# Implementation report

## 1. Files

### Created (all under `labs/ai-foundry-hosted-agents-custom-framework-automation/`)

| File | Purpose |
|---|---|
| `README.md` | Usage, prerequisites, parameters, boundary against the official lab |
| `.gitignore` | Excludes `out/` (contains the APIM subscription key) |
| `config/lab.defaults.psd1` | Lab configuration from notebook cell 2. No subscription ids, object ids, resource names or keys |
| `scripts/deploy.ps1` | Orchestrator |
| `scripts/teardown.ps1` | Resource group deletion (`clean-up-resources.ipynb` equivalent) |
| `scripts/modules/Common.ps1` | Logging, the single `az` wrapper, the Foundry REST wrapper, stderr cleanup |
| `scripts/modules/Preflight.ps1` | Azure CLI version, auth, subscription, lab source validation |
| `scripts/modules/Infra.ps1` | Resource group, parameters generation, Bicep deployment, outputs |
| `scripts/modules/AgentImage.ps1` | ACR data-plane readiness probe, registry policy check, `az acr build` |
| `scripts/modules/FoundryAgent.ps1` | Role assignment, hosted agent registration, status polling |
| `scripts/modules/Validate.ps1` | Direct and APIM invocation tests |
| `docs/01-notebook-audit.md` | Phase 1 |
| `docs/03-implementation-report.md` | This document |

### Modified

**None.** No file outside this folder was created or edited.

### Confirmation that the official lab was not modified

