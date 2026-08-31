<#
.SYNOPSIS
  Automated deployment of the official AI-Gateway lab
  "ai-foundry-hosted-agents-custom-framework".

.DESCRIPTION
  Scripted equivalent of the lab's Jupyter notebook. The official lab is the
  source of truth and is never modified: its main.bicep, policies and agent
  sources are referenced in place, read-only.

  Flow:
    prerequisites -> auth -> resource group -> Bicep deployment -> outputs
      -> ACR image build -> hosted agent registration -> readiness polling
      -> direct + APIM validation -> App Service (build, deploy, health check)
      -> outputs file -> demo URL

.PARAMETER SubscriptionId
  Subscription to deploy into. Defaults to the current `az` subscription.

.PARAMETER ResourceGroupName
  Target resource group. Created if missing.

.PARAMETER Location
  Azure region for the resource group. Only used when creating it.

.PARAMETER DeploymentName
  ARM deployment name.

.PARAMETER Framework
  Custom agent frameworks to build and host. Defaults to BOTH ('pydantic' and
  'strands'): the demo exists to show the same hosting contract running two
  different frameworks side by side, so one agent is not a complete deployment.
  Pass a single value to narrow a run down for diagnosis, e.g. -Framework strands.

.PARAMETER ImageTag
  Container image tag. Defaults to a UTC timestamp so every run produces a
  unique, immutable tag, as the hosted-agent documentation recommends.

.PARAMETER LabPath
  Path to the official lab folder. Defaults to the sibling directory
  ../../ai-foundry-hosted-agents-custom-framework.

.PARAMETER PrincipalObjectId
  Entra object id to grant the Foundry roles. Auto-detected for a signed-in
  user; required when running as a service principal.

.PARAMETER AgentTimeoutMinutes
  How long to wait for the hosted agent version to reach 'active'.

.PARAMETER AppServiceName
  Name of the App Service hosting the companion demo. Defaults to a stable,
  globally-unique name derived from the subscription and resource group.

.PARAMETER AppServiceSku
  App Service plan SKU. Defaults to the value in config/lab.defaults.psd1 (B1).

.PARAMETER SkipDemoApp
  Skips building and deploying the companion demo application. The lab
  infrastructure and the hosted agent are still deployed.

.PARAMETER ValidateOnly
  Validates prerequisites and the Bicep template without creating resources.

.PARAMETER SkipInfrastructure
  Skips the Bicep deployment and reads outputs from the existing deployment.

.PARAMETER SkipImageBuild
  Skips `az acr build`. Requires -ImageTag pointing at an existing image.

.PARAMETER SkipAgent
  Stops after the infrastructure and image steps.

.PARAMETER SkipValidation
  Skips the direct and APIM invocation tests.

.PARAMETER StopLocalDevServers
  Ends any node process running out of this repository before starting. Without
  it they are only reported. They hold handles in node_modules, and npm ci dies
  on them with EPERM minutes into the run - see Test-OrphanedDevServers.

.EXAMPLE
  .\deploy.ps1

.EXAMPLE
  # Both agents, the default.
  .\deploy.ps1

.EXAMPLE
  # One framework only - for diagnosing a single agent.
  .\deploy.ps1 -Framework strands

