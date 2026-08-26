# AgentImage.ps1 - builds the framework agent image in ACR (notebook cell 10).
#
# Uses `az acr build`, exactly like the lab: the image is built remotely in the
# registry, so no local Docker is required and the image is always linux/amd64
# as the hosted-agent platform demands.

Set-StrictMode -Version Latest

<#
.SYNOPSIS
  Waits until the deployer's ACR data-plane role assignments are effective.

.DESCRIPTION
  main.bicep grants the deployer Container Registry Repository Writer and
  Catalog Lister. Those assignments are created at the very end of the ARM
  deployment and are NOT immediately effective on the ACR data plane, so an
  `az acr build` fired straight after the deployment can fail with an
  authentication error on a correctly configured environment.

  This probes the real permission (a catalog list) with backoff instead of
  sleeping a fixed amount of time.
#>
function Wait-AcrDataPlaneReady {
    param(
        [Parameter(Mandatory)][string]$RegistryName,
        [int]$TimeoutSeconds = 300
    )

    Write-Step "Waiting for Container Registry '$RegistryName' data-plane access"

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $attempt = 0
    while ((Get-Date) -lt $deadline) {
        $attempt++
        $probe = Invoke-Az -Arguments @('acr', 'repository', 'list', '--name', $RegistryName, '-o', 'json') -AllowFailure
        if ($probe.Success) {
            Write-Ok "Registry reachable and authorized (attempt $attempt)"
            return
        }
        $remaining = [int]($deadline - (Get-Date)).TotalSeconds
        Write-Info "not authorized yet (attempt $attempt), RBAC still propagating - ${remaining}s left"
        Start-Sleep -Seconds 15
    }

    throw @(
        "Timed out waiting for data-plane access to registry '$RegistryName'.",
        '  Check   : the deployment must grant the running principal Container Registry Repository Writer',
        "            and Catalog Lister on the registry. main.bicep grants these to deployer().objectId,",
        '            so this fails if the Bicep deployment was run by a different principal than this script.'
    ) -join "`n"
}

function Test-AcrArmAuthPolicy {
    param([Parameter(Mandatory)][string]$RegistryName)

    # Foundry pulls the image with an Entra token. The documented troubleshooting
    # for image_pull_failed calls out this registry policy explicitly.
    $policy = Invoke-Az -Arguments @('acr', 'config', 'authentication-as-arm', 'show', '--registry', $RegistryName, '-o', 'json') -AllowFailure
    if ($policy.Success -and $policy.Json -and $policy.Json.status -ne 'enabled') {
        Write-Warn "Registry policy azureADAuthenticationAsArmPolicy is '$($policy.Json.status)'."
        Write-Warn "Foundry image pulls can fail with image_pull_failed. Enable it with:"
        Write-Warn "  az acr config authentication-as-arm update --registry $RegistryName --status enabled"
    }
}

<#
.SYNOPSIS
  Returns the digest of one image tag, or an empty string when it is absent.
.DESCRIPTION
  `az acr repository show --image repo:tag` is the stable (non-preview) way to
  ask whether a tag exists and what it points at. Any failure - including the
  tag simply not being there - returns empty, because the only caller uses this
  as evidence and must not itself fail while gathering evidence.
#>
function Get-AcrImageDigest {
    param(
        [Parameter(Mandatory)][string]$RegistryName,
        [Parameter(Mandatory)][string]$Repository,
        [Parameter(Mandatory)][string]$Tag
    )

    $result = Invoke-Az -Arguments @(
        'acr', 'repository', 'show',
        '--name', $RegistryName,
        '--image', "${Repository}:$Tag",
        '-o', 'json'
    ) -AllowFailure

    if ($result.Success -and $result.Json -and (Test-HasProperty -Object $result.Json -Name 'digest')) {
        return [string]$result.Json.digest
    }
    return ''
}

<#
.SYNOPSIS
  Extracts the ACR run id the CLI prints before it starts streaming logs.
.DESCRIPTION
  `az acr build` announces "Queued a build with ID: dt2" as soon as the server
  accepts the build, which is BEFORE the log streaming that crashes on a
  non-UTF-8 console. So even a crashed invocation leaves the one identifier that
  turns guesswork into a fact: the exact run to ask about. Returns '' when the
  line is absent, which means the build never got queued.
#>
function Get-AcrRunIdFromOutput {
    param([string]$Text)

    if (-not $Text) { return '' }
    $match = [regex]::Match($Text, 'Queued a build with ID:\s*(?<id>[A-Za-z0-9]+)')
    if ($match.Success) { return $match.Groups['id'].Value }
    return ''
}

<#
.SYNOPSIS
  Waits for one ACR run to reach a terminal state.
