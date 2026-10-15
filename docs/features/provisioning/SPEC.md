# Trusted infrastructure registry and dependency provisioning

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 9.1 Infrastructure repository

A separate administrator-controlled GitHub repository (e.g. `workspace-infrastructure`) is the central source of approved tool/dependency policy. It is **readable by relevant employees** but writable only by the owner/trusted admins. Branch protections/review requirements protect security-sensitive paths.

Illustrative contents:

```text
workspace-infrastructure/
  registry/{applications,cli,libraries,mcp,ai-providers,extensions}/
  capabilities/
  provisioning/{windows,linux,macos}/
  policies/
  skills/global/
  schemas/
```

- Project manifests list **approved tool IDs/capabilities and version constraints**, never arbitrary privileged install scripts or unreviewed download URLs.
- The provisioner resolves requests against **admin-approved** registry definitions, verifies signatures/hashes and platform compatibility, asks for permitted user/admin approval where necessary, and reports/install/validate status.
- When a project requests an unknown/unapproved tool, block installation and surface an approval request with source, function, requested permissions, version, license and risk analysis.
- Tool/extension updates must not silently switch to unreviewed sources or unbounded `latest` versions. Support explicit approved versions and compatible side-by-side versions.
- Registry authenticity must be verifiable independently of ordinary project content; signed releases/manifests are a strongly preferred hardening measure. Never place signing keys in an ordinary project repo or LLM context.

## 9.2 Provisioning experience

1. Employee installs the workspace and authenticates.
2. Workspace establishes permitted GitHub repos/projects and reads trusted infrastructure policy.
3. User selects project; workspace inspects requested capabilities/dependencies.
4. Runner detects installed tools and versions, builds a dependency-aware plan using approved definitions.
5. Show what will be installed/configured and any required license/login/admin intervention.
6. Install via appropriate OS/package managers or verified official distribution; configure MCPs/integrations; verify health.
7. Track installed tools and versions per runner; provide safe repair, uninstall and rollback where feasible.

Handle applications, SDKs, CLIs, runtimes, MCP servers, packages and workspace integrations; do not claim every proprietary license or installer supports unattended automation.

**Product acceptance:** G5 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Detect an approved tool/version on a runner and demonstrate an approved installation/validation path with platform handling. Exercise unknown-tool request/deny and owner/admin approval; project content cannot approve a new trusted tool.