.EXAMPLE
  .\deploy.ps1 -SubscriptionId 00000000-0000-0000-0000-000000000000 `
               -ResourceGroupName rg-hosted-agents-demo -Location swedencentral

.EXAMPLE
  .\deploy.ps1 -ValidateOnly
#>
[CmdletBinding()]
param(
    [string]$SubscriptionId,
    [string]$ResourceGroupName,
    [string]$Location,
    [string]$DeploymentName,
    [ValidateSet('pydantic', 'strands')][string[]]$Framework = @('pydantic', 'strands'),
    [string]$ImageTag,
    [string]$LabPath,
    [string]$PrincipalObjectId,
    [int]$AgentTimeoutMinutes = 15,
    [string]$AppServiceName,
    [string]$AppServiceSku,
    [switch]$SkipDemoApp,
    [switch]$ValidateOnly,
    [switch]$SkipInfrastructure,
    [switch]$SkipImageBuild,
    [switch]$SkipAgent,
    [switch]$SkipValidation,
    [switch]$StopLocalDevServers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir    = Split-Path -Parent $scriptRoot

. (Join-Path $scriptRoot 'modules\Common.ps1')
. (Join-Path $scriptRoot 'modules\Preflight.ps1')
. (Join-Path $scriptRoot 'modules\Infra.ps1')
. (Join-Path $scriptRoot 'modules\AgentImage.ps1')
. (Join-Path $scriptRoot 'modules\FoundryAgent.ps1')
. (Join-Path $scriptRoot 'modules\Validate.ps1')
. (Join-Path $scriptRoot 'modules\AppService.ps1')

$started = Get-Date

try {
    # ---------------------------------------------------------------- INPUTS
    $configFile = Join-Path $rootDir 'config\lab.defaults.psd1'
    if (-not (Test-Path $configFile)) { throw "Configuration file not found: $configFile" }
    $raw = Import-PowerShellDataFile -Path $configFile
    $config = @{}
    foreach ($k in $raw.Keys) { $config[$k] = $raw[$k] }

    if ($ResourceGroupName) { $config.ResourceGroupName = $ResourceGroupName }
    if ($Location)          { $config.Location          = $Location }
    if ($DeploymentName)    { $config.DeploymentName    = $DeploymentName }

    # The lab normally comes from this repository's own vendored copy, which is
    # why a fresh clone deploys without anything else being present. The two
    # sibling locations after it are the historical layout, kept working for
    # anyone running this against their own checkout of Azure-Samples/AI-Gateway
    # rather than the vendored snapshot. A folder only counts if it actually
    # holds main.bicep: resolving to a directory that merely has the right name
    # would fail much later, in the deployment step.
    $labCandidates = @()
    if ($LabPath) {
        $labCandidates += $LabPath
    }
    else {
        $labsDir = Split-Path -Parent $rootDir
        $repoRootForLab = Split-Path -Parent $labsDir
        $labCandidates += (Join-Path $repoRootForLab 'vendor\ai-gateway\labs\ai-foundry-hosted-agents-custom-framework')
        $labCandidates += (Join-Path $labsDir 'ai-foundry-hosted-agents-custom-framework')
        $labCandidates += (Join-Path (Split-Path -Parent (Split-Path -Parent $labsDir)) 'ai-foundry-hosted-agents-custom-framework')
    }

    $resolvedLabPath = $null
    foreach ($candidate in $labCandidates) {
        $resolved = Resolve-Path -Path $candidate -ErrorAction SilentlyContinue
        if ($resolved -and (Test-Path (Join-Path $resolved.Path 'main.bicep'))) {
            $resolvedLabPath = $resolved.Path
            break
        }
    }
    if (-not $resolvedLabPath) {
        throw @(
            'The lab folder was not found.',
            "  Tried   : $($labCandidates -join '; ')",
            '  Check   : vendor/ai-gateway is normally part of this repository. If it is',
            '            missing, restore it with:',
            '              pwsh scripts\sync-vendor.ps1',
            '            Or point at an external checkout of the official lab with',
            '            -LabPath <folder containing main.bicep>.'
        ) -join "`n"
    }
    $LabPath = $resolvedLabPath

    # -SkipImageBuild means "use an image that already exists", so the tag has to
    # be supplied. Generating the usual timestamp here would invent a tag nothing
    # ever pushed: the agent would register against a non-existent image and fail
    # much later, during the pull, as an opaque image_pull_failed.
    if ($SkipImageBuild -and -not $ImageTag) {
        throw @(
            '-SkipImageBuild requires -ImageTag.',
            '  Reason  : skipping the build means reusing an image already in the registry, and',
            '            without a tag this script would generate a fresh timestamp that no image has.',
            '  Check   : pass the tag of an existing image, for example -ImageTag 20260814203648.',
            '            List what is available with:',
            '              az acr repository show-tags --name <registry> --repository <framework>-agent -o table'
        ) -join "`n"
    }

    if (-not $ImageTag) { $ImageTag = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') }

    # One entry per framework being deployed. The demo's whole point is the
    # two-framework comparison - the same hosting contract running Pydantic AI
    # and Strands side by side - so both are the default. A single framework
    # stays selectable with -Framework for diagnosis, which is why this is a
    # loop over a list rather than two hardcoded passes.
    $Framework = @($Framework | Select-Object -Unique)
    $targets = @()
    foreach ($fw in $Framework) {
        if (-not $config.Frameworks.ContainsKey($fw)) {
            throw "Framework '$fw' is not defined in config/lab.defaults.psd1 (known: $($config.Frameworks.Keys -join ', '))."
        }
        # Repository name comes from the framework map, exactly as notebook cell 10
        # does (frameworks[framework]['image']) - not derived from the framework name.
        $targets += [pscustomobject]@{
            Framework       = $fw
            AgentName       = Assert-NotNullOrEmpty -Value $config.Frameworks[$fw].agentName `
                                -Name "Frameworks.$fw.agentName" -Hint 'Set it in config/lab.defaults.psd1.'
            ImageRepository = Assert-NotNullOrEmpty -Value $config.Frameworks[$fw].image `
                                -Name "Frameworks.$fw.image" -Hint 'Set it in config/lab.defaults.psd1.'
            ImageUri        = $null
            AgentVersion    = $null
            DirectOk        = $null
            ApimOk          = $null
        }
    }

    $modelName = Assert-NotNullOrEmpty -Value $config.ModelsConfig[0].name `
        -Name 'ModelsConfig[0].name' -Hint 'Set it in config/lab.defaults.psd1.'
    $outDir = Join-Path $rootDir 'out'
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

    Write-Host ''
    Write-Host 'Automated deployment - AI Foundry Hosted Agents (custom framework)' -ForegroundColor White
    Write-Host '------------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Info "Lab (read-only) : $LabPath"
    Write-Info "Resource group  : $($config.ResourceGroupName)"
    Write-Info "Deployment      : $($config.DeploymentName)"
    Write-Info "Frameworks      : $(($targets | ForEach-Object { "$($_.Framework) -> $($_.AgentName)" }) -join ', ')"
    Write-Info "Image tag       : $ImageTag"

    # ----------------------------------------------------------- PREPARATION
    Test-Prerequisites -RequireNode:(-not $SkipDemoApp)

    # Before anything long-running: a dev server left holding node_modules
    # fails the demo package build several minutes from here, with an EPERM
    # that names a lightningcss binary and not the server holding it. Checked
    # even with -SkipDemoApp, because the broker build reads the same tree.
    Test-OrphanedDevServers -RepoRoot (Split-Path -Parent (Split-Path -Parent $rootDir)) `
        -StopThem:$StopLocalDevServers
    Test-Configuration -Config $config
    $ctx = Test-Authentication -SubscriptionId $SubscriptionId
    Test-LabSources -LabPath $LabPath -Framework $Framework -PatchDir (Join-Path $rootDir 'patches')

    # Advisory only, and only meaningful once a subscription is selected: warns
    # when a previous resource group of this name left soft-deleted resources
    # whose names this deployment is about to ask for again. Never aborts.
    if (-not $SkipInfrastructure) {
        Test-SoftDeletedCollisions -ResourceGroupName $config.ResourceGroupName
    }

    if ($PrincipalObjectId) { $ctx.PrincipalObjectId = $PrincipalObjectId }
    $principalType = 'User'
    if ($ctx.UserType -eq 'servicePrincipal') { $principalType = 'ServicePrincipal' }

    $foundryUserObjectIds = @()
    if ($ctx.PrincipalObjectId) { $foundryUserObjectIds = @($ctx.PrincipalObjectId) }

    # --------------------------------------------------------- INFRASTRUCTURE
    $templateFile = Join-Path $LabPath 'main.bicep'
    $paramsFile   = Join-Path $outDir 'params.generated.json'
    New-BicepParametersFile -Config $config -FoundryUserObjectIds $foundryUserObjectIds -OutFile $paramsFile | Out-Null

    if ($ValidateOnly) {
        Initialize-ResourceGroup -Name $config.ResourceGroupName -Location $config.Location | Out-Null
        Invoke-LabDeployment -DeploymentName $config.DeploymentName `
            -ResourceGroupName $config.ResourceGroupName `
            -TemplateFile $templateFile -ParametersFile $paramsFile -ValidateOnly
        Write-Host ''
        Write-Ok 'Validation-only run finished. No lab resources were deployed.'
        return
    }

    if ($SkipInfrastructure) {
        Write-Step 'Skipping Bicep deployment (-SkipInfrastructure)'
    }
    else {
        Initialize-ResourceGroup -Name $config.ResourceGroupName -Location $config.Location | Out-Null
        Invoke-LabDeployment -DeploymentName $config.DeploymentName `
            -ResourceGroupName $config.ResourceGroupName `
            -TemplateFile $templateFile -ParametersFile $paramsFile
    }

    # ---------------------------------------------------------------- OUTPUTS
    $outputs = Get-LabDeploymentOutputs -DeploymentName $config.DeploymentName `
        -ResourceGroupName $config.ResourceGroupName -Config $config

    # ------------------------------------------------------------- CONTAINER
    # Every framework shares the image TAG - each has its own repository, so
    # pydantic-agent:<tag> and strands-agent:<tag> are distinct images built
    # from the same run and trivially correlated afterwards.
    if ($SkipImageBuild) {
        Write-Step 'Skipping image build (-SkipImageBuild)'
        foreach ($target in $targets) {
            $target.ImageUri = "$($outputs.ContainerRegistryName).azurecr.io/$($target.ImageRepository):$ImageTag"
            Write-Info "using existing image $($target.ImageUri)"
        }
    }
    else {
        # Registry readiness is a property of the registry, not of the image:
        # probing it once per run is enough for every framework.
        Wait-AcrDataPlaneReady -RegistryName $outputs.ContainerRegistryName
        Test-AcrArmAuthPolicy -RegistryName $outputs.ContainerRegistryName
        foreach ($target in $targets) {
            $target.ImageUri = Build-AgentImage -RegistryName $outputs.ContainerRegistryName `
                -LabPath $LabPath -Framework $target.Framework `
                -ImageRepository $target.ImageRepository -ImageTag $ImageTag
        }
    }

    if ($SkipAgent) {
        Write-Step 'Skipping hosted agent registration (-SkipAgent)'
    }
    else {
        # ------------------------------------------------------------- AGENT
        # The role is granted at project scope, so it covers every agent in the
        # project and is requested once rather than once per framework.
        if ($ctx.PrincipalObjectId) {
            Grant-FoundryProjectManagerRole -SubscriptionId $ctx.SubscriptionId `
                -ResourceGroupName $config.ResourceGroupName `
                -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint `
                -PrincipalObjectId $ctx.PrincipalObjectId -PrincipalType $principalType
        }
        else {
            Write-Warn 'No principal object id available; skipping the Foundry Project Manager role assignment.'
        }

        # Identical for every framework: the same model, the same gateway, the
        # same key. That sameness is the demo's point - two frameworks, one
        # hosting contract - so it is deliberately built once, outside the loop.
        $envVars = @{
            AZURE_OPENAI_ENDPOINT    = $outputs.InferenceEndpoint
            AZURE_OPENAI_API_VERSION = $config.AgentApiVersion
            AZURE_OPENAI_DEPLOYMENT  = $modelName
            APIM_SUBSCRIPTION_KEY    = $outputs.ApimSubscriptionKey
            LOG_LEVEL                = $config.AgentLogLevel
        }

        # The ARM deployment finishing does not mean the Foundry data plane is
        # usable; a freshly created account answers "Subdomain does not map to
        # a resource" for a few minutes. Probed once here rather than per agent.
        Wait-FoundryProjectReady -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint

        foreach ($target in $targets) {
            $target.AgentVersion = New-HostedAgentVersion -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint `
                -AgentName $target.AgentName -ImageUri $target.ImageUri -EnvironmentVariables $envVars `
                -Cpu $config.AgentCpu -Memory $config.AgentMemory

            Wait-HostedAgentActive -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint `
                -AgentName $target.AgentName -Version $target.AgentVersion -TimeoutMinutes $AgentTimeoutMinutes

            # -------------------------------------------------------- VALIDATION
            if (-not $SkipValidation) {
                $target.DirectOk = Test-AgentDirect -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint `
                    -AgentName $target.AgentName
                $target.ApimOk = Test-AgentThroughApim -GatewayUrl $outputs.ApimGatewayUrl `
                    -ApiPath $config.HostedAgentResponsesApiPath -AgentName $target.AgentName `
                    -ApiKey $outputs.ApimSubscriptionKey
            }
        }
    }

    # ------------------------------------------------------------ DEMO APP
    #
    # The companion demo: one Linux App Service where Express serves the built
    # console AND the /api routes from a single origin. The browser therefore
    # never holds an Azure credential or the APIM key, and no CORS
    # configuration exists to get wrong. See docs/04-app-service-decision.md.
    $demoUrl     = $null
    $demoHealthy = $null
    $siteName    = $null

    if ($SkipDemoApp) {
        Write-Step 'Skipping the companion demo application (-SkipDemoApp)'
    }
    else {
        $repoRoot = Split-Path -Parent (Split-Path -Parent $rootDir)

        $siteName = $AppServiceName
        if (-not $siteName) {
            $siteName = Get-DemoAppServiceName -SubscriptionId $ctx.SubscriptionId `
                -ResourceGroupName $config.ResourceGroupName
        }
        $sku = $AppServiceSku
        if (-not $sku) { $sku = $config.AppServiceSku }

        $staging = Join-Path $outDir 'appservice-package'
        # The package carries the Vite fingerprint of this build; Publish uses it
        # to tell "the new bundle landed" from "the old one is still serving".
        $package = Build-DemoPackage -RepoRoot $repoRoot -StagingPath $staging `
            -Region $config.Location -ResourceGroupName $config.ResourceGroupName

        $site = Initialize-DemoAppService -ResourceGroupName $config.ResourceGroupName `
            -Location $config.Location -PlanName "$siteName-plan" -SiteName $siteName `
            -Sku $sku -Runtime $config.AppServiceRuntime

        $workspaceName = Get-WorkspaceNameByCustomerId -ResourceGroupName $config.ResourceGroupName `
            -CustomerId $outputs.LogAnalyticsWorkspaceId

        Grant-DemoAppServiceRoles -SubscriptionId $ctx.SubscriptionId `
            -ResourceGroupName $config.ResourceGroupName -PrincipalId $site.PrincipalId `
            -ContainerRegistryName $outputs.ContainerRegistryName `
            -LogAnalyticsWorkspaceName $workspaceName

        # Same role the human principal gets: the broker creates and deletes
        # hosted agents on the presenter's behalf. Granted through the App
        # Service module rather than FoundryAgent.ps1 because for a managed
        # identity this is the only source of the permission - it is retried
        # while the identity propagates, and fatal if it never lands.
        Grant-FoundryProjectManagerRoleToIdentity -SubscriptionId $ctx.SubscriptionId `
            -ResourceGroupName $config.ResourceGroupName `
            -ProjectEndpoint $outputs.FoundryAgentProjectEndpoint `
            -PrincipalId $site.PrincipalId

        # Every value the broker requires (broker/src/config.ts). No AZURE_*
        # credential appears here on purpose: DefaultAzureCredential resolves
        # the site's system-assigned managed identity.
        Set-DemoAppServiceSettings -ResourceGroupName $config.ResourceGroupName -SiteName $siteName -Settings @{
            AZURE_SUBSCRIPTION_ID           = $ctx.SubscriptionId
            AZURE_RESOURCE_GROUP            = $config.ResourceGroupName
            AZURE_REGION                    = $config.Location
            APIM_GATEWAY_URL                = $outputs.ApimGatewayUrl
            APIM_SERVICE_NAME               = $outputs.ApimServiceName
            APIM_SUBSCRIPTION_KEY           = $outputs.ApimSubscriptionKey
            FOUNDRY_AGENTS_PROJECT_ENDPOINT = $outputs.FoundryAgentProjectEndpoint
            FOUNDRY_MODELS_ACCOUNT_NAME     = $outputs.FoundryModelsAccountName
            LOG_ANALYTICS_WORKSPACE_ID      = $outputs.LogAnalyticsWorkspaceId
            CONTAINER_REGISTRY_NAME         = $outputs.ContainerRegistryName
            CORS_ORIGIN                     = $site.Url
            # Oryx installs dependencies and runs `npm run build` (tsc) on the
            # way in. NODE_ENV is deliberately NOT set to 'production': npm then
            # omits devDependencies, typescript disappears and the build fails.
            # Measured on this repository's own lock file: 133 packages without
            # it, 115 with it - typescript and tsx among the 18 missing.
            SCM_DO_BUILD_DURING_DEPLOYMENT  = 'true'
            WEBSITE_RUN_FROM_PACKAGE        = '0'
        }

        Publish-DemoAppService -ResourceGroupName $config.ResourceGroupName `
            -SiteName $siteName -StagingPath $package.StagingPath -Url $site.Url `
            -AssetPath $package.AssetPath

        $demoUrl = $site.Url
        $demoHealthy = Wait-DemoAppServiceHealthy -Url $site.Url `
            -ResourceGroupName $config.ResourceGroupName -SiteName $siteName
    }

    # ---------------------------------------------------------- FINAL OUTPUT
    # One APIM API serves every agent - the agent name is a path segment - so the
    # per-agent URL is derived per target from the same template.
    foreach ($target in $targets) {
        $target | Add-Member -NotePropertyName ApimAgentUrl -NotePropertyValue (
            "$($outputs.ApimGatewayUrl)/$($config.HostedAgentResponsesApiPath)/agents/$($target.AgentName)/endpoint/protocols/openai/responses?api-version=v1"
        ) -Force
    }
    $anyDirectFailed = @($targets | Where-Object { $_.DirectOk -eq $false }).Count -gt 0
    $anyApimFailed   = @($targets | Where-Object { $_.ApimOk   -eq $false }).Count -gt 0

    $summary = [ordered]@{
        generatedUtc                = (Get-Date).ToUniversalTime().ToString('o')
        subscriptionId              = $ctx.SubscriptionId
        tenantId                    = $ctx.TenantId
        resourceGroupName           = $config.ResourceGroupName
        deploymentName              = $config.DeploymentName
        frameworks                  = @($targets | ForEach-Object { $_.Framework })
        agents                      = @($targets | ForEach-Object {
            [ordered]@{
                framework                = $_.Framework
                agentName                = $_.AgentName
                agentVersion             = $_.AgentVersion
                imageUri                 = $_.ImageUri
                apimAgentResponsesUrl    = $_.ApimAgentUrl
                directInvocationVerified = $_.DirectOk
                apimInvocationVerified   = $_.ApimOk
            }
        })
        apimGatewayUrl              = $outputs.ApimGatewayUrl
        apimSubscriptionName        = $outputs.ApimSubscriptionName
        containerRegistryName       = $outputs.ContainerRegistryName
        foundryAgentProjectEndpoint = $outputs.FoundryAgentProjectEndpoint
        inferenceEndpoint           = $outputs.InferenceEndpoint
        appServiceName              = $siteName
        demoUrl                     = $demoUrl
        demoHealthCheckPassed       = $demoHealthy
    }

    $summaryFile = Join-Path $outDir 'outputs.json'
    ($summary | ConvertTo-Json -Depth 6) | Set-Content -Path $summaryFile -Encoding utf8

    # The subscription key is a secret: written to a separate file, never to the
    # console and never to the summary that is safe to share.
    $secretFile = Join-Path $outDir 'apim-subscription-key.txt'
    Set-Content -Path $secretFile -Value $outputs.ApimSubscriptionKey -Encoding utf8

    Write-Host ''
    Write-Host '=================== DEPLOYMENT OUTPUTS ===================' -ForegroundColor White
    Write-Host "APIM gateway URL       : $($outputs.ApimGatewayUrl)"
    Write-Host "Foundry project        : $($outputs.FoundryAgentProjectEndpoint)"
    Write-Host "Inference endpoint     : $($outputs.InferenceEndpoint)"
    Write-Host "Container registry     : $($outputs.ContainerRegistryName)"
    foreach ($target in $targets) {
        Write-Host ''
        Write-Host "Agent ($($target.Framework))"
        Write-Host "  name                 : $($target.AgentName) (version $($target.AgentVersion))"
        Write-Host "  image                : $($target.ImageUri)"
        Write-Host "  endpoint (APIM)      : $($target.ApimAgentUrl)"
    }
    Write-Host ''
    Write-Host "APIM subscription key  : saved to $secretFile"
    Write-Host "Full summary           : $summaryFile"
    Write-Host '==========================================================' -ForegroundColor White

    if ($demoUrl) {
        Write-Host ''
        Write-Host '========================================' -ForegroundColor White
        Write-Host ' HOSTED AGENTS DEMO READY' -ForegroundColor White
        Write-Host '========================================' -ForegroundColor White
        Write-Host ''
        Write-Host "  Demo URL : $demoUrl" -ForegroundColor Green
        foreach ($target in $targets) {
            Write-Host "  Agent    : $($target.AgentName) v$($target.AgentVersion) ($($target.Framework))"
        }
        Write-Host "  Health   : $demoUrl/api/health"
        Write-Host ''
        if ($demoHealthy) {
            Write-Host '  Open the URL above - the console is live against this deployment.' -ForegroundColor Green
        }
        else {
            Write-Warn 'The health check did not pass yet. The site may still be starting;'
            Write-Warn "  re-check $demoUrl/api/health, or run:"
            Write-Warn "  az webapp log tail -g $($config.ResourceGroupName) -n $siteName"
        }
        Write-Host '========================================' -ForegroundColor White
    }

    if ($anyDirectFailed -or $anyApimFailed -or $demoHealthy -eq $false) {
        Write-Host ''
        Write-Warn 'Infrastructure and agent were deployed, but at least one verification did not pass.'
        Write-Warn 'See the messages above. The run is NOT fully verified.'
        exit 2
    }

    Write-Host ''
    Write-Ok "Completed in $([int]((Get-Date) - $started).TotalSeconds)s"
}
catch {
    Write-Host ''
    Write-Failure 'DEPLOYMENT FAILED'
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ScriptStackTrace) {
        Write-Host ''
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    }
    exit 1
}
