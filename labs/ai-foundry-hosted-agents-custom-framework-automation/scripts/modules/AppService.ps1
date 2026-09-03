# AppService.ps1 - builds and deploys the companion demo (broker + console)
# to a single Linux App Service.
#
# This is the companion demo, not the official lab: the lab's main.bicep is not
# touched and produces no App Service outputs. The site is created here with
# `az` *after* the lab deployment, from values the lab already returns - see
# docs/04-app-service-decision.md for why one App Service rather than two.
#
# Architecture in one line: Express serves demo-app/dist AND /api from the same
# origin, so the browser holds no Azure credential, no APIM key and needs no
# CORS. The APIM subscription key travels from the deployment outputs straight
# into an application setting; it is never written to a versioned file.
#
# Windows PowerShell 5.1 compatible: no ternary, no ??, no chain operators.

Set-StrictMode -Version Latest

# Built-in role definitions the site's managed identity needs. Ids rather than
# names: names are localised in some CLI configurations, ids never change.
$script:RoleReader             = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'  # Reader
$script:RoleLogAnalyticsReader = '73c42c96-874c-492b-b04d-ab87d138a893'  # Log Analytics Reader
$script:RoleAcrPull            = '7f951dda-4ed3-4680-a7ca-43fe172d538d'  # AcrPull

# Same definition FoundryAgent.ps1 grants to the human principal; hosted agents
# cannot be created or deleted without it.
$script:RoleFoundryProjectManager = 'eadc314b-1a2d-4efa-be10-5d325db5065e'

<#
.SYNOPSIS
  Derives a globally-unique, DNS-legal web app name from the resource group.
.DESCRIPTION
  App Service names share one global namespace, so a fixed name would collide
  between two people running this lab. The suffix is a hash of the
  subscription + resource group, which makes the name stable across re-runs
  of the same deployment (so a re-run updates the site instead of creating a
  second one) while differing between deployments.
#>
function Get-DemoAppServiceName {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [string]$Prefix = 'hosted-agents-demo'
    )

    $seed = "$SubscriptionId/$ResourceGroupName".ToLowerInvariant()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($seed))
    }
    finally {
        $sha.Dispose()
    }
    $suffix = (($bytes | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 8)
    return "$Prefix-$suffix"
}

<#
.SYNOPSIS
  Builds the console and the broker into a single deployable folder.
