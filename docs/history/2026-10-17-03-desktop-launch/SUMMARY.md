# Desktop app opens like an installed app

`AI Workspace.cmd` now creates Start menu and Desktop shortcuts that open the app without a console window. A second launch focuses the open window, and a taskbar pin relaunches AI Workspace instead of bare Electron. The first start also fetches the Electron binary when `npm install` skipped its download.

[Details](DETAILS.md).
