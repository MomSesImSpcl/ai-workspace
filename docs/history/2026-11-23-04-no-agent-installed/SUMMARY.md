# The app runs without any agent installed (onboarding-014)

Roles have no hard-coded agent: a role not chosen yet uses the first installed agent, or none. Each adapter reports whether its program is installed, and only installed agents can be chosen. With no agent, Settings → Agents says so once and disables the role fields, the composer shows "No agent installed" and a start is refused with what to do. Typecheck clean, tests 119/119, browser-checked.

[Details](DETAILS.md).
