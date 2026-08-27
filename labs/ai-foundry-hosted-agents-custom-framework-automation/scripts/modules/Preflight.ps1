# Preflight.ps1 - prerequisite, authentication and subscription validation.
# Nothing here modifies Azure.

Set-StrictMode -Version Latest

# The official hosted-agent documentation requires Azure CLI 2.80 or later.
$script:MinAzCliVersion = [version]'2.80.0'

function Test-Prerequisites {
    param([switch]$RequireNode)

    Write-Step 'Validating prerequisites (Azure CLI)'

    if (-not (Test-CommandExists 'az')) {
        throw @(
            'Azure CLI (az) was not found on PATH.',
            '  Check   : install it from https://learn.microsoft.com/cli/azure/install-azure-cli and reopen the shell.'
        ) -join "`n"
    }

    $version = Invoke-Az -Arguments @('version', '-o', 'json') -AsJson
    $rawVersion = Get-RequiredProperty -Object $version -Name 'azure-cli' `
        -Context "output of 'az version'" -Hint "Run 'az version' manually; the CLI installation may be broken."
    $cliVersion = [version]$rawVersion
    if ($cliVersion -lt $script:MinAzCliVersion) {
        throw @(
            "Azure CLI $cliVersion is too old for Foundry hosted agents.",
            "  Check   : the hosted-agent REST API requires $($script:MinAzCliVersion) or later. Run 'az upgrade'."
        ) -join "`n"
    }
    Write-Ok "Azure CLI $cliVersion"

    # Checked here rather than at the point of use: the companion demo is built
    # after ~10 minutes of Azure work, and a missing toolchain should stop the
    # run in the first seconds, not at the end.
    if ($RequireNode) {
        if (-not (Test-CommandExists 'npm')) {
            throw @(
                'npm was not found on PATH, and the companion demo application must be built locally.',
                '  Check   : install Node.js 20 or later from https://nodejs.org and reopen the shell,',
                '            or re-run with -SkipDemoApp to deploy only the lab and the hosted agent.'
            ) -join "`n"
        }
        Write-Ok 'npm found'
    }
}

<#
.SYNOPSIS
  Warns when soft-deleted resources from a previous incarnation of the target
  resource group could collide with this deployment.

