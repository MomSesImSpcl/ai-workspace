# Technology discovery and build-versus-buy research

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 8.1 Purpose and scope

The **Technology Catalog** is a global, project-agnostic database of discovered *metadata about technologies*, **not downloads of tools, full package repositories or automatic installs**. It allows an agent to find existing solutions before designing or buying something new.

- Store normalized technology identity, canonical URLs, source listings, original/public descriptions where retrieval is permitted, AI-generated concise description, extracted capabilities, tags, language/ecosystem, license, commercial-use signals, platforms, dependencies, popularity/quality indicators, source/update dates, version history and internal evaluation/approval status.
- Deduplicate one technology across multiple source listings (e.g., GitHub + NuGet + official site).
- Distinguish discovery from approval. **Discovered ≠ trusted ≠ installed ≠ project-required.**
- Track why a candidate was previously rejected and what changed in a later version. Do not assume ratings/downloads alone establish safety or technical fit.

## 8.2 Initial ingestion and incremental synchronization

- Support bulk initial acquisition of **authorized metadata** in scope, not a blanket crawl of every website.
- After initial ingestion, refresh from APIs/feeds/registries, detecting new/changed entries via source IDs, versions, timestamps and hashes such as description/metadata/version hashes. Reprocess only changed entries.
- Maintain source-specific quotas, rate limits, legal terms, backoff and error handling. Do not bypass a site's anti-scraping or authorization restrictions merely because only metadata is being stored.
- Candidate source types (examples, not mandatory implementations): GitHub, NuGet, OpenUPM, official MCP Registry, Blender Extensions, Hugging Face, fal, Replicate, npm, PyPI, vcpkg, ConanCenter, IDE marketplaces, itch.io and official release/documentation feeds. Unity Asset Store access must use an authorized method consistent with its applicable terms; **do not implement unauthorized scraping**.

## 8.3 Progressive, autonomous search

Do not deeply review 500,000 entries. Implement stages:

```text
metadata/full-text/vector filters
  -> names + AI short descriptions
  -> original descriptions + capabilities
  -> live README/docs for promising candidates
  -> deep inspection/benchmarks for finalists
  -> evidence-backed recommendation to architect/user
```

- Search planner may autonomously select relevant catalogs using catalog capability metadata (`domains`, `contains`, `cost`, `coverage`, `good_for`).
- Policy may require mandatory sources for particular domains (e.g. already-installed code first, NuGet for .NET, relevant Unity package indexes for Unity). Search may expand to cross-domain sources when useful.
- Do not hard-code only a couple of sources per category; allow bounded recursive subproblem discovery. Avoid endless searches with explicit limits/stop criteria.
- Every candidate should carry source URL, matched capabilities, limitations, license uncertainty, freshness and reason for recommendation.

## 8.4 Dependency decision support

- Architecture workflows consult internal code, approved tech and discovered candidates before recommending a new implementation.
- Compare reuse vs integration vs custom implementation in terms of requirements coverage, maintenance, licensing, compatibility, performance, reliability, risk, cost and long-term lock-in.
- Finalists should receive up-to-date documentation/license verification before decisions are made. Agents may propose additions to approved infrastructure but cannot approve executable software unilaterally.

**Product acceptance:** G10 in [acceptance scenarios](../../ACCEPTANCE.md).

## Acceptance evidence

- Ingest permitted metadata from at least two authorized registries. Update a nontrivial catalog without reprocessing unchanged entries; apply mandatory sources and bounded expansion, then narrow results to evidence-backed finalists without unauthorized downloads/installations.