.DESCRIPTION
  Returns the final status string, or 'Running' if the budget ran out while the
  build was still going. 'Unknown' means the run could not be queried at all.

  This is what makes a crashed CLI survivable without guessing: the server knows
  whether the build succeeded, and asking it is neither a heuristic nor a race.
#>
function Wait-AcrRunTerminal {
    param(
        [Parameter(Mandatory)][string]$RegistryName,
        [Parameter(Mandatory)][string]$RunId,
        [int]$TimeoutSeconds = 600,
        [int]$PollSeconds = 15
    )

    Write-Info "following ACR run '$RunId' on the server (the local log stream died, the build did not)"

    $terminal = @('Succeeded', 'Failed', 'Canceled', 'Cancelled', 'Error', 'Timeout')
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastStatus = ''

    while ((Get-Date) -lt $deadline) {
        $run = Invoke-Az -Arguments @(
            'acr', 'task', 'show-run',
            '--registry', $RegistryName,
            '--run-id', $RunId,
            '-o', 'json'
        ) -AllowFailure

        if ($run.Success -and $run.Json -and (Test-HasProperty -Object $run.Json -Name 'status')) {
            $status = [string]$run.Json.status
            if ($status -ne $lastStatus) {
                Write-Info "  run $RunId status: $status"
                $lastStatus = $status
            }
            if ($terminal -contains $status) { return $status }
        }
        else {
            Write-Info "  run $RunId not queryable yet, retrying"
        }

        Start-Sleep -Seconds $PollSeconds
    }

    if ($lastStatus) { return 'Running' }
    return 'Unknown'
}

<#
.SYNOPSIS
  Builds the agent image in ACR, surviving the Windows console encoding bug.

.DESCRIPTION
  Two defences, in order, both for the same real failure:

  1. PYTHONIOENCODING=utf-8 for the duration of the call. `az acr build` streams
     the remote build log, which contains box-drawing and progress characters.
     On a console whose codepage is not UTF-8 (850 and 1252 are the common
     Windows defaults) the CLI dies with
     `UnicodeEncodeError: 'charmap' codec can't encode character '█'`
     inside colorama - AFTER the build has completed and the image has been
     pushed. Setting the variable only around this call, and restoring the
     previous value in a finally, keeps logs streaming and leaves the operator's
     environment untouched.

  2. If the CLI still reports a failure, ask the registry whether the tag is
     actually there. A present tag with a resolvable digest means the remote
     build succeeded and only the local log stream broke, so the deployment
     continues with a loud warning rather than aborting on a build that worked.
     An absent tag means a real failure and the original error is raised.

  `--no-logs` would also avoid the crash, but it makes `az acr build` return as
  soon as the build is queued: the script would race ahead of an image that does
  not exist yet, and the build log - the first thing anyone needs when a
  Dockerfile fails - would be lost. Hence this approach instead.
