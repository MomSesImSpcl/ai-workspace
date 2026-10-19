# UI style

Read this before changing the app's interface (`app/src/ui.html`). It sets a shared direction, not a strict specification. Usability, readability and decisions the user approved come first.

**Reference:** the Claude desktop app, dark theme: minimal, content first, a calm developer tool.

## Look

- Flat, dark surfaces with low contrast between them; no gradients or decorative effects. A shadow only on something that floats (an overlay, a menu).
- One accent, used sparingly for the active or selected thing. Status colours only for status: green success, amber warning, red error, blue information. Workspace notices in a chat (for example "Working in a new worktree") use the warning amber with ⚠, as the user prefers (2026-10-19).
- Hierarchy through contrast, weight and spacing, not large text.
- Compact navigation and controls; the content area gets room.

## Tokens

The `:root` tokens in `ui.html` are the source of truth; reuse them instead of new literal values. They follow the Claude app's warm dark palette: background `--bg` `#262624`, panels `--panel` `#1f1e1d`, rail `--rail` `#1a1918`, fields `--field` `#30302e`, text `--text` / `--text-dim` / `--text-muted`, accent `--accent` `#d97757`, dividers `--hairline`.

- **Accent:** use only the `--accent*` tokens, never a literal accent colour, so a future accent setting can change it in one place.
- **Type:** `--font-body` (Inter or the system UI font), `--font-mono` for code, paths and ids. Body 13 px, headings 13 to 16 px, metadata (`.meta`) 11 px. Regular and medium weights; semibold only for titles.
- **Spacing:** 4, 8, 12, 16, 24 px.
- **Shape:** 1 px borders in `--hairline`; corners `--radius-sm` (7 px) for controls, `--radius` (10 px) for cards.
- **Icons:** simple outline SVGs, 11 to 18 px, `stroke="currentColor"`.
- **Motion:** `--t` (160 ms) for hover and focus; no other animation. Reduced motion sets it to 0.

## Patterns

These patterns were agreed with the user; follow them before inventing new ones.

- **Overlays** (Settings): float over the content with a light backdrop. Esc or a click on the backdrop closes them. Anchor them to the edge they open from and keep their content there, so nothing jumps when they resize.
- **Tabs:** right-aligned, underline on the selected tab, the last tab remembered.
- **Lists:** group with small uppercase dim titles above a faint line, sort A–Z inside a group, put search above the list, and keep headers sticky while the list scrolls.
- **Descriptions:** in a tooltip (`title`) rather than as text under every item. Show text inline only when the user needs it at a glance, for example the names inside one switch that covers several things.
- **Dropdowns:** a tooltip with the full selected value, since it may be cut off.
- **Paths:** a button with a small folder icon. A known file is shown selected in its folder, never opened.
- **Save feedback:** settings save on change, with no Save button. "Saved" appears next to the thing's title and clears after 2 s; errors stay until the next change.
- **Dangerous choices** (a mode that skips every check): confirm in a dialog first.

## Accessibility

Keep readable contrast, a visible keyboard focus (`:focus-visible`), labels or `aria-label` on every control, and keyboard use for menus and tabs (arrow keys, Esc). Layouts must not break in a narrow window.
