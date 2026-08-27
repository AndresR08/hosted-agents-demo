<#
.SYNOPSIS
  Deletes the lab resource group, mirroring the lab's clean-up-resources notebook.

.DESCRIPTION
  Destructive. Deleting the resource group removes APIM, both Foundry
  resources, the container registry, Log Analytics, every hosted agent, and the
  App Service plan and site that deploy.ps1 created for the companion demo -
  all of them live in this one resource group.

  Deleting the resource group is not the end of it: API Management and both
  Foundry (Cognitive Services) accounts are SOFT-deleted. They keep holding
  their names, and Foundry accounts keep consuming the subscription's regional
  quota, for up to 48 hours. A later deploy into a fresh group therefore fails
  on a name collision or on quota that nothing visible is using. This script
  purges them afterwards so the teardown is actually complete.

  Interactively it asks for confirmation. Non-interactively - a scheduled task,
  CI, or another script - there is no prompt to answer, so -Force is required.
  There is deliberately no affirmative default: without -Force a non-interactive
  run stops and says so rather than deleting anything.

.PARAMETER Force
  Skips the confirmation prompt. Required when there is no console to prompt on.
  -WhatIf still takes precedence and still deletes nothing.

.PARAMETER SkipPurge
  Leaves the soft-deleted APIM and Foundry accounts in place. Use it only when
  you intend to restore them; otherwise they block the names and the quota.

.PARAMETER NoWait
  Returns as soon as Azure accepts the deletion. Purging is then impossible -
  a resource is only listed as soft-deleted once the group is actually gone -
  so the script prints the exact commands to run later instead.

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
    [switch]$Force,
    [switch]$SkipPurge
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

<#
.SYNOPSIS
  Lists the resources in the group that survive deletion in a soft-deleted state.
.DESCRIPTION
  Only two kinds do so here: API Management services and Cognitive Services
  (Foundry) accounts. Everything else the lab creates - ACR, Log Analytics,
  App Service - goes away with the group and needs no purge.
#>
function Get-SoftDeletingResources {
    param([Parameter(Mandatory)][string]$ResourceGroupName)

    Write-Step 'Taking inventory of resources that will be soft-deleted'

    $query = "[?type=='Microsoft.ApiManagement/service' || type=='Microsoft.CognitiveServices/accounts']" +
             ".{name:name,type:type,location:location}"
    $listed = Invoke-Az -Arguments @(
        'resource', 'list', '-g', $ResourceGroupName, '--query', $query, '-o', 'json'
    ) -AllowFailure

    if (-not $listed.Success -or $null -eq $listed.Json) {
        Write-Warn 'Could not enumerate the group; nothing will be purged automatically.'
        return @()
    }

    $resources = @($listed.Json)
    if ($resources.Count -eq 0) {
        Write-Ok 'Nothing in this group soft-deletes'
        return @()
    }

    foreach ($item in $resources) { Write-Info "will need purging: $($item.name) ($($item.type))" }
    return $resources
}

<#
.SYNOPSIS
  Renders the az command that purges one soft-deleted resource.
.DESCRIPTION
  Shared by the -NoWait path, which can only print it, and the failure path in
  Invoke-SoftDeletePurge, which offers it as the retry - so the command an
  operator is told to run is never a second, separately maintained spelling of
  the one the script itself runs.
#>
function Get-PurgeCommandText {
    param(
        [Parameter(Mandatory)]$Resource,
        [Parameter(Mandatory)][string]$ResourceGroupName
    )

    if ($Resource.type -eq 'Microsoft.ApiManagement/service') {
        return "az apim deletedservice purge --service-name $($Resource.name) --location $($Resource.location)"
    }
    return "az cognitiveservices account purge -n $($Resource.name) -g $ResourceGroupName -l $($Resource.location)"
}

<#
.SYNOPSIS
  Purges the soft-deleted APIM service and Foundry accounts left by the deletion.
