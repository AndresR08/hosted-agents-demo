# Infra.ps1 - resource group + Bicep deployment + output retrieval.
#
# Mirrors notebook cells 6 and 8. The Bicep template used is the official lab's
# main.bicep, referenced in place and never modified. The generated parameters
# file is written into this automation's own out/ folder so the lab's own
# params.json is left untouched.

Set-StrictMode -Version Latest

function Initialize-ResourceGroup {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Location
    )

    Write-Step "Ensuring resource group '$Name'"

    $existing = Invoke-Az -Arguments @('group', 'show', '--name', $Name, '-o', 'json') -AllowFailure
    if ($existing.Success -and $existing.Json) {
        $existingLocation = Get-RequiredProperty -Object $existing.Json -Name 'location' `
            -Context "output of 'az group show --name $Name'" -Hint 'The resource group record is malformed.'
        Write-Ok "Using existing resource group in '$existingLocation'"
        if ($existingLocation -ne $Location) {
            Write-Warn "Existing group location '$existingLocation' differs from requested '$Location'. The existing location wins."
        }
        return $existingLocation
    }

    Invoke-Az -Arguments @('group', 'create', '--name', $Name, '--location', $Location, '-o', 'json') `
        -Resource "resource group $Name" `
        -Hint 'Confirm you have Contributor on the subscription and that the location name is valid.' | Out-Null
    Write-Ok "Created resource group '$Name' in '$Location'"
    return $Location
}

<#
.SYNOPSIS
  Builds the Bicep parameters file for the official lab template.

.DESCRIPTION
  Same parameter set the notebook writes in cell 6, with two differences that
  are deliberate and documented in the implementation report:
    * it is written to the automation's out/ folder, never to the lab folder;
    * foundryUserObjectIds is empty when no principal object id was resolved,
      instead of failing, so a service principal run still works.
#>
function New-BicepParametersFile {
    param(
        [Parameter(Mandatory)][hashtable]$Config,
        [string[]]$FoundryUserObjectIds,
        [Parameter(Mandatory)][string]$OutFile
    )

    if ($null -eq $FoundryUserObjectIds) { $FoundryUserObjectIds = @() }

    $parameters = [ordered]@{
        apimSku                       = @{ value = $Config.ApimSku }
        aiServicesConfig              = @{ value = $Config.AiServicesConfig }
        modelsConfig                  = @{ value = $Config.ModelsConfig }
        apimSubscriptionsConfig       = @{ value = $Config.ApimSubscriptionsConfig }
        inferenceAPIPath              = @{ value = $Config.InferenceApiPath }
        inferenceAPIType              = @{ value = $Config.InferenceApiType }
        foundryProjectName            = @{ value = $Config.FoundryProjectName }
        foundryAgentAiServiceIndex    = @{ value = $Config.FoundryAgentAiServiceIndex }
        foundryUserObjectIds          = @{ value = @($FoundryUserObjectIds) }
        enableHostedAgentResponsesApi = @{ value = $true }
        hostedAgentResponsesApiPath   = @{ value = $Config.HostedAgentResponsesApiPath }
    }

    $doc = [ordered]@{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = $parameters
    }

    $json = $doc | ConvertTo-Json -Depth 12
    Set-Content -Path $OutFile -Value $json -Encoding utf8
    Write-Ok "Parameters written to $OutFile"
    return $OutFile
}

<#
.SYNOPSIS
  Decides whether an ARM deployment error is worth retrying.

.DESCRIPTION
  Permanent failures are checked FIRST and always win: a message that mentions
  AuthorizationFailed is never retryable, even if it also happens to contain the
  word "Conflict" somewhere in the nested details ARM returns.

  The transient list comes from failures actually observed against this lab:
  a Log Analytics workspace whose deletion was still propagating
  (FailedIdentityOperation + "pending delete"), and a Foundry account with an
  operation still in flight (RequestConflict + "another operation is in
  progress"). Both cleared on their own within a minute.

  Returns $true only when the error is recognisably transient. An unrecognised
  error is treated as permanent - failing fast on something unknown is safer
  than burning three minutes rediscovering it.
#>
function Test-TransientDeploymentError {
    param([string]$ErrorText)

    if (-not $ErrorText) { return $false }

    $permanent = @(
        'AuthorizationFailed', 'InvalidTemplate', 'InvalidTemplateDeployment',
        'InvalidParameter', 'InvalidResourceReference', 'QuotaExceeded',
        'SubscriptionNotFound', 'ResourceGroupNotFound', 'InvalidResourceName',
        'SkuNotAvailable', 'quota', 'LinkedAuthorizationFailed', 'Forbidden'
    )
    foreach ($pattern in $permanent) {
        if ($ErrorText -match [regex]::Escape($pattern)) { return $false }
    }

    $transient = @(
        'RequestConflict', 'FailedIdentityOperation', 'Conflict',
        'try again later', 'another operation is in progress',
        'operation in progress', 'pending delete', 'AnotherOperationInProgress',
        'RetryableError', 'ServiceUnavailable', 'GatewayTimeout'
    )
    foreach ($pattern in $transient) {
        if ($ErrorText -match [regex]::Escape($pattern)) { return $true }
    }

    return $false
}

<#
.SYNOPSIS
  Runs the lab's Bicep deployment, retrying only transient ARM conflicts.
.DESCRIPTION
  The deployment is a declarative PUT and is safe to repeat: a retry re-applies
  the same template over whatever already exists. Retries are bounded at three
  attempts, 60 seconds apart, and only for the errors classified as transient by
  Test-TransientDeploymentError - everything else fails on the first attempt
  with the full Azure message.
#>
function Invoke-LabDeployment {
    param(
        [Parameter(Mandatory)][string]$DeploymentName,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$TemplateFile,
        [Parameter(Mandatory)][string]$ParametersFile,
        [switch]$ValidateOnly,
        [int]$MaxAttempts = 3,
        [int]$RetryDelaySeconds = 60
    )

    $verb = 'create'
    if ($ValidateOnly) { $verb = 'validate' }

    Write-Step "Running Bicep deployment '$DeploymentName' ($verb)"
    Write-Info 'APIM Basicv2 provisioning dominates this step; expect roughly 3-6 minutes.'

    $azArgs = @(
        'deployment', 'group', $verb,
        '--name', $DeploymentName,
        '--resource-group', $ResourceGroupName,
        '--template-file', $TemplateFile,
        '--parameters', $ParametersFile,
        '-o', 'json'
    )

    $hint = @(
        "Re-run 'az deployment group show -n $DeploymentName -g $ResourceGroupName --query properties.error' for the failing sub-resource.",
        'AuthorizationFailed here almost always means the account lacks Owner, or Contributor + Role Based Access Control Administrator:',
        'main.bicep creates role assignments and cannot complete without them.'
    ) -join ' '

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ($attempt -gt 1) { Write-Info "Attempt $attempt/$MaxAttempts" }

        $result = Invoke-Az -Arguments $azArgs -AllowFailure

        if ($result.Success) {
            if ($ValidateOnly) { Write-Ok 'Template validated. No resources were created.' }
            else { Write-Ok "Deployment '$DeploymentName' succeeded" }
            return
        }

        $azureError = ''
        if ($result.Error) { $azureError = $result.Error.Trim() }
        # ARM puts the useful detail in the JSON error payload on stdout, not
        # only on stderr, so both are classified together.
        $classifiable = "$azureError`n$($result.Text)"

        $isTransient = Test-TransientDeploymentError -ErrorText $classifiable

        if (-not $isTransient -or $attempt -eq $MaxAttempts) {
            $lines = @(
                "Step failed: $(Get-CurrentStep)",
                "  Command : az $($azArgs -join ' ')",
                "  Resource: deployment $DeploymentName in $ResourceGroupName",
                "  Attempts: $attempt of $MaxAttempts"
            )
            if ($isTransient) {
                $lines += '  Reason  : the error looks transient but did not clear within the retry budget.'
                $lines += '            Azure may still be purging resources from a previous deployment of this'
                $lines += '            resource group. Wait a few minutes and re-run, or use -ResourceGroupName.'
            }
            else {
                $lines += '  Reason  : the error is not retryable; retrying would not change the outcome.'
            }
            if ($azureError) { $lines += "  Azure   : $azureError" }
            $lines += "  Check   : $hint"
            throw ($lines -join "`n")
        }

        Write-Warn "Attempt $attempt/$MaxAttempts failed with a transient Azure conflict."
        Write-Warn '  Typically a resource from a previous deployment of this resource group is still'
        Write-Warn '  being deleted or has an operation in flight. This normally clears on its own.'
        if ($azureError) { Write-Info "  Azure: $($azureError.Split("`n")[-1])" }
        Write-Info "  Waiting ${RetryDelaySeconds}s before retrying..."
        Start-Sleep -Seconds $RetryDelaySeconds
    }
}

<#
.SYNOPSIS
  Reads one ARM deployment output, failing loudly if it is missing or empty.
.DESCRIPTION
  ARM returns outputs as { "<name>": { "type": ..., "value": ... } }. Both the
  named entry and its "value" member are validated, so a renamed output in the
  lab's main.bicep surfaces here with the list of names ARM actually returned,
  instead of silently becoming $null.
#>
function Read-DeploymentOutput {
    param(
        [Parameter(Mandatory)]$Outputs,
        [Parameter(Mandatory)][string]$Name,
        [string]$Hint = ''
    )

    $entry = Get-RequiredProperty -Object $Outputs -Name $Name -Context 'ARM deployment outputs' -Hint $Hint
    return (Get-RequiredProperty -Object $entry -Name 'value' -Context "ARM deployment output '$Name'" -Hint $Hint)
}

function Get-LabDeploymentOutputs {
    param(
        [Parameter(Mandatory)][string]$DeploymentName,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][hashtable]$Config
    )

    Write-Step 'Reading deployment outputs'

    $deployment = Invoke-Az -Arguments @(
        'deployment', 'group', 'show',
        '--name', $DeploymentName,
        '-g', $ResourceGroupName,
        '-o', 'json'
    ) -AsJson -Resource "deployment $DeploymentName" `
      -Hint 'The deployment must have completed at least once before outputs can be read.'

    $hint = "These names are declared in the lab's main.bicep OUTPUTS section. If the lab changed them, this automation must be updated to match - never guessed."

    $properties = Get-RequiredProperty -Object $deployment -Name 'properties' `
        -Context "deployment '$DeploymentName'" -Hint 'The deployment record is malformed or the deployment never ran.'
    $out = Get-RequiredProperty -Object $properties -Name 'outputs' `
        -Context "deployment '$DeploymentName'" `
        -Hint 'The deployment produced no outputs, which usually means it failed before completing.'

    $gatewayUrl   = Read-DeploymentOutput -Outputs $out -Name 'apimResourceGatewayURL'      -Hint $hint
    $acrName      = Read-DeploymentOutput -Outputs $out -Name 'containerRegistryName'       -Hint $hint
    $agentProject = Read-DeploymentOutput -Outputs $out -Name 'foundryAgentProjectEndpoint' -Hint $hint
    $subs         = Read-DeploymentOutput -Outputs $out -Name 'apimSubscriptions'           -Hint $hint

    # Additional outputs, needed only by the companion demo's broker (see
    # modules/AppService.ps1). All four already exist in the lab's main.bicep
    # OUTPUTS section - nothing was added to the lab to obtain them.
    $apimServiceId  = Read-DeploymentOutput -Outputs $out -Name 'apimServiceId'             -Hint $hint
    $lawCustomerId  = Read-DeploymentOutput -Outputs $out -Name 'logAnalyticsWorkspaceId'   -Hint $hint
    $modelsEndpoint = Read-DeploymentOutput -Outputs $out -Name 'foundryAiServicesEndpoint' -Hint $hint

    # apimSubscriptions is an array of objects; both fields we consume must exist.
    $subs = @($subs)
    if ($subs.Count -lt 1) {
        throw "Deployment output 'apimSubscriptions' contains no entries.`n  Check   : apimSubscriptionsConfig in the generated parameters, and APIM subscription creation in main.bicep."
    }
    $subName = Get-RequiredProperty -Object $subs[0] -Name 'name' `
        -Context "deployment output 'apimSubscriptions[0]'" -Hint $hint
    $apiKey  = Get-RequiredProperty -Object $subs[0] -Name 'key' `
        -Context "deployment output 'apimSubscriptions[0]'" `
        -Hint 'APIM returned a subscription without a key. Re-run the deployment or inspect the subscription in the portal.'

    # Shape checks: these values are used to build URLs and an ACR reference, so a
    # syntactically wrong value must fail here rather than as a confusing HTTP error later.
    if ($gatewayUrl -notmatch '^https://') {
        throw "Deployment output 'apimResourceGatewayURL' is not an https URL: '$gatewayUrl'.`n  Check   : $hint"
    }
    if ($agentProject -notmatch '^https://.+/api/projects/.+$') {
        throw @(
            "Deployment output 'foundryAgentProjectEndpoint' does not have the expected shape: '$agentProject'.",
            '  Expected: https://{account}.services.ai.azure.com/api/projects/{project}',
            "  Check   : $hint"
        ) -join "`n"
    }

    $inferencePath = Assert-NotNullOrEmpty -Value $Config.InferenceApiPath -Name 'config.InferenceApiPath' `
        -Hint 'Set it in config/lab.defaults.psd1.'

    # The lab outputs an APIM resource id and a Foundry endpoint, not the plain
    # names the broker's ARM paths need. Both are derived here rather than
    # guessed from configuration, so a renamed resource stays consistent.
    $apimServiceName = $apimServiceId.Split('/')[-1]
    $modelsAccount   = ([uri]$modelsEndpoint).Host.Split('.')[0]
    Assert-NotNullOrEmpty -Value $apimServiceName -Name 'apimServiceName' `
        -Hint "Derived from the deployment output 'apimServiceId'. $hint" | Out-Null
    Assert-NotNullOrEmpty -Value $modelsAccount -Name 'foundryModelsAccountName' `
        -Hint "Derived from the deployment output 'foundryAiServicesEndpoint'. $hint" | Out-Null

    $result = [pscustomobject]@{
        ApimGatewayUrl              = $gatewayUrl
        ApimServiceName             = $apimServiceName
        LogAnalyticsWorkspaceId     = $lawCustomerId
        FoundryModelsAccountName    = $modelsAccount
        ContainerRegistryName       = $acrName
        FoundryAgentProjectEndpoint = $agentProject
        ApimSubscriptionName        = $subName
        ApimSubscriptionKey         = $apiKey
        InferenceEndpoint           = "$gatewayUrl/$inferencePath/models"
    }

    Write-Ok "APIM gateway            : $($result.ApimGatewayUrl)"
    Write-Ok "Container Registry      : $($result.ContainerRegistryName)"
    Write-Ok "Foundry agent project   : $($result.FoundryAgentProjectEndpoint)"
    Write-Ok "APIM subscription key   : ****$($apiKey.Substring($apiKey.Length - 4))"
    Write-Ok "Inference endpoint      : $($result.InferenceEndpoint)"
    Write-Ok "APIM service            : $($result.ApimServiceName)"
    Write-Ok "Foundry models account  : $($result.FoundryModelsAccountName)"

    return $result
}
