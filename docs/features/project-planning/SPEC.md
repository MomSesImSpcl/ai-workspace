# Project planning, wiki and public roadmap

[Shared principles](../../PRINCIPLES.md) apply. [Dependencies and related features](SUMMARY.md).

## Purpose and status

Provide modular project planning and substantial, interconnected wiki pages inside AI Workspace, with an optional public roadmap/wiki portal. Features link to reusable knowledge rather than duplicating specifications. For example, a Retro Store feature named Customer Reputation can link to full Customers and Store Reputation pages shared with other features; an assigned agent retrieves approved design and relevant current evidence.

Status: **concept / candidate feature set; product behavior not-started**. This definition preserves the user's ideas and candidate approaches. It does not authorize coding, installation, publication or technology adoption. Select a small, testable scope, technologies, security implications and acceptance checks together when implementation begins. Priority and implementation order remain undecided.

## Ownership and integration

This feature owns wiki records, planning records and their relationships, document review/publication history and public snapshots. Knowledge Pages, Planning and Publication are separable logical modules, not required processes. A separately deployed public frontend MAY belong to the same product; users MUST NOT have to maintain unrelated private/public sources manually.

| Existing owner | Integration boundary |
|---|---|
| [Identity/projects 1](../identity-projects/SPEC.md) | User/project identity, non-Git resource access, repository ACLs and scoped action authority. Project grouping and wiki links grant no extra access. |
| [Retrieval 7.1 / knowledge-001](../knowledge-retrieval/SPEC.md) | Shared indexing, authorized search and selective context assembly. Pages/plans remain source records here and feed/query that layer; do not create a parallel AI search pipeline. Preserve repository scope where applicable and explicit project/source scope for non-Git records. |
| [Orchestrator 7.5](../ai-orchestrator/SPEC.md) | Context selection, configurable local or hosted agents, request inspection and delegation. This feature adds linked planning/wiki sources, not a second orchestrator or a local-only restriction. |
| [Project history](../project-history/SPEC.md) | Owns development outcomes and current handoffs; link these to planning records without duplicating their authority. JSONL/SQLite history storage remains a separate future option. |
| [Task runtime 4](../task-runtime/SPEC.md) | Execution, checkpoints and durable run state. A planning task may link to execution tasks/results; editing a planning status does not prove execution or verification. |
| [Memory 7.6](../memory/SPEC.md) and [documentation registry 7.3](../documentation/SPEC.md) | Memory complements curated pages; the registry owns version-matched external technical docs. Neither replaces approved project intent or current source evidence. [Hindsight qualification](../hermes-hindsight/SPEC.md) remains optional and separately owned. |
| [Architecture 3.3 / 9.3 / 13](../../ARCHITECTURE.md) | Classification, deterministic permissions, permitted model destinations, auditing, recovery, portability and quality gates. These apply to all adapters and public-serving paths. |

## Requirements

