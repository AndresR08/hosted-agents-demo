<#
.SYNOPSIS
  Refreshes vendor/ai-gateway/ from Azure-Samples/AI-Gateway.

.DESCRIPTION
  This repository vendors the official lab and the shared Bicep modules its
  main.bicep reaches, so that deploy.ps1 needs no external checkout of
  AI-Gateway. This script is what puts them there - both the first time and on
  every later sync, so the two paths cannot drift apart.

  Two properties are load-bearing and deliberate:

  1. Vendored files are byte-identical to upstream. Nothing is patched on the
     way in. A sync is therefore a copy, never a merge, and never conflicts.
  2. The two-level layout of upstream is preserved (vendor/ai-gateway/labs/<lab>
     and vendor/ai-gateway/modules). main.bicep refers to '../../modules/...',
     and that relative path has to keep resolving without editing the file.

  The vendored module set is not the whole of upstream's modules/ folder: it is
  exactly the transitive closure of main.bicep. All five APIM specs are included
  even though this lab only uses AzureAI, because loadJsonContent resolves at
  compile time across every branch of the ternary in inference-api.bicep -
  verified by removing them and watching the build fail with BCP091.

.PARAMETER UpstreamDir
  An existing checkout of AI-Gateway to copy from. When omitted, a shallow clone
  is made into a temporary folder and removed afterwards. CI passes its own
  checkout here so the workflow does not clone twice.

.PARAMETER Ref
  A specific upstream commit to vendor, instead of whatever is at the tip of
  main. This is how vendor/ stays pinned: the deployed environment was built
  from a particular revision of the shared Bicep modules, and picking up a newer
  one silently changes infrastructure on the next deployment. Moving the pin is
  a deliberate act, tested against a disposable resource group first.

  Ignored when -UpstreamDir is given: that checkout is used as it stands.

.PARAMETER SkipBuildCheck
  Skips the az bicep build verification. Only for environments without the Azure
  CLI; the check is the point of the script and should normally run.

.EXAMPLE
  .\sync-vendor.ps1
  Clones upstream at the tip of main, refreshes vendor/, verifies it compiles.

.EXAMPLE
  .\sync-vendor.ps1 -Ref 561d71992bd660af94efc76a8f2f21df0e6ac8e5
  Vendors that exact commit. Used to pin, or to roll back to, a known revision.

.EXAMPLE
  .\sync-vendor.ps1 -UpstreamDir ./upstream
  Same, reusing a checkout CI already made.
#>

[CmdletBinding()]
param(
    [string]$UpstreamDir,
    [string]$Ref,
    [switch]$SkipBuildCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot   = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptRoot))
$vendorRoot = Join-Path $repoRoot 'vendor/ai-gateway'
$labName    = 'ai-foundry-hosted-agents-custom-framework'

