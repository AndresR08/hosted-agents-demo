# =============================================================================
#  LOCAL ONLY - NEVER DEPLOY
#
#  This script runs on the presenter's own machine, against their own `az login`
#  session. It deletes infrastructure and reads billing data. It is not part of
#  the demo, it is never packaged into the App Service, and it must never be
#  reachable from a browser.
#
#  Build-DemoPackage (../modules/AppService.ps1) fails the deployment if
#  anything from scripts/local/ appears in the package, so this boundary is
#  enforced rather than remembered.
# =============================================================================

<#
.SYNOPSIS
  Interactive cost control for the lab's resource group. Local use only.

.DESCRIPTION
  Shows what the lab is costing and offers the only actions that actually
  change that number.

  The arithmetic that shapes this tool, measured from the Azure retail price
  list for swedencentral:

    APIM Basicv2       $0.27/hour   ~$197/month   92% of the fixed cost
    App Service B1     $0.018/hour  ~$13/month     6%
    ACR Basic          $0.1666/day  ~$5/month      2%
    Log Analytics      ingestion + retention only, ~$0 idle
    gpt-5-mini         GlobalStandard is pay-per-token: $0 when unused

  APIM cannot be paused - `az apim` has no stop or pause verb, and the
  Basic tier has no stopped state. So there is exactly one action with real
  financial impact: delete the resource group. Everything else is rounding.

  The menu says so plainly rather than offering a row of pause buttons that
  would give the impression of control over the 6% while the 92% keeps running.

  Note on "stopping" the App Service: `az webapp stop` halts the site process
  but bills identically, because the charge is against the plan (the serverfarm)
  and not the site. The only way down is to scale the plan to F1 (Free), which
  is what this tool offers.

.EXAMPLE
  pwsh ./Manage-LabCost.ps1
#>