- **planning-001 — Proper wiki pages:** Users MUST be able to create and edit long-form pages with headings, nested organization, navigation, search and cross-page links. Support rich content appropriate to the selected scope, including tables, diagrams, images/media, attachments and code snippets; Markdown is an option, not a mandated storage format. Documentation MUST remain full pages rather than only planning cards. Optional subpages and templates MAY support design, architecture, research or gameplay; no game-specific structure, Unity, compiler or Git dependency is mandatory.
- **planning-002 — Stable linked records:** Features, planning tasks, pages and related concepts MUST have stable identifiers, cross-references, backlinks and discoverable relationships. One page MUST be reusable by multiple features without duplicating its contents. Renaming, moving or splitting a page MUST preserve existing references through retained IDs or explicit redirects/replacement links. Removed or inaccessible targets MUST show an appropriate unresolved/unavailable reference without disclosing restricted titles or content. Page revisions/history MUST retain actor, time and source provenance, with a recoverable prior revision.
- **planning-003 — Planning and evidence:** Support features and tasks with statuses, priorities, dependencies, milestones and customizable project fields. Features MUST link to detailed wiki specifications; tasks MUST be able to link to decisions, implementation artifacts, tests and commits where available. Boards, lists, hierarchies and timelines are candidate views; exact views/fields are selected per slice. Planning tasks and execution runs MUST remain distinguishable. Community suggestions, if enabled, MUST enter as proposals rather than approved requirements or executable instructions.
- **planning-004 — Intent, approval and observed behavior:** Page/record metadata MUST distinguish brainstorming, proposed designs, approved requirements, implemented behavior and obsolete information. Retain revision, provenance, approval actor/time and evidence references as applicable; make these available to users and context assembly. Approval MUST apply to an identified revision; editing approved content MUST NOT silently approve the changed revision. Approval describes intent, while claims of implemented/verified behavior MUST link to actual evidence and its revision. Missing or stale evidence MUST be visible. These distinctions need not be a single linear status field; section/requirement-level granularity is an open decision.
- **planning-005 — AI context and maintenance:** Through the existing retrieval/orchestration contracts, agents MUST be able to search authorized planning records and follow relevant wiki links, preferring approved documentation and carrying status, exact revision and source references into inspectable context packages. When implementation accuracy matters, retrieve current files, code, Git history where applicable and other authoritative evidence; wiki summaries and memory alone are insufficient. Surface missing, conflicting, stale or unimplemented specifications rather than inventing details. Agents MAY propose page/feature updates after tasks, with appropriate review and approval before changing approved intent. Proposed updates MUST identify their base revision and evidence; conflicting newer edits require reconciliation. Documentation status and linked content MUST NOT grant tool authority or override user context restrictions.
- **planning-006 — Private data and authorized actions:** Records, links, backlinks, search results, history, attachments and derived context MUST obey current user/project/source and per-repository authorization before disclosure and again before model dispatch. Enforce permitted destinations and audit actions through existing deterministic services. Reading private content MUST NOT authorize editing, approval or publication. Private content stays private by default; untrusted pages, imported material and public feedback cannot approve requirements, grant permissions or become privileged instructions.
- **planning-007 — Optional public portal:** Project owners MUST be able to choose explicitly published features and wiki pages for an optional public site. The selected portal MUST support anonymous access when the owner chooses it and be read-only by default. Public-friendly summaries MAY differ from private technical specifications while retaining their source/revision relationship. Publication MUST require authorized review and preview of the exact approved public snapshot, including selected fields, media and links. Serve only that public-safe snapshot; later private edits MUST NOT appear automatically. Private repositories, internal notes, unpublished features, credentials and restricted memories MUST NOT leak through pages, APIs, search, metadata, backlinks or asset URLs. Hiding a UI field is insufficient. Publishing one record MUST NOT recursively publish linked private records.
- **planning-008 — Publication and editing recovery:** Retain publication actor, approval, source revision and snapshot history. Users with publication authority MUST be able to update, withdraw or restore a reviewed snapshot; availability of retained public history MUST follow the same publication policy. Concurrent edits MUST NOT silently overwrite newer work or reuse approval for a different revision. Interrupted saves or publications MUST preserve the last successful state, surface failure and support safe retry without duplicate releases or partial public exposure. If indexing or a source is unavailable, report incomplete/stale context instead of presenting it as current. Withdrawal MUST remove workspace-controlled serving, search and cached copies; explain that copies already obtained by third parties cannot be recalled.
- **planning-009 — Portability and replaceability:** Planning, wiki and publishing MUST remain usable as separable modules with explicit contracts. Content MUST be exportable in documented, portable forms with IDs, links, statuses, revisions/provenance and attachments, with an import/restore or migration path preserving relationships and private/public boundaries. Users MUST NOT be trapped in a vendor-specific format. Replacing an editor, planning backend or public frontend MUST NOT require rewriting the orchestrator's knowledge interface. Use free-to-use foundations under principle 10; hosting/maintenance costs may exist and MUST be distinguished from paid software dependencies. Apply the shared Windows/Linux/macOS contract without requiring a separate deployment topology.
- **planning-010 — Optional extensions and bounded selection:** Comments, votes, suggestions, changelogs, screenshots, release notes, subscriptions, custom branding/domains and external adapters MAY be selected later. None is required in the first slice. Select scope and acceptance together; identify covered requirements and defer unselected capabilities explicitly. There is no prescribed sequence or automatic progression to the next slice.

## Candidate foundations — not technology decisions

Preserve these candidates for implementation-time evaluation. Capabilities, licenses, free/paid boundaries, APIs, maintenance and integration suitability have **not been verified by this definition** and MUST be rechecked before selection. Existing platform, custom open-source composition and hybrid approaches are all candidates; none is mandatory.

