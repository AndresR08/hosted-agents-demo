# Validate.ps1 - post-deployment verification (notebook cells 15 and 17).
#
# Both tests are non-fatal by design: the deployment can be complete and correct
# while a first invocation still warms up. Failures are reported explicitly and
# reflected in the final summary rather than silently ignored.

Set-StrictMode -Version Latest

function Test-AgentDirect {
    param(
        [Parameter(Mandatory)][string]$ProjectEndpoint,
        [Parameter(Mandatory)][string]$AgentName,
        [string]$Query = 'Hello! What can you help me with?'
    )

    Write-Step 'Validating the agent directly against Foundry'

    $url = "$ProjectEndpoint/agents/$AgentName/endpoint/protocols/openai/responses?api-version=v1"
    $body = @{ input = $Query; stream = $false } | ConvertTo-Json -Depth 4

    $result = Invoke-FoundryRest -Method POST -Url $url -BodyJson $body

    if (-not $result.Success) {
        Write-Failure 'Direct invocation failed.'
        Write-Warn "  Azure : $($result.Error.Trim())"
        Write-Warn '  Check : this is the baseline test. If it fails, the APIM test will fail too.'
        return $false
    }

    Write-Ok 'Agent responded directly'
    $text = Get-ResponseText -Payload $result.Json
    if ($text) { Write-Info "A: $text" }
    return $true
}

function Test-AgentThroughApim {
    param(
        [Parameter(Mandatory)][string]$GatewayUrl,
        [Parameter(Mandatory)][string]$ApiPath,
        [Parameter(Mandatory)][string]$AgentName,
        [Parameter(Mandatory)][string]$ApiKey,
        [string]$Query = 'Hello! What can you help me with?'
    )

    Write-Step 'Validating the agent through APIM'

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $url = "$GatewayUrl/$ApiPath/agents/$AgentName/endpoint/protocols/openai/responses?api-version=v1"
    Write-Info "POST $url"

    # Same headers the notebook sends. APIM's own policy also injects
    # Content-Type and Foundry-Features, plus the managed-identity bearer token.
    $headers = @{
        'api-key'          = $ApiKey
        'Content-Type'     = 'application/json'
        'Foundry-Features' = 'HostedAgents=V1Preview'
    }
    $body = @{ input = $Query; stream = $false } | ConvertTo-Json -Depth 4

    try {
        $response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body -TimeoutSec 120
        Write-Ok 'Agent responded through APIM'
        $text = Get-ResponseText -Payload $response
        if ($text) { Write-Info "A: $text" }
        return $true
    }
    catch {
        Write-Failure 'APIM invocation failed.'
        Write-Warn "  Error : $($_.Exception.Message)"
        Write-Warn '  Check : 401 means a wrong subscription key; 404 means the hosted-agent API path or agent name is wrong;'
        Write-Warn '          500 usually means APIM managed identity lacks access to the Foundry agent project.'
        return $false
    }
}

function Get-ResponseText {
    param($Payload)
    if ($null -eq $Payload) { return $null }
    if ($Payload.PSObject.Properties.Name -contains 'output_text' -and $Payload.output_text) {
        return $Payload.output_text
    }
    if ($Payload.PSObject.Properties.Name -contains 'output' -and $Payload.output) {
        $first = $Payload.output[0]
        if ($first.PSObject.Properties.Name -contains 'content' -and $first.content) {
            return $first.content[0].text
        }
    }
    return $null
}
