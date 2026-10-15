# Technology candidates (nonbinding)


**The agent is free to choose alternatives. Do not reject a simpler, safer or better-maintained option solely because a tool below was discussed earlier.** Evaluate real maintenance, licensing, operating cost, target platforms, developer experience, security and testability at implementation time.

| Concern | Technologies discussed / candidates | Selection note |
|---|---|---|
| Desktop shell | **Tauri 2**, Rust; alternatively Electron or native UI | Tauri is attractive, not mandatory. Keep desktop OS glue thin. |
| Web/mobile UI | **React + TypeScript**, Vite, responsive PWA | Component sharing is useful; other frameworks acceptable. |
| Workspace/control-plane backend | **Go** or **ASP.NET Core/.NET (C#)** | Both discussed; neither is mandated. Prefer a modular monolith first if suitable. |
| Workstation agent/runner | Go worker, .NET Worker Service, Rust helpers | Cross-platform process supervision, secure IPC and straightforward deployment matter most. |
| Durable workflows | **Temporal** or simpler DB-backed workflow engine | Evaluate operational overhead; Temporal is a candidate, not foundational requirement. |
| Persistent relational state | **PostgreSQL** | Solid default; alternative must provide migrations, durability and correct transactions. |
| Local state/cache | **SQLite** | Optional for disconnected runners and indexing. |
| Embedding/vector search | **pgvector**, embedded vector index or dedicated search engine | Start with simple hybrid search and ACL-safe retrieval; separate vector DB only if needed. |
| Full-text search | PostgreSQL FTS, SQLite FTS, Tantivy/other engine | Use the best fit for local/global corpora. |
| Artifacts | Filesystem, Git LFS, S3-compatible object storage | Different artifacts have different retention/access requirements. |
| APIs/events | HTTP/REST, WebSocket/SignalR, SSE, gRPC | Choose based on client/runner needs; stable contracts matter more than transport. |
| Project/versioning | Git/GitHub, `git worktree`, GitHub App/API | GitHub access is specified for GitHub-hosted projects; exact integration mechanism remains design choice. |
| Project/skill policy files | Markdown, YAML, JSON, `SKILL.md` | Versioned, inspectable schemas; no executable authority from untrusted files. |
| Code semantic index | Roslyn, MSBuild, compiler APIs | C# domain module; not a reason to force whole backend into C#. |
| Local/ML workers | Python, PyTorch/Transformers, model servers | Python is useful for AI/CV/3D without being the whole platform backend. |
| AI gateway | Custom interface/adapters, appropriate gateway libraries | Feature fidelity, data privacy, credentials and portability matter. |
| App integrations | MCP, Unity Editor APIs, Blender Python, external service APIs | Semantic typed capabilities above tool-specific adapters. |
| Provisioning | WinGet/PowerShell, apt/dnf/pacman, Homebrew, npm/pip/uv/NuGet/UPM | Registry-authorized installs only; versions and checksums pinned where appropriate. |
| Import/render cache | Unity Accelerator or suitable artifact cache | Optional optimization for repeated worker worktrees; check current compatibility/licensing. |
| 3D/animation | Blender, Unreal Control Rig, Cascadeur, Meshy, Tripo | Domain add-ons; only export interoperable data and respect asset licenses. |
| Media processing | FFmpeg, transcription/audio/video services | Replaceable service/tool adapters; rights and data policies apply. |
| Creative/decision models | Fable, Opus, Astra, local LLM, Jev, other providers | **Role labels/current choices only**. Do not hard-code vendors into skills/tasks. |

**Technology selection rubric:** Only free-to-use options qualify, and existing solutions are preferred over custom builds ([principle 10](PRINCIPLES.md#product-invariants)). Then: Security & access controls → functional fit → maintainability and ecosystem → integration/tooling → performance/scale → operational overhead → portability/vendor lock-in → cost. Record trade-offs rather than assuming any candidate is perfect.
