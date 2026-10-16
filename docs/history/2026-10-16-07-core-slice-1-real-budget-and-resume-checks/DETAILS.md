# 2026-10-16 — Core slice 1: real budget pause and kill/resume checks

- **Scope:** 4.3 restart resume, 4.6 budget, 13.1 reliability — verify against real Claude Code what was previously fake-adapter only.
- **Budget pause:** goal "create f01–f12, one write per message", budget 15,000. Step 1 (8 turns) wrote f01–f08, used 38,769 tokens → task `paused` (`token budget 15000 reached`). `resume --budget 400000` continued the CLI session; step 2 wrote f09–f12 → `completed`, 67,465 tokens. **Finding:** a step can overshoot the budget (checked only between steps).
- **Kill / resume:** same goal; process tree killed (`taskkill /T /F`) after f03 was written. Task file stayed `running`, steps=0. `resume` → `completed` with all 12 files. **Finding:** the interrupted step re-ran from scratch, so f01–f03 were written twice (audit: 2 write_file calls each). Harmless here (same content) but violates 13.1 for non-idempotent actions.
- **Follow-up proposed (not agreed):** per-tool-call idempotency records in the broker so a re-run step skips already-committed side effects; mid-step budget enforcement (e.g. per-tool-call budget check in the broker).
- **Branch / commit:** `feature/core-slice`; commit ID from Git.