.DESCRIPTION
  The official lab names most resources from uniqueString(resourceGroup().id).
  That id is derived from the subscription and the resource group NAME, so
  re-creating a resource group with the same name in the same subscription
  reproduces exactly the same resource names.

  When the previous resource group was deleted recently, its resources are not
  gone: API Management and Cognitive Services stay recoverable for about 48
  hours, Log Analytics for up to 14 days. A new deployment into the same name
  then either fails with a Conflict ("resource already exists ... pending
  delete") or, worse, silently RESTORES the old resource - which is how a
  Foundry project came back carrying agent versions from a previous run.

  This check is deliberately advisory. A name match here is not proof of a
  collision: the previous resource may already be purged by the time the
  deployment reaches it, and the retry in Invoke-LabDeployment exists precisely
  for that race. Aborting a healthy deployment on a heuristic would be worse
  than the problem.

  Limitation, stated rather than guessed: the resource NAMES cannot be computed
  locally, because uniqueString is an ARM-side hash that is not reproducible in
  PowerShell. The check therefore matches on the resource group name recorded
  in each deleted resource, which is what these three APIs expose:
    - az apim deletedservice list          -> serviceId contains /resourceGroups/<rg>/
    - az cognitiveservices account list-deleted -> id contains /resourceGroups/<rg>/
    - az monitor log-analytics workspace list-deleted-workspaces -> resourceGroup field
  Container Registry and App Service have no soft-delete surface to query, so
  they are not checked; neither has ever produced this failure.
#>
function Test-SoftDeletedCollisions {
    param([Parameter(Mandatory)][string]$ResourceGroupName)

    Write-Step "Checking for soft-deleted resources from a previous '$ResourceGroupName'"

    $needle = "/resourcegroups/$($ResourceGroupName.ToLowerInvariant())/"
    $found = @()

    # Each block below tests only .Success, never .Json. An empty JSON array is
    # falsy in PowerShell, so "$x.Success -and $x.Json" reported the overwhelmingly
    # common case - nothing soft-deleted at all - as "could not list (skipped)",
    # i.e. as if the check had not run. @() around a $null Json keeps the loop
    # safe when a listing really does come back empty or unparsable.

    # --- API Management (recoverable ~48h, name reserved until purged) --------
    $apim = Invoke-Az -Arguments @('apim', 'deletedservice', 'list', '-o', 'json') -AllowFailure
    if ($apim.Success) {
        foreach ($svc in @($apim.Json)) {
            $serviceId = ''
            if (Test-HasProperty -Object $svc -Name 'serviceId') { $serviceId = [string]$svc.serviceId }
            if ($serviceId.ToLowerInvariant().Contains($needle)) {
                $purge = '(unknown)'
                if (Test-HasProperty -Object $svc -Name 'scheduledPurgeDate') { $purge = [string]$svc.scheduledPurgeDate }
                $found += "API Management '$($svc.name)' - scheduled purge: $purge"
            }
        }
    }
    else {
        Write-Info 'could not list deleted API Management services (skipped)'
    }

    # --- Cognitive Services / Foundry (recoverable ~48h) ----------------------
    # No resourceGroup field on these records; the resource id carries it.
    $cog = Invoke-Az -Arguments @('cognitiveservices', 'account', 'list-deleted', '-o', 'json') -AllowFailure
    if ($cog.Success) {
        foreach ($acct in @($cog.Json)) {
            $id = ''
            if (Test-HasProperty -Object $acct -Name 'id') { $id = [string]$acct.id }
            if ($id.ToLowerInvariant().Contains($needle)) {
                $found += "Cognitive Services / Foundry account '$($acct.name)'"
            }
        }
    }
    else {
        Write-Info 'could not list deleted Cognitive Services accounts (skipped)'
    }

    # --- Log Analytics (recoverable up to 14 days) ---------------------------
    $law = Invoke-Az -Arguments @('monitor', 'log-analytics', 'workspace', 'list-deleted-workspaces', '-o', 'json') -AllowFailure
    if ($law.Success) {
        foreach ($ws in @($law.Json)) {
            $wsRg = ''
            if (Test-HasProperty -Object $ws -Name 'resourceGroup') { $wsRg = [string]$ws.resourceGroup }
            if ($wsRg -and $wsRg.ToLowerInvariant() -eq $ResourceGroupName.ToLowerInvariant()) {
                $found += "Log Analytics workspace '$($ws.name)'"
            }
        }
    }
    else {
        Write-Info 'could not list deleted Log Analytics workspaces (skipped)'
    }

    if ($found.Count -eq 0) {
        Write-Ok 'No soft-deleted resources found for this resource group name'
        return
    }

    Write-Warn "Found $($found.Count) soft-deleted resource(s) belonging to a previous '$ResourceGroupName':"
    foreach ($item in $found) { Write-Warn "    - $item" }
    Write-Warn ''
    Write-Warn '  The lab derives resource names from uniqueString(resourceGroup().id), so this'
    Write-Warn '  deployment will ask for exactly those names again. Azure may either block the'
    Write-Warn '  creation with a Conflict, or restore the deleted resource together with its old'
    Write-Warn '  contents - a restored Foundry project brings back its previous agent versions.'
    Write-Warn ''
    Write-Warn '  Three ways forward:'
    Write-Warn '    1. Wait for Azure to finish the retention window (APIM and Foundry ~48h,'
    Write-Warn '       Log Analytics up to 14 days) and re-run.'
    Write-Warn '    2. Purge the resources explicitly, if your subscription policy allows it.'
    Write-Warn '    3. Re-run with a different -ResourceGroupName for a genuinely clean environment.'
    Write-Warn ''
    Write-Warn '  Continuing anyway: a name match is not proof of a collision, and transient'
    Write-Warn '  conflicts are retried automatically during the deployment step.'
}

function Test-Authentication {
    param([string]$SubscriptionId)

    Write-Step 'Validating Azure authentication and subscription'

    $account = Invoke-Az -Arguments @('account', 'show', '-o', 'json') -AllowFailure
    if (-not $account.Success) {
        throw @(
            'Not signed in to Azure.',
            "  Check   : run 'az login' (and 'az account set --subscription <id>') then re-run this script."
        ) -join "`n"
    }

    if ($SubscriptionId) {
        Write-Info "selecting subscription $SubscriptionId"
        Invoke-Az -Arguments @('account', 'set', '--subscription', $SubscriptionId) `
            -Resource "subscription $SubscriptionId" `
            -Hint 'Confirm the subscription id exists and your account has access to it.' | Out-Null
    }

    $account = Invoke-Az -Arguments @('account', 'show', '-o', 'json') -AsJson

    # The lab grants the signed-in principal a Foundry role on both Foundry
    # resources. `az ad signed-in-user show` only works for a user principal;
    # a service principal must supply its object id explicitly.
    $signedIn = Invoke-Az -Arguments @('ad', 'signed-in-user', 'show', '-o', 'json') -AllowFailure
    $objectId = $null
    if ($signedIn.Success -and $signedIn.Json -and (Test-HasProperty -Object $signedIn.Json -Name 'id')) {
        $objectId = $signedIn.Json.id
    }

    # Every one of these feeds a role-assignment scope or an output file; none may
    # be allowed to become $null silently.
    $accountHint = "Run 'az account show' manually and confirm the CLI is returning a complete account record."
    $user = Get-RequiredProperty -Object $account -Name 'user' -Context "output of 'az account show'" -Hint $accountHint

    $userType = ''
    if (Test-HasProperty -Object $user -Name 'type') { $userType = [string]$user.type }

    $ctx = [pscustomobject]@{
        SubscriptionId    = Get-RequiredProperty -Object $account -Name 'id'       -Context "output of 'az account show'" -Hint $accountHint
        SubscriptionName  = Get-RequiredProperty -Object $account -Name 'name'     -Context "output of 'az account show'" -Hint $accountHint
        TenantId          = Get-RequiredProperty -Object $account -Name 'tenantId' -Context "output of 'az account show'" -Hint $accountHint
        UserName          = Get-RequiredProperty -Object $user    -Name 'name'     -Context "output of 'az account show'" -Hint $accountHint
        UserType          = $userType
        PrincipalObjectId = $objectId
    }

    Write-Ok "Subscription: $($ctx.SubscriptionName) ($($ctx.SubscriptionId))"
    Write-Ok "Tenant      : $($ctx.TenantId)"
    Write-Ok "Signed in as: $($ctx.UserName) [$($ctx.UserType)]"

    if (-not $objectId) {
        Write-Warn "Could not resolve the signed-in principal's object id ('az ad signed-in-user show' failed)."
        Write-Warn 'This is expected for a service principal. Pass -PrincipalObjectId to grant it the Foundry roles.'
    }
    else {
        Write-Ok "Principal object id resolved"
    }

    return $ctx
}

<#
.SYNOPSIS
  Validates the loaded configuration before anything touches Azure.
.DESCRIPTION
  A missing key in lab.defaults.psd1 would otherwise reach the Bicep parameters
  file as a null value and be rejected far downstream, or worse, be accepted
  with an empty value.
#>
function Test-Configuration {
    param([Parameter(Mandatory)][hashtable]$Config)

    Write-Step 'Validating lab configuration'

    $requiredScalars = @(
        'ResourceGroupName', 'DeploymentName', 'Location', 'ApimSku',
        'InferenceApiPath', 'InferenceApiType', 'HostedAgentResponsesApiPath',
        'FoundryProjectName', 'AgentCpu', 'AgentMemory', 'AgentApiVersion', 'AgentLogLevel',
        'AppServiceSku', 'AppServiceRuntime'
    )
    foreach ($key in $requiredScalars) {
        if (-not $Config.ContainsKey($key)) {
            throw "Configuration key '$key' is missing from config/lab.defaults.psd1."
        }
        Assert-NotNullOrEmpty -Value $Config[$key] -Name "config.$key" -Hint 'Set it in config/lab.defaults.psd1.' | Out-Null
    }

    $requiredCollections = @('AiServicesConfig', 'ModelsConfig', 'ApimSubscriptionsConfig', 'Frameworks')
    foreach ($key in $requiredCollections) {
        if (-not $Config.ContainsKey($key) -or $null -eq $Config[$key]) {
            throw "Configuration key '$key' is missing from config/lab.defaults.psd1."
        }
    }

    if (@($Config.AiServicesConfig).Count -lt 2) {
        throw "AiServicesConfig must contain two Foundry resources (models and agents), as the lab's notebook defines."
    }
    if (-not $Config.ContainsKey('FoundryAgentAiServiceIndex')) {
        throw "Configuration key 'FoundryAgentAiServiceIndex' is missing."
    }
    if ($Config.FoundryAgentAiServiceIndex -ge @($Config.AiServicesConfig).Count) {
        throw "FoundryAgentAiServiceIndex ($($Config.FoundryAgentAiServiceIndex)) is out of range for AiServicesConfig ($(@($Config.AiServicesConfig).Count) entries)."
    }
    if (@($Config.ModelsConfig).Count -lt 1) {
        throw 'ModelsConfig must contain at least the model the hosted agent consumes.'
    }
    if (@($Config.ApimSubscriptionsConfig).Count -lt 1) {
        throw 'ApimSubscriptionsConfig must contain at least one subscription: the automation reads its key.'
    }

    Write-Ok 'Configuration is complete'
}

function Test-LabSources {
    param([Parameter(Mandatory)][string]$LabPath, [Parameter(Mandatory)][string[]]$Framework)

    Write-Step 'Validating the official lab sources (read-only)'

    if (-not (Test-Path -Path $LabPath -PathType Container)) {
        throw "Lab folder not found: $LabPath`n  Check   : pass -LabPath pointing at labs/ai-foundry-hosted-agents-custom-framework."
    }

    # One Dockerfile per framework being deployed: a missing source is caught
    # here, in the first seconds, rather than minutes into an ACR build.
    $required = @(
        'main.bicep',
        'policy.xml',
        'hosted-agent-policy.xml'
    )
    foreach ($fw in $Framework) {
        $required += (Join-Path 'src' (Join-Path 'frameworks' (Join-Path $fw 'Dockerfile')))
    }
    foreach ($rel in $required) {
        $full = Join-Path $LabPath $rel
        if (-not (Test-Path -Path $full)) {
            throw "Required lab file missing: $full`n  Check   : the official lab folder appears incomplete or moved."
        }
    }

    Write-Ok "Lab sources found at $LabPath (not modified by this automation)"
}
