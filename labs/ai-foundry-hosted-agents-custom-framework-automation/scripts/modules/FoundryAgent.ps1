# FoundryAgent.ps1 - hosted agent registration and readiness polling.
#
# This replaces notebook cell 13 (azure-ai-projects SDK create_version), which is
# broken in the lab as shipped. See docs/03-implementation-report.md for the full
# justification. The REST contract implemented here is the one documented at
# https://learn.microsoft.com/azure/foundry/agents/how-to/deploy-hosted-agent
# (REST pivot) and manage-hosted-agent, using api-version=v1 and the
# https://ai.azure.com audience.

Set-StrictMode -Version Latest

# Role the documentation requires to create/update hosted agents at project scope.
#
# The lab already grants it: modules/cognitive-services/v3/foundry.bicep assigns
# this role definition to deployer().objectId on BOTH Foundry accounts, and a
# project inherits from its parent account. (main.bicep separately assigns
# Foundry User, 53ca6127-..., which alone would NOT be enough - that role grants
# data-plane use, not agent management.)
#
# The assignment below is therefore normally a no-op safety net. It matters only
# when the ARM deployment and this script run under different principals, since
# the Bicep assignment follows the deployer, not whoever runs the agent step.
$script:FoundryProjectManagerRoleId = 'eadc314b-1a2d-4efa-be10-5d325db5065e'

$script:FoundryApiVersion = 'v1'

<#
.SYNOPSIS
  Splits a Foundry project endpoint into its account and project names.
.DESCRIPTION
  Endpoint shape produced by the lab's foundry.bicep module:
  https://{account}.services.ai.azure.com/api/projects/{project}
#>
function Split-FoundryProjectEndpoint {
    param([Parameter(Mandatory)][string]$Endpoint)

    $uri = [uri]$Endpoint
    $account = $uri.Host.Split('.')[0]
    $segments = $uri.AbsolutePath.Trim('/').Split('/')
    $project = $segments[$segments.Length - 1]

    if (-not $account -or -not $project) {
        throw "Could not parse the Foundry project endpoint '$Endpoint'.`n  Check   : expected https://{account}.services.ai.azure.com/api/projects/{project}."
    }

    return [pscustomobject]@{ AccountName = $account; ProjectName = $project }
}

<#
.SYNOPSIS
  Grants the running principal Foundry Project Manager on the agent project.
.DESCRIPTION
  Idempotent: skips when the assignment already exists. This is an addition to
  the lab's Bicep, not a change to it - see the implementation report.
#>
function Grant-FoundryProjectManagerRole {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$PrincipalObjectId,
        [string]$PrincipalType = 'User'
    )

    Write-Step 'Ensuring Foundry Project Manager role on the agent project'

    $parts = Split-FoundryProjectEndpoint -Endpoint $ProjectEndpoint
    $scope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.CognitiveServices/accounts/$($parts.AccountName)/projects/$($parts.ProjectName)"

    # --include-inherited is essential: the lab grants this role on the parent
    # Foundry ACCOUNT, and the project inherits it. Without the flag the CLI only
    # reports assignments made at this exact scope, so the check would miss the
    # inherited grant and create a redundant duplicate on every run.
    $existing = Invoke-Az -Arguments @(
        'role', 'assignment', 'list',
        '--assignee', $PrincipalObjectId,
        '--scope', $scope,
        '--role', $script:FoundryProjectManagerRoleId,
        '--include-inherited',
        '-o', 'json'
    ) -AllowFailure

    if ($existing.Success -and $null -ne $existing.Json -and @($existing.Json).Count -gt 0) {
        $scopes = @($existing.Json | ForEach-Object { $_.scope }) -join ', '
        Write-Ok "Role already granted (effective at: $scopes)"
        return
    }

    $create = Invoke-Az -Arguments @(
        'role', 'assignment', 'create',
        '--assignee-object-id', $PrincipalObjectId,
        '--assignee-principal-type', $PrincipalType,
        '--role', $script:FoundryProjectManagerRoleId,
        '--scope', $scope,
        '-o', 'json'
    ) -AllowFailure

    if (-not $create.Success) {
        Write-Warn 'Could not create the Foundry Project Manager role assignment.'
        Write-Warn "  Scope : $scope"
        Write-Warn "  Azure : $($create.Error.Trim())"
        Write-Warn '  Agent creation will fail with 403 unless this role is already granted by other means.'
        Write-Warn '  Check : your account needs Owner, or Role Based Access Control Administrator, on the resource group.'
        return
    }

    Write-Ok "Granted Foundry Project Manager at $scope"
}

<#
.SYNOPSIS
  Extracts the version number from any of the shapes the agents API returns.