.DESCRIPTION
  Best-effort by design: a failed purge is an inconvenience - the name and the
  quota stay held until Azure expires them on its own - not a teardown failure,
  because the resource group the caller asked to remove is already gone. Every
  failure is therefore reported with the command to retry, and none of them
  aborts the run or changes the exit code.

  Note the purge uses the ORIGINAL resource group name: a soft-deleted
  Cognitive Services account is addressed by the group it was deleted from,
  which no longer exists. That is expected, not a stale argument.
#>
function Invoke-SoftDeletePurge {
    param(
        [Parameter(Mandatory)][array]$Resources,
        [Parameter(Mandatory)][string]$ResourceGroupName
    )

    Write-Step 'Purging soft-deleted resources'

    foreach ($item in $Resources) {
        if ($item.type -eq 'Microsoft.ApiManagement/service') {
            $purgeArgs = @('apim', 'deletedservice', 'purge', '--service-name', $item.name, '--location', $item.location)
        }
        else {
            $purgeArgs = @('cognitiveservices', 'account', 'purge', '-n', $item.name, '-g', $ResourceGroupName, '-l', $item.location)
        }

        $purge = Invoke-Az -Arguments $purgeArgs -AllowFailure
        if ($purge.Success) {
            Write-Ok "Purged $($item.name)"
            continue
        }

        # Purging something that is not in the soft-delete list is the normal
        # outcome when it was already purged, or when soft-delete is disabled for
        # that provider on this subscription. Neither is a problem.
        $text = "$($purge.Error) $($purge.Text)"
        if ($text -match '(?i)not found|does not exist') {
            Write-Ok "$($item.name) was not soft-deleted - nothing to purge"
            continue
        }

        Write-Warn "Could not purge $($item.name): $($purge.Error.Trim())"
        Write-Warn "  Retry : $(Get-PurgeCommandText -Resource $item -ResourceGroupName $ResourceGroupName)"
        Write-Warn '  Until it succeeds the name stays taken, and a Foundry account keeps its quota (up to 48h).'
    }
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

    # The inventory has to be taken BEFORE the deletion: once the group is gone
    # there is no way left to ask which APIM service or which Foundry accounts
    # used to live in it. The soft-delete listings are subscription-wide and do
    # not reliably carry the originating group, so purging by name afterwards
    # would mean guessing.
    $softDeleting = @()
    if ($proceed -and -not $SkipPurge) {
        $softDeleting = @(Get-SoftDeletingResources -ResourceGroupName $ResourceGroupName)
    }

    if ($proceed) {
        $azArgs = @('group', 'delete', '--name', $ResourceGroupName, '--yes')
        if ($NoWait) { $azArgs += '--no-wait' }
        Invoke-Az -Arguments $azArgs -Resource "resource group $ResourceGroupName" `
            -Hint 'A resource lock or a policy assignment can block deletion.' | Out-Null
        Write-Ok "Deletion requested for '$ResourceGroupName'"
    }

    if ($proceed -and $SkipPurge) {
        Write-Warn 'Soft-deleted resources were left in place (-SkipPurge).'
        Write-Warn '  They keep their names, and Foundry accounts keep their quota, for up to 48h.'
    }
    elseif ($proceed -and $NoWait -and $softDeleting.Count -gt 0) {
        # A resource only appears in the soft-delete listings once the group has
        # finished deleting, which -NoWait explicitly declines to wait for.
        Write-Warn 'Cannot purge with -NoWait: the deletion has not finished yet.'
        Write-Warn '  Run these once the resource group is gone, or re-run this script without -NoWait:'
        foreach ($item in $softDeleting) {
            Write-Warn "    $(Get-PurgeCommandText -Resource $item -ResourceGroupName $ResourceGroupName)"
        }
    }
    elseif ($proceed -and $softDeleting.Count -gt 0) {
        Invoke-SoftDeletePurge -Resources $softDeleting -ResourceGroupName $ResourceGroupName
    }
}
catch {
    Write-Failure 'TEARDOWN FAILED'
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
