# Mobile capture and cross-device task control

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 2.2 Mobile/thin client

- **Same workspace/task IDs and backend**, not a separately synchronized mobile agent or a cloned repository on the phone.
- Mobile should support idea capture, project selection, text/voice input, photo/video/file capture, project-knowledge search, image generation requests, remote research, starting tasks, monitoring progress, viewing results and ordinary approvals.
- Use the same identity and repository authorization as desktop. A phone should not hold unrestricted shell/MCP credentials, privileged signing keys or production secrets.
- High-risk actions must remain unavailable or require separately designed privileged authorization and step-up authentication. Initial mobile release should avoid raw shell, infrastructure registry edits and software provisioning.
- Tasks needing local Unity/Blender/repos may queue for an authorized desktop runner; tasks that need only available cloud services can proceed without it. Surface this distinction clearly.
- Voice dictation should turn an idea into a selected project inbox item and/or task with a clear link back to the captured media and transcription.

**Product acceptance:** G11 in [acceptance scenarios](../../ACCEPTANCE.md).