.DESCRIPTION
  The data plane answers the two creation calls with two different objects:

    POST /agents                  -> an "agent" object. The version data is
                                     nested under versions.latest, and there is
                                     NO top-level "version" property.
    POST /agents/{name}/versions  -> an "agent.version" object, which does carry
                                     a top-level "version" (and "status").

  This is a live change on Microsoft's side: the agent object used to expose the
  version at the root. See docs/03-implementation-report.md.

  Order of preference: top-level version, then versions.latest.version, then the
  "{name}:{n}" id as a last resort - the id is a composite, so parsing it is
  strictly more fragile than reading the dedicated field.
#>
function Resolve-AgentVersionNumber {
    param(
        [Parameter(Mandatory)]$Response,
        [Parameter(Mandatory)][string]$Context,
        [string]$Hint = ''
    )

    if (Test-HasProperty -Object $Response -Name 'version') {
        return [string]$Response.version
    }

    $latest = $null
    if ((Test-HasProperty -Object $Response -Name 'versions') -and
        (Test-HasProperty -Object $Response.versions -Name 'latest')) {
        $latest = $Response.versions.latest
    }

    if ($null -ne $latest) {
        if (Test-HasProperty -Object $latest -Name 'version') {
            return [string]$latest.version
        }
        if (Test-HasProperty -Object $latest -Name 'id') {
            # id is "{agent name}:{version}"; the name itself may contain no ':'.
            $tail = ([string]$latest.id).Split(':')[-1]
            if (-not [string]::IsNullOrWhiteSpace($tail)) { return $tail }
        }
    }

    # Nothing usable: fall back to the shared validator so the operator gets the
    # standard "available properties" diagnostic instead of a bespoke message.
    return [string](Get-RequiredProperty -Object $Response -Name 'version' -Context $Context -Hint $Hint)
}

<#
.SYNOPSIS
  Reads the provisioning status out of an agent or agent.version response.
.DESCRIPTION
  Mirrors Resolve-AgentVersionNumber: GET on a version returns status at the
  root, while an agent object carries it under versions.latest.status. The
  polling loop below queries the version endpoint, so the root branch is the
  normal path - the nested branch keeps the loop working if that endpoint is
  ever answered with the agent shape.
#>
function Resolve-AgentVersionStatus {
    param([Parameter(Mandatory)]$Response)

    if (Test-HasProperty -Object $Response -Name 'status') {
        return [string]$Response.status
    }
    if ((Test-HasProperty -Object $Response -Name 'versions') -and
        (Test-HasProperty -Object $Response.versions -Name 'latest') -and
        (Test-HasProperty -Object $Response.versions.latest -Name 'status')) {
        return [string]$Response.versions.latest.status
    }
    return ''
}

function Get-HostedAgent {
    param(
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$AgentName
    )

    $url = "$ProjectEndpoint/agents/$AgentName" + "?api-version=$($script:FoundryApiVersion)"
    $result = Invoke-FoundryRest -Method GET -Url $url
    if ($result.Success) { return $result.Json }
    return $null
}

<#
.SYNOPSIS
  Registers the container image as a Foundry hosted agent.
.DESCRIPTION
  Creates the agent when it does not exist (POST /agents), otherwise adds a new
  version (POST /agents/{name}/versions). Both bodies use the documented
  snake_case definition schema with kind=hosted.

  The definition mirrors notebook cell 13 exactly: Responses protocol 1.0.0,
  cpu 1, memory 2Gi, and the same environment variables, so the agent behaves
  identically to the official lab.
