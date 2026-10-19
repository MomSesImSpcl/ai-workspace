# Details

## rtk check (2026-10-19)

rtk 0.50.0 is installed for both agents as a hook, not a plugin: Claude Code `rtk hook claude` in the user settings, Codex `rtk hook codex` in `hooks.json`, plus a global rule file each. Its tracking database `history.db` was malformed; it was renamed with a `.malformed-2026-10-19` suffix and rtk created a new one (`rtk gain` works again).

## Codex per-hook test (Codex 0.163.0)

In a throwaway `CODEX_HOME` with two `SessionStart` marker hooks:

- Without `--dangerously-bypass-hook-trust` neither hook ran (untrusted hooks are skipped).
- With it, both ran; `-c hooks.SessionStart=[]` and `-c hooks={}` removed neither.
- `-c hooks.state.'<file>:session_start:1:0'.enabled=false` is rejected: "session-flags: … is ignored".

Codex docs: higher config layers do not replace lower hooks; single hooks can be disabled only in the `/hooks` browser, which saves to the user's `config.toml`. The throwaway folder, which held a copy of `auth.json`, was deleted after the test.
