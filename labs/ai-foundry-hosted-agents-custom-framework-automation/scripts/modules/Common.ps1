# Common.ps1 - logging, step tracking and the single Azure CLI wrapper.
#
# Every az invocation in this automation goes through Invoke-Az so that there is
# exactly one place that captures stderr, checks the exit code and reports which
# step / resource failed. Nothing here swallows a non-zero exit code.
#
# Windows PowerShell 5.1 compatible: no ternary, no ??, no pipeline chain operators.

Set-StrictMode -Version Latest

$script:CurrentStep = '<none>'

function Write-Step {
    param([string]$Message)
    $script:CurrentStep = $Message
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info    { param([string]$m) Write-Host "    $m" -ForegroundColor Gray }
function Write-Ok      { param([string]$m) Write-Host "  + $m" -ForegroundColor Green }
function Write-Warn    { param([string]$m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Write-Failure { param([string]$m) Write-Host "  x $m" -ForegroundColor Red }

function Get-CurrentStep { return $script:CurrentStep }

<#
.SYNOPSIS
  Runs an Azure CLI command and fails loudly with full context.

.DESCRIPTION
  Returns the parsed JSON object when -AsJson is used, otherwise the raw stdout
  text. On a non-zero exit code it throws a message naming the step, the exact
  command, the resource being touched and what the operator should check.

  stderr is redirected to a temp file rather than merged with 2>&1: in Windows
  PowerShell 5.1, merging a native command's stderr wraps each line in an
  ErrorRecord and corrupts $? even on success.
#>
function Invoke-Az {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$Resource = '',
        [string]$Hint = '',
        [switch]$AsJson,
        [switch]$AllowFailure
    )

    $display = 'az ' + ($Arguments -join ' ')
    Write-Info "run: $display"

    $errFile = [System.IO.Path]::GetTempFileName()
    try {
        # The caller runs with $ErrorActionPreference = 'Stop'. When a native
        # command writes to stderr, Windows PowerShell raises a NativeCommandError,
        # which under 'Stop' terminates at the invocation line - before the exit
        # code can be inspected, defeating -AllowFailure entirely. Relaxing the
        # preference for this single call is what makes exit-code handling work;
        # it is function-scoped, so the caller's 'Stop' is unaffected.
        $ErrorActionPreference = 'Continue'
        $stdout = & az @Arguments 2>$errFile
        $exit = $LASTEXITCODE
        $stderr = ''
        if (Test-Path $errFile) {
            $stderr = Get-CleanErrorText (Get-Content -Path $errFile -Raw -ErrorAction SilentlyContinue)
        }
    }
    finally {
        Remove-Item -Path $errFile -Force -ErrorAction SilentlyContinue
    }

    $text = ''
    if ($null -ne $stdout) { $text = ($stdout -join "`n") }

    if ($exit -ne 0) {
        if ($AllowFailure) {
            return [pscustomobject]@{ Success = $false; ExitCode = $exit; Text = $text; Error = $stderr; Json = $null }
        }
        $lines = @()
        $lines += "Step failed: $(Get-CurrentStep)"
        $lines += "  Command : $display"
        if ($Resource) { $lines += "  Resource: $Resource" }
        $lines += "  Exit    : $exit"
        if ($stderr) { $lines += "  Azure   : $($stderr.Trim())" }
        if ($Hint)   { $lines += "  Check   : $Hint" }
        throw ($lines -join "`n")
    }

    # -AllowFailure callers read .Json to decide whether a resource exists, so the
    # payload must be parsed for them too - not only for -AsJson. A parse failure
    # is fatal for -AsJson (the caller asked for an object) but tolerated for
    # -AllowFailure, where non-JSON output is a legitimate outcome.
    $json = $null
    if (($AsJson -or $AllowFailure) -and $text.Trim()) {
        try { $json = $text | ConvertFrom-Json }
        catch {
            if ($AllowFailure -and -not $AsJson) {
                $json = $null
            }
            else {
                throw @(
                    "Step failed: $(Get-CurrentStep)",
                    "  Command : $display",
                    '  Reason  : Azure CLI returned output that is not valid JSON.',
                    "  Output  : $($text.Substring(0, [Math]::Min(400, $text.Length)))"
                ) -join "`n"
            }
        }
    }

    if ($AllowFailure) {
        return [pscustomobject]@{ Success = $true; ExitCode = 0; Text = $text; Error = ''; Json = $json }
    }
    if ($AsJson) { return $json }
    return $text
}

<#
.SYNOPSIS
  Calls a Foundry Agent Service data-plane endpoint via `az rest`.

.DESCRIPTION
  Uses --resource https://ai.azure.com, which the official documentation states
  is REQUIRED for every az rest call against Foundry data-plane endpoints:
  without it az rest cannot derive the AAD audience from the URL and auth fails.

  Returns a result object rather than throwing, so callers can distinguish a
  legitimate 404 (agent does not exist yet) from a real error.
#>
function Invoke-FoundryRest {
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'POST', 'PATCH', 'DELETE')][string]$Method,
        [Parameter(Mandatory)][string]$Url,
        [string]$BodyJson,
        [string[]]$Headers
    )

    $azArgs = @('rest', '--method', $Method, '--url', $Url, '--resource', 'https://ai.azure.com')

    $bodyFile = $null
    if ($BodyJson) {
        # Passing JSON inline through the CLI on Windows is a quoting minefield;
        # @file is the documented, quoting-safe form.
        $bodyFile = Join-Path ([System.IO.Path]::GetTempPath()) ("foundry-body-{0}.json" -f ([guid]::NewGuid().ToString('N')))
        Set-Content -Path $bodyFile -Value $BodyJson -Encoding utf8
        $azArgs += @('--body', "@$bodyFile")
    }
    if ($Headers) { $azArgs += @('--headers') + $Headers }

    try {
        $result = Invoke-Az -Arguments $azArgs -AllowFailure
    }
    finally {
        if ($bodyFile) { Remove-Item -Path $bodyFile -Force -ErrorAction SilentlyContinue }
    }

    $json = $null
    if ($result.Text -and $result.Text.Trim()) {
        try { $json = $result.Text | ConvertFrom-Json } catch { $json = $null }
    }

    return [pscustomobject]@{
        Success = $result.Success
        Json    = $json
        Text    = $result.Text
        Error   = $result.Error
    }
}

