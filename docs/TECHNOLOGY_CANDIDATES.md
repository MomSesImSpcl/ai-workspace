# Technology candidates (nonbinding)


**The agent is free to choose alternatives. Do not reject a simpler, safer or better-maintained option solely because a tool below was discussed earlier.** Evaluate real maintenance, licensing, operating cost, target platforms, developer experience, security and testability at implementation time.

| Concern | Technologies discussed / candidates | Selection note |
|---|---|---|
| Desktop shell | **Chosen: Electron** ([ADR 0003](architecture/decisions/0003-electron-workspace-shell.md)). Considered: Tauri 2, native UI | Keeps the stack in Node and gives a native folder dialog; Tauri would add a Rust toolchain and a different webview per OS to test, and its smaller size does not matter for a personal tool. Keep desktop OS glue thin. |
| Web/mobile UI | **React + TypeScript**, Vite, responsive PWA | Component sharing is useful; other frameworks acceptable. |
| Workspace/control-plane backend | **Chosen: TypeScript on Node 24**, no build step ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). Considered: Go, ASP.NET Core/.NET (C#) | First-class MCP and Claude Agent SDKs, and one language for core, desktop and browser UI. Modular monolith. |
| Workstation agent/runner | Go worker, .NET Worker Service, Rust helpers | Cross-platform process supervision, secure IPC and straightforward deployment matter most. |
| Durable workflows | **Chosen: atomic JSON task files**, no workflow engine ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). Considered: Temporal, DB-backed workflow engine | Enough for one local user with restart-safe tasks and no extra service to run; revisit with concurrency or multiple users. |
| Agent orchestration integration | **Hermes Agent** | Concrete use case and adoption remain open; see the separate [evaluation and integration feature](features/hermes-hindsight/SUMMARY.md). |
| Long-term memory engine | **Hindsight** | Concrete use case and adoption remain open; resolve `knowledge-001` and source ACLs through the separate [evaluation and integration feature](features/hermes-hindsight/SUMMARY.md). |
| Persistent relational state | **PostgreSQL** | Solid default; alternative must provide migrations, durability and correct transactions. |
| Local state/cache | **SQLite** | Optional for disconnected runners and indexing. |
| Embedding/vector search | **pgvector**, embedded vector index or dedicated search engine | Start with simple hybrid search and ACL-safe retrieval; separate vector DB only if needed. |
| Full-text search | PostgreSQL FTS, SQLite FTS, Tantivy/other engine | Use the best fit for local/global corpora. |
| Artifacts | Filesystem, Git LFS, S3-compatible object storage | Different artifacts have different retention/access requirements. |
| APIs/events | HTTP/REST, WebSocket/SignalR, SSE, gRPC | Choose based on client/runner needs; stable contracts matter more than transport. |
| Project/versioning | Git/GitHub, `git worktree`, GitHub App/API | GitHub access is specified for GitHub-hosted projects; exact integration mechanism remains design choice. |
| Project/skill policy files | Markdown, YAML, JSON, `SKILL.md` | Versioned, inspectable schemas; no executable authority from untrusted files. |
| Code semantic index | Roslyn, MSBuild, compiler APIs | C# domain module; not a reason to force whole backend into C#. |
| TypeScript/JavaScript, HTML, CSS analysis ([code-index 7.2.1](features/code-index/SPEC.md#721-language-analysis)) | **TypeScript Compiler API + Language Service** or `ts-morph`; `vscode-html-languageservice` with `parse5` or `htmlparser2`; `vscode-css-languageservice` with PostCSS and `postcss-selector-parser`; LSP or Tree-sitter for other languages | Tree-sitter gives syntax only, not type resolution. |
| Markdown, shell and batch analysis ([code-index 7.2.2](features/code-index/SPEC.md#722-markdown-shell-and-batch)) | **unified + remark**, markdownlint; **tree-sitter-bash**, ShellCheck, shfmt; tree-sitter-batch or a small own extractor | MDX needs its own parser. Check tree-sitter-batch maintenance, grammar coverage and license before choosing it. External binaries run only through the tool broker. |
| Runtime UI verification ([ui-verification](features/ui-verification/SPEC.md)) | **Playwright**, Chromium DevTools Protocol | Must drive an Electron instance alongside the user's own. |
| Local/ML workers | Python, PyTorch/Transformers, model servers | Python is useful for AI/CV/3D without being the whole platform backend. |
| AI gateway | **Chosen: agent CLIs (Claude Code, Codex) behind a workspace adapter interface** ([ADR 0001](architecture/decisions/0001-core-slice-stack.md)). Considered: gateway libraries, paid provider APIs | Runs on the user's existing subscriptions instead of paid APIs, and any agent can take any role. |
| App integrations | MCP, Unity Editor APIs, Blender Python, external service APIs | Semantic typed capabilities above tool-specific adapters. |
| Provisioning | WinGet/PowerShell, apt/dnf/pacman, Homebrew, npm/pip/uv/NuGet/UPM | Registry-authorized installs only; versions and checksums pinned where appropriate. |
| Import/render cache | Unity Accelerator or suitable artifact cache | Optional optimization for repeated worker worktrees; check current compatibility/licensing. |
| 3D/animation | Blender, Unreal Control Rig, Cascadeur, Meshy, Tripo | Domain add-ons; only export interoperable data and respect asset licenses. |
| Media processing | FFmpeg, transcription/audio/video services | Replaceable service/tool adapters; rights and data policies apply. |
| Creative/decision models | Fable, Opus, Astra, local LLM, Jev, other providers | **Role labels/current choices only**. Do not hard-code vendors into skills/tasks. |

**Technology selection rubric:** Only free-to-use options qualify, and existing solutions are preferred over custom builds ([principle 10](PRINCIPLES.md#product-invariants)). Then: Security & access controls → functional fit → maintainability and ecosystem → integration/tooling → performance/scale → operational overhead → portability/vendor lock-in → cost. Record trade-offs rather than assuming any candidate is perfect.
