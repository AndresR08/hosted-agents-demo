<#
  Helpers for the SHARED API Management gateway.

  Everything in here touches infrastructure other teams depend on, so the rules
  are stricter than anywhere else in this automation: only ever add resources
  whose names this lab owns, only ever delete from a fixed allow-list, and prove
  before/after that nothing else moved.
#>

# Resource types this lab owns on the shared gateway, in the order they must be
# DELETED: children before parents, links before targets, and the diagnostic
# setting first because it is the one that becomes harmful the moment our
# workspace disappears.
$script:SharedApimNamePrefix = 'hosted-agents-'

<#
.SYNOPSIS
  Warns when an MSYS environment is present, which is where path mangling lives.
.DESCRIPTION
  MSYS rewrites arguments that look like Unix paths before a native executable
  sees them. On 2026-09-03 that turned an ARM resource id starting with
  '/subscriptions/...' into 'C:/Program Files/Git/subscriptions/...', and a
  deployment to the SHARED gateway failed half-way through - five of six
  resources created, one rejected.

  This WARNS rather than aborts, and the distinction is the point. The hazard is
  not "MSYS exists on this machine": it is bash building the argv for a native
  .exe. PowerShell does not rewrite its own arguments, and $env:MSYSTEM is
  inherited by any process a Git Bash shell starts - so aborting on it blocks
  perfectly safe runs, which is exactly what the first version of this function
  did the moment it was tried.

  What actually prevents a repeat is Assert-ResourceIdShape, called immediately
  before any resource id is written into a parameters file for a foreign-scope
  deployment. That checks the value itself, so it catches mangling from any
  source - a shell, a bad config edit, a copy/paste - and cannot be fooled by an
  environment variable that means nothing on its own.
#>
function Assert-NotRunningUnderMsys {
    $msys = $env:MSYSTEM
    $ostype = $env:OSTYPE
    if ($msys -or ($ostype -and $ostype -like 'msys*')) {
        Write-Warn "An MSYS environment is present (MSYSTEM='$msys')."
        Write-Warn '  If this script was started FROM Git Bash, any argument beginning with "/"'
        Write-Warn '  may have been rewritten to a Windows path before PowerShell saw it.'
        Write-Warn '  Resource ids are shape-checked before use, so a mangled one fails at the'
        Write-Warn '  door rather than half-way through the shared gateway.'
    }
}

<#
.SYNOPSIS
  Fails when a value that must be an ARM resource id no longer looks like one.
.DESCRIPTION
  The precise half of the guard above, and the one that catches the problem
  wherever it came from - a mangling shell, a bad config edit, or a copy/paste.
  Cheap, and it runs immediately before the value is handed to a deployment that
  writes to shared infrastructure.
#>
function Assert-ResourceIdShape {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Value,
        [Parameter(Mandatory)][string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Resource id '$Name' is empty. It must start with '/subscriptions/'."
    }
    if ($Value -notlike '/subscriptions/*') {
        $hint = ''
        if ($Value -match '^[A-Za-z]:[\\/]' -or $Value -like '*Git/subscriptions/*') {
            $hint = "  Cause    : this looks path-mangled - a Unix-style id rewritten to a Windows path.`n" +
                    "             That is MSYS behaviour; run from PowerShell, not Git Bash."
        }
        throw @(
            "Resource id '$Name' is not a fully qualified ARM id."
            "  Value    : $Value"
            "  Expected : /subscriptions/{subscriptionId}/resourceGroups/..."
            $hint
        ) -join "`n"
    }
}

<#
.SYNOPSIS
  Writes an ARM parameters file from a plain hashtable.
.DESCRIPTION
  New-BicepParametersFile in Infra.ps1 knows the vendored main.bicep's parameter
  set by name. The two templates this migration introduced have different ones,
  so this writes whatever it is given rather than growing a second hard-coded
  list that would drift from the templates.
#>
function New-ParametersFile {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary]$Parameters,
        [Parameter(Mandatory)][string]$OutFile
    )

    $wrapped = [ordered]@{}
    foreach ($k in $Parameters.Keys) { $wrapped[$k] = @{ value = $Parameters[$k] } }

    $doc = [ordered]@{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = $wrapped
    }

    $dir = Split-Path -Parent $OutFile
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $doc | ConvertTo-Json -Depth 12 | Set-Content -Path $OutFile -Encoding utf8
    Write-Info "parameters written to $OutFile"
    return $OutFile
}

