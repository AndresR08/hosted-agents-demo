# App Service: architecture decision

Goal: `deploy.ps1` runs once and ends with a public URL that opens a working
demo. This records what was chosen, what was rejected and why, so the next
person changing it knows which constraints are load-bearing.

## Constraint that decides everything

The APIM subscription key and the Entra token must stay server-side. That is
already the reason `broker/` exists: the browser talks only to the broker, and
the broker holds both. Whatever hosts the frontend, the key never reaches it.

That constraint is satisfied identically by every option below, which is why
it does *not* argue for separating the frontend from the broker.

## Options considered

|                          | 1 — one App Service | 2 — two App Services | 3 — Static Web App + App Service |
| ------------------------ | ------------------- | -------------------- | -------------------------------- |
| Resources                | 1 site + 1 plan     | 2 sites (+1 plan)    | SWA + site + plan                |
| CORS                     | none — same origin  | required             | required                         |
| Broker URL in the bundle | never               | baked in at build    | baked in at build                |
| Order of operations      | linear              | circular (each needs the other's URL) | circular |
| Managed identity         | one, on the broker  | one useful, one idle | one useful                       |
| Deploy                   | one zip             | two zips             | zip + `swa` CLI                  |
| Cost                     | 1× B1               | 2× B1                | B1 + SWA Free                    |
| Tooling                  | Azure CLI only      | Azure CLI only       | needs the `swa` CLI too          |

Option 3 also fails a hard requirement of this repository's automation:
everything must run from Windows PowerShell with Azure CLI, and `swa` is a
separate npm-installed toolchain.

## Decision: one App Service

A single Linux App Service (Node 22 LTS, B1) where Express serves both
`demo-app/dist` and `/api`.

Security is unchanged — no option puts a secret in the browser — while CORS,
the second identity, the second deployment and the circular URL dependency all
disappear. It is also the fastest to a usable demo, which is the whole point.

```
browser ──HTTPS──▶ App Service (system-assigned managed identity)
                     ├─ /            demo-app/dist   (static)
                     └─ /api/*       broker (Express)
                                       ├─ DefaultAzureCredential ──▶ ARM, Foundry, Log Analytics, ACR
                                       └─ APIM_SUBSCRIPTION_KEY (application setting) ──▶ APIM
```

## What this required in the existing code

Kept deliberately small; nothing about the broker's architecture changed.

| Change | Why |
| ------ | --- |
| `broker/src/acr.ts` replaces `azCli.ts` | The App Service Linux Node image has no Azure CLI. `az acr manifest list-metadata` was the broker's only shell-out; it is now the same lookup over ACR's REST token exchange, so image digest and push time survive the move. |
| `broker` builds with `tsc`, starts with `node dist/index.js` | `tsx` was a devDependency and `npm start` ran it. `npm run dev` is unchanged. |
| `broker/src/index.ts` serves `public/` | Single-origin mode, registered after every `/api` router; the SPA fallback explicitly excludes `/api`. Skipped entirely when the folder is absent, so local development is untouched. |
| `demo-app/src/config/env.ts` | `VITE_BROKER_BASE_URL=/` now means same origin. It was `||`, which turned any empty value into `http://localhost:4000`. `/` rather than `""` because Windows cannot hold an empty environment variable. |

`PORT`, `DefaultAzureCredential` and `/api/health` needed no changes — the
broker already read `process.env.PORT`, already resolved a managed identity
through `DefaultAzureCredential`, and already exposed a health endpoint.

## Deployment outputs

No new Bicep output, and no change to the official lab. Three values the broker
needs were already published by `main.bicep` and are now read in
`modules/Infra.ps1`:

| Broker variable              | Source                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `APIM_SERVICE_NAME`          | last segment of the `apimServiceId` output                  |
| `LOG_ANALYTICS_WORKSPACE_ID` | `logAnalyticsWorkspaceId` (the customerId the query API wants) |
| `FOUNDRY_MODELS_ACCOUNT_NAME`| host of `foundryAiServicesEndpoint`                         |

The App Service is created with `az` *after* the deployment, so it needs no
output of its own.

## Why NODE_ENV is not set to production

Oryx installs dependencies and runs `npm run build` (`tsc`) on the way in.
With `NODE_ENV=production`, npm omits devDependencies — measured on this
repository's own lock file: 133 packages without it, 115 with it, `typescript`
and `tsx` among the missing. The build would fail and the site would never
start. The runtime is `NODE:22-lts`: Node 20 is no longer in App Service's
Linux catalogue (`az webapp list-runtimes --os linux`), and the broker's
`engines: node >=20` is satisfied by 22.

## The APIM key

`$outputs.ApimSubscriptionKey` goes straight into
`az webapp config appsettings set`, passed through an `@file` argument so it
never appears in a command line, a process listing or the transcript, and the
temporary file is deleted in a `finally`. It is never written to a versioned
file. Nothing else in the pipeline carries it.

For a longer-lived deployment, replace that single setting with a Key Vault
reference; the broker reads it as an ordinary environment variable either way.

## RBAC granted to the site's managed identity

| Role | Scope | Used by |
| ---- | ----- | ------- |
| Reader | resource group | `routes/controls.ts`, `policy.ts`, `environment.ts`, `maintenance.ts` |
| Log Analytics Reader | the workspace | `routes/journey.ts`, `observability.ts`, `auditRecord.ts` |
| AcrPull | the container registry | `src/acr.ts` |
| Foundry Project Manager | the agent project | agent create/delete in `routes/agents.ts` |

A failed grant is fatal. A demo that starts without these roles looks healthy —
`/api/health` touches no Azure resource — and then fails panel by panel in front
of an audience.

A managed identity is visible to ARM before it is visible to RBAC, so
`role assignment create` issued seconds after `webapp identity assign` can
legitimately return `PrincipalNotFound`. That single error is retried 3 times,
10 seconds apart. `AuthorizationFailed` is not retried: waiting never fixes a
missing permission.

## Re-deploying: what happens the second time

The resource group is **reused by default**, and that is deliberate. The lab
names most resources from `uniqueString(resourceGroup().id)`, which is derived
from the subscription and the resource group *name*, so keeping the name keeps
the names — and therefore keeps the URL, the ACR layer cache, the agent version
history, and a single resource group for `teardown.ps1` to delete. Creating a
fresh resource group per run would sidestep every naming collision, but it also
provisions **another APIM Basicv2** — the most expensive resource in the lab —
on every run, changes the public URL each time, and destroys convergence. That
trade is not worth it; `-ResourceGroupName` remains available for the cases
where a genuinely separate environment is what you want.

| Scenario | What happens |
| --- | --- |
| **A. First install, new resource group** | Everything is created. ~25-35 min, dominated by APIM. |
| **B. Re-run over a healthy resource group** | Converges. The Bicep deployment is a declarative PUT and re-applies over what exists; the App Service, its plan and the role assignments are reused (`already granted`); the console and broker are rebuilt and redeployed. The site restarts, so expect a few seconds of downtime. |
| **C. Teardown, then deploy again with the same name** | **The risky one.** Deleting the group does not purge it: API Management and Cognitive Services stay recoverable for ~48 hours, Log Analytics for up to 14 days, with their names reserved. The redeploy asks for exactly those names again and Azure either blocks it with a `Conflict` or *restores* the old resource — a restored Foundry project comes back carrying its previous agent versions, which is worse than a clean failure because the stale state is invisible. Preflight warns when it detects this; the three ways out are to wait for the retention window, purge explicitly if policy allows, or pass a different `-ResourceGroupName`. |
| **D. New version of the demo over existing infrastructure** | Intended path. Infrastructure is reused, a new immutable image tag is built and pushed, a new Hosted Agent version is registered and polled to `active`, and the App Service is redeployed. Previous agent versions remain in the registry and in Foundry. |

Two robustness measures exist because of failures actually seen on the first
real deployment:

- **Transient ARM conflicts are retried** — up to 3 attempts, 60 seconds apart,
  and only for errors recognisably transient (`RequestConflict`,
  `FailedIdentityOperation`, `pending delete`, `try again later`, …). Permanent
  failures such as `AuthorizationFailed`, `InvalidTemplate` or a quota error are
  never retried and fail on the first attempt.
- **`az acr build` survives the Windows console encoding bug** — the CLI streams
  the remote build log and dies with `UnicodeEncodeError` on a non-UTF-8
  codepage *after* the image has been built and pushed. The call runs with
  `PYTHONIOENCODING=utf-8`, and if it still fails the registry is asked whether
  the tag actually arrived: if it did, the deployment continues on that image
  with a warning rather than aborting on a build that worked.

## Operational notes

- Three checks after deployment, one per failure mode:
  1. `GET /api/health` — the broker is up. Real evidence, not a liveness ping:
     `broker/src/config.ts` refuses to start when any required variable is
     missing, so a 200 means every setting arrived. It touches no Azure
     resource, which is exactly why it needs the other two.
  2. `GET /` contains the console's root element — the bundle is being served
     from the same origin.
  3. `GET /api/environment` returns a non-zero resource count — the managed
     identity can really read Azure. Informational: RBAC can take a few
     minutes to take effect, and the deployment is not wrong because of it.
- The site name is derived from a hash of subscription + resource group, so
  re-running `deploy.ps1` updates the same site instead of creating another,
  and two people running the lab do not collide in App Service's global
  namespace. Override with `-AppServiceName`.
- Teardown is unchanged: the site lives in the lab's resource group, which
  `teardown.ps1` already deletes.
- `-SkipDemoApp` deploys the lab and the hosted agent without the companion
  application.
