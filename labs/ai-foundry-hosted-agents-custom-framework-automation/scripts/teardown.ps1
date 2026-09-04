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

.PARAMETER SkipSharedApimCleanup
  Leaves this lab's API, backend, product, subscriptions and diagnostic setting
  registered on the SHARED gateway. Almost never what you want: those resources
  outlive this resource group, they sit in infrastructure other teams use, and
  the diagnostic setting will be left pointing at a Log Analytics workspace that
  this teardown is about to delete.

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
    [switch]$SkipPurge,
    [switch]$SkipSharedApimCleanup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir    = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot 'modules\Common.ps1')
. (Join-Path $scriptRoot 'modules\SharedApim.ps1')

# Before anything reads a resource id: this teardown deletes from a gateway
# other teams share, and MSYS argument rewriting has already broken one
# deployment against it. See Assert-NotRunningUnderMsys.
Assert-NotRunningUnderMsys

# The config is needed even when -ResourceGroupName is supplied: the shared
# gateway's name and this lab's resource names on it live there, and they are
# the same values deploy.ps1 created from. Two lists would drift.
$config = Import-PowerShellDataFile -Path (Join-Path $rootDir 'config\lab.defaults.psd1')

if (-not $ResourceGroupName) {
    $ResourceGroupName = $config.ResourceGroupName
}

# out/ is git-ignored, and already where this automation keeps run artefacts.
# Named after the resource group so two environments cannot overwrite each
# other's outstanding work.
$journalPath = Join-Path $rootDir (Join-Path 'out' "pending-purge.$ResourceGroupName.txt")

# Separate journal for the shared gateway. Kept apart from the purge journal
# because the debts are different in kind: an unpurged soft-delete blocks OUR
# next deployment, while a leftover on the shared gateway is litter in someone
# else's resource - and only one of the two is anyone else's problem.
$sharedJournalPath = Join-Path $rootDir (Join-Path 'out' "pending-shared-apim-cleanup.$ResourceGroupName.txt")

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

  An interrupted purge is the case this guards hardest. The resource group is
  already gone by the time we get here, so anything not yet purged is invisible
  - it holds its name and its quota with nothing on screen to say so. That
  happened: a backgrounded run was killed between two purges and left two
  Foundry accounts behind, silently.

  Two layers cover it, because they cover different interruptions:

    - try/finally prints what is left. This runs on Ctrl+C and on a terminating
      error, but NOT on a hard kill - PowerShell never gets to run finally when
      the process is killed outright.
    - a journal file, written before the first purge and deleted after the last
      one, covers exactly that hard kill. It survives the process, so the
      commands are recoverable from disk afterwards, and the next teardown of
      the same group finds it and says so.
#>
function Invoke-SoftDeletePurge {
    param(
        [Parameter(Mandatory)][array]$Resources,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$JournalPath
    )

    Write-Step 'Purging soft-deleted resources'

    # Everything still owed, in the same shape Get-PurgeCommandText expects.
    # Entries are removed as each one is settled, so whatever remains here at
    # any instant is exactly what an interruption would strand.
    $pending = [System.Collections.ArrayList]::new()
    foreach ($item in $Resources) { [void]$pending.Add($item) }

    try {
    # Inside the try, not before it: a failure while writing the journal must
    # still reach the finally below, or an interruption at the very first step
    # would report nothing at all. Found by testing the interrupted path rather
    # than by reading the code.
    Write-PurgeJournal -Pending $pending -ResourceGroupName $ResourceGroupName -JournalPath $JournalPath

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
            $pending.Remove($item)
            Write-PurgeJournal -Pending $pending -ResourceGroupName $ResourceGroupName -JournalPath $JournalPath
            continue
        }

        # Purging something that is not in the soft-delete list is the normal
        # outcome when it was already purged, or when soft-delete is disabled for
        # that provider on this subscription. Neither is a problem.
        $text = "$($purge.Error) $($purge.Text)"
        if ($text -match '(?i)not found|does not exist') {
            Write-Ok "$($item.name) was not soft-deleted - nothing to purge"
            $pending.Remove($item)
            Write-PurgeJournal -Pending $pending -ResourceGroupName $ResourceGroupName -JournalPath $JournalPath
            continue
        }

        Write-Warn "Could not purge $($item.name): $($purge.Error.Trim())"
        Write-Warn "  Retry : $(Get-PurgeCommandText -Resource $item -ResourceGroupName $ResourceGroupName)"
        Write-Warn '  Until it succeeds the name stays taken, and a Foundry account keeps its quota (up to 48h).'
        # Reported, with its retry command, so it is no longer a silent debt -
        # which is all $pending tracks. Leaving it in would make the finally
        # block repeat what was just printed.
        $pending.Remove($item)
        Write-PurgeJournal -Pending $pending -ResourceGroupName $ResourceGroupName -JournalPath $JournalPath
    }
    }
    finally {
        # Reached on the normal path, on Ctrl+C, and on a terminating error.
        # $pending is empty on the normal path, so this says nothing then.
        if ($pending.Count -gt 0) {
            Write-Host ''
            Write-Warn "The purge did not finish. $($pending.Count) resource(s) are still soft-deleted:"
            foreach ($item in $pending) {
                Write-Warn "    $(Get-PurgeCommandText -Resource $item -ResourceGroupName $ResourceGroupName)"
            }
            Write-Warn '  They keep their names, and Foundry accounts keep their quota, for up to 48h.'
            Write-Warn "  Also saved to: $JournalPath"
        }
    }
}

