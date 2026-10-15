# Version-matched local documentation registry

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 7.3 Versioned local documentation

- Maintain a **Documentation Registry** supporting local searchable copies and/or metadata references for permitted official documentation: C#, .NET, Roslyn, MSBuild, NuGet, Unity, Unreal, Blender, Git, GitHub, FMOD, Steamworks, libraries/packages, and any future domain/tool.
- Version-match documents to the target project: Unity version, .NET target framework, C# language version, package/SDK version. In particular, Unity's runtime/API availability must not be inferred from the latest standalone .NET docs.
- Include language/API reference, source/API metadata for open-source dependencies where allowed, tutorials/examples and official version/release notes.
- Incrementally sync allowed content, track source/revision/license/update date and reindex changed sections only. Use official APIs/docs downloads or authorized access; do not indiscriminately scrape restricted sources.
- Local docs are the fast/offline default; use live verification for recently changed APIs, releases, rules or contested behavior. Clearly distinguish retrieved authoritative text from model synthesis.

**Product acceptance:** G7 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Provide at least one working local documentation source matched to an actual project SDK/engine version. Answer a version-sensitive question with source/revision evidence and current verification where needed.