<#
.SYNOPSIS
  Reads the primary key of one subscription on the shared gateway.
.DESCRIPTION
  The lab used to get this from main.bicep's `apimSubscriptions` output, which
  existed because the same template created the subscription. Now the
  subscription lives on a gateway in another resource group, so the key is
  fetched explicitly. listSecrets is a POST, and it is the only supported way -
  the key is deliberately not returned by a GET.
#>
function Get-SharedApimSubscriptionKey {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$ApimName,
        [Parameter(Mandatory)][string]$SubscriptionName
    )

    $url = "https://management.azure.com/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName" +
           "/providers/Microsoft.ApiManagement/service/$ApimName/subscriptions/$SubscriptionName/listSecrets?api-version=2022-08-01"

    $result = Invoke-Az -Arguments @('rest', '--method', 'post', '--url', $url, '-o', 'json') `
        -Resource "subscription $SubscriptionName on $ApimName" `
        -Hint 'The subscription must exist on the shared gateway before its key can be read.' -AsJson

    $key = $result.primaryKey
    if ([string]::IsNullOrWhiteSpace($key)) {
        throw "API Management returned no primaryKey for subscription '$SubscriptionName' on '$ApimName'."
    }
    return $key
}

<#
.SYNOPSIS
  Composes the values the rest of deploy.ps1 consumes, from two deployments.
.DESCRIPTION
  Get-LabDeploymentOutputs reads all of these from one deployment, because the
  vendored main.bicep created the gateway and the lab in the same template. They
  now come from two places - the lab's own infrastructure, and a gateway in
  another resource group - so they are assembled here into the SAME SHAPE the
  downstream code already expects. Nothing after this point needs to know the
  gateway moved.
