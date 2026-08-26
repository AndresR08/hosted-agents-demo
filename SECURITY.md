# Security Policy

## Supported Versions

This project doesn't tag numbered releases — see [`CHANGELOG.md`](CHANGELOG.md), which groups changes by milestone date instead. Only the latest state of `main` is supported.

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |
| Anything older | ❌ |

As a portfolio demo rather than a maintained product, there is no backport policy and no security support for older commits or forks.

## Reporting a Vulnerability

This repository is a reference demo, not a commercial product — see [`demo-app/docs/en/01-general/PURPOSE.md`](demo-app/docs/en/01-general/PURPOSE.md) for what it is and isn't. If you find a vulnerability in the code that lives here (`demo-app/` or `broker/`), please report it by opening a [GitHub Issue](../../issues), with enough detail to reproduce it: affected file/line, steps, and potential impact.

Vulnerabilities in **Azure AI Foundry**, **Azure API Management**, or the underlying **[`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway)** lab are out of scope here — report those to Microsoft, not to this repository. This project reads that lab's deployment; it doesn't own or patch it. See [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md) for the exact boundary between what this project owns and what it visualizes.

## Scope

**In scope:**
- `demo-app/` — the frontend console.
- `broker/` — the local backend that authenticates to Azure on the console's behalf.
- This project's own documentation and configuration.

**Out of scope:**
- The official lab (its README, notebook, `main.bicep`, APIM policy XML, and `src/frameworks/`) — that lives in [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/ai-foundry-hosted-agents-custom-framework) and is Microsoft's, not ours. Issues about it belong in [that repository]( https://github.com/Azure-Samples/AI-Gateway/issues ), not here.
- Azure AI Foundry, Azure API Management, or any other Azure platform service.
- Anyone else's deployment of the lab. This repository has no visibility into, and no responsibility for, how another person or organization configures their own subscription.

## Security Considerations

This project is built so that no secret needs to leave a developer's own machine:

- **Never commit secrets, API keys, or connection strings.** `broker/.env` (which holds the APIM subscription key) and `demo-app/.env.local` are both git-ignored — see the `.gitignore` in each directory.
- **Never publish an APIM subscription key, an Entra/Azure AD token, or any other Azure credential** in an issue, pull request, commit message, or screenshot.
- **Never commit real Azure resource identifiers** — subscription IDs, tenant names, or resource-group names. This repository's own technical documentation was swept for exactly this before publication; real values were anonymized (see [`demo-app/docs/en/03-development/HISTORY.md`](demo-app/docs/en/03-development/HISTORY.md)).
- **Never add real deployment data** (screenshots, captures, logs, or exports) without the same sanitization pass. The screenshots and diagram already in this repository (`assets/`) have been sanitized before publication — new ones must meet the same bar before they're added.

## Responsible Disclosure

If you believe you've found a real vulnerability, please don't disclose it publicly — in an issue, a pull request, or anywhere else — before it's been reviewed. Open a GitHub Issue with the minimum detail needed to triage it, and hold back exploit-level specifics until a maintainer has had the chance to respond. Given the scope above, most reports will turn out to belong to Microsoft's own security process rather than this repository — but report here first if you're unsure which side of that line it falls on.
