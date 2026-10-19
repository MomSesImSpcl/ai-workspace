# Code documentation

Read this before you create or change code or its documentation. It is the agent-facing form of [code-documentation](features/code-documentation/SPEC.md) (codedoc-001–011); the spec governs where they differ. Apply it to new and changed code now, as if [documentation indexing](features/code-index/SPEC.md#724-documentation-indexing-and-code-linking) (code-index-030–039) already existed, so the index can use it once it is built. Existing code you do not touch waits for the retroactive pass (codedoc-012).

Goal: accurate retrieval and maintainability, not comment volume. Use the project's own conventions; in this repository that is `/** … */` above TypeScript/JavaScript symbols, `//` for a one-line why, and Markdown in `docs/`.

## What to write

- **Intent and contracts:** responsibilities, constraints, invariants, meaningful inputs/outputs, side effects, errors, and why a non-obvious choice exists. Never restate the name or narrate lines.
- **Searchable words:** concrete domain terms and useful synonyms, so "how does the workspace choose an agent?" finds `agentChoice` in `app/src/turn.ts`.
- **Resolvable links:** repository-relative paths, exact symbol names and stable anchors (for example `See: docs/features/sessions/SPEC.md`, `` `runSetup` in `app/src/setup.ts` ``). Not "handled elsewhere". Never invent a symbol or link.
- **Status where it matters:** mark proposed, deprecated, unverified or planned. Specs say what is intended, comments what the code does, ADRs why, tests prove it; keep them apart.
- **Proportional:** detail for complex, reused, public, risky or non-obvious code; trivial private helpers usually get nothing. A short accurate paragraph beats a template.
- **Truthful:** no invented rationale, guarantees, test claims or performance claims. If you do not know why, say so or leave it out. When observed and intended behavior differ, write both.

A significant symbol gets, where it applies: purpose (one or two sentences with domain terms), contract not visible from types, reasoning (link the ADR if there is one), relationships (owning feature, verified links to docs, callers, config or tests), an example only if use is easy to get wrong, and status/limits.

Low value: `/** Returns an agent. */`. Useful (illustrative): "Chooses the agent best suited to a task from its required capabilities, complexity and available models. A compatible user override wins. No candidate gives an explicit no-match, never an incompatible agent. See: docs/features/model-routing/SPEC.md#role-and-agent-assignments".

## Where it goes

| Place | Contains | Not |
|---|---|---|
| Source comments | important APIs, algorithms, invariants, errors, side effects, non-obvious decisions | obvious code, line narration |
| Feature specs | requirements, scenarios, acceptance, intended behavior | claims that it works |
| Architecture docs | responsibilities, data/control flow, boundaries, entry points, failure paths | copies of source |
| ADRs | context, alternatives, decision, trade-offs | invented rationale, unapproved decisions |
| Runbooks | setup, migration, troubleshooting, verified commands | unchecked commands presented as safe |
| Tests and examples | expected behavior and usage, linked to the API | coverage they do not have |

Each fact has one owner; link to it instead of copying it.

## Workflow

1. **Before editing:** find the relevant code and docs (with the index once it exists, until then with search and file reads), check their status, tell intended from built behavior, and read linked ADRs and requirements if contracts or architecture change. Never change code from its documentation alone; read the current source and tests.
2. **While editing:** update the docs of changed contracts, assumptions, behavior, algorithms or relationships, next to the symbols they explain. Update higher-level docs only when affected; leave unrelated docs alone.
3. **After editing:** check that the paths, symbols and anchors you wrote exist (until the index validates them, check them yourself), that comments match the code and tests, and report checks you did not run.
4. **Renames and removals:** update or flag the references, backlinks and examples that point at them.
5. **Unsure:** mark the claim unverified or needing review instead of guessing.

Done when a reader can tell what the code does, when to use it and where it lives without opening unrelated modules, every written link resolves, and no secrets or private data went into the docs.