`git status --porcelain -- labs/ai-foundry-hosted-agents-custom-framework/` reports
only changes that predate this work (the notebook edit and the untracked
`broker/`, `demo-app/` folders, all present in the session's initial snapshot).
No lab file was written.

Two specific precautions:

- The generated Bicep parameters go to `out/params.generated.json`. The lab's own
  `params.json` still carries its original timestamp of 31/07.
- `az bicep build` was run with `--outfile` pointed at a scratch directory. Its
  default behaviour writes `main.json` next to `main.bicep`, which would have
  dirtied the lab folder — the same artifact is currently sitting untracked in
  `labs/gemini-mcp-agents/`.

## 2. ⚠️ Broken step B1 — hosted agent registration

**What is broken in the notebook.** Cell 13 calls
`project.agents.create_version(...)` from `azure-ai-projects==2.3.0`. Reported
failure: `400 BadRequest — "API version not supported"`. The output actually
stored in the notebook is a `KeyboardInterrupt` inside
`azure/ai/projects/operations/_patch_agents.py:179` — the call hung and was
aborted by hand. Either way, **the lab ships without a working implementation of
this step.**

**Replacement used.** The documented REST call, issued through `az rest`:

```
POST {projectEndpoint}/agents/{name}?api-version=v1                 # first creation
POST {projectEndpoint}/agents/{name}/versions?api-version=v1        # subsequent versions
--resource https://ai.azure.com
{ "definition": { "kind": "hosted", "container_configuration": { "image": … },
                  "cpu": "1", "memory": "2Gi",
                  "protocol_versions": [ { "protocol": "responses", "version": "1.0.0" } ],
                  "environment_variables": { … } } }
```

**Why this is equivalent to the lab's intent.** The body carries exactly the
values notebook cell 13 passes: Responses protocol 1.0.0, cpu `1`, memory `2Gi`,
the same image URI, and the same five environment variables. It creates the same
object; only the transport differs.

**Why it is trusted over the SDK path.** It is the form Microsoft documents in
the REST pivot of
[Deploy a hosted agent](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/deploy-hosted-agent)
and in
[Manage hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/manage-hosted-agent),
which also states that `--resource https://ai.azure.com` is **required** for every
`az rest` call to a Foundry data-plane endpoint, since `az rest` cannot otherwise
derive the AAD audience.

**On the prior art in `broker/src/foundryAgents.ts`.** That module implements the
same call with the same path, api-version and snake_case body. It was used as a
lead, not as authority; the contract implemented here was verified field-by-field
against the Microsoft documentation above, and it matches. One difference: the
broker always POSTs to `/agents/{name}/versions`, whereas the documentation uses
`POST /agents` for the first creation. This automation follows the documentation
and probes with a `GET /agents/{name}` first.

**Status: ⚠️ NOT VERIFIED AGAINST A LIVE ENVIRONMENT.** See §10.

### 2.1 Why REST is preferable to the Python SDK here

Beyond the fact that the SDK path is the one that is broken:

- **No interpreter dependency.** The SDK route needs Python plus
  `pip install azure-ai-projects==2.3.0 azure-identity` at deploy time. On
  Windows that brings the Microsoft Store `python` alias, interpreter-version
  drift and wheel-availability failures into a deployment script. `az rest` is
  already a hard prerequisite of this automation.
- **Same authentication as every other step.** `az rest --resource
  https://ai.azure.com` reuses the `az login` session; the SDK would introduce a
  second credential chain (`AzureCliCredential`) with its own failure modes.
- **The documentation's own REST examples are `az rest` calls**, so the automation
  matches the reference material line for line.
- **Failures are legible.** The REST call returns Foundry's status code and body
  verbatim, instead of an SDK exception several frames deep — which is exactly
  what made the notebook's failure hard to characterise.

## 2.5 Two lessons carried over from an earlier review

A review of a *different* lab was offered as prior art early on. It described
another architecture entirely, so nothing was carried over from it structurally
— the notebook remains the single source of truth for this automation. Two
general lessons did survive, and both shaped the code:

1. **Validate every value read out of JSON.** In PowerShell, reading a property
   that does not exist returns `$null` silently: `$outputs.typo.value` yields
   `$null` with no error. A renamed or missing ARM output therefore propagates a
   null endpoint or key deep into the run and surfaces much later as an
   unrelated HTTP failure. See §3.

2. **Do not depend on Python resolving correctly on Windows.** `python` on PATH
   can be the Microsoft Store alias, and a very recent interpreter can outrun
   the wheels `azure-ai-projects` needs. The notebook installs and uses that SDK;
   this automation has **no Python dependency at all** — the hosted agent is
   registered and polled through `az rest`. See §2.1 and §9.

## 3. Strict output and value validation

Implemented after Lesson 1 above.

`Get-RequiredProperty` (in `scripts/modules/Common.ps1`) is the single gate for every value
read out of a JSON payload. It fails when the containing object is null, when the
property is absent (listing the names that *were* present), when the value is
null, when a string is empty or whitespace, or when an array is empty.
`Read-DeploymentOutput` layers the ARM `{ "<name>": { "value": … } }` shape on
top, validating both the named entry and its `value` member.
`Assert-NotNullOrEmpty` covers computed values that are not read from JSON.

Applied to:

| Value | Where |
|---|---|
| `properties`, `properties.outputs` | deployment record |
| `apimResourceGatewayURL`, `containerRegistryName`, `foundryAgentProjectEndpoint`, `apimSubscriptions` | ARM outputs |
| `apimSubscriptions[0].name`, `apimSubscriptions[0].key` | ARM output sub-objects |
| `azure-cli` version | `az version` |
| `id`, `name`, `tenantId`, `user`, `user.name` | `az account show` |
| `location` | `az group show` |
| `version` | Foundry agent creation response |
| `status` | Foundry version poll (guarded before access) |
| `InferenceApiPath`, `Frameworks.<fw>.agentName`, `ModelsConfig[0].name` | configuration |

Two shape checks were added because these values build URLs, and a syntactically
wrong value must fail at the source rather than as a confusing HTTP error later:
`apimResourceGatewayURL` must start with `https://`, and
`foundryAgentProjectEndpoint` must match
`https://…/api/projects/…`.

`Test-Configuration` validates `config/lab.defaults.psd1` before anything touches
Azure: twelve required scalars must be present and non-empty, the four required
collections must exist, `AiServicesConfig` must hold at least two Foundry
resources, `FoundryAgentAiServiceIndex` must be in range, and `ModelsConfig` and
`ApimSubscriptionsConfig` must be non-empty.

## 4. Bugs found by actually running the script

Three defects were found by executing `-ValidateOnly`, not by inspection. All are
fixed.

1. **`-AllowFailure` was defeated by `$ErrorActionPreference = 'Stop'`.**
   `deploy.ps1` sets `Stop`. When a native command writes to stderr, Windows
   PowerShell raises a `NativeCommandError`, which under `Stop` terminates at the
   invocation line — before the exit code can be inspected. The first
   `-ValidateOnly` run therefore aborted on a *normal* "resource group not found"
   probe. `Invoke-Az` now sets `$ErrorActionPreference = 'Continue'` for that one
   call; the scope is the function, so callers keep `Stop`.

2. **`-AllowFailure` never parsed JSON.** `$json` was only computed under
   `-AsJson`, so every `-AllowFailure` caller received `Json = $null`. This
   silently broke existence checks: `Initialize-ResourceGroup` could never see an
   existing group, `Grant-FoundryProjectManagerRole` could never detect an
   existing assignment, `Test-Authentication` never resolved the principal object
   id, and `Test-AcrArmAuthPolicy` never read the policy. Parsing now runs for
   `-AllowFailure` too, tolerating non-JSON output.

   This is the exact class of defect Lesson 1 warns about — a `$null` that
   produced no error and a misleading message ("`az ad signed-in-user show`
   failed") for a command that had in fact returned exit 0.

3. **Parameter binding bug in `Invoke-LabDeployment`.** `-Hint @(…) -join ' '`
   binds the array to `-Hint` and leaves `-join` as a stray argument. Fixed by
   joining into a variable first.

4. **The entire `scripts/lib/` directory was invisible to git.** The repository
   root `.gitignore` line 28 contains `lib/` — a Python virtual-environment rule —
   which silently excluded six of the eight PowerShell files. `git status
   --untracked-files=all` listed only `deploy.ps1` and `teardown.ps1`, so a fresh
   clone would have produced a `deploy.ps1` that fails immediately on its first
   dot-source. Fixed by renaming the directory to `scripts/modules/`; a nested
   negation would not work, because git does not descend into an excluded
   directory. Verified: all 14 files are now listed, and `out/` remains ignored.


## 5. The operator's role — earlier claim corrected

A previous version of this report stated that the lab grants the operator only
**Foundry User** and therefore omitted the **Foundry Project Manager** role that
hosted-agent creation requires. **That claim was wrong**, and is withdrawn.

`modules/cognitive-services/v3/foundry.bicep` lines 86-94 assign Foundry Project
Manager (`eadc314b-1a2d-4efa-be10-5d325db5065e`) to `deployer().objectId` on both
Foundry accounts. Projects inherit from their parent account, so the principal
that ran the deployment already holds the permission at project scope. This is
therefore **not** a defect in the lab, and it is **not** a candidate root cause
for the broken cell 13.

`Grant-FoundryProjectManagerRole` is kept as a narrow safety net for the one case
the Bicep cannot cover: the ARM deployment and the agent registration running
under different principals (for example `-SkipInfrastructure` from a second
account, or a CI principal deploying and a human registering). It queries with
`--include-inherited`, so the inherited account-level grant satisfies the check
and no duplicate assignment is created. If it cannot create an assignment it
warns with the exact scope and continues, so the real Foundry error stays visible.

## 6. ⚠️ Broken step B2 — direct invocation

Cell 15's stored output is `404 ResourceNotFound — "Subdomain does not map to a
resource."` This automation performs the same test via the documented REST path
(`POST {projectEndpoint}/agents/{name}/endpoint/protocols/openai/responses?api-version=v1`)
rather than through `project.get_openai_client()`. The test is **non-fatal**: a
failure is reported explicitly, recorded in `out/outputs.json`, and the script
exits with code `2` so a caller can tell "deployed but unverified" from "deployed
and verified". It is not marked as working.

## 7. Polling

The notebook has no polling; cell 14's markdown asks the reader to wait manually.
`Wait-HostedAgentActive` replaces that with
`GET {projectEndpoint}/agents/{name}/versions/{version}?api-version=v1` and the
documented `status` field:

| Status | Action |
|---|---|
| `creating` | keep polling, print remaining budget |
| `active` | proceed |
| `failed` | abort and print the version's `error` object, with the documented causes (`image_pull_failed`, `UnauthorizedAcrPull`, `AcrImageNotFound`) |
| `deleting` / `deleted` | abort |

Default budget 15 minutes, 10-second interval, both overridable. A transient
query failure is retried rather than treated as terminal. On timeout the script
prints the exact `az rest` command to inspect the version by hand.

The only other wait, `Wait-AcrDataPlaneReady`, is **not** a fixed sleep either: it
probes the real permission (`az acr repository list`) until it succeeds, because
the ACR role assignments `main.bicep` grants to `deployer()` are created at the
end of the deployment and are not immediately effective on the data plane.

## 8. Error handling

Every `az` invocation goes through `Invoke-Az`. No exit code is ignored. A failure
reports the step, the exact command, the resource, the exit code, the cleaned
Azure error and a targeted "Check" line — for example, `AuthorizationFailed`
during the deployment explains that `main.bicep` creates role assignments and
therefore needs Owner or Contributor + RBAC Administrator.

Two Windows PowerShell specifics are handled deliberately:

- stderr is captured to a temp file rather than merged with `2>&1`, which in
  5.1 wraps each stderr line in an ErrorRecord and corrupts `$?` even on success;
  `Get-CleanErrorText` then strips the `az.cmd :` / `CategoryInfo` decoration.
- JSON request bodies are passed as `--body @file`, avoiding CLI quoting problems.

## 9. Why no Bash helper was needed

The task allowed proposing a Bash companion for complex JSON parsing or repetitive
`az` calls. It is not needed here, and none was written. The two things that would
have justified it in the notebook — `jq`-style JSON handling and the Foundry
data-plane calls — are covered natively: `ConvertFrom-Json` handles the former,
and the documentation's own REST examples are `az rest` calls, which run
identically from PowerShell. Adding Bash would introduce a WSL/Git-Bash
dependency for zero benefit. The solution is pure PowerShell + Azure CLI.

## 10. Testing — what was actually run

**Unit / offline, passing:**

| Test | Result |
|---|---|
| Parse check of all 8 `.ps1` files (`[Parser]::ParseFile`) | 0 errors |
| `config/lab.defaults.psd1` loads via `Import-PowerShellDataFile` | 17 keys, values match notebook cell 2 |
| `Test-Configuration` on the real config | passes |
| `Test-Configuration` with a key removed | fails naming the key |
| `Invoke-Az` success path with JSON parsing | subscription returned |
| `Invoke-Az` failure path | throws with step / command / resource / exit code / Azure message / hint |
| `Invoke-Az -AllowFailure` | returns `Success=false`, does not throw |
| `Get-CleanErrorText` | decoration stripped, only the Azure message remains |
| `Read-DeploymentOutput`, missing key | fails, listing the names ARM did return |
| `Read-DeploymentOutput`, `value: null` | fails, "the value is null" |
| `Read-DeploymentOutput`, `value: "  "` | fails, "the value is an empty string" |
| `Get-LabDeploymentOutputs`, malformed Foundry endpoint | rejected with the expected shape |
| `Get-LabDeploymentOutputs`, happy path | all six values built, key masked in the log |
| `Split-FoundryProjectEndpoint` | account and project parsed from the lab's real endpoint shape |
| `New-BicepParametersFile` | valid JSON, correct schema |
| Python dependency grep over `scripts/` and `config/` | no executable reference; two prose comments only |

**Against live Azure, passing:**

| Test | Result |
|---|---|
| `az rest` wrapper against a read-only ARM endpoint | 200 |
| `az bicep build` of the lab's `main.bicep` (`--outfile` to scratch) | compiles, exit 0 |
| Generated parameters vs. template parameters | 11 of 11 names match exactly |
| The 4 consumed outputs vs. `main.bicep` OUTPUTS | all present, exact casing |
| **`.\deploy.ps1 -ValidateOnly`** | **exit 0 — ARM validated the template with the generated parameters** |
| Re-run of `-ValidateOnly` (idempotence of the group step) | reuses the existing group |
| `out/` is git-ignored; the object id appears only there | confirmed |
| Lab folder integrity after everything above | unchanged |

The `-ValidateOnly` run created the empty resource group
`lab-ai-foundry-hosted-agents-custom-framework` in `swedencentral`. This is
unavoidable: `az deployment group validate` is scoped to a resource group. An
empty group carries no cost and can be removed with `.	eardown.ps1`. **No lab
resource was deployed.**

**Not executed:**

- **No lab resources were deployed.** A full run provisions APIM `Basicv2` and two
  Foundry accounts — a real, ongoing cost, and explicitly deferred.
- Consequently **untested end to end**: the Bicep deployment itself,
  `az acr build`, the ACR data-plane readiness probe, the ACR ARM-auth policy
  check, the hosted agent registration (§2), the Foundry Project Manager role
  assignment (§5), the status polling loop (§7), and both invocation tests.

**Therefore: the deployment is NOT confirmed to work.** ARM has accepted the
template and parameters, and the offline logic is tested — but no Azure-facing
step past validation has run.

## 11. Risks that still require a real deployment

1. **§2 hosted agent registration.** The REST contract matches the documentation
   field for field, but has never been executed against this environment. This is
   the step that is broken in the notebook and remains the highest risk.
2. **§5 role gap.** Whether Foundry Project Manager is genuinely required — and
   whether its absence is what breaks the notebook — is unproven. The assignment
   is created idempotently; if the account cannot create it, the script warns and
   continues so the real Foundry error is visible.
3. **§7 polling.** The `status` values are documented but the loop has never seen
   a live `creating -> active` transition, nor a `failed` payload.
4. **ACR RBAC propagation.** `Wait-AcrDataPlaneReady` assumes the permission
   becomes effective within 5 minutes. The real propagation delay is unmeasured.
5. **§6 direct invocation (404 in the notebook).** Still undiagnosed. It may
   simply reflect that no agent existed at the time.
6. **`deployer().objectId`.** If the Bicep deployment and `az acr build` ever run
   under different principals, the build fails on permissions. Untested.
7. **Quota.** `gpt-5-mini` GlobalStandard capacity 10 in `swedencentral` was not
   verified; ARM validation does not check model quota.

## 12. Outstanding work

1. Run a full `.\deploy.ps1` once the spend is authorised, then update §2, §5,
   §7 and §10 with real results.
2. **`hosted-agents-demo` wiring** is intentionally out of scope, as instructed.
   `out/outputs.json` is already shaped to feed the broker's configuration when
   that phase starts.
