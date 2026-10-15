# Versioned skills and reusable capability workflows

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 6.1 Skills

- A **skill** is a versioned reusable instruction/workflow package, not a model. It may contain `SKILL.md`, executable scripts, schemas, references, examples, tests and output formats.
- Support global, domain, project and user scopes subject to permissions, with an explicit conflict/precedence policy. Inherited skills must not accidentally expose another project's private references.
- Skills request **semantic capabilities**, e.g. `code.search_symbols`, `environment.create_scene`, `video.inspect`, `animation.retarget`, `git.diff` or `image.generate`, rather than hard-code tool providers or models.
- Skills declare required/optional capabilities and permissions, expected artifacts and acceptance checks. Version/pin them where reproducibility matters.
- A project-provided skill or script is untrusted until permitted by policy. Merely reading a `SKILL.md` cannot confer shell, network, secret or install privileges.
