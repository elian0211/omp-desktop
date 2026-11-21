# Phase 4 — Settings, keymap, widths, docs

**Outcome:** Settings / keymap / pane widths match the new chrome; architecture docs and CHANGELOG describe project strip + dual-fold side + tool dock; superseded plan clearly marked (already in its README).

**Depends on:** phases 1–3 behaviour stable  
**Unblocks:** nothing (closes the redesign)

## 4.1 Settings → Layout

| Concern | Action |
|---|---|
| `sidebar` / side panel toggle | Map to **project side** visibility (`Ctrl+B` etc.) |
| `sidebarWidth` | Project side width |
| `railWidth` | Prefer rename to **dock width** (keep storage key or migrate once) |
| `defaultSide` | Remove or redefine for browser/files-detail only; no tree-as-default stage |
| Activity / Workspaces copy | Delete obsolete strings |
| Column widths custom row | List: project side, dock, split, browser, files-detail as applicable |
| Focus layout | Document what remains visible (open-questions 5) |

## 4.2 Settings → Rail

- Rename section/labels toward **Session tools** / **Tool dock** (sections still gate SessionView cards).
- `showChanges` / radar / … unchanged semantically; visibility is “included in Session dock”, not “old activity Session view”.

## 4.3 Keymap

| Action | Intent |
|---|---|
| `desktop.sidebar.toggle` | Toggle project side |
| New (optional) `desktop.dock.toggle` | Collapse/expand dock |
| New (optional) `desktop.dock.file` / `.session` / `.tree` / `.usage` | Select dock tab |
| Remove / repurpose activity-view chords if any were added in 2026-11-20 phase 4 drafts | |
| `desktop.panel.stats` | Open Usage dock |
| Tree / preview related chords | Point at dock |

Update Rust keybinding defaults if action ids change; keep `fromGuest` rules as today.

## 4.4 i18n

- EN sources for: project strip a11y, fold titles (“Sessions”, “Explorer”), dock tabs (File, Session, Tree, Usage), empty stubs, settings copy.
- `i18n-zh.js` entries for all of the above.
- Search index for settings rows if labels change.

## 4.5 Architecture docs (ship with behaviour)

| Doc | Update |
|---|---|
| `docs/architecture/project-navigation.md` | Strip + Sessions fold + thin tabs; mark activity bar historical |
| `docs/architecture/file-preview.md` | Docked File tab; triggers; close behaviour |
| `docs/architecture/file-comments.md` | Explorer fold; detail vs preview |
| `docs/architecture/pr-automation.md` | Visibility → Session dock |
| `docs/architecture/settings.md` | Layout / dock keys |
| `docs/architecture/widgets.md` | Session dock hosting |
| `CHANGELOG.md` | User-facing summary of the redesign |

## 4.6 Plan hygiene

- Confirm [`../2026-11-20-workspace-layout/README.md`](../2026-11-20-workspace-layout/README.md) stays **SUPERSEDED**.
- Close any open-questions resolved during implementation by moving them to the closed table in `open-questions.md`.

## 4.7 Acceptance

- [ ] Settings Layout / Rail copy matches UI; no references to activity Workspaces/Files/Session as current.
- [ ] Keymap chords work for project side + dock; documented in shortcuts UI.
- [ ] Widths persist across restart.
- [ ] Architecture docs + CHANGELOG updated.
- [ ] `test-settings-schema.mjs`, `test-i18n.mjs`, keymap tests green.

## 4.8 Likely files

- `src/app/settings-schema.js`, `session-prefs.js`, `layout-widths.js`
- `src/app/keymap.js`, `src-tauri/src/keybindings/`
- `src/app/i18n-zh.js`, settings rows under `design/settings/`
- Architecture docs listed above; `CHANGELOG.md`
