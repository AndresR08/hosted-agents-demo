# APIM Consumption tier — a local patch, not an upstream bug

Status: **applied.** The patch lives in
[`patches/apim-consumption-capacity.patch`](../patches/apim-consumption-capacity.patch)
and is applied to `vendor/ai-gateway/` automatically by `scripts/sync-vendor.ps1`.

## Decision: not the default. Read this before proposing it again

**`Basicv2` remains the default for any session with a live audience.**
`Consumption` is supported and works end to end - it is not experimental, and
the patch below is maintained - but it is for disposable environments only.

The reason is one measured number, taken on a real deployment
(`rg-apim-consumption-test`, swedencentral, 2026-08-27):

| | |
|---|---|
| First request after **35 minutes idle** | **54.2 s** |
| Next request, immediately after | 0.36 s |
| Two more, immediately after | 0.34 s / 0.36 s |

The cold request was an unauthenticated call that APIM rejects with `401`
before reaching any backend. It generated no tokens and did no model work:
**those 54 seconds are the gateway waking up, nothing else.**

Two traps worth knowing before anyone re-runs this experiment:

- **A short idle period will tell you it is fine.** At 12 minutes idle the
  first call cost only ~1.4 s more than a warm one - and that difference was
  within the variance of the model call itself, not a cold start at all. The
  instance was still warm. Measuring with a short gap produces a number that
  supports the wrong conclusion.
- **A warm-up call does not fully solve it.** It is mandatory if you use this
  tier at all, but any long pause *during* a session - coffee, questions, a
  segment that does not touch the gateway - can put the instance back to sleep
  and spend 54 seconds in front of the client.

What it costs to keep `Basicv2`: ~$197/month while the resource group exists,
~92% of the lab's fixed cost, and ~25-35 min to deploy instead of ~14. That is
the price of not gambling a client demo on a cold start, and it was judged
worth paying.

### Where `Consumption` *is* the right choice

- Disposable test environments, created and deleted the same day.
- Validating an infrastructure change without paying for `Basicv2` to prove it.

### Considered and deliberately not built

A keep-alive ping (from the broker, or a scheduled job) would hold the instance
warm. It was left out: it adds a moving part whose failure mode is silent - the
ping stops, nobody notices, and the 54 s comes back at the worst moment - to
save money on environments that are not the ones under time pressure. Revisit
only if idle cost on a long-lived demo environment becomes a real problem.

## Why this is not the same kind of finding as `05`

[`05-upstream-issue-deployments-bicep.md`](05-upstream-issue-deployments-bicep.md)
documents a genuine defect: `deployments.bicep` dereferences a conditional
resource, so a configuration upstream *does* support fails with `NotFound`.
That one is reportable, and drafted as an issue.

This one is not a defect. `modules/apim/v3/apim.bicep` hardcodes
`sku.capacity: 1`, which is correct for every tier this lab was written
for — Developer, Basic, Basicv2, Standard, Premium. The Consumption tier is
simply outside the scope upstream ever claimed. Asking Microsoft to fix it
would be asking for a feature, not reporting a break.

So: **do not file this upstream.** It is our customisation, carried
deliberately, and the automation says so out loud rather than pretending the
vendored tree is untouched.

## What breaks without the patch

```
MissingSkuTypeCapacity: For Consumption SKU Type capacity must be specified as 0.
```

Two things about this error are worth knowing before anyone debugs it again:

**`az deployment group validate` does not catch it.** Validation passed cleanly
with `apimSku = 'Consumption'` against the unpatched template. ARM does not
check the SKU/capacity combination at validation time, only at deployment. A
green `-ValidateOnly` run proves nothing here.

**It is not reachable from outside the module.** `capacity` is not a parameter
of `apim.bicep`, and `main.bicep` only forwards `apimSku`. No parameter file,
no CLI flag, and no change confined to this automation can produce a working
Consumption deployment. Modifying the vendored template was the only option —
which is what made a formal patch mechanism worth building rather than a hand
edit worth keeping.

## The patch

```bicep
-    capacity: 1
+    capacity: apimSku == 'Consumption' ? 0 : 1
```

Conditional rather than a flat `0`, so every other tier keeps the upstream
behaviour exactly. Switching `ApimSku` back to `Basicv2` needs no revert.

## How it survives a sync

`sync-vendor.ps1` rebuilds `vendor/` from scratch on every run, so a hand edit
would vanish at the next sync — silently, and the next deployment would fail
with `MissingSkuTypeCapacity` again, far from the cause. Instead:

1. Upstream is copied into a staging folder.
2. Every `*.patch` in `patches/` is applied there with `git apply`.
3. **A patch that does not apply fails the sync**, with the upstream SHA and
   git's own error. It does not warn and continue: a half-patched tree deploys
   differently from what the patch file claims, which is worse than no sync.
4. Only then does the build check run, so a patch that produces something
   uncompilable is caught by the same gate as a broken upstream.
5. `vendor/` is replaced only after all of that passes.

The generated `NOTICE.md` lists the applied patches and drops the
"byte-identical to upstream" claim when there are any. `deploy.ps1` reports
them too, in the preflight step that used to say "not modified by this
automation".

`-SkipPatches` vendors upstream unmodified — for inspecting what upstream
actually ships, or re-cutting a patch that stopped applying.

## If upstream changes that line

The sync fails, by design. Re-cut the patch against the new file, or delete it
if upstream has made `capacity` configurable on its own.
