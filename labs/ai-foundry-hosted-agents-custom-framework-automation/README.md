# Lab automation â€” AI Foundry Hosted Agents (custom framework)

Scripted deployment of the official Microsoft lab
[`labs/ai-foundry-hosted-agents-custom-framework`](../ai-foundry-hosted-agents-custom-framework/).

## What this is, and what it is not

| | |
|---|---|
| **`../../vendor/ai-gateway/`** | The **official Microsoft lab**, vendored into this repository from `Azure-Samples/AI-Gateway` under its MIT License, byte-identical to upstream and **pinned to a specific commit**. Source of truth for the architecture. **Never modified by this folder** â€” refresh it with `scripts/sync-vendor.ps1`, never by hand. |

> **The vendored copy is pinned deliberately.** The shared Bicep modules define
> the deployed infrastructure, so taking a newer upstream revision changes real
> resources on the next run â€” quietly, because the template compiles either way.
> Move the pin with `sync-vendor.ps1 -Ref <full SHA>`, deploy the result to a
> disposable resource group first, and only then to an environment anyone
> depends on. The current pin is recorded in
> [`vendor/ai-gateway/NOTICE.md`](../../vendor/ai-gateway/NOTICE.md).
| **`./` (this folder)** | **Our automation.** A PowerShell reimplementation of the lab's notebook so the environment can be stood up unattended. It *references* the lab's `main.bicep`, policies and agent sources in place; it does not copy or patch them. |
| **`hosted-agents-demo`** | **Our separate demo project** (`broker/` + `demo-app/`). A companion that *consumes* the deployed environment. `deploy.ps1` now builds it and publishes it to an App Service, so a single run ends with a working demo URL â€” see [`docs/04-app-service-decision.md`](docs/04-app-service-decision.md). |

This automation deploys the same architecture the notebook deploys, with the same
parameters and the same resulting resources. Where it deviates, the deviation is
listed in [`docs/03-implementation-report.md`](docs/03-implementation-report.md).

## Prerequisites

- Windows with **Windows PowerShell 5.1** or PowerShell 7+.
- **Azure CLI 2.80 or later** (`az upgrade`). Required by the Foundry hosted-agent REST API.
- Signed in: `az login`.
- On the target subscription: **Owner**, or **Contributor + Role Based Access Control Administrator**.
  The lab's `main.bicep` creates role assignments and cannot complete without them.
- Quota for `gpt-5-mini` (`GlobalStandard`, 10 units) in the target region.

- **Node.js 20 or later** (`npm` on PATH), used to build the companion demo. Not
  needed with `-SkipDemoApp`.

No Python, no Jupyter, no local Docker. The container image is built remotely in ACR.

## Usage

```powershell
cd labs\ai-foundry-hosted-agents-custom-framework-automation\scripts

# Dry run: prerequisites + auth + ARM template validation. Creates only the resource group.
.\deploy.ps1 -ValidateOnly

# Full deployment with the notebook's defaults
.\deploy.ps1

# Another subscription / resource group / framework
.\deploy.ps1 -SubscriptionId 00000000-0000-0000-0000-000000000000 `
             -ResourceGroupName rg-hosted-agents-demo `
             -Location swedencentral `
             -Framework strands
