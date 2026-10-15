# Visual concepts and editable 3D asset pipelines

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 11.1 Provider-neutral creative pipeline

- Visual reasoning, concept image generation, 3D mesh generation, texture generation, rig/animation processing, speech, video generation and review are distinct swappable capabilities.
- The workspace should resolve the **best approved available capability**, not hard-code a particular AI or application. Allow user overrides and approved alternate providers.
- Preserve original generated assets, prompts, model/provider/version, source references, manual edits and final exports. Use appropriate binary artifact storage or Git LFS where suitable.

## 11.2 3D asset pipeline

Illustrative flow: concept/reference → approved 3D generator (e.g., Meshy/Tripo) → Blender refinement (topology, materials, UVs, LODs, collision, scale, rigging) → export → Unity import/visual check → revision as needed. The pipeline is configurable; not every job needs every stage. Support human artist takeovers via editable source files and asset metadata.

**Product acceptance:** G12 in [acceptance scenarios](../../ACCEPTANCE.md).