| Candidate | Potential role | Question to evaluate |
|---|---|---|
| [OpenProject Community Edition](https://www.openproject.org/) | Combined planning/wiki | Verify Community Edition coverage, operational weight and workspace UX integration. |
| [BookStack](https://www.bookstackapp.com/) | Long-form wiki | Evaluate page organization/API, permissions and separate planning integration. |
| [Forgejo](https://forgejo.org/) | Issues, boards, milestones, Git-backed wiki | Evaluate fit for non-code projects and a public, nontechnical roadmap. |
| [Plane Community Edition](https://plane.so/) | Planning | Check whether needed wiki/publication capabilities require paid tiers. |
| [ProseMirror](https://prosemirror.net/) | Custom editor foundation | Assess required editing UX and document infrastructure. |
| [Tiptap open-source core](https://tiptap.dev/) | Rich-text editing | Separate free core/packages from commercial extensions/services. |
| [Astro](https://astro.build/) | Public frontend | Assess snapshot delivery; does not itself decide publishing/data ownership. |
| [PostgreSQL](https://www.postgresql.org/) / [SQLite](https://sqlite.org/) | Structured persistence | Choose against deployment, concurrency, content and recovery needs. |
| [Hindsight](https://hindsight.vectorize.io/) | Optional memory integration | Follow its separate qualification; cannot replace pages, approved requirements or source verification. |

A hybrid such as BookStack plus custom planning is a candidate only if permissions, portability and integration remain manageable. Record the comparison with a simpler baseline through [technology discovery](../technology-catalog/SPEC.md) when selected; a functioning catalog is not a prerequisite for a bounded assessment.

## Candidate slices and open decisions

Unordered slices to discuss: wiki foundation; planning foundation; stable cross-linking; AI context integration; public snapshots and a simple read-only portal; community features; AI-proposed documentation maintenance; import/export and external adapters. Each selected slice needs a bounded workflow, technology decision, security checks and observable acceptance. Stop for review after that slice.

Open decisions for implementation time:

- Existing platform, custom composition or hybrid; canonical content in database, Markdown/Git or a hybrid; editor/document format balancing rich content, portability and useful diffs.
- Approval/status granularity, exact review roles and publication permissions; which initial planning views and fields are useful.
- Static, server-rendered or dynamic public delivery; which information each project publishes and how public summaries relate to private revisions.
- Whether community feedback/voting is selected initially or later; how code/Git changes flag documentation for review without silently approving AI updates.

These choices do not authorize implementation. Public publishing is optional; publication safety is mandatory whenever it is selected.

## Observable acceptance scenarios

These are future product checks, not completed tests. Run the applicable checks for a selected partial scope and retain actual evidence before marking requirements validated.

| Check | Observable result / requirement coverage |
|---|---|
| A1 — Reusable pages (`001–002`) | Create a substantial Customers page with rich content and a subpage, link it from multiple features and navigate backlinks. Rename/move/split it and inspect a prior revision; existing references still resolve or show explicit replacements. |
| A2 — Planning (`003`) | Create linked features/tasks with selected fields, dependencies and a milestone, inspect the selected view and follow decision/test/commit evidence. A planning status change does not mark an execution run complete; a community suggestion remains a proposal. |
| A3 — Status clarity (`004`) | Retrieve brainstorming, proposed, approved, implemented and obsolete records. Inspect approval/evidence revisions; edit an approved page and verify the new revision is unapproved while previous approval remains attributable. Unsupported verification claims are flagged. |
| A4 — Context accuracy (`005`) | Assign Customer Reputation to a configured compatible orchestrator. Inspect linked approved pages and relevant current source evidence in its request; introduce a contradiction/missing source and observe an explicit issue. Review an AI-proposed update, then create a conflicting newer edit; reconciliation is required. |
| A5 — Authorization (`006`) | A user authorized only for repo A cannot discover repo B content/titles through links, backlinks, revisions, search, attachments or model context. Revoke access and repeat; non-Git resources obey their own scope. Reading a page or injecting instructions into feedback cannot authorize publication or a tool action. |
| A6 — Public safety (`007–008`) | Preview and publish one feature and public wiki summary. Anonymous visitors can read approved content; direct API/asset/link/search requests reveal no internal notes or unpublished records. Private edits stay private until another approved snapshot. Withdraw and restore through authorized review, checking controlled caches and retained history policy. |
| A7 — Recovery (`008`) | Race two edits and interrupt a save/publication. Report conflict/failure, keep successful content and the last complete public snapshot, and retry safely without duplicate releases. Make indexing unavailable and inspect a visible incomplete/stale context warning. |
| A8 — Project independence (`001`, `009`) | Use pages/planning in a non-game, non-code project with no Git or Unity requirement. Exercise selected functionality across supported desktop platforms under the shared compatibility contract. |
| A9 — Portability (`009`) | Export and restore the selected records including media, relationships, revisions and access/publication metadata. Replace the selected editor/backend/frontend boundary in a contract test without changing the orchestrator knowledge interface or making private records public. |
| A10 — Scope selection (`010`) | Record selected requirements, non-goals, candidate comparison and checks for one slice. Unselected views, community features and subsequent slices remain deferred rather than installed or started automatically. |

## Non-goals

No mandatory vendor, editor, framework, database or hosting provider; no required Codecks-style card UX; no requirement to deliver every view, community feature or publication capability in the first slice; no automatic publication of AI-generated content. Pages and memory do not replace deep retrieval or current implementation evidence. This definition establishes no fixed build order or implementation commitment.