<#
.SYNOPSIS
  Strips PowerShell's NativeCommandError decoration from captured stderr.
.DESCRIPTION
  Windows PowerShell wraps each stderr line of a native command in an
  ErrorRecord, so the captured text carries the "az.cmd : " prefix plus the
  script position, CategoryInfo and FullyQualifiedErrorId noise. Only the
  actual Azure message is useful to the operator.
#>
function Get-CleanErrorText {
    param([string]$Text)

    if (-not $Text) { return '' }

    $keep = @()
    foreach ($line in ($Text -split "`r?`n")) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed -match '^(En |At )\S+.*:\s*\d+') { continue }
        if ($trimmed -match '^\+') { continue }
        if ($trimmed -match '^(\+ )?(CategoryInfo|FullyQualifiedErrorId)') { continue }
        if ($trimmed -match '^~+$') { continue }
        $keep += ($trimmed -replace '^az(\.cmd)?\s*:\s*', '')
    }
    return (($keep -join "`n").Trim())
}

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

# ---------------------------------------------------------------------------
# Strict property access.
#
# In PowerShell, reading a property that does not exist on a JSON-deserialised
# object yields $null instead of an error, so a renamed or missing ARM output
# silently propagates $null into an endpoint, a registry name or a key, and the
# failure only surfaces much later as an unrelated HTTP error. Every value this
# automation depends on is read through these helpers, which fail immediately
# and say exactly which property was missing and what was actually available.
# ---------------------------------------------------------------------------

function Test-HasProperty {
    param($Object, [Parameter(Mandatory)][string]$Name)
    if ($null -eq $Object) { return $false }
    return (@($Object.PSObject.Properties.Name) -contains $Name)
}

function Get-AvailablePropertyNames {
    param($Object)
    if ($null -eq $Object) { return '(object is null)' }
    $names = @($Object.PSObject.Properties.Name)
    if ($names.Count -eq 0) { return '(no properties)' }
    return ($names -join ', ')
}

<#
.SYNOPSIS
  Reads a property that must exist and must not be null or empty.
.PARAMETER Context
  Human description of where the value comes from, used in the error message.
#>
function Get-RequiredProperty {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Context,
        [string]$Hint = ''
    )

    if ($null -eq $Object) {
        throw (Format-ValidationError -Context $Context -Name $Name -Reason 'the containing object is null' -Hint $Hint)
    }
    if (-not (Test-HasProperty -Object $Object -Name $Name)) {
        throw (Format-ValidationError -Context $Context -Name $Name `
            -Reason "the property does not exist. Available: $(Get-AvailablePropertyNames -Object $Object)" -Hint $Hint)
    }

    $value = $Object.$Name
    if ($null -eq $value) {
        throw (Format-ValidationError -Context $Context -Name $Name -Reason 'the value is null' -Hint $Hint)
    }
    if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) {
        throw (Format-ValidationError -Context $Context -Name $Name -Reason 'the value is an empty string' -Hint $Hint)
    }
    if ($value -is [System.Array] -and $value.Count -eq 0) {
        throw (Format-ValidationError -Context $Context -Name $Name -Reason 'the array is empty' -Hint $Hint)
    }

    return $value
}

function Format-ValidationError {
    param([string]$Context, [string]$Name, [string]$Reason, [string]$Hint)
    $lines = @(
        "Required value '$Name' is unusable ($Context).",
        "  Reason  : $Reason"
    )
    if ($Hint) { $lines += "  Check   : $Hint" }
    return ($lines -join "`n")
}

<#
.SYNOPSIS
  Asserts that a computed (not directly read) value is present.
#>
function Assert-NotNullOrEmpty {
    param(
        [AllowNull()][AllowEmptyString()]$Value,
        [Parameter(Mandatory)][string]$Name,
        [string]$Hint = ''
    )
    if ($null -eq $Value -or ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value))) {
        $lines = @("Required value '$Name' is null or empty.")
        if ($Hint) { $lines += "  Check   : $Hint" }
        throw ($lines -join "`n")
    }
    return $Value
}
