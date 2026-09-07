<#
.SYNOPSIS
  Lists the API Management instances this account can see. Read-only.

.DESCRIPTION
  A lookup, not a tool. It answers one question - "what could I pass to
  -SharedApimName?" - and stops there. It writes nothing, stores nothing, has no
  configuration of its own, and makes no decision on anyone's behalf: the point
  is that a human reads the table and picks a name.

  That shape is deliberate. DESIGN_DECISIONS.md 8.2 declines to build a
  standalone-APIM mode on the grounds that a code path nobody runs decays
  unnoticed, and the same argument applies to helper tooling. Anything here that
  remembered a previous answer, or had settings to keep in step with
  lab.defaults.psd1, would be one more thing to go stale. Having no state is
  what keeps this correct without anyone maintaining it.

  It marks the instance this lab is currently configured against, when that can
  be read. If it cannot, the listing prints anyway - a convenience is not worth
  a failure.

.PARAMETER SubscriptionId
  Subscription to look in. Defaults to the current `az` subscription.

.PARAMETER ResourceGroupName
  Narrow the listing to one resource group. Omit to list the whole subscription.

.EXAMPLE
  pwsh ./Find-SharedApim.ps1

.EXAMPLE
  pwsh ./Find-SharedApim.ps1 -ResourceGroupName rg-shared-apim-gateway-V2
#>

[CmdletBinding()]
param(
    [string]$SubscriptionId,
    [string]$ResourceGroupName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootDir    = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot 'modules\Common.ps1')

if ($SubscriptionId) {
    Invoke-Az -Arguments @('account', 'set', '--subscription', $SubscriptionId) | Out-Null
}

# Best-effort only: used to mark a row, never to decide anything.
$configured = $null
try {
    $cfg = Import-PowerShellDataFile -Path (Join-Path $rootDir 'config\lab.defaults.psd1')
    $configured = $cfg.SharedApimName
}
catch {
    $configured = $null
}

$azArgs = @('apim', 'list', '-o', 'json')
if ($ResourceGroupName) { $azArgs += @('-g', $ResourceGroupName) }

$scope = if ($ResourceGroupName) { "resource group '$ResourceGroupName'" } else { 'this subscription' }
Write-Step "Listing API Management instances in $scope"

$instances = @(Invoke-Az -Arguments $azArgs -AsJson `
    -Resource 'API Management instances' `
    -Hint 'Check that the account is signed in and can read the target subscription.')

if ($instances.Count -eq 0) {
    Write-Warn "No API Management instances are visible in $scope."
    return
}

$rows = $instances | ForEach-Object {
    [pscustomobject]@{
        Name          = $_.name
        ResourceGroup = $_.resourceGroup
        Tier          = $_.sku.name
        Region        = $_.location
        InUse         = if ($configured -and $_.name -eq $configured) { '<- configured' } else { '' }
    }
}

Write-Host ''
$rows | Sort-Object Name | Format-Table -AutoSize | Out-String | Write-Host
Write-Ok "$($instances.Count) instance(s) found"

if (-not $configured) {
    Write-Info 'Could not read SharedApimName from config, so no row is marked.'
}

Write-Host ''
Write-Info 'To point a run at one of these:'
Write-Info '  .\deploy.ps1   -SharedApimName <name> -SharedApimResourceGroupName <group>'
Write-Info '  .\teardown.ps1 -SharedApimName <name> -SharedApimResourceGroupName <group>'
Write-Info 'Pass both to both, or neither - see DESIGN_DECISIONS.md 8.'