```

Tear down when finished (deletes the whole resource group):

```powershell
.\teardown.ps1 -ResourceGroupName lab-ai-foundry-hosted-agents-custom-framework
```

## Parameters

Only values that genuinely vary per environment are parameters. Everything that
the notebook hardcodes as lab configuration lives in
[`config/lab.defaults.psd1`](config/lab.defaults.psd1).

| Parameter | Default | Why it exists |
|---|---|---|
| `-SubscriptionId` | current `az` subscription | Run against a different subscription. |
| `-ResourceGroupName` | `lab-ai-foundry-hosted-agents-custom-framework` | The notebook derives this from its folder name; here it is explicit. |
| `-Location` | `swedencentral` | Only used when the group is created. |
| `-DeploymentName` | `ai-foundry-hosted-agents-custom-framework` | ARM deployment name. |
| `-Framework` | `pydantic` | `pydantic` or `strands`. Notebook cell 10. |
| `-ImageTag` | UTC timestamp | Unique immutable tag per run, replacing the notebook's session counter. |
| `-LabPath` | `vendor/ai-gateway/labs/â€¦` | Override to run against an external checkout of the official lab instead of the vendored copy. Two legacy sibling locations are still probed automatically. |
| `-PrincipalObjectId` | auto-detected | Required when running as a service principal. |
| `-AgentTimeoutMinutes` | `15` | Readiness polling budget. |
| `-AppServiceName` | hash of subscription + resource group | Stable across re-runs, unique between deployments. Override if the generated name is taken. |
| `-AppServiceSku` | `B1` (`config/lab.defaults.psd1`) | Plan size for the companion demo. |
| `-SkipDemoApp` | off | Deploy the lab and the hosted agent only, without the demo application. |
| `-ValidateOnly` | off | Validate without deploying lab resources. |
| `-SharedApimName` | `apim-shared-pdcibwky2f5ms` (`config/lab.defaults.psd1`) | The shared gateway to register on. Point a run at a different instance - after a migration to a new one, say - without editing committed configuration. |
| `-SharedApimResourceGroupName` | `rg-shared-apim-gateway-V2` (`config/lab.defaults.psd1`) | Resource group of that instance. **`teardown.ps1` takes the same two flags and must be given the same values**, or it cleans the wrong gateway and leaves this lab's resources behind on the right one. |
| `-SkipInfrastructure` / `-SkipImageBuild` / `-SkipAgent` / `-SkipValidation` | off | Re-run individual stages. |

## API Management â€” this lab deploys none of its own

**Since 2026-09-04 there is no APIM tier to choose, because the lab no longer
creates an API Management instance.** It registers on the shared gateway
`apim-shared-pdcibwky2f5ms` (Developer tier, resource group
`rg-shared-apim-gateway-V2`), which several teams' labs use. `deploy.ps1` always
does this; **there is no flag to deploy a standalone instance instead**, and the
`-Skip*` switches do not change it.

The reason is cost: an APIM was ~92% of this lab's fixed spend. The instance it
used to create, `apim-7atp6hx2a4e7u` (`Basicv2`, ~$197/month billed while the
resource group existed), was deleted and purged once the shared path had been
verified end to end.

What this means in practice:

- Every resource the lab creates on that gateway is prefixed `hosted-agents-`.
  This is not style. In ARM, creating a child resource that already exists is an
  **update in place**, so an unprefixed name silently takes over another team's
  resource. See `DESIGN_DECISIONS.md` Â§8.
- `teardown.ps1` removes those resources from the shared gateway **before**
  deleting the resource group, and refuses to continue if it cannot remove the
  diagnostic setting.
- **`teardown.ps1` is not the tool for removing one resource from a live group** â€”
  it deletes the entire group. Use a targeted `az` command instead.
- Before changing anything about this integration, read `DESIGN_DECISIONS.md`
  Â§8.1: six failures it cost, all of which fail *silently*.

`ApimSku` still exists in [`config/lab.defaults.psd1`](config/lab.defaults.psd1)
but **nothing in the deployed path reads it**. It applies only to the vendored
`main.bicep`, which this automation no longer deploys.

**Which gateway is used is overridable per run.** `-SharedApimName` and
`-SharedApimResourceGroupName` default to the values in the config and are only
worth passing when the shared instance itself changes:

```powershell
.\deploy.ps1 -SharedApimName apim-shared-v3 -SharedApimResourceGroupName rg-shared-apim-gateway-V3
.\teardown.ps1 -SharedApimName apim-shared-v3 -SharedApimResourceGroupName rg-shared-apim-gateway-V3
```

Pass them to **both** or to neither. A teardown reading the config default after
a deployment that was pointed elsewhere finds nothing, reports success, and
leaves the real resources on the gateway it never looked at.

### Why there is no `-StandaloneApim` mode

It was designed and costed, then deliberately deferred â€” see `DESIGN_DECISIONS.md`
Â§8.2 for the reasoning. The short version: an alternate mode nobody runs rots
silently, which is exactly what happened to the section of this README that used
to sit here. It described a tier choice the script had already lost.

### If a standalone instance ever comes back: use `Developer`, not `Consumption`

Kept because it was measured rather than assumed, and it decides the tier.

`Consumption` is dramatically cheaper and deploys in ~14 minutes instead of
~25-35, but **it must never serve a session with a live audience**. Measured on a
real deployment: after 35 minutes idle, the **first request took 54 seconds** â€”
the gateway alone, on an unauthenticated call returning `401` without reaching a
backend, so no tokens were involved. The next call took 0.36 s. A warm-up before
presenting is therefore mandatory *and* insufficient: any long pause during the
session can put the instance back to sleep. A shorter idle test is misleading â€”
at 12 minutes idle the penalty was only ~1.4 s, which reads acceptable and is
not.

`Developer` avoids this entirely: it is dedicated, always-on capacity, so it has
no cold start, and it is roughly a quarter the price of `Basicv2`. Its trade-offs
are no SLA and no scaling beyond a single unit â€” the right shape for a demo lab,
and already what the shared gateway is.

The vendored `apim.bicep` hardcodes `sku.capacity: 1`, which `Consumption`
rejects; a patch applied on every `sync-vendor.ps1` run handles it â€” see
[`docs/06-apim-consumption.md`](docs/06-apim-consumption.md) and
[`patches/`](patches/). That patch is still applied, and still only matters to
the vendored template.

## Re-deploying

The resource group is **reused by default**. The lab derives most resource names
from `uniqueString(resourceGroup().id)`, so keeping the name keeps the names â€”
and with them the public URL, the ACR layer cache, the Hosted Agent version
history, and one resource group for `teardown.ps1` to remove. A new resource
group per run would avoid every collision but would change the demo URL and
destroy convergence. Use `-ResourceGroupName` when you deliberately want a
separate environment. (It no longer provisions a second APIM: since the shared
gateway migration the lab creates none, so a new group is much cheaper than it
used to be - though it does register a second set of `hosted-agents-*` resources
on the shared gateway under the same names, which will collide with the first.)

| Scenario | Behaviour |
| --- | --- |
| **New resource group** | Full install. Faster than it used to be: no APIM is provisioned, which used to dominate the ~25-35 min. Foundry and the model deployment now set the pace. |
| **Existing, healthy resource group** | Idempotent. Infrastructure and role assignments are reused; the demo is rebuilt and redeployed; the site restarts briefly. |
| **Teardown, then immediate re-deploy with the same name** | May conflict. Deleted Foundry resources stay recoverable ~48 h, Log Analytics up to 14 days, with their names reserved. Preflight warns; wait for the retention window, purge explicitly, or pass a different `-ResourceGroupName`. (APIM is no longer among them - the lab deploys none.) |
| **New demo version over existing infrastructure** | Infrastructure reused; a new image tag and a new Hosted Agent version are created; App Service redeployed. |

Transient ARM conflicts (`RequestConflict`, `FailedIdentityOperation`, `pending
delete`, â€¦) are retried up to 3 times, 60 s apart. Permanent errors
(`AuthorizationFailed`, `InvalidTemplate`, quota) fail immediately.

## Outputs

Written to `out/` (git-ignored):

- `out/outputs.json` â€” gateway URL, agent endpoint, Foundry project endpoint,
  inference endpoint, registry, image, agent name and version, and whether each
  invocation test passed. **Contains no secrets.**
- `out/apim-subscription-key.txt` â€” the APIM subscription key, kept separate
  because it is a credential.
- `out/params.generated.json` â€” the Bicep parameters actually used.
- `out/appservice-package/` â€” the staged demo package that was deployed
  (broker sources + built console). **No secrets:** the APIM key goes directly
  into an App Service application setting and is never written here.

The run ends by printing the demo URL:

```
========================================
 HOSTED AGENTS DEMO READY
