# Settings overlay: verification

- Change: `app/src/ui.html` only (CSS for `.drawer`, `.backdrop`, `.tabs`; markup tab panels; `renderDrawer()` tab state from the `settingsTab` UI pref; backdrop click, Escape and arrow-key tab handlers). The grid lost its drawer column; the rail is column 4.
- `npm test`: 49/49 pass.
- UI server (`node src/cli.ts ui`, throwaway `AI_WORKSPACE_HOME`) in the browser pane:
  - 800 px wide: the panel fills the area between the sessions column and the rail.
  - 1600 px wide: panel 900 px at the rail, backdrop over the remaining chat area; sessions column uncovered.
  - Agents tab picked, page reloaded, Settings opened: Agents tab selected, only its panel shown.
  - Escape closes panel and backdrop; a backdrop click closes them.
- Escape does not close Settings while a context menu or dialog is open (those close first).
- Not checked: the Electron window, collapsed-sidebar layout by eye.