.DESCRIPTION
  Layout produced (matches what broker/src/index.ts expects at runtime):

    <staging>/package.json      broker manifest, npm start -> node dist/index.js
    <staging>/src/**            broker TypeScript, compiled by Oryx on deploy
    <staging>/public/**         demo-app/dist, served by Express at /

  The console is built with VITE_BROKER_BASE_URL='/', which
  demo-app/src/config/env.ts reads as "same origin" - the deployed bundle then
  calls relative /api paths, so no broker URL is ever baked into the browser
  bundle and no CORS configuration is required.

  node_modules is deliberately NOT shipped: dependencies are restored on the
  App Service by Oryx. Zipping a Windows-built node_modules would ship
  platform-specific binaries that cannot run on Linux.
#>
<#
.SYNOPSIS
  Fails the build if operator-only tooling reached the deployable package.

.DESCRIPTION
  scripts/local/ holds tools meant for the presenter's own machine - cost
  management, resource deletion. None of it may ever be served from the public
  App Service.

  Today Build-DemoPackage copies an explicit list of paths, so nothing from
  scripts/local/ can arrive by accident. That is a property of the current
  implementation, not a guarantee: a future refactor that copies a directory
  wholesale, or adds a build step that sweeps the repository, would silently
  publish it. This turns "remember not to include it" into a build failure.

  Deliberately a hard failure and not a warning: a warning in a long deploy log
  is a warning nobody reads, and the thing being prevented is publishing a
  delete-my-infrastructure script to a public URL.
#>
function Assert-NoLocalOnlyContent {
    param([Parameter(Mandatory)][string]$StagingPath)

    $offenders = @(
        Get-ChildItem -Path $StagingPath -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object {
                $rel = $_.FullName.Substring($StagingPath.Length).TrimStart('\', '/')
                # Matches the folder at any depth, and any .ps1 that came with it.
                $rel -match '(^|[\\/])local([\\/]|$)' -or $rel -match '\.ps1$'
            } |
            ForEach-Object { $_.FullName.Substring($StagingPath.Length).TrimStart('\', '/') }
    )

    if ($offenders.Count -gt 0) {
        throw @(
            'Operator-only content reached the deployable package. Refusing to continue.'
            "  Staging : $StagingPath"
            "  Found   : $($offenders -join ', ')"
            '  Why     : scripts/local/ contains tools that delete infrastructure and'
            '            read billing data. They run on the presenter machine only and'
            '            must never be served from the public App Service.'
            '  Check   : Build-DemoPackage should copy only the broker sources and the'
            '            built console. Remove whatever new copy step pulled this in.'
        ) -join "`n"
    }

    Write-Info 'package contains no operator-only content'
}

function Build-DemoPackage {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$StagingPath,
        [Parameter(Mandatory)][string]$Region,
        [Parameter(Mandatory)][string]$ResourceGroupName
    )

    Write-Step 'Building the demo package (console + broker)'

    if (-not (Test-CommandExists 'npm')) {
        throw @(
            'npm was not found on PATH.',
            '  Check   : install Node.js 20 or later from https://nodejs.org and reopen the shell.'
        ) -join "`n"
    }

    $brokerDir  = Join-Path $RepoRoot 'broker'
    $demoAppDir = Join-Path $RepoRoot 'demo-app'
    foreach ($dir in @($brokerDir, $demoAppDir)) {
        if (-not (Test-Path $dir)) {
            throw "Expected the companion demo at '$dir'.`n  Check   : run this script from inside the hosted-agents-demo repository."
        }
    }

    Invoke-NpmCommand -WorkingDirectory $demoAppDir -Arguments @('ci') -What 'console dependencies'
    Invoke-NpmCommand -WorkingDirectory $demoAppDir -Arguments @('run', 'build') -What 'console build' -Environment @{
        # '/' is the same-origin marker: env.ts strips the trailing slash and
        # the bundle then calls relative /api paths. An empty string cannot be
        # used - PowerShell removes an empty environment variable entirely, so
        # Vite would fall back to the localhost default.
        VITE_BROKER_BASE_URL     = '/'
        VITE_DEFAULT_MODE        = 'live'
        VITE_REGION              = $Region
        VITE_RESOURCE_GROUP_NAME = $ResourceGroupName
    }

    $distDir = Join-Path $demoAppDir 'dist'
    $indexHtml = Join-Path $distDir 'index.html'
    if (-not (Test-Path $indexHtml)) {
        throw "The console build produced no dist/index.html in '$distDir'.`n  Check   : run 'npm run build' in demo-app manually to see the error."
    }

    # Vite fingerprints the bundle - /assets/index-<hash>.js - so the asset name
    # changes whenever the console's content changes. That makes it the one
    # reliable way to ask a deployed site "are you serving THIS build?", which is
    # what Publish-DemoAppService needs after a failed deploy: a site still
    # running the previous version answers /api/health perfectly well.
    $assetPath = ''
    $indexContent = Get-Content -Path $indexHtml -Raw
    $match = [regex]::Match($indexContent, '(?<path>/assets/[^"'']+\.js)')
    if ($match.Success) {
        $assetPath = $match.Groups['path'].Value
    }
    else {
        Write-Warn 'Could not find a fingerprinted /assets/*.js reference in dist/index.html.'
        Write-Warn '  A failed deployment will not be able to prove whether the new bundle landed,'
        Write-Warn '  and will be reported as failed rather than guessed at.'
    }

    if (Test-Path $StagingPath) { Remove-Item -Path $StagingPath -Recurse -Force }
    New-Item -ItemType Directory -Path $StagingPath | Out-Null

    Copy-Item -Path (Join-Path $brokerDir 'package.json')      -Destination $StagingPath
    Copy-Item -Path (Join-Path $brokerDir 'package-lock.json') -Destination $StagingPath
    Copy-Item -Path (Join-Path $brokerDir 'tsconfig.json')     -Destination $StagingPath
    Copy-Item -Path (Join-Path $brokerDir 'src')               -Destination $StagingPath -Recurse
    Copy-Item -Path $distDir -Destination (Join-Path $StagingPath 'public') -Recurse

    Assert-NoLocalOnlyContent -StagingPath $StagingPath

    Write-Ok "Package staged at $StagingPath"
    if ($assetPath) { Write-Info "build fingerprint: $assetPath" }

    return [pscustomobject]@{
        StagingPath = $StagingPath
        AssetPath   = $assetPath
    }
}

<#
.SYNOPSIS
  Runs npm in a given directory, failing loudly, with optional extra env vars.
.DESCRIPTION
  The environment variables are set for the duration of the call and restored
  afterwards, so a build variable cannot leak into the rest of the session.
#>
function Invoke-NpmCommand {
    param(
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$What,
        [hashtable]$Environment
    )

    Write-Info "run: npm $($Arguments -join ' ')  (in $WorkingDirectory)"

    $saved = @{}
    if ($Environment) {
        foreach ($key in $Environment.Keys) {
            $saved[$key] = [Environment]::GetEnvironmentVariable($key)
            [Environment]::SetEnvironmentVariable($key, $Environment[$key])
        }
    }

    $previous = Get-Location
    try {
        Set-Location -Path $WorkingDirectory
        $ErrorActionPreference = 'Continue'
        & npm @Arguments 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        $exit = $LASTEXITCODE
    }
    finally {
        Set-Location -Path $previous
        foreach ($key in $saved.Keys) {
            [Environment]::SetEnvironmentVariable($key, $saved[$key])
        }
    }

    if ($exit -ne 0) {
        throw @(
            "Step failed: $(Get-CurrentStep)",
            "  Command : npm $($Arguments -join ' ')",
            "  Where   : $WorkingDirectory ($What)",
            "  Exit    : $exit",
            '  Check   : re-run the same npm command in that folder to see the full output.'
        ) -join "`n"
    }
}

<#
.SYNOPSIS
  Creates (or reuses) the Linux App Service plan and web app, with a
  system-assigned managed identity.
.DESCRIPTION
  Idempotent: a second run of deploy.ps1 updates the existing site rather than
  failing. Returns the site's name, default hostname and principal id.
#>
function Initialize-DemoAppService {
    param(
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$Location,
        [Parameter(Mandatory)][string]$PlanName,
        [Parameter(Mandatory)][string]$SiteName,
        [Parameter(Mandatory)][string]$Sku,
        [Parameter(Mandatory)][string]$Runtime
    )

    Write-Step "Ensuring App Service '$SiteName' ($Sku, $Runtime)"

    $plan = Invoke-Az -Arguments @('appservice', 'plan', 'show', '-g', $ResourceGroupName, '-n', $PlanName, '-o', 'json') -AllowFailure
    if (-not ($plan.Success -and $plan.Json)) {
        Invoke-Az -Arguments @(
            'appservice', 'plan', 'create',
            '-g', $ResourceGroupName, '-n', $PlanName,
            '--location', $Location, '--sku', $Sku, '--is-linux', '-o', 'json'
        ) -Resource "App Service plan $PlanName" `
          -Hint "Some subscriptions cap Linux plans per region. Try another -Location or a different -AppServiceSku." | Out-Null
        Write-Ok "Created App Service plan '$PlanName'"
    }
    else {
        Write-Ok "Using existing App Service plan '$PlanName'"
    }

    $site = Invoke-Az -Arguments @('webapp', 'show', '-g', $ResourceGroupName, '-n', $SiteName, '-o', 'json') -AllowFailure
    if (-not ($site.Success -and $site.Json)) {
        Invoke-Az -Arguments @(
            'webapp', 'create',
            '-g', $ResourceGroupName, '-p', $PlanName, '-n', $SiteName,
            '--runtime', $Runtime, '-o', 'json'
        ) -Resource "web app $SiteName" `
          -Hint 'The name must be globally unique. If it is taken, pass -AppServiceName explicitly.' | Out-Null
        Write-Ok "Created web app '$SiteName'"
    }
    else {
        Write-Ok "Using existing web app '$SiteName'"
    }

    # HTTPS only + a modern TLS floor + no FTP: the site holds an APIM key in
    # its configuration and authenticates to Azure with a managed identity.
    Invoke-Az -Arguments @(
        'webapp', 'update', '-g', $ResourceGroupName, '-n', $SiteName,
        '--https-only', 'true', '--set', 'siteConfig.minTlsVersion=1.2', '-o', 'json'
    ) -Resource "web app $SiteName" | Out-Null
    Invoke-Az -Arguments @(
        'webapp', 'config', 'set', '-g', $ResourceGroupName, '-n', $SiteName,
        '--ftps-state', 'Disabled',
        # 'cd ... && npm start', not a bare 'npm start'. Setting a custom startup
        # command replaces the startup script Oryx generates, and the replacement
        # runs from / rather than from the site root - npm then reads /package.json,
        # fails with ENOENT and the container exits 254 before Node ever starts.
        # Verified the hard way: the build succeeded and the site still would not boot.
        '--startup-file', 'cd /home/site/wwwroot && npm start',
        '-o', 'json'
    ) -Resource "site configuration for $SiteName" | Out-Null

    # Always On removes the cold start that would otherwise hit the first
    # click of a presentation. Separate and non-fatal because the Free and
    # Shared tiers do not support it - the demo still works without it.
    $alwaysOn = Invoke-Az -Arguments @(
        'webapp', 'config', 'set', '-g', $ResourceGroupName, '-n', $SiteName,
        '--always-on', 'true', '-o', 'json'
    ) -AllowFailure
    if (-not $alwaysOn.Success) {
        Write-Warn "Always On could not be enabled on '$Sku'; the site will cold-start after idling."
    }

    $identity = Invoke-Az -Arguments @(
        'webapp', 'identity', 'assign', '-g', $ResourceGroupName, '-n', $SiteName, '-o', 'json'
    ) -AsJson -Resource "managed identity for $SiteName" `
      -Hint 'Assigning a system-assigned identity requires write access on the web app.'

    $principalId = Get-RequiredProperty -Object $identity -Name 'principalId' `
        -Context "output of 'az webapp identity assign'" `
        -Hint 'The site must have a system-assigned managed identity: the broker authenticates to Azure with it and holds no static credential.'

    $shown = Invoke-Az -Arguments @('webapp', 'show', '-g', $ResourceGroupName, '-n', $SiteName, '-o', 'json') -AsJson
    $hostName = Get-RequiredProperty -Object $shown -Name 'defaultHostName' `
        -Context "output of 'az webapp show'" -Hint 'The site record is incomplete; check it in the portal.'

    Write-Ok "Managed identity principal: $principalId"

    return [pscustomobject]@{
        Name        = $SiteName
        PlanName    = $PlanName
        HostName    = $hostName
        Url         = "https://$hostName"
        PrincipalId = $principalId
    }
}

<#
.SYNOPSIS
  Grants the site's managed identity exactly the read/manage rights the broker
  uses, and nothing more.
.DESCRIPTION
  What each grant is for, traced to the code that needs it:
    Reader on the resource group     - ARM GETs in routes/controls.ts,
                                       routes/policy.ts, routes/environment.ts,
                                       routes/maintenance.ts.
    Log Analytics Reader             - api.loganalytics.io queries in
                                       routes/journey.ts, observability.ts,
                                       auditRecord.ts.
    AcrPull on the registry          - manifest metadata in src/acr.ts.
    Foundry Project Manager          - agent create/delete in the agents
                                       routes; granted by the caller through
                                       Grant-FoundryProjectManagerRole, the
                                       same function the human principal uses.

  A failed grant is FATAL. A demo that starts without these roles looks healthy
  - the broker answers /api/health, which touches no Azure resource - and then
  fails panel by panel in front of an audience. Failing here, with the scope
  and the Azure error, is the honest outcome.
#>
function Grant-DemoAppServiceRoles {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$PrincipalId,
        [Parameter(Mandatory)][string]$ContainerRegistryName,
        [Parameter(Mandatory)][string]$LogAnalyticsWorkspaceName
    )

    Write-Step 'Granting the App Service identity read access to the lab resources'

    $rgScope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName"

    Grant-RoleIfMissing -PrincipalId $PrincipalId -RoleId $script:RoleReader `
        -Scope $rgScope -Description 'Reader on the resource group'

    Grant-RoleIfMissing -PrincipalId $PrincipalId -RoleId $script:RoleAcrPull `
        -Scope "$rgScope/providers/Microsoft.ContainerRegistry/registries/$ContainerRegistryName" `
        -Description "AcrPull on $ContainerRegistryName"

    if (-not $LogAnalyticsWorkspaceName) {
        throw @(
            'The Log Analytics workspace backing this deployment could not be resolved,',
            'so the Log Analytics Reader grant cannot be scoped.',
            "  Check   : az monitor log-analytics workspace list -g $ResourceGroupName",
            "            one workspace there must carry the customerId the deployment output",
            "            'logAnalyticsWorkspaceId' returned (see Get-WorkspaceNameByCustomerId).",
            '  Without it the observability and audit panels fail with an authorization error.'
        ) -join "`n"
    }

    Grant-RoleIfMissing -PrincipalId $PrincipalId -RoleId $script:RoleLogAnalyticsReader `
        -Scope "$rgScope/providers/Microsoft.OperationalInsights/workspaces/$LogAnalyticsWorkspaceName" `
        -Description "Log Analytics Reader on $LogAnalyticsWorkspaceName"
}

<#
.SYNOPSIS
  Creates one role assignment, retrying only while the identity is still
  propagating.
.DESCRIPTION
  A system-assigned managed identity is visible to ARM before it is visible to
  the RBAC service, so a `role assignment create` issued seconds after
  `webapp identity assign` can legitimately fail with PrincipalNotFound. That
  is the ONLY failure retried here, and only three times: an AuthorizationFailed
  (the caller may not create role assignments) will never fix itself by waiting,
  so it is reported immediately.

  Anything still failing after the retries throws. See the note on
  Grant-DemoAppServiceRoles for why a missing grant must not be survivable.
#>
function Grant-RoleIfMissing {
    param(
        [Parameter(Mandatory)][string]$PrincipalId,
        [Parameter(Mandatory)][string]$RoleId,
        [Parameter(Mandatory)][string]$Scope,
        [Parameter(Mandatory)][string]$Description,
        [int]$MaxAttempts = 3,
        [int]$RetryDelaySeconds = 10
    )

    $existing = Invoke-Az -Arguments @(
        'role', 'assignment', 'list',
        '--assignee', $PrincipalId, '--scope', $Scope, '--role', $RoleId,
        '--include-inherited', '-o', 'json'
    ) -AllowFailure

    if ($existing.Success -and $null -ne $existing.Json -and @($existing.Json).Count -gt 0) {
        Write-Ok "$Description (already granted)"
        return
    }

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $create = Invoke-Az -Arguments @(
            'role', 'assignment', 'create',
            '--assignee-object-id', $PrincipalId,
            '--assignee-principal-type', 'ServicePrincipal',
            '--role', $RoleId, '--scope', $Scope, '-o', 'json'
        ) -AllowFailure

        if ($create.Success) {
            Write-Ok $Description
            return
        }

        $azureError = ''
        if ($create.Error) { $azureError = $create.Error.Trim() }

        # A concurrent or inherited assignment the list above did not see.
        if ($azureError -match 'RoleAssignmentExists') {
            Write-Ok "$Description (already granted)"
            return
        }

        $stillPropagating = ($azureError -match 'PrincipalNotFound') -or
                            ($azureError -match 'does not exist in the directory')

        if (-not $stillPropagating -or $attempt -eq $MaxAttempts) {
            throw @(
                "Could not grant: $Description",
                "  Scope   : $Scope",
                "  Azure   : $azureError",
                "  Attempts: $attempt of $MaxAttempts",
                '  Check   : granting roles needs Owner, or Contributor + Role Based Access Control',
                '            Administrator, on the resource group. Re-run with -SkipInfrastructure',
                '            -SkipImageBuild -SkipAgent once the permission is in place.'
            ) -join "`n"
        }

        Write-Warn "$Description - identity not visible to RBAC yet (attempt $attempt/$MaxAttempts), retrying in ${RetryDelaySeconds}s"
        Start-Sleep -Seconds $RetryDelaySeconds
    }
}

<#
.SYNOPSIS
  Grants Foundry Project Manager on the agent project to the site's identity.
.DESCRIPTION
  Deliberately separate from FoundryAgent.ps1's Grant-FoundryProjectManagerRole,
  which is warn-and-continue because it is a safety net for a human principal
  the lab's Bicep has usually already granted. For the managed identity the
  grant is the only source of the permission and is subject to the propagation
  delay above, so it goes through Grant-RoleIfMissing: retried, then fatal.
  The scope is built by the lab automation's own parser, so both paths address
  the project identically.
#>
function Grant-FoundryProjectManagerRoleToIdentity {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$PrincipalId
    )

    Write-Step 'Granting the App Service identity Foundry Project Manager on the agent project'

    $parts = Split-FoundryProjectEndpoint -Endpoint $ProjectEndpoint
    $scope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName" +
             "/providers/Microsoft.CognitiveServices/accounts/$($parts.AccountName)/projects/$($parts.ProjectName)"

    Grant-RoleIfMissing -PrincipalId $PrincipalId -RoleId $script:RoleFoundryProjectManager `
        -Scope $scope -Description "Foundry Project Manager on $($parts.ProjectName)"
}

<#
.SYNOPSIS
  Writes the broker's configuration as App Service application settings.
.DESCRIPTION
  This is the only place the APIM subscription key leaves the deployment
  outputs. It is passed through an @file argument rather than the command
  line, so it never appears in a process listing or in the transcript
  Invoke-Az prints, and the temporary file is deleted in a finally block. It
  is never written to a versioned file.

  No AZURE_* credential is set: the broker authenticates with the site's
  managed identity through DefaultAzureCredential (broker/src/azureAuth.ts).
#>
function Set-DemoAppServiceSettings {
    param(
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$SiteName,
        [Parameter(Mandatory)][hashtable]$Settings
    )

    Write-Step 'Applying broker configuration as application settings'

    $file = Join-Path ([System.IO.Path]::GetTempPath()) ("appsettings-{0}.json" -f ([guid]::NewGuid().ToString('N')))
    try {
        $payload = @()
        foreach ($key in ($Settings.Keys | Sort-Object)) {
            $payload += [ordered]@{ name = $key; value = [string]$Settings[$key]; slotSetting = $false }
        }
        # ConvertTo-Json unwraps a single-element array; the API needs a list.
        $json = ConvertTo-Json -InputObject @($payload) -Depth 4
        Set-Content -Path $file -Value $json -Encoding utf8

        Invoke-Az -Arguments @(
            'webapp', 'config', 'appsettings', 'set',
            '-g', $ResourceGroupName, '-n', $SiteName,
            '--settings', "@$file", '-o', 'none'
        ) -Resource "application settings for $SiteName" `
          -Hint 'The site must exist and you need write access to its configuration.' | Out-Null
    }
    finally {
        Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    }

    $names = ($Settings.Keys | Sort-Object) -join ', '
    Write-Ok "Applied $($Settings.Count) settings: $names"
    Write-Info 'APIM_SUBSCRIPTION_KEY was passed as a secret setting and is not echoed here.'
}

<#
.SYNOPSIS
  Zips a directory with forward-slash entry names.
.DESCRIPTION
  Not Compress-Archive: in Windows PowerShell 5.1 it writes entry paths with
  backslashes, and the Linux-side extraction then produces literal files named
  "public\index.html" instead of a public/ directory - the site would deploy
  successfully and serve nothing. Writing the entries directly is the only way
  to guarantee the separator on 5.1.
#>
function New-ZipFromDirectory {
    param(
        [Parameter(Mandatory)][string]$SourceDirectory,
        [Parameter(Mandatory)][string]$DestinationPath
    )

    Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

    if (Test-Path $DestinationPath) { Remove-Item -Path $DestinationPath -Force }

    $root = (Resolve-Path $SourceDirectory).Path.TrimEnd('\')
    $archive = [System.IO.Compression.ZipFile]::Open($DestinationPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in (Get-ChildItem -Path $root -Recurse -File -Force)) {
            $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $file.FullName, $relative,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
}

<#
.SYNOPSIS
  Lists the site's deployment records (Kudu), newest first.
.DESCRIPTION
  This is App Service's own record of what was deployed and whether it worked -
  the authoritative signal, independent of anything the application serves.
  Kudu's status codes: 3 = Failed, 4 = Success. Returns an empty array when the
  records cannot be read, so callers degrade instead of failing while gathering
  evidence.
#>
function Get-SiteDeployments {
    param(
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$SiteName
    )

    $result = Invoke-Az -Arguments @(
        'webapp', 'log', 'deployment', 'list',
        '-g', $ResourceGroupName, '-n', $SiteName, '-o', 'json'
    ) -AllowFailure

    if ($result.Success -and $null -ne $result.Json) { return @($result.Json) }
    return @()
}

<#
.SYNOPSIS
  Zips the staged package and deploys it, letting Oryx install and build.

.DESCRIPTION
  `az webapp deploy` reports failure for two very different situations, and its
  own message does not distinguish them:

    * the upload or the Oryx build genuinely failed, or
    * both succeeded and the site simply did not answer the platform's start
      probe in time - the deployed code is on the box but the process exits.

  The second is what a wrong startup command looks like, and the CLI's generic
  "site failed to start within 10 mins" sends the operator hunting in the wrong
  place. So on failure this probes /api/health itself: an answering site means
  the deployment landed and the CLI was merely impatient; a silent one means the
  process is not staying up, and the exact log commands are printed.

  The failure is always re-raised. This adds diagnosis, never tolerance.
#>
function Publish-DemoAppService {
    param(
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$SiteName,
        [Parameter(Mandatory)][string]$StagingPath,
        [string]$Url = '',
        [string]$AssetPath = '',
        # How many times to send the same package before giving up. See the
        # retry block below for why one failure shape is worth repeating and
        # the others are not.
        [int]$MaxAttempts = 2
    )

    Write-Step "Deploying the package to '$SiteName'"
    Write-Info 'App Service installs dependencies and compiles the broker on the way in; expect roughly 2-4 minutes.'
    Write-Info 'A build-stage rejection is retried once: it leaves the site unbootable, and a completed rebuild is the repair.'

    # The package is built once and re-sent unchanged on a retry: the bytes were
    # never in question, only whether App Service finished building them.
    $zipPath = Join-Path ([System.IO.Path]::GetTempPath()) ("hosted-agents-demo-{0}.zip" -f ([guid]::NewGuid().ToString('N')))
    try {
        New-ZipFromDirectory -SourceDirectory $StagingPath -DestinationPath $zipPath

        for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {

            # Baseline of App Service's own deployment records. After a CLI failure the
            # decisive question is whether a NEW record appeared and succeeded - which is
            # true even when the console bundle is byte-identical to the deployed one and
            # its Vite fingerprint therefore cannot tell the two apart. Re-read on every
            # attempt, so a retry is judged against what the attempt before it left.
            $deploymentsBefore = Get-SiteDeployments -ResourceGroupName $ResourceGroupName -SiteName $SiteName
            $idsBefore = @($deploymentsBefore | ForEach-Object { [string]$_.id })

            $result = Invoke-Az -Arguments @(
                'webapp', 'deploy',
                '-g', $ResourceGroupName, '-n', $SiteName,
                '--src-path', $zipPath, '--type', 'zip', '--async', 'false', '-o', 'json'
            ) -AllowFailure

            if ($result.Success) {
                Write-Ok 'Package deployed'
                return
            }

            $azureError = ''
            if ($result.Error) { $azureError = $result.Error.Trim() }

            Write-Warn 'az webapp deploy reported a failure. Establishing what actually reached the site.'

            # Primary evidence: App Service's own deployment record. A new id that
            # completed with Kudu status 4 means the package arrived and was accepted,
            # whatever the CLI said. This is what makes the check hermetic on a re-run
            # where the console is unchanged and its Vite fingerprint is identical.
            $deploymentsAfter = Get-SiteDeployments -ResourceGroupName $ResourceGroupName -SiteName $SiteName
            $newDeployments = @($deploymentsAfter | Where-Object { $idsBefore -notcontains [string]$_.id })
            $succeededDeployments = @($newDeployments | Where-Object {
                $_.complete -eq $true -and (Test-HasProperty -Object $_ -Name 'status') -and ([int]$_.status -eq 4)
            })

            # Secondary, corroborating signals, used to word the diagnosis.
            $newAssetServed = $false
            $siteAnswersHealth = $false

            if ($Url -and $AssetPath) {
                try {
                    $assetProbe = Invoke-WebRequest -Uri "$Url$AssetPath" -UseBasicParsing -TimeoutSec 30
                    if ($assetProbe.StatusCode -eq 200) { $newAssetServed = $true }
                }
                catch {
                    $newAssetServed = $false
                }
            }

            if ($Url) {
                try {
                    $healthProbe = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 30
                    if ($healthProbe.StatusCode -eq 200) { $siteAnswersHealth = $true }
                }
                catch {
                    $siteAnswersHealth = $false
                }
            }

            if ($succeededDeployments.Count -gt 0) {
                $landed = $succeededDeployments[0]
                Write-Warn 'App Service DID accept this deployment, despite the CLI reporting a failure.'
                Write-Warn "  Proof: a new deployment record completed successfully - id $($landed.id)."
                Write-Warn '  The package landed; the CLI most likely timed out waiting for the start probe.'
                if ($AssetPath -and $newAssetServed) { Write-Warn "  The site is also serving $AssetPath." }
                Write-Warn '  The health check that follows remains the authority on whether the demo works.'
                return
            }

            # The one failure shape worth repeating automatically, and the reason
            # this loop exists: the package ARRIVED and App Service rejected it
            # while building. Observed 2026-09-03 - Oryx hung extracting the Node
            # SDK, the step that takes ~15 s when it works, and never reached
            # `npm install`. Nothing about the package caused it; the identical
            # package succeeded on the next run.
            #
            # It matters because that failure is DESTRUCTIVE, not inert. The build
            # runs in place against the live /home/site/wwwroot, so a half-finished
            # one leaves the site with no oryx-manifest.toml - and the startup
            # script reads that file to learn node_modules is a tar.gz it has to
            # extract. Without it the site boots against an empty node_modules,
            # cannot resolve 'express', and restart-loops into a 503. The previous
            # version is NOT still serving: a partial build takes production down.
            #
            # Re-sending the same package is the repair, because a build that runs
            # to completion rewrites the manifest and the tarball. That is exactly
            # how the site was recovered by hand that day. Doing it here is the
            # difference between a transient Azure-side hang costing one retry and
            # costing an outage that waits for a human.
            #
            # Deliberately NOT retried: a run that produced no new deployment
            # record at all. That is a transfer or authentication failure, the
            # package never reached the site, nothing was disturbed, and repeating
            # it just fails the same way more slowly.
            if ($newDeployments.Count -gt 0 -and $attempt -lt $MaxAttempts) {
                Write-Warn "The package arrived but App Service rejected it while building (attempt $attempt of $MaxAttempts)."
                Write-Warn '  That leaves the site unbootable rather than on its previous version, so this'
                Write-Warn '  is repaired now rather than left for a human: the same package is being sent'
                Write-Warn '  again, and a build that completes rewrites the manifest the startup needs.'
                Start-Sleep -Seconds 30
                continue
            }

            break
        }
    }
    finally {
        Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    }

    # Everything below is a genuine failure. The shapes are distinguished because
    # they send the operator to completely different places.
    $lines = @(
        "Step failed: $(Get-CurrentStep)",
        "  Resource: deployment to $SiteName in $ResourceGroupName",
        "  Attempts: $MaxAttempts (a build-stage rejection is retried once automatically;"
        '            a package that never arrived is not, because nothing was disturbed).'
    )

    if ($newDeployments.Count -gt 0) {
        $rec = $newDeployments[0]
        $recStatus = '(unknown)'
        if (Test-HasProperty -Object $rec -Name 'status') { $recStatus = [string]$rec.status }
        $lines += "  State   : the package ARRIVED but App Service did not accept it."
        $lines += "            New deployment id $($rec.id), status $recStatus (4 = success, 3 = failed),"
        $lines += "            complete=$($rec.complete). This is a build or startup failure, not a transfer one."
    }
    elseif ($siteAnswersHealth) {
        $lines += '  State   : NO new deployment record exists, and the PREVIOUS version is still serving.'
        $lines += '            /api/health answers 200 from the old process; this run changed nothing.'
        $lines += '            The demo is still up on the previous build.'
    }
    else {
        $lines += '  State   : no new deployment record, and the site answers neither the bundle nor /api/health.'
        $lines += '            The package never arrived and the site is not healthy.'
    }

    if ($AssetPath) {
        $lines += "  Bundle  : $AssetPath served = $newAssetServed (identical console content across runs"
        $lines += '            produces an identical fingerprint, so this is corroboration, not proof).'
    }

    if ($azureError) { $lines += "  Azure   : $($azureError.Split("`n")[-1])" }

    $lines += @(
        '  Diagnose in this order:',
        "    1. az webapp log deployment show -g $ResourceGroupName -n $SiteName",
        '         Did Oryx install dependencies and run the build? A failure here is a build problem,',
        '         and means the package arrived but could not be compiled.',
        "    2. az webapp log tail -g $ResourceGroupName -n $SiteName",
        '         Shows what the Node process printed. Two failures look alike but are not:',
        "         - 'Missing required environment variable: X' means an application setting did not arrive.",
        "         - 'npm error path /package.json' means the startup command is running from the wrong",
        '           directory; it must be: cd /home/site/wwwroot && npm start',
        "    3. az webapp config show -g $ResourceGroupName -n $SiteName --query appCommandLine",
        '         Confirms the startup command actually stored on the site.'
    )
    throw ($lines -join "`n")
}

<#
.SYNOPSIS
  Polls the deployed site until the broker answers on /api/health.
.DESCRIPTION
  The broker refuses to start when a required environment variable is missing
  (broker/src/config.ts), so a healthy /api/health is real evidence that every
  setting arrived and that the managed identity resolved - not just that the
  container started. The root document is checked too, which is what proves
  the console bundle is actually being served from the same origin.
#>
function Wait-DemoAppServiceHealthy {
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$SiteName,
        [int]$TimeoutSeconds = 300
    )

    Write-Step 'Waiting for the demo to answer'

    $healthUrl = "$Url/api/health"
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = 'no response yet'

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 20
            if ($response.StatusCode -eq 200) {
                Write-Ok "Broker healthy at $healthUrl"

                try {
                    $root = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
                    if ($root.StatusCode -eq 200 -and $root.Content -match '<div id="root"') {
                        Write-Ok 'Console served from the same origin'
                    }
                    else {
                        Write-Warn 'The broker is healthy but the root document does not look like the console bundle.'
                        Write-Warn '  Check : the package must contain public/index.html (see Build-DemoPackage).'
                    }
                }
                catch {
                    Write-Warn "The broker is healthy but the root document could not be fetched: $($_.Exception.Message)"
                }

                Test-DemoAzureReachable -Url $Url
                return $true
            }
            $lastError = "HTTP $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 10
    }

    Write-Warn "The demo did not become healthy within $TimeoutSeconds seconds (last: $lastError)."
    Write-Warn "  Check : az webapp log tail -g $ResourceGroupName -n $SiteName"
    Write-Warn '  A missing required environment variable makes the broker exit on start - the log names it.'
    return $false
}

<#
.SYNOPSIS
  Reports whether the deployed broker can actually reach Azure.
.DESCRIPTION
  /api/health answers from process state alone - it proves the broker started
  with a complete configuration, and nothing else. This separates the third
  failure mode from the first two: the site is up, the console is served, but
  the managed identity cannot read the subscription.

  /api/environment is the cheapest route that makes a real ARM call. It
  deliberately degrades rather than erroring (routes/environment.ts returns an
  empty list when the ARM call fails), so the signal is the resource COUNT: at
  this point the resource group holds APIM, two Foundry accounts, ACR, Log
  Analytics and this site, so a zero means the ARM read failed - almost always
  RBAC that has not propagated yet.

  Informational only. RBAC can take a few minutes to take effect and the
  deployment is not wrong because of it.
#>
function Test-DemoAzureReachable {
    param([Parameter(Mandatory)][string]$Url)

    try {
        $response = Invoke-WebRequest -Uri "$Url/api/environment" -UseBasicParsing -TimeoutSec 30
        $body = $response.Content | ConvertFrom-Json
        $count = 0
        if (Test-HasProperty -Object $body -Name 'resourceCount') { $count = [int]$body.resourceCount }

        if ($count -gt 0) {
            Write-Ok "Azure reachable from the site: $count resources read with the managed identity"
        }
        else {
            Write-Warn 'The broker is healthy but read 0 resources from Azure.'
            Write-Warn '  The managed identity cannot read the resource group yet. Role assignments'
            Write-Warn '  can take a few minutes to take effect - re-check the console shortly.'
        }
    }
    catch {
        Write-Warn "The broker is healthy but /api/environment failed: $($_.Exception.Message)"
        Write-Warn '  The console will load; panels backed by Azure will report the error.'
    }
}

<#
.SYNOPSIS
  Resolves the Log Analytics workspace NAME from its customerId GUID.
.DESCRIPTION
  The lab's main.bicep outputs `logAnalyticsWorkspaceId`, which is the
  workspace's customerId - the value the query API needs, but not a resource
  id, so it cannot be used as a role-assignment scope. The workspace in the
  resource group carrying that customerId is the one to scope the grant to.
  Returns an empty string when it cannot be resolved; the caller warns.
#>
function Get-WorkspaceNameByCustomerId {
    param(
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$CustomerId
    )

    $list = Invoke-Az -Arguments @(
        'monitor', 'log-analytics', 'workspace', 'list',
        '-g', $ResourceGroupName, '-o', 'json'
    ) -AllowFailure

    if (-not ($list.Success -and $list.Json)) { return '' }

    foreach ($workspace in @($list.Json)) {
        if ((Test-HasProperty -Object $workspace -Name 'customerId') -and $workspace.customerId -eq $CustomerId) {
            return [string]$workspace.name
        }
    }
    return ''
}