#>
function New-HostedAgentVersion {
    param(
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$AgentName,
        [Parameter(Mandatory)][string]$ImageUri,
        [Parameter(Mandatory)][hashtable]$EnvironmentVariables,
        [string]$Cpu = '1',
        [string]$Memory = '2Gi'
    )

    Write-Step "Registering hosted agent '$AgentName' in Microsoft Foundry"

    $definition = [ordered]@{
        kind                    = 'hosted'
        container_configuration = @{ image = $ImageUri }
        cpu                     = $Cpu
        memory                  = $Memory
        protocol_versions       = @(@{ protocol = 'responses'; version = '1.0.0' })
        environment_variables   = $EnvironmentVariables
    }

    $existing = Get-HostedAgent -ProjectEndpoint $ProjectEndpoint -AgentName $AgentName

    if ($null -eq $existing) {
        Write-Info "agent does not exist yet - creating it (this also creates version 1)"
        $url = "$ProjectEndpoint/agents" + "?api-version=$($script:FoundryApiVersion)"
        $body = [ordered]@{ name = $AgentName; definition = $definition } | ConvertTo-Json -Depth 12
    }
    else {
        Write-Info 'agent exists - adding a new version'
        $url = "$ProjectEndpoint/agents/$AgentName/versions" + "?api-version=$($script:FoundryApiVersion)"
        $body = [ordered]@{ definition = $definition } | ConvertTo-Json -Depth 12
    }

    $result = Invoke-FoundryRest -Method POST -Url $url -BodyJson $body

    if (-not $result.Success) {
        throw @(
            "Step failed: $(Get-CurrentStep)",
            "  Resource: hosted agent '$AgentName' at $ProjectEndpoint",
            "  Azure   : $($result.Error.Trim())",
            "  Body    : $($result.Text)",
            '  Check   : 403 means the principal lacks Foundry Project Manager at project scope.',
            '            404 on the endpoint means the project endpoint is wrong.',
            '            400 about the image means ACR permissions or a missing tag.'
        ) -join "`n"
    }

    if ($null -eq $result.Json) {
        throw "Agent creation succeeded but returned no parsable JSON.`n  Response: $($result.Text)"
    }
    # The inspect URL below writes ${AgentName}, not $AgentName: PowerShell
    # allows '?' inside a variable name, so "$AgentName?api-version=" parses as
    # the variable $AgentName?api and, under Set-StrictMode, throws while the
    # argument is being built - before Get-RequiredProperty is ever called.
    # Every other URL in this module appends the query string by concatenation,
    # which is why this was the only line affected.
    $inspectHint = "The service accepted the request but did not report a version. " +
        "Inspect the agent with: az rest --method GET --url " +
        "`"${ProjectEndpoint}/agents/${AgentName}?api-version=$($script:FoundryApiVersion)`" " +
        "--resource https://ai.azure.com"

    $version = Resolve-AgentVersionNumber -Response $result.Json `
        -Context 'Foundry response to the agent creation call' `
        -Hint $inspectHint

    Write-Ok "Agent '$AgentName' registered, version $version"
    return [string]$version
}

<#
.SYNOPSIS
  Polls the agent version until it reaches the documented 'active' status.
.DESCRIPTION
  Replaces the manual wait the notebook asks the reader to perform. Documented
  status values: creating, active, failed, deleting, deleted. Terminates early
  and surfaces the error object on 'failed'.
#>
function Wait-HostedAgentActive {
    param(
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$AgentName,
        [Parameter(Mandatory)][string]$Version,
        [int]$TimeoutMinutes = 15,
        [int]$PollSeconds = 10
    )

    Write-Step "Waiting for agent '$AgentName' version $Version to become active"

    $url = "$ProjectEndpoint/agents/$AgentName/versions/$Version" + "?api-version=$($script:FoundryApiVersion)"
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    $lastStatus = ''
    $attempt = 0

    while ((Get-Date) -lt $deadline) {
        $attempt++
        $result = Invoke-FoundryRest -Method GET -Url $url

        if (-not $result.Success) {
            Write-Info "status query failed (attempt $attempt), retrying: $($result.Error.Trim())"
            Start-Sleep -Seconds $PollSeconds
            continue
        }

        $status = ''
        if ($result.Json) { $status = Resolve-AgentVersionStatus -Response $result.Json }

        if ($status -ne $lastStatus) {
            Write-Info "status: $status"
            $lastStatus = $status
        }
        else {
            $remaining = [int]($deadline - (Get-Date)).TotalSeconds
            Write-Info "status: $status (${remaining}s before timeout)"
        }

        switch ($status) {
            'active' {
                Write-Ok "Agent is active after $attempt checks"
                return
            }
            'failed' {
                $detail = ''
                if ($result.Json.PSObject.Properties.Name -contains 'error') {
                    $detail = ($result.Json.error | ConvertTo-Json -Depth 6)
                }
                throw @(
                    "Agent version $Version failed to provision.",
                    "  Error   : $detail",
                    '  Check   : image_pull_failed / UnauthorizedAcrPull point at ACR RBAC for the Foundry project identity;',
                    '            AcrImageNotFound points at a wrong image tag.'
                ) -join "`n"
            }
            { $_ -in @('deleting', 'deleted') } {
                throw "Agent version $Version reports status '$status' - it is being removed. Aborting."
            }
        }

        Start-Sleep -Seconds $PollSeconds
    }

    throw @(
        "Timed out after $TimeoutMinutes minutes waiting for agent '$AgentName' version $Version.",
        "  Last status: $lastStatus",
        "  Check      : query it manually with",
        "               az rest --method GET --url `"$url`" --resource https://ai.azure.com"
    ) -join "`n"
}