#>
function Get-MigratedLabOutputs {
    param(
        [Parameter(Mandatory)][string]$InfraDeploymentName,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][hashtable]$Config
    )

    Write-Step 'Reading deployment outputs'

    $deployment = Invoke-Az -Arguments @(
        'deployment', 'group', 'show', '--name', $InfraDeploymentName, '-g', $ResourceGroupName, '-o', 'json'
    ) -AsJson -Resource "deployment $InfraDeploymentName" `
      -Hint 'The infrastructure deployment must have completed at least once before outputs can be read.'

    $out  = $deployment.properties.outputs
    $hint = "These names are declared in bicep/infra.bicep OUTPUTS. If that file changed, this automation must be updated to match - never guessed."

    $acrName        = Read-DeploymentOutput -Outputs $out -Name 'containerRegistryName'       -Hint $hint
    $agentProject   = Read-DeploymentOutput -Outputs $out -Name 'foundryAgentProjectEndpoint' -Hint $hint
    $lawCustomerId  = Read-DeploymentOutput -Outputs $out -Name 'logAnalyticsWorkspaceId'     -Hint $hint
    $modelsEndpoint = Read-DeploymentOutput -Outputs $out -Name 'foundryAiServicesEndpoint'   -Hint $hint

    $apimName = $Config.SharedApimName
    $apimRg   = $Config.SharedApimResourceGroupName
    $res      = $Config.SharedApimResources

    # The gateway URL is read from the live service rather than assembled from
    # its name: the hostname is a property of the resource, and guessing it is
    # how a demo ends up pointing at a gateway that does not exist.
    $apim = Invoke-Az -Arguments @(
        'apim', 'show', '--name', $apimName, '--resource-group', $apimRg, '-o', 'json'
    ) -AsJson -Resource "shared API Management $apimName" `
      -Hint "Check SharedApimName / SharedApimResourceGroupName in config/lab.defaults.psd1."

    $gatewayUrl = $apim.gatewayUrl
    if ($gatewayUrl -notmatch '^https://') {
        throw "The shared gateway '$apimName' reported a gatewayUrl that is not https: '$gatewayUrl'."
    }

    $subName = $Config.ApimSubscriptionsConfig[0].name
    $apiKey  = Get-SharedApimSubscriptionKey -SubscriptionId $SubscriptionId -ResourceGroupName $apimRg `
        -ApimName $apimName -SubscriptionName $subName

    $modelsAccount = ([uri]$modelsEndpoint).Host.Split('.')[0]

    $result = [pscustomobject]@{
        ApimGatewayUrl              = $gatewayUrl
        ApimServiceName             = $apimName
        LogAnalyticsWorkspaceId     = $lawCustomerId
        FoundryModelsAccountName    = $modelsAccount
        ContainerRegistryName       = $acrName
        FoundryAgentProjectEndpoint = $agentProject
        ApimSubscriptionName        = $subName
        ApimSubscriptionKey         = $apiKey
        InferenceEndpoint           = "$gatewayUrl/$($res.InferenceApiPath)/models"
    }

    Write-Ok "Shared gateway          : $gatewayUrl"
    Write-Ok "APIM service            : $apimName (shared, $apimRg)"
    Write-Ok "Container Registry      : $acrName"
    Write-Ok "Foundry agent project   : $agentProject"
    Write-Ok "APIM subscription       : $subName"
    Write-Ok "APIM subscription key   : ****$($apiKey.Substring([Math]::Max(0,$apiKey.Length-4)))"
    Write-Ok "Inference endpoint      : $($result.InferenceEndpoint)"

    return $result
}

<#
.SYNOPSIS
  Counts and names everything on the shared gateway that a lab could collide with.
.DESCRIPTION
  Read-only. Taken before and after any write so the delta can be proved rather
  than asserted: the question that matters on shared infrastructure is not "did
  my resources appear" but "did anything else change".
#>
function Get-SharedApimInventory {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$ApimName
    )

    $base = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.ApiManagement/service/$ApimName"
    $inventory = [ordered]@{}

    foreach ($kind in @('apis', 'products', 'subscriptions', 'backends')) {
        $result = Invoke-Az -Arguments @(
            'rest', '--method', 'get',
            '--url', "https://management.azure.com$base/$kind`?api-version=2022-08-01",
            '-o', 'json'
        ) -AllowFailure
        $names = @()
        if ($result.Success -and $result.Text) {
            try { $names = @(($result.Text | ConvertFrom-Json).value | ForEach-Object { $_.name }) } catch { $names = @() }
        }
        $inventory[$kind] = @($names | Sort-Object)
    }

    $diag = Invoke-Az -Arguments @(
        'rest', '--method', 'get',
        '--url', "https://management.azure.com$base/providers/Microsoft.Insights/diagnosticSettings`?api-version=2021-05-01-preview",
        '-o', 'json'
    ) -AllowFailure
    $diagNames = @()
    if ($diag.Success -and $diag.Text) {
        try { $diagNames = @(($diag.Text | ConvertFrom-Json).value | ForEach-Object { $_.name }) } catch { $diagNames = @() }
    }
    $inventory['diagnosticSettings'] = @($diagNames | Sort-Object)

    return $inventory
}

<#
.SYNOPSIS
  Reports what changed between two inventories, and fails loudly on losses.
.DESCRIPTION
  Additions are expected and printed. DISAPPEARANCES are the finding: on a
  shared gateway, a resource that stopped existing is someone else's outage, so
  they are returned rather than merely logged and the caller decides.
#>
function Compare-SharedApimInventory {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary]$Before,
        [Parameter(Mandatory)][System.Collections.IDictionary]$After
    )

    $lost = @()
    Write-Info 'category              before  after  delta'
    foreach ($kind in $Before.Keys) {
        $b = @($Before[$kind])
        $a = @($After[$kind])
        $gone = @($b | Where-Object { $a -notcontains $_ })
        $new  = @($a | Where-Object { $b -notcontains $_ })
        $delta = $a.Count - $b.Count
        $sign = if ($delta -ge 0) { "+$delta" } else { "$delta" }
        Write-Info ("{0,-20} {1,6} {2,6} {3,6}" -f $kind, $b.Count, $a.Count, $sign)
        foreach ($n in $new)  { Write-Info "    added   $n" }
        foreach ($n in $gone) { Write-Warn "    LOST    $n" ; $lost += "$kind/$n" }
    }
    return $lost
}

