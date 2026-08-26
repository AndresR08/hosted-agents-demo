# Vendored from Azure-Samples/AI-Gateway

| | |
|---|---|
| Source | https://github.com/Azure-Samples/AI-Gateway |
| Commit | `561d71992bd660af94efc76a8f2f21df0e6ac8e5` |
| Commit date | 2026-07-24 |
| Vendored on | 2026-08-26 |
| License | MIT - see [LICENSE.md](LICENSE.md), Copyright (c) Microsoft Corporation |

Redistributed under the MIT License, which permits it provided the copyright
notice and permission notice are preserved. They are, in `LICENSE.md`, unmodified.

## This copy is pinned

The commit above is **pinned deliberately**, not simply whatever was at the tip
of `main` when this ran. The shared Bicep modules define the deployed
infrastructure, so picking up a newer revision changes real resources on the
next `deploy.ps1` run - quietly, because the template still compiles.

Moving the pin is a deliberate act: refresh with a new `-Ref`, deploy the result
to a **disposable resource group** first, and only then apply it to an
environment anyone depends on.

```
pwsh scripts/sync-vendor.ps1 -Ref <full 40-character SHA>
```

## Do not edit these files here

They are byte-identical to upstream, and `scripts/sync-vendor.ps1` rebuilds this
folder from scratch on every sync. Edits would be silently discarded, and would
turn each sync from a copy into a merge conflict. Fix things upstream, or in the
automation that consumes them.

## What is vendored, and why exactly this

`labs/ai-foundry-hosted-agents-custom-framework/` in full, plus the transitive closure of its `main.bicep`:

- `modules/azure-roles.json`
- `modules/apim/v3/apim.bicep`
- `modules/apim/v3/inference-api.bicep`
- `modules/apim/v3/specs/AIFoundryAzureAI.json`
- `modules/apim/v3/specs/AIFoundryOpenAI.json`
- `modules/apim/v3/specs/AIFoundryOpenAIV1.json`
- `modules/apim/v3/specs/LLMOpenAI.json`
- `modules/apim/v3/specs/PassThrough.json`
- `modules/cognitive-services/v3/foundry.bicep`
- `modules/cognitive-services/v3/deployments.bicep`
- `modules/monitor/v1/appinsights.bicep`
- `modules/operational-insights/v1/workspaces.bicep`

All five APIM specs are present although this lab only ever uses `AzureAI`.
`loadJsonContent` is a compile-time function, so Bicep resolves **every branch**
of the ternary in `inference-api.bicep` regardless of which one runs. Removing
the four unused specs fails the build with `BCP091`.

The layout mirrors upstream's two-level depth on purpose: `main.bicep` refers to
`../../modules/...`, and that path has to keep resolving without patching the file.

Also vendored, for the notebook rather than for the automation:

- `shared/utils.py`
- `LICENSE.md`

`deploy.ps1` is pure PowerShell and needs no Python. `shared/utils.py` is here
because the automation's comments refer to notebook cells throughout, and those
cells call it.

## Refreshing

```
pwsh labs/ai-foundry-hosted-agents-custom-framework-automation/scripts/sync-vendor.ps1
```

A monthly GitHub Actions workflow does the same and opens a pull request. It
never merges on its own.