function Write-Step { param([string]$m) Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok   { param([string]$m) Write-Host "    $m" -ForegroundColor Green }

# The transitive closure of main.bicep, plus the notebook's own Python helper.
# Every path is relative to the upstream repository root, and lands at the same
# relative path under vendor/ai-gateway/ - that sameness is what keeps
# '../../modules/...' resolving.
$moduleFiles = @(
    'modules/azure-roles.json'
    'modules/apim/v3/apim.bicep'
    'modules/apim/v3/inference-api.bicep'
    'modules/apim/v3/specs/AIFoundryAzureAI.json'
    'modules/apim/v3/specs/AIFoundryOpenAI.json'
    'modules/apim/v3/specs/AIFoundryOpenAIV1.json'
    'modules/apim/v3/specs/LLMOpenAI.json'
    'modules/apim/v3/specs/PassThrough.json'
    'modules/cognitive-services/v3/foundry.bicep'
    'modules/cognitive-services/v3/deployments.bicep'
    'modules/monitor/v1/appinsights.bicep'
    'modules/operational-insights/v1/workspaces.bicep'
)

# Not needed to deploy - deploy.ps1 is pure PowerShell - but the automation's
# comments refer to notebook cells throughout, and utils.py is what those cells
# call. Without them those references point at nothing.
$extraFiles = @(
    'shared/utils.py'
    'LICENSE.md'
)

# The lab folder is copied wholesale, so nothing enumerates its contents - which
# means a partially populated source would be copied partially and silently. It
# happened: a git clone onto a deep Windows path failed MAX_PATH on three files,
# the copy succeeded, and `az bicep build` still passed because none of the three
# was a Bicep file. The missing requirements-*.txt would only have surfaced much
# later, as a failed `az acr build`.
#
# These are the files something downstream actually opens: deploy.ps1 through
# Test-LabSources, the Dockerfiles through their pip install, and the notebook as
# the reference the automation's comments point at.
$labRequiredFiles = @(
    'main.bicep'
    'policy.xml'
    'hosted-agent-policy.xml'
    'ai-foundry-hosted-agents-custom-framework.ipynb'
    'clean-up-resources.ipynb'
    'src/frameworks/pydantic/Dockerfile'
    'src/frameworks/pydantic/main.py'
    'src/frameworks/pydantic/requirements-pydantic.txt'
    'src/frameworks/strands/Dockerfile'
    'src/frameworks/strands/main.py'
    'src/frameworks/strands/requirements-strands.txt'
)

# Both are declared before the try so the finally can test them even if the run
# fails before either is assigned - Set-StrictMode makes an unassigned variable
# an error, not an empty value.
$tempClone = $null
$staging   = $null
try {
    # ------------------------------------------------------------- UPSTREAM
    if (-not $UpstreamDir) {
        # A short temp path on purpose: this repository's deepest upstream file
        # is long enough that cloning under an already-deep directory fails
        # MAX_PATH on Windows, which is how the truncated-source bug was found.
        $tempClone = Join-Path ([System.IO.Path]::GetTempPath()) "aigw-$([guid]::NewGuid().ToString('N').Substring(0,8))"

        if ($Ref) {
            # `git clone --depth 1` can only take the tip of a branch, so a
            # pinned commit is fetched by object id into an empty repository.
            Write-Step "Fetching Azure-Samples/AI-Gateway at $Ref into $tempClone"
            New-Item -ItemType Directory -Path $tempClone -Force | Out-Null
            git -C $tempClone init --quiet
            if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
            git -C $tempClone remote add origin https://github.com/Azure-Samples/AI-Gateway.git
            if ($LASTEXITCODE -ne 0) { throw 'git remote add failed.' }
            git -C $tempClone fetch --depth 1 --quiet origin $Ref
            if ($LASTEXITCODE -ne 0) {
                throw @(
                    "Could not fetch commit '$Ref' from Azure-Samples/AI-Gateway."
                    '  Check   : the commit must exist and be reachable from a branch or tag.'
                    '            A full 40-character SHA is required; abbreviations are not'
                    '            accepted when fetching by object id.'
                ) -join "`n"
            }
            git -C $tempClone checkout --quiet FETCH_HEAD
            if ($LASTEXITCODE -ne 0) { throw "git checkout of '$Ref' failed." }
        }
        else {
            Write-Step "Cloning Azure-Samples/AI-Gateway (shallow) into $tempClone"
            git clone --depth 1 --quiet https://github.com/Azure-Samples/AI-Gateway.git $tempClone
            if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
        }
        $UpstreamDir = $tempClone
    }
    elseif ($Ref) {
        Write-Warning "-Ref is ignored when -UpstreamDir is given; using that checkout as it stands."
    }

    $UpstreamDir = (Resolve-Path $UpstreamDir).Path
    if (-not (Test-Path (Join-Path $UpstreamDir 'modules'))) {
        throw "Not an AI-Gateway checkout (no modules/ folder): $UpstreamDir"
    }

    $sha  = (git -C $UpstreamDir rev-parse HEAD).Trim()
    $date = (git -C $UpstreamDir log -1 --format=%ad --date=short).Trim()

    # Fetching by object id should land exactly on the requested commit, but a
    # silent mismatch here would vendor the wrong revision under a NOTICE.md
    # claiming otherwise - the one failure this file exists to prevent.
    if ($Ref -and $tempClone -and $sha -ne $Ref) {
        throw "Asked for commit '$Ref' but the checkout is at '$sha'."
    }
    Write-Ok "upstream $sha ($date)"

    # --------------------------------------------------------------- COPY
    # Everything is built in a staging folder and only swapped into place once it
    # is complete and verified. The obvious alternative - delete vendor/ and
    # refill it - destroys a perfectly good vendored copy whenever the refresh
    # fails, which is exactly what happened the first time this script was
    # exercised against a truncated clone.
    #
    # The tree is rebuilt rather than merged so that a file deleted upstream
    # disappears here too, instead of lingering as an orphan no sync removes.
    Write-Step "Staging a refreshed copy of $vendorRoot"
    $staging = Join-Path ([System.IO.Path]::GetTempPath()) "vendor-stage-$([guid]::NewGuid().ToString('N').Substring(0,8))"
    if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null

    $labSource = Join-Path $UpstreamDir "labs/$labName"
    if (-not (Test-Path (Join-Path $labSource 'main.bicep'))) {
        throw "The lab folder is missing or has no main.bicep: $labSource"
    }
    # Checked before the copy, so a truncated source is rejected rather than
    # propagated into vendor/.
    $missingAtSource = @($labRequiredFiles | Where-Object { -not (Test-Path (Join-Path $labSource $_)) })
    if ($missingAtSource.Count -gt 0) {
        throw @(
            'The upstream lab folder is incomplete. Refusing to vendor a partial copy.'
            "  Source  : $labSource"
            "  Missing : $($missingAtSource -join ', ')"
            '  Check   : on Windows this is usually a git clone that hit MAX_PATH.'
            '            Clone to a shorter path, or enable long paths with'
            '              git config --global core.longpaths true'
        ) -join "`n"
    }

    $labTarget = Join-Path $staging "labs/$labName"
    New-Item -ItemType Directory -Path (Split-Path -Parent $labTarget) -Force | Out-Null
    Copy-Item -Recurse -Path $labSource -Destination $labTarget

    # And again after the copy: the copy itself can lose files to MAX_PATH.
    $missingAtTarget = @($labRequiredFiles | Where-Object { -not (Test-Path (Join-Path $labTarget $_)) })
    if ($missingAtTarget.Count -gt 0) {
        throw @(
            'Files were lost while copying the lab folder into vendor/.'
            "  Missing : $($missingAtTarget -join ', ')"
            '  Check   : the destination path may exceed the Windows path limit.'
        ) -join "`n"
    }
    Write-Ok "labs/$labName ($($labRequiredFiles.Count) required files present)"

    foreach ($rel in ($moduleFiles + $extraFiles)) {
        $src = Join-Path $UpstreamDir $rel
        if (-not (Test-Path $src)) {
            throw @(
                "Upstream no longer has a file this repository vendors: $rel"
                '  This means the dependency set changed. Re-derive the transitive'
                '  closure of main.bicep before editing the list in this script.'
            ) -join "`n"
        }
        $dst = Join-Path $staging $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
        Copy-Item -Path $src -Destination $dst
    }
    Write-Ok "$($moduleFiles.Count) module files, $($extraFiles.Count) support files"

    # ------------------------------------------------------------- NOTICE
    $notice = @"
# Vendored from Azure-Samples/AI-Gateway

| | |
|---|---|
| Source | https://github.com/Azure-Samples/AI-Gateway |
| Commit | ``$sha`` |
| Commit date | $date |
| Vendored on | $(Get-Date -Format 'yyyy-MM-dd') |
| License | MIT - see [LICENSE.md](LICENSE.md), Copyright (c) Microsoft Corporation |

Redistributed under the MIT License, which permits it provided the copyright
notice and permission notice are preserved. They are, in ``LICENSE.md``, unmodified.
$(if ($Ref) { @"

## This copy is pinned

The commit above is **pinned deliberately**, not simply whatever was at the tip
of ``main`` when this ran. The shared Bicep modules define the deployed
infrastructure, so picking up a newer revision changes real resources on the
next ``deploy.ps1`` run - quietly, because the template still compiles.

Moving the pin is a deliberate act: refresh with a new ``-Ref``, deploy the result
to a **disposable resource group** first, and only then apply it to an
environment anyone depends on.

``````
pwsh scripts/sync-vendor.ps1 -Ref <full 40-character SHA>
``````
"@ })

## Do not edit these files here

They are byte-identical to upstream, and ``scripts/sync-vendor.ps1`` rebuilds this
folder from scratch on every sync. Edits would be silently discarded, and would
turn each sync from a copy into a merge conflict. Fix things upstream, or in the
automation that consumes them.

## What is vendored, and why exactly this

``labs/$labName/`` in full, plus the transitive closure of its ``main.bicep``:

$(($moduleFiles | ForEach-Object { "- ``$_``" }) -join "`n")

All five APIM specs are present although this lab only ever uses ``AzureAI``.
``loadJsonContent`` is a compile-time function, so Bicep resolves **every branch**
of the ternary in ``inference-api.bicep`` regardless of which one runs. Removing
the four unused specs fails the build with ``BCP091``.

The layout mirrors upstream's two-level depth on purpose: ``main.bicep`` refers to
``../../modules/...``, and that path has to keep resolving without patching the file.

Also vendored, for the notebook rather than for the automation:

$(($extraFiles | ForEach-Object { "- ``$_``" }) -join "`n")

``deploy.ps1`` is pure PowerShell and needs no Python. ``shared/utils.py`` is here
because the automation's comments refer to notebook cells throughout, and those
cells call it.

## Refreshing

``````
pwsh labs/$labName-automation/scripts/sync-vendor.ps1
``````

A monthly GitHub Actions workflow does the same and opens a pull request. It
never merges on its own.
"@
    Set-Content -Path (Join-Path $staging 'NOTICE.md') -Value $notice -Encoding utf8
    Write-Ok 'NOTICE.md'

    # -------------------------------------------------------------- VERIFY
    # A vendored copy that does not compile must never reach a commit or a pull
    # request, so this failure is fatal.
    if (-not $SkipBuildCheck) {
        Write-Step 'Verifying the vendored template compiles'
        $outFile = Join-Path ([System.IO.Path]::GetTempPath()) "vendor-verify-$([guid]::NewGuid().ToString('N').Substring(0,8)).json"
        $errFile = "$outFile.err"
        $mainBicep = Join-Path $labTarget 'main.bicep'

        # stderr goes to a file rather than through 2>&1. In Windows PowerShell
        # 5.1 the latter wraps every stderr line in an ErrorRecord, which under
        # $ErrorActionPreference = 'Stop' aborts on az's routine "a new Bicep
        # release is available" warning - a successful build reported as a
        # failure. The same reason Invoke-Az in modules/Common.ps1 does this.
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & az bicep build --file $mainBicep --outfile $outFile 2>$errFile | Out-Null
            $exit = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $prevEap }

        if ($exit -ne 0 -or -not (Test-Path $outFile)) {
            $detail = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { '' }
            Remove-Item $errFile -Force -ErrorAction SilentlyContinue
            throw @(
                'az bicep build failed on the vendored template.'
                'The vendored file set is incomplete or inconsistent with upstream.'
                $detail
            ) -join "`n"
        }
        Write-Ok "compiles - $([math]::Round((Get-Item $outFile).Length / 1KB)) KB of ARM"
        Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue
    }

    # --------------------------------------------------------------- PUBLISH
    # Only now, with a complete and compiling copy in hand, is the existing
    # vendor/ folder touched. Everything above can fail without leaving the
    # repository worse than it was found.
    Write-Step "Publishing into $vendorRoot"
    if (Test-Path $vendorRoot) { Remove-Item -Recurse -Force $vendorRoot }
    New-Item -ItemType Directory -Path (Split-Path -Parent $vendorRoot) -Force | Out-Null
    Move-Item -Path $staging -Destination $vendorRoot
    $staging = $null

    Write-Host ''
    Write-Ok "vendor/ai-gateway is at upstream $($sha.Substring(0,7)) ($date)"
    Write-Host ''
}
finally {
    if ($tempClone -and (Test-Path $tempClone)) {
        Remove-Item -Recurse -Force $tempClone -ErrorAction SilentlyContinue
    }
    # Set to $null once published; anything left here is a failed run's staging.
    if ($staging -and (Test-Path $staging)) {
        Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
    }
}
