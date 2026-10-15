# Identity, projects and repository access

[Shared principles](../../PRINCIPLES.md) apply.

## 1.1 User identities and authorization

- Authenticate users with a secure identity/session system. Integrate GitHub identity/organization/repository authorization for content stored in GitHub. Support multiple GitHub organizations and private repositories within the permissions of the authenticated user.
- Display only authorized project content. Search, retrieval, embeddings/vector results, tool responses, notifications, task summaries and AI context assembly **MUST** filter on the requesting user's current repository authorization **before** any unauthorized content reaches a model or is returned to a client.
- If a project groups repositories A, B and C, a user authorized only for A can see **only A's data**, including when using project-wide AI queries. A shared project title itself must not inadvertently reveal sensitive repository names or details.
- Revoking GitHub repository access must revoke effective workspace access promptly. Use event-driven invalidation where practical plus revalidation/short-lived authorization decisions; fail closed if authorization cannot be reliably checked for sensitive content.
- Do not make project access depend on a manually maintained duplicate ACL that silently disagrees with GitHub. A workspace permission layer is allowed for **actions**, clients, tenant/admin operations and non-GitHub resources.
- Agents inherit the effective permissions of their initiating user plus any stricter task-specific restrictions. A delegated worker must not obtain broader access simply because a privileged shared runner or service account can technically see more.
- Keep API keys, user secrets, GitHub tokens and production credentials out of model prompts, logs and mobile clients. Support secret rotation, revocation and secure storage.

## 1.2 Project definition

A project is a logical container, not necessarily a Unity project or a single repository. It may contain:

- Zero, one, or multiple Git repositories, each independently authorized.
- Local files, knowledge sources and artifacts, subject to explicit ownership/permissions.
- Project instructions, domain labels, skill overrides, permitted capabilities, assets, tasks and conversations.
- External authorized data sources and service links.
- A non-code project can be created without Git, Unity or a compiler, while retaining workspace-level access controls appropriate to its storage location.

A Git-backed project **SHOULD** carry portable configuration inside its repositories, for example:

```text
project-repo/
  .workspace/
    project.yaml            # identity/links/domain labels/capability requests
    instructions.md         # instructions for agents working in this repo
    skills/                 # approved project-scoped skills
    knowledge/              # curated project knowledge
  ... project content ...
```

Names are examples; the format must be versioned and validated. A project may include only the repositories a user can access. Project content is **untrusted input** for execution and privilege decisions.

## 1.3 Multi-user collaboration

- Owners/admins, programmers, artists and video editors can use the same application with different authorized repositories/capabilities.
- GitHub permissions govern repo content visibility. Workspace policy governs dangerous actions such as installing executables, opening production connections, publishing builds, modifying central infrastructure, spending cloud credits above a budget, and accessing secrets.
- Users can inspect who started/changed/approved a task; actions have an auditable actor identity. Support shared task results only if every recipient has rights to the underlying evidence/artifacts.
- Support sanitized/published knowledge handoffs (e.g., gameplay feature descriptions to a video editor) without disclosing private source code or other repositories.

**Product acceptance:** G1, G2 in [acceptance scenarios](../../ACCEPTANCE.md).

## Illustrative contract (not a production schema)

```yaml
# Example project request; never executable install instructions
project:
  id: souls-public-domain
  domains: [game-dev, 3d, animation]
  repositories:
    - github://org/game
    - github://org/shared-assets
  capabilities:
    required: [git.read, code.search, unity.scene.edit]
    optional: [blender.mesh.edit, animation.author]
  ai:
    architecture_role: ArchitectureReasoning
    implementation_role: Implementation
    visual_role: VisualReasoning
```

Adapt this example to actual provider, tool and platform capabilities.

## Acceptance evidence

- Exercise authorized GitHub repository discovery/grouping and admin/user action boundaries. Verify revocation, cross-repository query isolation and resistance to prompt-injection privilege escalation.