<#
.SYNOPSIS
  Writes the outstanding purge commands to disk, or removes the file when none.
.DESCRIPTION
  The journal is what survives a hard kill, where finally never runs. It holds
  the same commands Get-PurgeCommandText produces - the function is called here
  rather than the text rebuilt, so the file and the console can never disagree.
#>
function Write-PurgeJournal {
    param(
        [Parameter(Mandatory)]$Pending,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$JournalPath
    )

    if ($Pending.Count -eq 0) {
        Remove-Item -Path $JournalPath -Force -ErrorAction SilentlyContinue
        return
    }

    $lines = @(
        "# Soft-deleted resources from '$ResourceGroupName' that were not purged."
        "# Written by teardown.ps1 at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')."
        '# Run these to finish the job, then delete this file. Only a teardown run'
        '# that purges everything itself removes it automatically.'
        ''
    )
    foreach ($item in $Pending) {
        $lines += (Get-PurgeCommandText -Resource $item -ResourceGroupName $ResourceGroupName)
    }

    $dir = Split-Path -Parent $JournalPath
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -Path $JournalPath -Value $lines -Encoding utf8
}

try {
    if ($SubscriptionId) {
        Invoke-Az -Arguments @('account', 'set', '--subscription', $SubscriptionId) | Out-Null
    }

    # A journal left by an earlier run means that run was killed mid-purge and
    # never got to print anything. Surfacing it here is what turns a silent
    # debt into a visible one, whatever this run turns out to do.
    if (Test-Path $journalPath) {
        Write-Warn "A previous teardown of '$ResourceGroupName' did not finish purging:"
        foreach ($line in (Get-Content $journalPath | Where-Object { $_ -and -not $_.StartsWith('#') })) {
            Write-Warn "    $line"
        }
        Write-Warn "  Source: $journalPath"
        Write-Warn '  Delete that file once the commands above have been run: this notice is'
        Write-Warn '  driven by the file, not by a live check against Azure.'
        Write-Host ''
    }

    # The same idea for the shared gateway, and louder: this debt is owed to
    # other teams' infrastructure, not to our own next deployment.
    if (Test-Path $sharedJournalPath) {
        Write-Warn "A previous teardown left resources on the SHARED gateway '$($config.SharedApimName)':"
        foreach ($line in (Get-Content $sharedJournalPath | Where-Object { $_ -and -not $_.StartsWith('#') })) {
            Write-Warn "    $line"
        }
        Write-Warn "  Source: $sharedJournalPath"
        Write-Host ''
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

    <#
      The shared gateway is cleaned BEFORE the resource group is deleted, and
      that order is the whole point rather than a preference.

      Our diagnostic setting on that gateway points at a Log Analytics workspace
      inside this resource group. Delete the group first and the setting is
      orphaned - still attached to infrastructure other teams use, pointing at a
      destination that no longer exists. Our APIs and backend likewise reference
      Foundry endpoints that are about to stop resolving, and would sit in their
      portal indefinitely. With -NoWait the group deletion is asynchronous, so
      "afterwards" would not even be a well-defined moment.

      Remove-SharedApimRegistration throws if the diagnostic setting cannot be
      removed, which stops this script before the group is touched. That is
      deliberate: leaving our own group intact is recoverable, leaving litter in
      someone else's gateway is not ours to undo.
    #>
    if ($proceed -and $SkipSharedApimCleanup) {
        Write-Warn 'Shared-gateway resources were left in place (-SkipSharedApimCleanup).'
        Write-Warn "  This lab's API, backend, product and subscriptions stay registered on"
        Write-Warn "  '$($config.SharedApimName)', and its diagnostic setting will be left"
        Write-Warn '  pointing at a Log Analytics workspace this run is about to delete.'
    }
    elseif ($proceed) {
        $ctxSubscriptionId = $SubscriptionId
        if (-not $ctxSubscriptionId) {
            $account = Invoke-Az -Arguments @('account', 'show', '-o', 'json') -AsJson
            $ctxSubscriptionId = $account.id
        }

        Remove-SharedApimRegistration `
            -SubscriptionId $ctxSubscriptionId `
            -ResourceGroupName $config.SharedApimResourceGroupName `
            -ApimName $config.SharedApimName `
            -Resources $config.SharedApimResources `
            -OwnedSubscriptions $config.SharedApimOwnedSubscriptions `
            -JournalPath $sharedJournalPath | Out-Null
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
        Invoke-SoftDeletePurge -Resources $softDeleting -ResourceGroupName $ResourceGroupName `
            -JournalPath $journalPath
    }
}
catch {
    Write-Failure 'TEARDOWN FAILED'
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
