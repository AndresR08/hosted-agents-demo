# Upstream issue draft — `deployments.bicep` output breaks multi-account deployments

Status: **drafted, not filed.** To be reviewed and posted manually at
<https://github.com/Azure-Samples/AI-Gateway/issues>.

This is why `vendor/ai-gateway` stays pinned at `561d7199` and was not moved to
`e5d99225`. Reproduced against a real subscription in a disposable resource
group on 2026-08-26; the resource group and every soft-deleted remnant were
purged afterwards.

---

## Title

```
modules/cognitive-services/v3/deployments.bicep: modelDeployments output dereferences a conditional resource, breaking multi-account deployments (NotFound)
```

## Body

```markdown
### Summary

The `modelDeployments` output added to
`modules/cognitive-services/v3/deployments.bicep` iterates over the whole of
`modelsConfig` unconditionally, while the `modelDeployment` resource it
dereferences is created **conditionally**. When a `modelsConfig` entry is
filtered out for a given Cognitive Services account, the output still resolves
`modelDeployment[i].id`, and the deployment fails with `NotFound`.

This affects any deployment with **more than one Foundry account** where a model
is targeted at a subset of them — which is the topology of
`labs/ai-foundry-hosted-agents-custom-framework` (a `foundry-models` account
that hosts the model, and a `foundry-agents` account that hosts the hosted
agents).

### Affected code

`modules/cognitive-services/v3/deployments.bicep`

The resource is conditional on the model's `aiservice` matching the account:

```bicep
@batchSize(1)
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [
  for (model, i) in modelsConfig:
    if (contains(cognitiveService.name, modelsConfig[i].?aiservice != null ? modelsConfig[i].aiservice : '')) {
      name: model.name
      parent: cognitiveService
      ...
    }
]
```

The output is not:

```bicep
output modelDeployments array = [for (model, i) in modelsConfig: {
  name:         modelDeployment[i].name
  resourceId:   modelDeployment[i].id                        // <-- always dereferenced
  modelName:    modelDeployment[i].properties.model.name
  modelVersion: modelDeployment[i].properties.model.version
  modelFormat:  modelDeployment[i].properties.model.format
  ...
}]
```

`modules/cognitive-services/v3/foundry.bicep` surfaces that output for every
account, which forces it to be evaluated:

```bicep
modelDeployments: modelDeployments[i].outputs.modelDeployments
```

### Reproduction

Deploy `labs/ai-foundry-hosted-agents-custom-framework/main.bicep` unchanged,
with its documented two-account `aiServicesConfig` and a `modelsConfig` whose
single entry is pinned to the models account:

```json
{
  "name": "gpt-5-mini",
  "publisher": "OpenAI",
  "version": "2025-08-07",
  "sku": "GlobalStandard",
  "capacity": 10,
  "aiservice": "foundry-models"
}
```

For the `foundry-agents` account the `if (contains(...))` guard is false, so no
deployment is created — but the output still asks for it.

### Actual result

```
ERROR: {"status":"Failed","error":{"code":"DeploymentFailed",
  "target":".../deployments/ai-foundry-hosted-agents-custom-framework",
  "details":[{"code":"ResourceDeploymentFailure",
    "target":".../deployments/foundryModule", "details":[{"code":"DeploymentFailed",
      "details":[{"code":"ResourceDeploymentFailure",
        "target":".../deployments/models-foundry-agents-<suffix>",
        "details":[{"code":"DeploymentFailed","details":[{
          "code":"NotFound",
          "message":"Specified resource '/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/foundry-agents-<suffix>/deployments/gpt-5-mini' cannot be found."
        }]}]}]}]}]}}
```

`az bicep build` passes, so this is not caught at compile time — only at
deployment.

### Expected result

The deployment succeeds, and `modelDeployments` describes only the deployments
that were actually created for that account.

### Suggested fix

Mirror the resource's condition in the output, so filtered-out entries are not
dereferenced. For example, emit only matching entries:

```bicep
output modelDeployments array = [
  for (model, i) in modelsConfig:
    contains(cognitiveService.name, modelsConfig[i].?aiservice != null ? modelsConfig[i].aiservice : '')
      ? {
          name:       modelDeployment[i].name
          resourceId: modelDeployment[i].id
          ...
        }
      : null
]
```

(then filter the nulls at the consumer, or restructure so the condition is
evaluated once and shared by both the resource and the output).

### Environment

| | |
|---|---|
| Repository revision | `e5d99225fd620a3f9d8c0df160820a663b6f1a9b` (2026-08-07) |
| Last known good | `561d71992bd660af94efc76a8f2f21df0e6ac8e5` (2026-07-24) |
| Lab | `labs/ai-foundry-hosted-agents-custom-framework` |
| Region | `swedencentral` |
| Azure CLI | 2.88.0 |

### Possibly related, seen in the same run

`modules/monitor/v1/appinsights.bicep` emits a warning on the same revision:

```
Warning BCP037: The property "AzureMonitorWorkspaceIngestionMode" is not allowed
on objects of type "ApplicationInsightsComponentProperties". Permissible
properties include "DisableIpMasking", "DisableLocalAuth", "Flow_Type", ...
```

It is only a warning and the deployment of that module succeeded, so it is
mentioned here for completeness rather than as part of this report.
```

---

## Note on a change that turned out **not** to be a problem

While auditing the same revision, `modules/operational-insights/v1/workspaces.bicep`
replaces

```bicep
features: { searchVersion: 1 }
```

with

```bicep
features: { enableLogAccessUsingOnlyResourcePermissions: true }
```

which looked like a change to the Log Analytics access-control model, and
therefore a risk to the broker's managed-identity reads.

**It is not.** Both live workspaces were compared — one deployed from the old
module, one from the new — and both report the identical feature set:

```json
{ "enableLogAccessUsingOnlyResourcePermissions": true, "legacy": 0, "searchVersion": 1 }
```

`true` is already the Azure default for new workspaces; upstream only made it
explicit, and Azure still defaults `searchVersion` to 1. No extra role
assignment is required. This is recorded so the question is not re-opened.
