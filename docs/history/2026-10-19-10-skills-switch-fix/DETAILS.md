# Details

- Real Claude Code run, caveman plugin on, `--setting-sources project,local`: without the flag the init event listed 22 `caveman:*` skills plus built-ins; with `--disable-slash-commands` it listed none. The user's own `~/.claude/skills` (gepeto, pinokio) did not load in either run.
- `~/.claude/skills/caveman`, `megacave`, `ultracave` are real copies (not links) whose `SKILL.md` is identical to the caveman plugin's; they load on their own when the user source loads, so they stay listed with a "copy of" label instead of being hidden.
- `app/test/tasks.test.ts`: the copy label, no flag with global rules off, no flag when the run's plugin has skills, the flag when that plugin is off. `npm run typecheck` clean, `npm test` 50/50.