<#
.SYNOPSIS
  Removes this lab's footprint from the shared gateway.
.DESCRIPTION
  Deletes ONLY the names it is given, only when they carry this lab's prefix,
  and in an order that never leaves a dangling reference.

  The diagnostic setting goes first and is the only fatal one. Every other
  leftover is untidy and visible; an orphaned diagnostic setting is the one that
  keeps pointing at a destination that no longer exists, which Microsoft
  explicitly warns can be re-applied to a resource later recreated with the same
  name. If it cannot be removed, the caller must NOT go on to delete the
  resource group - that is precisely the sequence that creates the orphan.

  A 404 is success: teardown has to be re-runnable after a partial run.
#>
function Remove-SharedApimRegistration {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$ApimName,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Resources,
        [Parameter(Mandatory)][string[]]$OwnedSubscriptions,
        [string]$JournalPath = ''
    )

    Write-Step "Removing this lab's registration from the shared gateway '$ApimName'"

    $base = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.ApiManagement/service/$ApimName"

    # Ordered: diagnostic setting, subscriptions, product links, product, APIs,
    # backend. Each entry is {path, label, fatal}.
    $targets = @()
    $targets += @{ path = "$base/providers/Microsoft.Insights/diagnosticSettings/$($Resources.DiagnosticSettingName)"; label = "diagnosticSettings/$($Resources.DiagnosticSettingName)"; api = '2021-05-01-preview'; fatal = $true }
    foreach ($sub in $OwnedSubscriptions) {
        $targets += @{ path = "$base/subscriptions/$sub"; label = "subscriptions/$sub"; api = '2022-08-01'; fatal = $false }
    }
    $targets += @{ path = "$base/products/$($Resources.ProductName)/apis/$($Resources.InferenceApiName)"; label = "products/$($Resources.ProductName)/apis/$($Resources.InferenceApiName)"; api = '2022-08-01'; fatal = $false }
    $targets += @{ path = "$base/products/$($Resources.ProductName)/apis/$($Resources.ResponsesApiName)"; label = "products/$($Resources.ProductName)/apis/$($Resources.ResponsesApiName)"; api = '2022-08-01'; fatal = $false }
    $targets += @{ path = "$base/products/$($Resources.ProductName)"; label = "products/$($Resources.ProductName)"; api = '2022-08-01'; fatal = $false }
    $targets += @{ path = "$base/apis/$($Resources.ResponsesApiName)"; label = "apis/$($Resources.ResponsesApiName)"; api = '2022-08-01'; fatal = $false }
    $targets += @{ path = "$base/apis/$($Resources.InferenceApiName)"; label = "apis/$($Resources.InferenceApiName)"; api = '2022-08-01'; fatal = $false }
    $targets += @{ path = "$base/backends/$($Resources.BackendName)"; label = "backends/$($Resources.BackendName)"; api = '2022-08-01'; fatal = $false }

    <#
      The allow-list is not enough on its own: a wrong edit to config would put a
      wrong name into it and this function would obey. The prefix assertion is
      the second lock, checked against the LEAF name of every target.

      One name legitimately cannot carry our prefix: API Management generates a
      subscription of its own, with a 24-hex-character id, whenever a product is
      published. Listing it in config is necessary - but listing alone must NOT
      be sufficient, or the allow-list becomes a way to bypass the prefix rule
      entirely. An early version of this function had exactly that hole: putting
      'subscription1' - the FinOps lab's, under an auto-suspend quota - into
      SharedApimOwnedSubscriptions was enough to have it deleted.

      So a non-prefixed name has to clear two further gates: it must LOOK like an
      APIM-generated id, and Azure must confirm it is bound to OUR product. The
      second gate is the real one, because it asks the resource who owns it
      instead of trusting a naming convention.
    #>
    $ourProductId = "$base/products/$($Resources.ProductName)"
    foreach ($t in $targets) {
        $leaf = ($t.label -split '/')[-1]
        if ($leaf.StartsWith($script:SharedApimNamePrefix)) { continue }

        if ($OwnedSubscriptions -notcontains $leaf) {
            throw @(
                "Refusing to delete '$($t.label)' from the SHARED gateway."
                "  Reason : the name does not start with '$script:SharedApimNamePrefix' and is not"
                '           listed in SharedApimOwnedSubscriptions.'
                '  Check  : config/lab.defaults.psd1 - a wrong name here deletes another'
                "           team's resource."
            ) -join "`n"
        }

        if ($leaf -notmatch '^[0-9a-f]{24}$') {
            throw @(
                "Refusing to delete '$($t.label)' from the SHARED gateway."
                '  Reason : it is listed in SharedApimOwnedSubscriptions but does not carry this'
                "           lab's prefix and is not shaped like an API Management generated id"
                '           (24 hex characters). Only the subscription APIM creates for our'
                '           product may be listed there.'
                '  Check  : config/lab.defaults.psd1 - remove this entry.'
            ) -join "`n"
        }

        # The decisive gate: ask Azure whose product this subscription belongs to.
        $probe = Invoke-Az -Arguments @(
            'rest', '--method', 'get',
            '--url', "https://management.azure.com$base/subscriptions/$leaf`?api-version=2022-08-01",
            '-o', 'json'
        ) -AllowFailure

        if (-not $probe.Success) {
            # Already gone, or unreadable. Nothing to delete either way; the
            # delete below will confirm and treat 404 as success.
            Write-Info "could not read subscription '$leaf' to confirm ownership; the delete will verify"
            continue
        }

        $scope = ''
        try { $scope = ($probe.Text | ConvertFrom-Json).properties.scope } catch { $scope = '' }
        if ($scope -ne $ourProductId) {
            throw @(
                "Refusing to delete subscription '$leaf' from the SHARED gateway."
                '  Reason : Azure reports it is NOT bound to this lab.'
                "  Its scope    : $scope"
                "  Our product  : $ourProductId"
                '  Check  : config/lab.defaults.psd1 SharedApimOwnedSubscriptions lists a'
                "           subscription belonging to someone else. Remove it."
            ) -join "`n"
        }
        Write-Info "subscription '$leaf' confirmed bound to $($Resources.ProductName)"
    }

    $failed = @()
    foreach ($t in $targets) {
        if (-not $PSCmdlet.ShouldProcess("$ApimName/$($t.label)", 'Delete from shared gateway')) { continue }

        $result = Invoke-Az -Arguments @(
            'rest', '--method', 'delete',
            '--url', "https://management.azure.com$($t.path)`?api-version=$($t.api)"
        ) -AllowFailure

        if ($result.Success) {
            Write-Ok "removed $($t.label)"
            continue
        }

        # Idempotency: gone already is the outcome we wanted.
        $text = "$($result.Error) $($result.Text)"
        if ($text -match 'ResourceNotFound|NotFound|404|does not exist') {
            Write-Ok "$($t.label) was not present"
            continue
        }

        if ($t.fatal) {
            throw @(
                "Could not remove $($t.label) from the shared gateway."
                "  Azure  : $($result.Error.Trim())"
                '  Why this stops the teardown: this setting points at a Log Analytics'
                '           workspace in the resource group about to be deleted. Deleting the'
                '           group now would leave it orphaned on infrastructure other teams'
                '           use, pointing at a destination that no longer exists.'
                '  Check  : remove it by hand, then re-run:'
                "           az monitor diagnostic-settings delete -n $($Resources.DiagnosticSettingName) --resource $base"
            ) -join "`n"
        }

        Write-Warn "Could not remove $($t.label): $($result.Error.Trim())"
        $failed += "az rest --method delete --url `"https://management.azure.com$($t.path)?api-version=$($t.api)`""
    }

    if ($JournalPath) {
        if ($failed.Count -gt 0) {
            $lines = @(
                "# Resources this lab still owns on the SHARED gateway '$ApimName'."
                '# They were not removed. Run these, then delete this file.'
                '#'
            ) + $failed
            Set-Content -Path $JournalPath -Value $lines -Encoding utf8
            Write-Warn "$($failed.Count) resource(s) could not be removed. Commands written to:"
            Write-Warn "  $JournalPath"
        }
        elseif (Test-Path $JournalPath) {
            Remove-Item -Path $JournalPath -Force -ErrorAction SilentlyContinue
        }
    }

    return $failed
}
