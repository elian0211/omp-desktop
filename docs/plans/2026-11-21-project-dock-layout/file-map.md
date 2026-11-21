# File map

Prefer editing these over inventing parallel trees. Architecture docs under “Docs” are post-ship truth; this plan folder is planning only.

## Phase 1 — Project shell

| Path | Role |
|---|---|
| `src/design/project-strip.jsx` **new** | Open projects strip |
| `src/design/` project side / folds host **new or evolve** `SidePanel` | Sessions + Explorer |
| `src/design/workspaces-view.jsx` | Harvest session rows → Sessions fold; unmount as activity |
| `src/design/files/files-view.jsx` | Explorer fold body |
| `src/design/activity-bar.jsx`, `src/app/activity.js` | Demote / unmount |
| `src/design/tab-group-chip.jsx`, `chrome.jsx` TabBar | Thin session tabs; drop project chips as primary |
| `src/design/toolbar.jsx` | Full width; side toggle → project side |
| `src/design/layout/sidebar.css`, `stage.css`, `chrome.css`, **project-strip.css** | Hierarchy |
| `src/app-live.jsx` | Mount strip + side; drop activity view switch |
| `src/app/project-nav.js` | Optional `projectAbbr`; reuse `groupTabs` / `groupRunState` |
| `src/app/project-appearance.js` | Accent for strip |
| `src/index.html` | Script order |
| `src/design/empty-workspace.jsx` | CTA → open workspace |

## Phase 2 — Tool dock (File + Session)

| Path | Role |
|---|---|
| `src/design/tool-dock.jsx` **new** | Tabs + pane host |
| `src/design/layout/tool-dock.css`, `stage.css` | Dock columns |
| `src/design/chat/file-preview.jsx` | Pane presentation; drop modal shell |
| `src/design/side-views/session-view.jsx` | Mount in dock |
| `src/app-live.jsx` | Dock state; preview → File tab; session visibility gates |
| `src/app/layout-widths.js`, `use-pane-widths.jsx` | Dock width |
| `src/app/use-pr-automation.jsx` / PR card gates | Dock Session visibility |
| `src/design/chrome.jsx` widgets / AmbientRail remnants | Only via Session dock |

## Phase 3 — Tree + Usage + cleanup

| Path | Role |
|---|---|
| `src/design/tool-dock.jsx` | Add Tree + Usage |
| Conversation tree host + `use-conversation-tree.jsx` | Dock body |
| `UsageStatsPanel` | Dock body; leave modal |
| `src/design/toolbar.jsx` | Remove moved toggles |
| `src/app-live.jsx` | Remove `side === "tree"` stage column |
| `src/app/session-ui.js` | `defaultSide` / `seedEntries` cleanup |
| `activity-bar.jsx` / `activity.js` / dead Workspaces activity CSS | Delete if unused |

## Phase 4 — Settings / docs

| Path | Role |
|---|---|
| `src/app/settings-schema.js`, `session-prefs.js` | Keys + copy |
| `src/design/settings/rows-layout.jsx` | Widths list |
| `src/app/keymap.js`, `src-tauri/src/keybindings/` | Actions |
| `src/app/i18n-zh.js` | Strings |
| Architecture docs in phase-4 list | Truth |
| `CHANGELOG.md` | User-facing |
| `docs/plans/2026-11-20-workspace-layout/` | Remains superseded |

## Rust

| Path | Role |
|---|---|
| `recent_projects.rs`, `external_open.rs` | Unchanged stores |
| keybindings | Only if action ids change |
| `project_file_read` / preview IPC | Unchanged |
| Widget / PR / git_browser | No layout-only API change expected |

## Tests

| Path | When |
|---|---|
| `tests/test-project-nav.mjs` | Abbr / grouping helpers |
| `tests/test-file-preview.mjs` (if any) / preview consumers | Dock open path |
| `tests/test-file-comments.mjs` | Explorer fold assumptions |
| `tests/test-widgets.mjs`, PR tests | Session dock visibility |
| `tests/test-settings-schema.mjs`, `test-i18n.mjs`, keymap tests | Phase 4 |
| New unit tests | Dock `selectTab` / collapse helper if extracted |

## Plan folder

| Path | Role |
|---|---|
| `docs/plans/2026-11-21-project-dock-layout/*` | This redesign |
| `docs/plans/2026-11-20-workspace-layout/*` | Historical; superseded |