========================================

  Demo URL : https://hosted-agents-demo-xxxxxxxx.azurewebsites.net
```

## Layout

```
ai-foundry-hosted-agents-custom-framework-automation/
â”œâ”€â”€ README.md
â”œâ”€â”€ config/lab.defaults.psd1        # lab configuration (no environment-specific values)
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ deploy.ps1                  # orchestrator
â”‚   â”œâ”€â”€ teardown.ps1                # resource group deletion
â”‚   â”œâ”€â”€ sync-vendor.ps1             # refresh ../../vendor/ai-gateway from upstream
â”‚   â”œâ”€â”€ local/                      # LOCAL ONLY - never deployed, never packaged
â”‚   â”‚   â””â”€â”€ Manage-LabCost.ps1      # cost status and controls for the presenter
â”‚   â””â”€â”€ modules/
â”‚       â”œâ”€â”€ Common.ps1              # logging, az wrapper, Foundry REST wrapper
â”‚       â”œâ”€â”€ Preflight.ps1           # prerequisites, auth, lab source checks
â”‚       â”œâ”€â”€ Infra.ps1               # resource group, Bicep deployment, outputs
â”‚       â”œâ”€â”€ AgentImage.ps1          # ACR readiness + az acr build
â”‚       â”œâ”€â”€ FoundryAgent.ps1        # hosted agent registration + status polling
â”‚       â”œâ”€â”€ Validate.ps1            # direct and APIM invocation tests
â”‚       â””â”€â”€ AppService.ps1          # companion demo: build, site, RBAC, settings, deploy, health
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ 01-notebook-audit.md        # phase 1: what the notebook actually does
â”‚   â”œâ”€â”€ 03-implementation-report.md # phase 3+: what was built, tested, and left open
â”‚   â””â”€â”€ 04-app-service-decision.md  # hosting the companion demo: options, decision, RBAC
â””â”€â”€ out/                            # generated, git-ignored
```

## Known limitations

See [`docs/03-implementation-report.md`](docs/03-implementation-report.md) for the
authoritative list, including the two steps that are broken in the notebook as
shipped and how this automation handles them.
