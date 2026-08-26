<#
.SYNOPSIS
  Deletes the lab resource group, mirroring the lab's clean-up-resources notebook.

.DESCRIPTION
  Destructive. Deleting the resource group removes APIM, both Foundry
  resources, the container registry, Log Analytics, every hosted agent, and the
  App Service plan and site that deploy.ps1 created for the companion demo -
  all of them live in this one resource group.

  Interactively it asks for confirmation. Non-interactively - a scheduled task,
  CI, or another script - there is no prompt to answer, so -Force is required.
  There is deliberately no affirmative default: without -Force a non-interactive
  run stops and says so rather than deleting anything.

.PARAMETER Force
  Skips the confirmation prompt. Required when there is no console to prompt on.
  -WhatIf still takes precedence and still deletes nothing.

.EXAMPLE
  .\teardown.ps1 -ResourceGroupName lab-ai-foundry-hosted-agents-custom-framework
  Interactive: prompts before deleting.

.EXAMPLE
  .\teardown.ps1 -ResourceGroupName rg-scratch-20260826 -Force -NoWait
  Unattended: no prompt, returns as soon as the deletion is accepted.
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [string]$SubscriptionId,
    [string]$ResourceGroupName,
    [switch]$NoWait,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir    = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot 'modules\Common.ps1')

if (-not $ResourceGroupName) {
    $config = Import-PowerShellDataFile -Path (Join-Path $rootDir 'config\lab.defaults.psd1')
    $ResourceGroupName = $config.ResourceGroupName
}

try {
    if ($SubscriptionId) {
        Invoke-Az -Arguments @('account', 'set', '--subscription', $SubscriptionId) | Out-Null
    }

    Write-Step "Checking resource group '$ResourceGroupName'"
    $existing = Invoke-Az -Arguments @('group', 'show', '--name', $ResourceGroupName, '-o', 'json') -AllowFailure
    if (-not $existing.Success) {
        Write-Ok "Resource group '$ResourceGroupName' does not exist. Nothing to do."
        return
    }

    # -Force suppresses the prompt by lowering ConfirmPreference for this scope
    # only. ShouldProcess is still called, so -WhatIf keeps working and still
    # deletes nothing. Without -Force and without a console, ShouldProcess
    # cannot prompt and throws a host exception whose message says nothing about
    # what to do; that is translated below into an actionable one.
    if ($Force) { $ConfirmPreference = 'None' }

    $proceed = $false
    try {
        $proceed = $PSCmdlet.ShouldProcess($ResourceGroupName, 'Delete resource group and all resources in it')
    }
    catch {
        throw @(
            "Cannot ask for confirmation: this session has no interactive console."
            "  Resource group : $ResourceGroupName"
            '  Check          : re-run with -Force to confirm the deletion explicitly,'
            '                   or run it from an interactive shell to be prompted.'
        ) -join "`n"
    }

    if ($proceed) {
        $azArgs = @('group', 'delete', '--name', $ResourceGroupName, '--yes')
        if ($NoWait) { $azArgs += '--no-wait' }
        Invoke-Az -Arguments $azArgs -Resource "resource group $ResourceGroupName" `
            -Hint 'A resource lock or a policy assignment can block deletion.' | Out-Null
        Write-Ok "Deletion requested for '$ResourceGroupName'"
    }
}
catch {
    Write-Failure 'TEARDOWN FAILED'
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