[CmdletBinding()]
param(
    [string]$ResourceGroupName,
    [string]$SubscriptionId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot     = Split-Path -Parent $PSCommandPath
$automationRoot = Split-Path -Parent $scriptRoot          # scripts/
$labRoot        = Split-Path -Parent $automationRoot      # the automation folder

. (Join-Path $automationRoot 'modules\Common.ps1')

if (-not $ResourceGroupName) {
    $config = Import-PowerShellDataFile -Path (Join-Path $labRoot 'config\lab.defaults.psd1')
    $ResourceGroupName = $config.ResourceGroupName
}

# Retail prices, swedencentral, USD. Hard-coded only to render an estimate
# before any billing call: option 1 pulls the real figure from Cost Management.
# Stale prices here can mislead, so the estimate is always labelled as such.
$script:Price = @{
    ApimBasicV2PerHour   = 0.27
    AppServiceB1PerHour  = 0.018
    AcrBasicPerDay       = 0.1666
}
$script:HoursPerMonth = 730

function Write-Rule { Write-Host ('-' * 64) -ForegroundColor DarkGray }

function Get-LabState {
    <#
      Reads what actually exists. Every number shown to the operator comes from
      here rather than from an assumption about what deploy.ps1 created: the
      resource group may have been partly torn down, or scaled by hand.
    #>
    $state = [ordered]@{
        ResourceGroupExists = $false
        Resources           = @()
        ApimCount           = 0
        AcrCount            = 0
        PlanName            = $null
        PlanSku             = $null
        SiteName            = $null
        SiteState           = $null
        EstimatedMonthly    = 0.0
    }

    $rg = Invoke-Az -Arguments @('group', 'show', '--name', $ResourceGroupName, '-o', 'json') -AllowFailure
    if (-not $rg.Success) { return $state }
    $state.ResourceGroupExists = $true

    # Invoke-Az returns the parsed object directly for -AsJson, and a
    # {Success, Json, ...} wrapper for -AllowFailure. Not interchangeable.
    $state.Resources = @(Invoke-Az -Arguments @('resource', 'list', '-g', $ResourceGroupName, '-o', 'json') -AsJson)

    $state.ApimCount = @($state.Resources | Where-Object { $_.type -eq 'Microsoft.ApiManagement/service' }).Count
    $state.AcrCount  = @($state.Resources | Where-Object { $_.type -eq 'Microsoft.ContainerRegistry/registries' }).Count

    $plan = @($state.Resources | Where-Object { $_.type -eq 'Microsoft.Web/serverfarms' } | Select-Object -First 1)
    if ($plan.Count -gt 0) {
        $state.PlanName = $plan[0].name
        $planDetail = Invoke-Az -Arguments @('appservice', 'plan', 'show', '-g', $ResourceGroupName,
            '-n', $plan[0].name, '-o', 'json') -AllowFailure
        if ($planDetail.Success -and $planDetail.Json) { $state.PlanSku = $planDetail.Json.sku.name }
    }

    $site = @($state.Resources | Where-Object { $_.type -eq 'Microsoft.Web/sites' } | Select-Object -First 1)
    if ($site.Count -gt 0) {
        $state.SiteName = $site[0].name
        $siteDetail = Invoke-Az -Arguments @('webapp', 'show', '-g', $ResourceGroupName,
            '-n', $site[0].name, '-o', 'json') -AllowFailure
        if ($siteDetail.Success -and $siteDetail.Json) { $state.SiteState = $siteDetail.Json.state }
    }

    $monthly = 0.0
    $monthly += $state.ApimCount * $script:Price.ApimBasicV2PerHour * $script:HoursPerMonth
    $monthly += $state.AcrCount  * $script:Price.AcrBasicPerDay * 30
    # F1 is free; only a Basic or larger plan bills.
    if ($state.PlanSku -and $state.PlanSku -ne 'F1' -and $state.PlanSku -ne 'FREE') {
        $monthly += $script:Price.AppServiceB1PerHour * $script:HoursPerMonth
    }
    $state.EstimatedMonthly = [math]::Round($monthly, 2)

    return $state
}

function Show-Status {
    param([Parameter(Mandatory)]$State)

    Write-Host ''
    Write-Host '  Lab cost manager' -ForegroundColor White
    Write-Host '  (local only - never deployed)' -ForegroundColor DarkGray
    Write-Rule
    Write-Host "  Resource group : $ResourceGroupName"

    if (-not $State.ResourceGroupExists) {
        Write-Host '  Status         : DELETED - nothing is billing' -ForegroundColor Green
        Write-Rule
        return
    }

    Write-Host "  Status         : ACTIVE - $($State.Resources.Count) resources" -ForegroundColor Yellow
    if ($State.SiteName) {
        $planLabel = if ($State.PlanSku) { $State.PlanSku } else { 'unknown' }
        Write-Host "  Demo site      : $($State.SiteName) [$($State.SiteState)] on plan $planLabel"
    }
    Write-Host ("  Fixed cost     : ~`$$($State.EstimatedMonthly)/month  [Estimate, retail list price]") -ForegroundColor Yellow

    if ($State.ApimCount -gt 0) {
        $apim = [math]::Round($script:Price.ApimBasicV2PerHour * $script:HoursPerMonth, 2)
        $pct  = if ($State.EstimatedMonthly -gt 0) { [math]::Round(100 * $apim / $State.EstimatedMonthly) } else { 0 }
        Write-Host "                   of which APIM Basicv2 ~`$$apim ($pct%) - cannot be paused" -ForegroundColor DarkGray
    }
    Write-Rule
}

function Show-RealCost {
    <#
      The estimate above is a list price. This is what the subscription was
      actually charged, which is the number worth acting on - and the only one
      that reflects consumption (tokens, log ingestion) rather than fixed SKUs.
    #>
    Write-Step 'Reading actual cost from Cost Management (month to date)'

    $body = @{
        type       = 'ActualCost'
        timeframe  = 'MonthToDate'
        dataset    = @{
            granularity = 'None'
            aggregation = @{ totalCost = @{ name = 'Cost'; function = 'Sum' } }
            grouping    = @(@{ type = 'Dimension'; name = 'ServiceName' })
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $sub = Invoke-Az -Arguments @('account', 'show', '-o', 'json') -AsJson
    $scope = "/subscriptions/$($sub.id)/resourceGroups/$ResourceGroupName"
    $url = "https://management.azure.com$scope/providers/Microsoft.CostManagement/query?api-version=2023-03-01"

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $tmp -Value $body -Encoding utf8
        $result = Invoke-Az -Arguments @('rest', '--method', 'post', '--url', $url,
            '--body', "@$tmp", '-o', 'json') -AllowFailure
    }
    finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }

    if (-not $result.Success -or -not $result.Json) {
        $azErr = if ($result.Error) { $result.Error.Trim() } else { '' }
        Write-Warn 'Could not read Cost Management.'
        if ($azErr -match '429|Too many requests') {
            # The Cost Management query API is aggressively throttled and answers
            # 429 for a while after a handful of calls. Worth naming, because it
            # is transient and looks nothing like a permissions problem.
            Write-Warn '  Azure is rate-limiting the query API (429). This is transient:'
            Write-Warn '  wait a minute and choose option 1 again.'
        }
        else {
            Write-Warn '  Billing data lags real usage by up to 24h, and reading it needs'
            Write-Warn '  Cost Management Reader on the subscription.'
        }
        Write-Warn '  The estimate above still stands as a list-price figure.'
        if ($azErr) { Write-Warn "  Azure : $azErr" }
        return
    }

    $rows = @($result.Json.properties.rows)
    if ($rows.Count -eq 0) {
        # A valid, empty answer - not an error. Seen on this lab's own
        # subscription: the query returns 200 with the right columns and no
        # rows. Usual causes are the up-to-24h billing lag on recent resources,
        # and sponsored or credit-based subscriptions that do not surface cost
        # at resource-group scope at all.
        Write-Info 'Cost Management answered, but has no rows for this resource group yet.'
        Write-Info '  Usual causes: the up-to-24h billing lag, or a sponsored/credit'
        Write-Info '  subscription that does not report cost at resource-group scope.'
        Write-Info '  The list-price estimate above is then the figure to go by.'
        return
    }

    Write-Host ''
    Write-Host '  Actual cost, month to date  [Fact, from Cost Management]' -ForegroundColor White
    Write-Rule
    $total = 0.0
    foreach ($row in ($rows | Sort-Object { [double]$_[0] } -Descending)) {
        $cost = [double]$row[0]
        $total += $cost
        Write-Host ("  {0,10:N2}  {1}" -f $cost, $row[1])
    }
    Write-Rule
    Write-Host ("  {0,10:N2}  TOTAL" -f $total) -ForegroundColor Yellow
    Write-Host '  Billing lags usage by up to 24 hours.' -ForegroundColor DarkGray
}

function Set-PlanSku {
    param(
        [Parameter(Mandatory)]$State,
        [Parameter(Mandatory)][ValidateSet('B1', 'F1')][string]$Sku
    )

    if (-not $State.PlanName) {
        Write-Warn 'No App Service plan in this resource group; nothing to scale.'
        return
    }
    if ($State.PlanSku -eq $Sku) {
        Write-Info "The plan is already $Sku. Nothing to do."
        return
    }

    if ($Sku -eq 'F1') {
        Write-Warn 'F1 (Free) has hard limits the demo will feel:'
        Write-Warn '  - no Always On, so the site cold-starts on the first request'
        Write-Warn '  - a 60 CPU-minutes/day quota; the site stops responding past it'
        Write-Warn '  Fine while nobody is watching. Scale back to B1 before a demo.'
        Write-Host ''
        $answer = Read-Host "  Scale $($State.PlanName) down to F1? [y/N]"
        if ($answer -ne 'y') { Write-Info 'Cancelled.'; return }
    }

    Write-Step "Scaling $($State.PlanName) to $Sku"
    Invoke-Az -Arguments @('appservice', 'plan', 'update', '-g', $ResourceGroupName,
        '-n', $State.PlanName, '--sku', $Sku, '-o', 'json') `
        -Resource "app service plan $($State.PlanName)" `
        -Hint 'F1 allows only one free plan per region per subscription.' | Out-Null
    Write-Ok "Plan is now $Sku"
}

function Remove-LabResourceGroup {
    <#
      The only action that stops the 92%. Two confirmations, because it destroys
      APIM, both Foundry accounts with their registered agents, the registry and
      its images, the workspace and its history, and the demo site - and because
      a resource group name is easy to mistype when several look alike.
    #>
    param([Parameter(Mandatory)]$State)

    if (-not $State.ResourceGroupExists) {
        Write-Info 'The resource group does not exist. Nothing to delete.'
        return
    }

    Write-Host ''
    Write-Host '  DESTRUCTIVE - this deletes the following, permanently:' -ForegroundColor Red
    Write-Rule
    foreach ($r in $State.Resources) { Write-Host "    $($r.name)  [$($r.type)]" }
    Write-Rule
    Write-Host '  Also gone: every registered hosted agent, every image in the' -ForegroundColor Red
    Write-Host '  registry, and all Log Analytics history.' -ForegroundColor Red
    Write-Host ''
    Write-Host '  Re-deploying under the SAME name within the soft-delete window' -ForegroundColor Yellow
    Write-Host '  (~48h for APIM and Foundry, up to 14 days for Log Analytics) can' -ForegroundColor Yellow
    Write-Host '  fail with a Conflict, or silently restore the old resource with' -ForegroundColor Yellow
    Write-Host '  its previous state. Plan for that before deleting.' -ForegroundColor Yellow
    Write-Host ''

    # First gate: type the name. Defeats "wrong window, pressed enter".
    $typed = Read-Host "  Type the resource group name to confirm"
    if ($typed -ne $ResourceGroupName) {
        Write-Info "Name did not match ('$typed'). Cancelled - nothing was deleted."
        return
    }

    # Second gate: an explicit y, with N as the default.
    $answer = Read-Host "  Delete '$ResourceGroupName' and everything above? [y/N]"
    if ($answer -ne 'y') { Write-Info 'Cancelled - nothing was deleted.'; return }

    # teardown.ps1 stays the single implementation of deletion, so its
    # safeguards and error messages are not duplicated here. -Force because the
    # operator has already confirmed twice; a third prompt teaches nothing.
    $teardown = Join-Path $automationRoot 'teardown.ps1'
    Write-Step 'Delegating to teardown.ps1'
    & $teardown -ResourceGroupName $ResourceGroupName -Force
    if ($LASTEXITCODE -ne 0) { Write-Warn 'teardown.ps1 reported a failure; see above.' }
}

# ------------------------------------------------------------------- MAIN
try {
    if ($SubscriptionId) {
        Invoke-Az -Arguments @('account', 'set', '--subscription', $SubscriptionId) | Out-Null
    }

    $account = Invoke-Az -Arguments @('account', 'show', '-o', 'json') -AllowFailure
    if (-not $account.Success) {
        throw "Not signed in.`n  Check   : run 'az login' first. This tool uses your own session."
    }
    $subName = $account.Json.name

    while ($true) {
        $state = Get-LabState
        Show-Status -State $state

        Write-Host "  Subscription   : $subName" -ForegroundColor DarkGray
        Write-Host ''
        Write-Host '   [1] Show actual cost, month to date (Cost Management)'
        if ($state.ResourceGroupExists -and $state.PlanName) {
            if ($state.PlanSku -eq 'F1' -or $state.PlanSku -eq 'FREE') {
                Write-Host '   [2] Scale the demo plan back up to B1  (restore for a demo)'
            }
            else {
                Write-Host ('   [2] Scale the demo plan down to F1 Free  (saves ~${0}/month, ~6%)' -f `
                    [math]::Round($script:Price.AppServiceB1PerHour * $script:HoursPerMonth))
            }
        }
        if ($state.ResourceGroupExists) {
            # Formatted invariantly: -f follows the console culture, which on a
            # Spanish-locale machine renders 215,24 two lines below 215.24.
            $savings = $state.EstimatedMonthly.ToString('0.00', [cultureinfo]::InvariantCulture)
            Write-Host "   [3] DELETE the whole resource group      (saves ~`$$savings/month, 100%)" -ForegroundColor Red
        }
        Write-Host '   [Q] Quit'
        Write-Host ''
        Write-Host '  APIM Basicv2 has no pause. While the resource group exists, it bills.' -ForegroundColor DarkGray
        Write-Host ''

        $choice = Read-Host '  Choice'
        switch ($choice.Trim().ToUpperInvariant()) {
            '1' { Show-RealCost }
            '2' {
                if (-not $state.ResourceGroupExists -or -not $state.PlanName) {
                    Write-Info 'Not available: there is no App Service plan.'
                }
                elseif ($state.PlanSku -eq 'F1' -or $state.PlanSku -eq 'FREE') {
                    Set-PlanSku -State $state -Sku 'B1'
                }
                else {
                    Set-PlanSku -State $state -Sku 'F1'
                }
            }
            '3' { Remove-LabResourceGroup -State $state }
            'Q' { Write-Host ''; return }
            default { Write-Info "Not an option: '$choice'" }
        }

        Write-Host ''
        Read-Host '  Press Enter to continue' | Out-Null
    }
}
catch {
    Write-Failure 'COST MANAGER FAILED'
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