#>
function Build-AgentImage {
    param(
        [Parameter(Mandatory)][string]$RegistryName,
        [Parameter(Mandatory)][string]$LabPath,
        [Parameter(Mandatory)][string]$Framework,
        [Parameter(Mandatory)][string]$ImageRepository,
        [Parameter(Mandatory)][string]$ImageTag
    )

    $sourcePath = Join-Path $LabPath (Join-Path 'src' (Join-Path 'frameworks' $Framework))
    $imageRef = "${ImageRepository}:$ImageTag"
    $imageUri = "$RegistryName.azurecr.io/$imageRef"

    Write-Step "Building '$Framework' agent image in ACR ($imageRef)"
    Write-Info "source: $sourcePath (read-only, from the official lab)"

    # Baseline BEFORE building. Without it, a tag that already existed makes any
    # later "the tag is there" check meaningless: a genuinely failed build would
    # be waved through on the digest of the previous image. Empty when absent.
    $digestBefore = Get-AcrImageDigest -RegistryName $RegistryName -Repository $ImageRepository -Tag $ImageTag
    if ($digestBefore) {
        Write-Info "tag '$ImageTag' already exists (digest $digestBefore); a new image must change it"
    }

    $savedEncoding = [Environment]::GetEnvironmentVariable('PYTHONIOENCODING')
    try {
        [Environment]::SetEnvironmentVariable('PYTHONIOENCODING', 'utf-8')
        $result = Invoke-Az -Arguments @(
            'acr', 'build',
            '--registry', $RegistryName,
            '--image', $imageRef,
            $sourcePath
        ) -AllowFailure
    }
    finally {
        [Environment]::SetEnvironmentVariable('PYTHONIOENCODING', $savedEncoding)
    }

    if ($result.Success) {
        Write-Ok "Image pushed: $imageUri"
        return $imageUri
    }

    $azureError = ''
    if ($result.Error) { $azureError = $result.Error.Trim() }
    $lastErrorLine = ''
    if ($azureError) { $lastErrorLine = $azureError.Split("`n")[-1] }

    Write-Warn 'az acr build reported a failure. Establishing what the SERVER says happened.'
    if ($lastErrorLine) { Write-Info "  CLI error: $lastErrorLine" }

    # The run id is announced before log streaming begins, so a stream crash
    # still leaves it behind. With it, the server answers the only question that
    # matters - did the build succeed - instead of us racing the push.
    $runId = Get-AcrRunIdFromOutput -Text "$($result.Text)`n$azureError"
    $runStatus = 'Unknown'
    if ($runId) {
        $runStatus = Wait-AcrRunTerminal -RegistryName $RegistryName -RunId $runId
    }
    else {
        Write-Warn '  The CLI failed before the build was queued (no run id in its output).'
    }

    # A build the server calls Failed is a real failure, whatever is in the registry.
    if (@('Failed', 'Canceled', 'Cancelled', 'Error', 'Timeout') -contains $runStatus) {
        throw @(
            "Step failed: $(Get-CurrentStep)",
            "  Resource: registry $RegistryName, image $imageRef",
            "  ACR run : $runId reached status '$runStatus' - the remote build genuinely failed.",
            "  Azure   : $azureError",
            "  Check   : az acr task logs --registry $RegistryName --run-id $runId",
            '            A permission error means the ACR repository-write role has not propagated;',
            '            anything else is the lab Dockerfile or its requirements failing to build.'
        ) -join "`n"
    }

    # Still building when the budget ran out: unresolved, so unsafe by definition.
    if ($runStatus -eq 'Running') {
        throw @(
            "Step failed: $(Get-CurrentStep)",
            "  Resource: registry $RegistryName, image $imageRef",
            "  ACR run : $runId was still running when the wait budget expired.",
            '  Meaning : BUILD NOT CONFIRMED. The hosted agent is NOT registered against an image',
            '            whose build has not finished.',
            "  Check   : az acr task show-run --registry $RegistryName --run-id $runId -o table",
            '            Once it reports Succeeded, resume without rebuilding:',
            "              .\deploy.ps1 -SkipInfrastructure -SkipImageBuild -ImageTag $ImageTag"
        ) -join "`n"
    }

    # Server says Succeeded (or could not be asked). Either way the registry now
    # has to prove a NEW image exists - a pre-existing tag is never enough.
    $digestAfter = Get-AcrImageDigest -RegistryName $RegistryName -Repository $ImageRepository -Tag $ImageTag

    if ($digestAfter -and ($digestAfter -ne $digestBefore)) {
        Write-Warn 'The Azure CLI failed, but the remote build completed and produced a new image.'
        if ($runId) { Write-Warn "  ACR run $runId reported status '$runStatus'." }
        if ($digestBefore) {
            Write-Warn "  The tag moved to a different digest:"
            Write-Warn "    before: $digestBefore"
            Write-Warn "    after : $digestAfter"
        }
        else {
            Write-Warn '  The tag did not exist before this build and is now present.'
        }
        Write-Warn '  This is the Windows console-encoding failure in az acr build (the CLI runs'
        Write-Warn '  python -I, so PYTHONIOENCODING cannot fix it); the deployment continues with'
        Write-Warn '  the image the server actually produced.'
        Write-Ok "Image confirmed in the registry: $imageUri"
        Write-Ok "Digest: $digestAfter"
        return $imageUri
    }

    if ($digestAfter -and ($digestAfter -eq $digestBefore)) {
        throw @(
            "Step failed: $(Get-CurrentStep)",
            "  Resource: registry $RegistryName, image $imageRef",
            "  ACR run : $runId reported '$runStatus'",
            "  Azure   : $azureError",
            "  Registry: the tag '$ImageTag' still points at the digest it had BEFORE this build",
            "            ($digestAfter), so this build produced no new image.",
            '  Meaning : the pre-existing image was NOT accepted as the build output. Registering the',
            '            hosted agent against it would deploy stale code under a tag that claims to be new.',
            '  Check   : to deliberately reuse that exact image instead of building, re-run with',
            "              .\deploy.ps1 -SkipImageBuild -ImageTag $ImageTag"
        ) -join "`n"
    }

    throw @(
        "Step failed: $(Get-CurrentStep)",
        "  Resource: registry $RegistryName, image $imageRef",
        "  ACR run : $runId reported '$runStatus'",
        "  Azure   : $azureError",
        "  Registry: the tag '$ImageTag' is NOT present in repository '$ImageRepository'.",
        '  Meaning : BUILD NOT CONFIRMED - no image to deploy, so the hosted agent is not registered.',
        "  Check   : az acr task list-runs --registry $RegistryName --top 5 -o table"
    ) -join "`n"
}
