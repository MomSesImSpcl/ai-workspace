# Details

## Plugin measurement (2026-10-19)

Claude Code Implementer setup without the workspace's MCP server and task note: `--setting-sources project,local`, short system prompt, file tools only, one plugin enabled at a time.

Fixed prompt per call, one-turn "Reply OK": none 4,403; caveman 6,259 (+1,856); ponytail 5,539 (+1,136).

Real task, 3 runs each (reject an empty `integration` in `setRole`, add a test, explain), parallel in throwaway worktrees:

| Setup | Avg cost | Avg turns | Avg output tokens |
|---|---|---|---|
| none | $0.192 | 10.3 | 2,948 |
| caveman | $0.178 | 9.7 | 2,680 |
| ponytail | $0.162 | 9.3 | 2,613 |

Savings came mostly from fewer turns and cache reads. With 3 runs and turns varying 8–12 within one setup, the differences are within noise. The global effort-suggestion rule still loaded with `--setting-sources project,local` and stopped the first batch, so the prompt was prefixed with "Do the work now; skip any effort or ponytail-level suggestion". Tests in the runs were not executed.
