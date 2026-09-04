# Lab automation — AI Foundry Hosted Agents (custom framework)

Scripted deployment of the official Microsoft lab
[`labs/ai-foundry-hosted-agents-custom-framework`](../ai-foundry-hosted-agents-custom-framework/).

## What this is, and what it is not

| | |
|---|---|
| **`../../vendor/ai-gateway/`** | The **official Microsoft lab**, vendored into this repository from `Azure-Samples/AI-Gateway` under its MIT License, byte-identical to upstream and **pinned to a specific commit**. Source of truth for the architecture. **Never modified by this folder** — refresh it with `scripts/sync-vendor.ps1`, never by hand. |

> **The vendored copy is pinned deliberately.** The shared Bicep modules define
> the deployed infrastructure, so taking a newer upstream revision changes real
> resources on the next run — quietly, because the template compiles either way.
> Move the pin with `sync-vendor.ps1 -Ref <full SHA>`, deploy the result to a
> disposable resource group first, and only then to an environment anyone
> depends on. The current pin is recorded in
> [`vendor/ai-gateway/NOTICE.md`](../../vendor/ai-gateway/NOTICE.md).
| **`./` (this folder)** | **Our automation.** A PowerShell reimplementation of the lab's notebook so the environment can be stood up unattended. It *references* the lab's `main.bicep`, policies and agent sources in place; it does not copy or patch them. |
| **`hosted-agents-demo`** | **Our separate demo project** (`broker/` + `demo-app/`). A companion that *consumes* the deployed environment. `deploy.ps1` now builds it and publishes it to an App Service, so a single run ends with a working demo URL — see [`docs/04-app-service-decision.md`](docs/04-app-service-decision.md). |

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
| `-LabPath` | `vendor/ai-gateway/labs/…` | Override to run against an external checkout of the official lab instead of the vendored copy. Two legacy sibling locations are still probed automatically. |
| `-PrincipalObjectId` | auto-detected | Required when running as a service principal. |
| `-AgentTimeoutMinutes` | `15` | Readiness polling budget. |
| `-AppServiceName` | hash of subscription + resource group | Stable across re-runs, unique between deployments. Override if the generated name is taken. |
| `-AppServiceSku` | `B1` (`config/lab.defaults.psd1`) | Plan size for the companion demo. |
| `-SkipDemoApp` | off | Deploy the lab and the hosted agent only, without the demo application. |
| `-ValidateOnly` | off | Validate without deploying lab resources. |
| `-SkipInfrastructure` / `-SkipImageBuild` / `-SkipAgent` / `-SkipValidation` | off | Re-run individual stages. |

## API Management — this lab deploys none of its own

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
  resource. See `DESIGN_DECISIONS.md` §8.
- `teardown.ps1` removes those resources from the shared gateway **before**
  deleting the resource group, and refuses to continue if it cannot remove the
  diagnostic setting.
- **`teardown.ps1` is not the tool for removing one resource from a live group** —
  it deletes the entire group. Use a targeted `az` command instead.
- Before changing anything about this integration, read `DESIGN_DECISIONS.md`
  §8.1: six failures it cost, all of which fail *silently*.

`ApimSku` still exists in [`config/lab.defaults.psd1`](config/lab.defaults.psd1)
but **nothing in the deployed path reads it**. It applies only to the vendored
`main.bicep`, which this automation no longer deploys.

### Why there is no `-StandaloneApim` mode

It was designed and costed, then deliberately deferred — see `DESIGN_DECISIONS.md`
§8.2 for the reasoning. The short version: an alternate mode nobody runs rots
silently, which is exactly what happened to the section of this README that used
to sit here. It described a tier choice the script had already lost.

### If a standalone instance ever comes back: use `Developer`, not `Consumption`

Kept because it was measured rather than assumed, and it decides the tier.

`Consumption` is dramatically cheaper and deploys in ~14 minutes instead of
~25-35, but **it must never serve a session with a live audience**. Measured on a
real deployment: after 35 minutes idle, the **first request took 54 seconds** —
the gateway alone, on an unauthenticated call returning `401` without reaching a
backend, so no tokens were involved. The next call took 0.36 s. A warm-up before
presenting is therefore mandatory *and* insufficient: any long pause during the
session can put the instance back to sleep. A shorter idle test is misleading —
at 12 minutes idle the penalty was only ~1.4 s, which reads acceptable and is
not.

`Developer` avoids this entirely: it is dedicated, always-on capacity, so it has
no cold start, and it is roughly a quarter the price of `Basicv2`. Its trade-offs
are no SLA and no scaling beyond a single unit — the right shape for a demo lab,
and already what the shared gateway is.

The vendored `apim.bicep` hardcodes `sku.capacity: 1`, which `Consumption`
rejects; a patch applied on every `sync-vendor.ps1` run handles it — see
[`docs/06-apim-consumption.md`](docs/06-apim-consumption.md) and
[`patches/`](patches/). That patch is still applied, and still only matters to
the vendored template.

## Re-deploying

The resource group is **reused by default**. The lab derives most resource names
from `uniqueString(resourceGroup().id)`, so keeping the name keeps the names —
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
delete`, …) are retried up to 3 times, 60 s apart. Permanent errors
(`AuthorizationFailed`, `InvalidTemplate`, quota) fail immediately.

## Outputs

Written to `out/` (git-ignored):

- `out/outputs.json` — gateway URL, agent endpoint, Foundry project endpoint,
  inference endpoint, registry, image, agent name and version, and whether each
  invocation test passed. **Contains no secrets.**
- `out/apim-subscription-key.txt` — the APIM subscription key, kept separate
  because it is a credential.
- `out/params.generated.json` — the Bicep parameters actually used.
- `out/appservice-package/` — the staged demo package that was deployed
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
├── README.md
├── config/lab.defaults.psd1        # lab configuration (no environment-specific values)
├── scripts/
│   ├── deploy.ps1                  # orchestrator
│   ├── teardown.ps1                # resource group deletion
│   ├── sync-vendor.ps1             # refresh ../../vendor/ai-gateway from upstream
│   ├── local/                      # LOCAL ONLY - never deployed, never packaged
│   │   └── Manage-LabCost.ps1      # cost status and controls for the presenter
│   └── modules/
│       ├── Common.ps1              # logging, az wrapper, Foundry REST wrapper
│       ├── Preflight.ps1           # prerequisites, auth, lab source checks
│       ├── Infra.ps1               # resource group, Bicep deployment, outputs
│       ├── AgentImage.ps1          # ACR readiness + az acr build
│       ├── FoundryAgent.ps1        # hosted agent registration + status polling
│       ├── Validate.ps1            # direct and APIM invocation tests
│       └── AppService.ps1          # companion demo: build, site, RBAC, settings, deploy, health
├── docs/
│   ├── 01-notebook-audit.md        # phase 1: what the notebook actually does
│   ├── 03-implementation-report.md # phase 3+: what was built, tested, and left open
│   └── 04-app-service-decision.md  # hosting the companion demo: options, decision, RBAC
└── out/                            # generated, git-ignored
```

## Known limitations

See [`docs/03-implementation-report.md`](docs/03-implementation-report.md) for the
authoritative list, including the two steps that are broken in the notebook as
shipped and how this automation handles them.
