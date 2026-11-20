# Phase 1 — Activity bar + Workspaces view

**Outcome:** Far-left **activity bar**; **Workspaces** side view shows open folders **and sessions with run state**, plus recents and open-folder; old `ProjectSidebar` is no longer mounted.

**Depends on:** nothing  
**Unblocks:** phase 2 (other activity views)

## 1.1 Activity bar shell

New chrome (suggested: `ActivityBar` + `SidePanel` host under `src/design/`).

**Behaviour:**

- Vertical icon strip, fixed narrow width (CSS variable, not user-resized).
- Each icon: **hover bubble with the view title** (VS Code–style) plus the same string as `aria-label`, all via `OMP_TR`; pressed/selected state for the active view id. Reuse an existing tip/tooltip control if the chrome already has one; native `title` alone is a fallback only if no richer tip exists.
- State: `activeView` ∈ `{ workspaces, files, session, … }` — **app-level or per-window**, not per-tab (switching tabs should not reset you from Files → Workspaces unless we decide otherwise; prefer **remember last view** globally for the window).
- Optional: clicking the already-selected icon **collapses** the side panel (content hidden, bar remains) — VS Code parity; confirm in `open-questions.md`.
- Keyboard: phase 4 adds chords; phase 1 at least keeps icons button-accessible.

**Layout:**

```
.workspace
  .activity-bar     /* new, flex:none */
  .side-panel       /* width = former sidebar / files width; one child view */
  .stage            /* chat + optional right widgets */
```

Reuse resize handle on the side panel edge (not on the activity bar).

## 1.2 Workspaces view

Port capabilities from `project-sidebar.jsx` into `WorkspacesView` (name flexible):

| Capability | Keep |
|---|---|
| Open tabs grouped by `(profile, folder)` | Yes — `groupTabs` |
| Expand multi-tab workspace; list **sessions** | Yes — with `TabRunDot` / `groupRunState` |
| Select / close / rename session | Yes |
| New conversation in workspace | Yes (`onNewInProject`) |
| Recents (no open tab) + forget | Yes |
| Open folder / Browse | Yes — existing picker |
| Drag reorder projects & members | Yes — same lists as tab bar (`useDragReorder`) |
| Project accent on folder glyph | Yes |

**This view is how run state stays glanceable** across all workspaces, which the tab bar alone does not do well when many groups exist.

**Open folder:** in-panel button is enough for phase 1; a separate modal is optional later if the panel feels crowded.

## 1.3 Retire ProjectSidebar mount

- Remove `ProjectSidebar` from `app-live.jsx`.
- Either delete `project-sidebar.jsx` after the port, or thin it into a pure list used only by `WorkspacesView` (prefer one component).
- Tweak `sidebar`: force side panel visible in phase 1; full key removal in phase 4.
- Update `docs/architecture/project-navigation.md`: sidebar → activity Workspaces view.

## 1.4 Empty state

- No tab: default `activeView = workspaces`; side panel shows recents + Browse.
- `EmptyWorkspace`: short CTA “Open a workspace” that focuses the Workspaces view / Browse control (not a second parallel UI).

## 1.5 Tab bar

- Unchanged role: open sessions as chips/tabs.
- Do **not** require a leading “Open workspace” tab control if Browse lives in the Workspaces view; an optional `+` for “new session in current folder” can stay on toolbar/chip.

## 1.6 Acceptance

- [ ] Activity bar visible; Workspaces icon selects the workspaces panel.
- [ ] Hovering an activity icon shows a title bubble (localized).
- [ ] Open sessions listed under folders with run dots; selecting focuses the tab.
- [ ] Recents + Browse work; reorder still works.
- [ ] `ProjectSidebar` not mounted separately.
- [ ] Empty window: Workspaces view usable without a tab.
- [ ] i18n + any pure helper tests green; CHANGELOG note.

## 1.7 Likely files

- `src/design/` — `activity-bar.jsx`, workspaces view (from sidebar), layout CSS
- `src/design/project-sidebar.jsx` — port / replace
- `src/app-live.jsx` — activity state, mount host
- `src/design/empty-workspace.jsx`, `toolbar.jsx`
- `src/index.html` — script order
- `docs/architecture/project-navigation.md`, `CHANGELOG.md`
