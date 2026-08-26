# Phase 1 — Audit of the official notebook

Source of truth: `../ai-foundry-hosted-agents-custom-framework/ai-foundry-hosted-agents-custom-framework.ipynb`
(19 cells), plus `main.bicep`, `policy.xml`, `hosted-agent-policy.xml`,
`src/frameworks/*`, `clean-up-resources.ipynb`, `shared/utils.py` and
`modules/cognitive-services/v3/foundry.bicep`.

Nothing in this document is inferred; every claim maps to a cell or a file.

## Flow

```
INPUTS          cell 2       hardcoded lab configuration
   |
PREPARATION     cell 4       az account show / az ad signed-in-user show
   |
INFRASTRUCTURE  cell 6       resource group + az deployment group create (main.bicep)
   |
CONFIGURATION   cell 8       read deployment outputs, compose the inference endpoint
   |
DEPLOYMENT      cells 10-13  az acr build -> register hosted agent version
   |
VALIDATION      cells 15,17  direct Foundry call, then call through APIM
   |
OUTPUTS         cell 8/13    gateway URL, agent endpoint, subscription key
```

## Step detail

| # | Cell | What it does | Resource affected | Depends on | Automatable | Human needed | Can fail | Failure detection |
|---|---|---|---|---|---|---|---|---|
| 1 | 2 | Sets all lab configuration | none | — | yes | no | `__vsc_ipynb_file__` only exists inside VS Code Jupyter | NameError |
| 2 | 4 | Reads account + signed-in user object id | none (read) | `az login` | yes | `az login` beforehand | not signed in; SP has no `signed-in-user` | non-zero exit |
| 3 | 6 | Creates RG, writes `params.json`, runs the Bicep deployment | see below | step 2 | yes | no | quota, RBAC, region | deployment exit code / `properties.error` |
| 4 | 8 | Reads deployment outputs | none (read) | step 3 | yes | no | missing outputs | output key absent |
| 5 | 10 | `az acr build` of the framework image | ACR | steps 3, 4 | yes | choose framework | ACR RBAC not yet propagated; Dockerfile build errors | non-zero exit |
| 6 | 12 | `pip install azure-ai-projects==2.3.0` | none | — | n/a (dropped) | no | — | — |
| 7 | 13 | Registers the hosted agent version | Foundry agent project | steps 4, 5 | **broken as shipped** | currently yes | see "Broken steps" | hang / HTTP error |
| 8 | — | Wait for the agent to reach `Running` | — | step 7 | **not implemented in the notebook** | **yes, manual** | — | — |
| 9 | 15 | Direct invocation via the SDK | none (read) | step 8 | yes | no | **broken as shipped** | HTTP 404 |
| 10 | 17 | Invocation through APIM | none (read) | step 8 | yes | no | 401/404/500 | status code |

## Resources

**Created by `main.bicep`:** Log Analytics workspace; Application Insights; APIM
`Basicv2` with the inference API and `policy.xml`; two Foundry accounts
(`foundry-models` with the `gpt-5-mini` deployment, `foundry-agents`) and their
projects; ACR `acr<suffix>` (Basic, admin enabled); the `hosted-agent-responses-api`
APIM API with the `create-response` operation
(`/agents/{agentName}/endpoint/protocols/openai/responses`) and
`hosted-agent-policy.xml`; **13 role assignments** (9 from `main.bicep`, 4 from the Foundry module).

**Referenced only (`existing`):** the two Foundry accounts, both Foundry projects,
the APIM service.

**Role assignments created:**

| Role | Assignee | Scope | Declared in |
|---|---|---|---|
| Foundry User (`53ca6127-…`) | signed-in principal | each Foundry account | `main.bicep` |
| AcrPull | `foundry-models` account and project identities | ACR | `main.bicep` |
| AcrPull | `foundry-agents` account and project identities | ACR | `main.bicep` |
| ACR Repository Reader | `foundry-agents` account identity | ACR | `main.bicep` |
| ACR Repository Writer, Catalog Lister | `deployer().objectId` | ACR | `main.bicep` |
| **Foundry Project Manager** (`eadc314b-…`) | **`deployer().objectId`** | **each Foundry account** | `foundry.bicep` |
| Cognitive Services User | APIM managed identity | each Foundry account | `foundry.bicep` |

`deployer().objectId` is what makes step 5 work. If the Bicep deployment and the
`az acr build` are run by different principals, the build fails on permissions.

## Policies

- `policy.xml` (inference API): managed-identity token for
  `https://cognitiveservices.azure.com`, sets `Authorization`, sets the backend.
- `hosted-agent-policy.xml` (hosted-agent API): managed-identity token for
  `https://ai.azure.com`, sets `Authorization`, forces `Content-Type: application/json`
  and `Foundry-Features: HostedAgents=V1Preview`.

## Environment variables injected into the agent container

`AZURE_OPENAI_ENDPOINT` (`{gateway}/inference/models`), `AZURE_OPENAI_API_VERSION`
(`2024-05-01-preview`), `AZURE_OPENAI_DEPLOYMENT` (`gpt-5-mini`),
`APIM_SUBSCRIPTION_KEY`, `LOG_LEVEL`. Matches `src/frameworks/*/example.env`.

## Notebook-only mechanics that cannot survive conversion

1. **`__vsc_ipynb_file__`** (cell 2) — a VS Code Jupyter variable. Both
   `deployment_name` and `resource_group_name` derive from it.
2. **`build_version = build_version + 1`** (cell 10) — the image tag depends on how
   many times the cell was executed in the session. Not reproducible.
3. **`params.json` is written into the lab folder** (cell 6) — an automation doing
   the same would modify the official lab and, as the current working tree shows,
   persist a real Entra object id into a tracked file.
4. **The manual wait** — the markdown of cell 14 tells the reader to wait for
   `Running` before testing. There is no polling anywhere in the notebook.
5. **`utils.get_deployment_output`** parses `apimSubscriptions` by running
   `.replace("'", '"')` over a Python repr.

## Broken steps found

### ⚠️ B1 — cell 13, hosted agent registration

Reported symptom: `400 BadRequest — "API version not supported"`.
Stored output actually in the notebook: a `KeyboardInterrupt` raised inside
`project.agents.create_version` → `azure/ai/projects/operations/_patch_agents.py:179`,
i.e. the call hung and was aborted manually. Both point at the same step. The
notebook therefore ships **without a working implementation of this step**.

### ⚠️ B2 — cell 15, direct invocation

Stored output: `404 ResourceNotFound — "Subdomain does not map to a resource."`

### G1 — role model (CORRECTED)

An earlier reading of this audit stated that the lab grants the operator only
**Foundry User** (`53ca6127-db72-4b80-b1b0-d745d6d5456d`) and therefore lacked the
**Foundry Project Manager** role (`eadc314b-1a2d-4efa-be10-5d325db5065e`) that
Microsoft's documentation requires to create a hosted agent. **That was
incomplete.**

`modules/cognitive-services/v3/foundry.bicep` (lines 86-94) already assigns
Foundry Project Manager to `deployer().objectId` on **both** Foundry accounts, and
a project inherits role assignments from its parent account. The operator who runs
the deployment therefore does have the required permission, and G1 is **not** a
gap in the lab.

What remains true, and is the reason the automation still checks: the Bicep
assignment follows `deployer().objectId`. If the ARM deployment and the agent
registration run under different principals, the second principal has no such
grant. Both role IDs were confirmed live with `az role definition list`.
