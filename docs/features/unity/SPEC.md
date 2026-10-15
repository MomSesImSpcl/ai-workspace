# Unity indexing, scene authoring and background validation

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

**Unity is an optional capability module, not a requirement of the workspace core.** When installed and authorized, it should support code-aware and scene-aware AI automation.

## 10.1 Deep Unity index

- Read the actual project's Unity version/packages and build an asset/object dependency graph including scenes, GameObjects, Components, serialized references, prefabs/variants, ScriptableObjects, materials, shaders, textures, meshes, animations, Animator Controllers, Timeline, Addressables, input assets, build/project settings and relevant code symbols.
- Combine Unity object/reference data with C#/Roslyn code data where feasible. Respect Git repo access and per-task asset restrictions.
- Expose semantic queries: “where is this prefab referenced?”, “which script writes this serialized property?”, “what assets match ‘ruined church’?”, “which materials use this shader?”.
- Generate previews/thumbnails and metadata of available assets for vision-assisted selection without needlessly passing enormous binaries to cloud models.

## 10.2 Typed Unity actions

Provide structured Editor operations via a Unity integration (custom Editor plugin, MCP adapter, API, or comparable design): create/open/save scene; create/move/rotate/scale GameObject; instantiate prefab; add/configure Components; set serialized fields; create materials/ScriptableObjects; resolve references; list/query assets; run validation; enter Play Mode where permitted; capture images/videos/logs; trigger builds/tests; inspect console and profiler outputs. Every action returns meaningful success/error details and must be scope-validated.

## 10.3 Environment generation from predefined assets

User story: **“Build me a ruined village environment using only these approved prefabs/assets, with a central church and surrounding forest, while I continue my own work.”**

Expected steps:

1. User selects Unity project, goal, allowed asset collections, target new scene/prefab, size/layout/performance constraints and background execution.
2. Agent inventories allowed assets, previews them, drafts structured layout/design, optionally asks for approval if the goal is underspecified or destructive.
3. Agent assembles a new dedicated scene or prefab using typed Editor operations; should prefer references to existing assets over copies and obey user-defined `allowed assets` and `forbidden changes`.
4. Agent renders multiple inspection views, runs visual analysis, iterates with bounded loops, performs Unity validation, and saves scene/prefab with appropriate `.meta` files.
5. Provide before/after screenshots or flythrough, object/prefab counts, actual validations and Git diff/change list. No invented “passed” checks.
6. Task can be paused/redirected (“make the cathedral taller”) and returns to work at a safe checkpoint.
7. User reviews output and decides accept/merge/revise/discard; no silent modification of the user’s current work.

## 10.4 Concurrency/isolation modes

Support **both** approaches, chosen by task constraints and current user activity:

**Mode U1 — Shared Editor, different scene:** AI controls its authorized scene in the same Unity project/Editor while the human does not interfere with AI-owned scene. Enforce scene ownership for intended scene modifications. Disclose limitations: selection, Play Mode, compilation, domain reload, asset imports, project settings, Scene View and other editor-global state are shared; a different scene is *not* full process isolation. Avoid disruptive global actions during interactive work.

**Mode U2 — Isolated worker Editor:** If user and AI need truly independent active Unity editing, create a separate Git worktree/branch and **a second Unity Editor process pointed at its own project directory**, with separate Unity `Library/Temp` data and unique MCP endpoint/process identity. The AI owns that checkout while user keeps normal Editor/worktree. Prefer new/additive scenes or independent prefabs to reduce YAML merge conflicts. Budget time/disk for imports; evaluate import artifact caching/Accelerator if compatible.

Other modes MAY include offline scene-file generation when safe or dedicated remote Unity runners. Do not force a second project checkout when U1 suffices, but do not promise isolation in U1 that it does not provide.

## 10.5 Background visual capture

- A worker Unity Editor **must not need to occupy a visible physical monitor** for routine visual validation.
- Prefer programmatic camera/render-pipeline capture (temporary inspection camera, `RenderTexture`/GPU rendering, captured PNG/video and diagnostic data) over OS-level screen screenshots or simulated mouse clicks. Capture aerial/ground views and optional diagnostics: depth, wireframe, normals, light, collider/navmesh, LOD and performance information as implemented.
- Capture must use the correct scene/render pipeline and working GPU context. Test behavior when backgrounded/minimized/virtual-desktop/headless on supported OS/GPU/Unity configurations; do **not** assume that every minimized/headless arrangement keeps rendering identically.
- The AI can visually inspect generated images/video and make structured, bounded refinements. Expose the results to the human for final verification.

## 10.6 Git change safety

- AI tasks should default to creating self-contained scenes/prefabs/assets with traceable changes. Avoid edits to a scene/prefab the user is actively modifying.
- For isolated workers, stage/commit to task branch, test integration against target branch, present conflicts and require appropriate approval before merge. Do not auto-merge Unity YAML conflicts just because a merge driver claims success.
- For shared Editor mode, ensure save ownership and change tracking, with safe rollback/checkpoint options.
- Provide reviewable screenshots, scene links and diffs alongside code changes.

## 10.7 Other game-dev features

- Play Mode automated test loops, screenshots/video inspection and automated bug fixing (edit → compile/run → observe → critique → fix).
- Editor profiling, performance baselines, build/test matrices, asset dependency diagnostics and explicit custom project actions.
- Optional live preview dashboards, game-economy simulators, boss/encounter editors and other domain mini-apps.

**Product acceptance:** G8, G9 in [acceptance scenarios](../../ACCEPTANCE.md).

## Illustrative contract (not a production schema)

```yaml
# Example environment task request
kind: task
profile: EnvironmentAuthoring
project: souls-public-domain
background: true
constraints:
  allowed_assets: ["Assets/Environment/MedievalVillage/**"]
  target_output: "Assets/Scenes/GeneratedVillage.unity"
  forbidden_changes: ["Assets/Scenes/Combat.unity", "ProjectSettings/**"]
  prefer_isolation: separate-editor-worktree
acceptance:
  - "scene saves and reopens"
  - "all placed prefabs are from the allowed set"
  - "programmatic render previews exist"
  - "no unauthorized assets/scenes modified"
  - "user can review changes before merge"
```

Adapt this example to actual provider, tool and platform capabilities.
