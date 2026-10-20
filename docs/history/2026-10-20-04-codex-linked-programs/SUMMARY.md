# Codex runs the programs of the user's hooks in its sandbox

#21: the user's `rtk` hook turns `git` into `rtk git`, which failed in Codex's Windows sandbox, first because `rtk.exe` was a WinGet link, then because the real file had no permission for the sandbox's users. The workspace now puts linked programs' real folders on Codex's PATH, and on Windows checks at start-up that the sandbox can run every program the user's Codex hooks call, with the fix command in the chat. The app never changes permissions. Branch `claude/great-ride-93ynxs`. [Details](DETAILS.md).
