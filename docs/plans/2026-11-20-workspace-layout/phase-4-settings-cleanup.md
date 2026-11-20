# Phase 4 — Settings, keymap, widths

**Outcome:** Settings and shortcuts match activity bar + side views; old sidebar / AmbientRail semantics are gone.

**Depends on:** phases 1–3 behaviour stable

## 4.1 Settings → Layout

| Today | After |
|---|---|
| `sidebar` toggle | **Remove** or replace with “Show side panel” (activity content). Activity bar itself always on when side UI enabled, or toggle both together — pick one and document. |
| `defaultSide` (`rail` \| `tree` \| `browser`) | Retarget: default **activity view** for new windows (`workspaces` \| `files` \| `session`) and/or optional stage overlay (`tree` \| `browser` \| `none`). Drop “rail vs files” exclusivity. |
| Widths | Drop `sidebarWidth` as “project list only”. One **side panel** width (`sidePanelWidth` / keep `filesWidth`). Activity bar width fixed in CSS. `railWidth` → widget column width. |

## 4.2 Settings → Rail → rename

Rename section to **Side panels** / **Workspace tools**. Keys:

| Key | Meaning |
|---|---|
| `showContext` … `showMinimap` / `showChanges` | Sections inside **Session** activity view |
| Widget / extension tweaks | Right column vs Session “Extensions” |

Focus layout: hide side panel (+ optional widget column).

## 4.3 Keymap

| Action | Plan |
|---|---|
| `desktop.sidebar.toggle` | Remap to show/hide **side panel** (keep id for user bindings, or migrate with changelog) |
| New `desktop.view.workspaces` / `.files` / `.session` | Optional chords to jump activity icons |
| `desktop.files.toggle` | Focus Files activity view (+ detail if needed) |
| `desktop.tab.new` | Clarify: new session in current workspace vs open Browse — document choice |
| Stats / history / browser / terminal / tree | Unchanged |

Sync `app/keymap.js` with Rust `ACTION_IDS`.

## 4.4 Toolbar

- Remove old “project sidebar” pressed state tied to `ProjectSidebar`.
- Plus / open project → Workspaces Browse or focus Workspaces view.
- Rail button → Session view or side panel toggle.
- Files button → Files activity view.

## 4.5 Docs & changelog

- `project-navigation.md` — activity Workspaces view  
- `file-comments.md` — Files activity  
- `settings.md` — Layout / renamed Rail  
- `pr-automation.md`, `widgets.md`, `extension-widgets.md`  
- `frontend-load-order.md` if new scripts  
- `CHANGELOG.md`, `AGENTS.md` if module map drifts  

## 4.6 Acceptance

- [ ] No Settings copy that describes the old permanent project sidebar / AmbientRail.
- [ ] Width handles only for visible columns.
- [ ] Keymap / `ACTION_IDS` / i18n / settings-schema tests green.
