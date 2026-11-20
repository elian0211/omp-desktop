# File map

Prefer editing these over inventing parallel trees. Architecture docs under “Docs” are post-ship truth; this plan folder is planning only.

## Phase 1 — Activity bar + Workspaces

| Path | Role |
|---|---|
| `src/design/` **new** activity bar + side panel host | Icon strip + view switch |
| `src/design/project-sidebar.jsx` | Port into Workspaces view; unmount old entry |
| `src/design/layout/sidebar.css` | Evolve into side-panel + activity-bar CSS |
| `src/design/empty-workspace.jsx` | CTA → Workspaces / Browse |
| `src/design/toolbar.jsx` | Drop/remap sidebar button |
| `src/design/tab-group-chip.jsx` | Unchanged session dropdown; run dots stay |
| `src/app-live.jsx` | `activeView` state; mount host |
| `src/app/project-nav.js` | Reuse `groupTabs` / `recentRows` / `groupRunState` |
| `src/live.js` | `openProject` / recents — minimal change |
| `src/index.html` | Script order |

## Phase 2 — Files + Session views

| Path | Role |
|---|---|
| Side view components | Files tree; Session accordion |
| `src/design/files/*`, `use-file-comments.jsx` | Tree in Files view |
| `src/design/git/file-tree.jsx` | Existing toggles |
| `src/design/chrome.jsx` | Extract AmbientRail card bodies |
| `src/design/subagents/subagent-rail-card.jsx` | Session section |
| `src/design/pr-automation-card.jsx`, `use-pr-automation.jsx` | Session section + visibility |
| `src/app/extension-widgets.js` | Session “Extensions” |
| `src/design/layout/stage.css` | activity + side + stage + optional widgets |

## Phase 3 — Widget rail

| Path | Role |
|---|---|
| `AmbientRail` → widget-only parent | |
| `src/app/use-widgets.jsx`, `src/design/widgets/*` | Visibility |
| `rail.css` | Empty hide |

## Phase 4 — Settings / keymap

| Path | Role |
|---|---|
| `src/app/settings-schema.js`, `session-prefs.js` | |
| `src/app/keymap.js`, `src-tauri/src/keybindings/` | |
| `src/app/use-pane-widths.jsx`, settings width rows | |
| `src/app/i18n-zh.js` | |

## Rust

| Path | Role |
|---|---|
| `recent_projects.rs`, `external_open.rs` | Unchanged stores; UI consumers change |
| keybindings | Only if action ids change |
| Widget / PR / git_browser | No layout-only API change expected |

## Tests

| Path | When |
|---|---|
| `tests/test-project-nav.mjs` | If helpers change |
| `tests/test-file-comments.mjs` | Files view assumptions |
| `tests/test-widgets.mjs`, PR bridge tests | Visibility |
| `tests/test-settings-schema.mjs`, `test-i18n.mjs` | Keys / strings |
| New tests | Activity view state helpers if extracted |

## Docs (ship with behaviour)

| Path | Phase |
|---|---|
| `docs/architecture/project-navigation.md` | 1 |
| `docs/architecture/file-comments.md` | 2 |
| `docs/architecture/pr-automation.md` | 2 |
| `docs/architecture/widgets.md` / `extension-widgets.md` | 3 |
| `docs/architecture/settings.md` | 4 |
| `CHANGELOG.md` | each user-facing phase |

## Plan folder

`docs/plans/2026-11-20-workspace-layout/` — when shipped, mark README status or point to architecture docs.
