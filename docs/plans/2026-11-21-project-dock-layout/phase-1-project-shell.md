# Phase 1 — Project shell (strip + dual-fold side + thin tabs)

**Outcome:** Under a full-width title bar and toolbar, the workspace shows a **project strip**, a **project side panel** with **Sessions** and **Explorer** folds, and a **thin session tab strip** for the active project. The activity-bar three-view navigator is no longer the primary chrome (unmounted or stubbed behind a flag until phase 4 deletes it).

**Depends on:** nothing (builds on shipped activity/Workspaces/Files code as parts bins)  
**Unblocks:** phase 2 (tool dock)

## 1.1 Chrome hierarchy

Lock the DOM / flex order in `app-live.jsx` + layout CSS:

```
.window
  title / TabBar area?   /* today: tabs above toolbar — see 1.5; title chrome as today */
  .toolbar               /* full width */
  .workspace             /* horizontal under toolbar */
    .project-strip       /* fixed width, full height of .workspace */
    .project-side        /* resizable; Sessions + Explorer folds */
    .main-column         /* vertical */
      .session-tabs      /* thin */
      .stage             /* chat + optional stage sides */
      /* status remains global as today */
```

**Must:** project strip and project side start **below** the toolbar, never beside the title bar.

If today’s `TabBar` sits above the toolbar, decide in this phase whether thin session tabs move **under** the toolbar into `.main-column` (preferred for the sketch) or stay above but **only list active-project sessions**. Prefer matching the sketch: tabs in `.main-column` under the toolbar. Document the choice in the PR.

## 1.2 Project strip

**New chrome** (suggested: `design/project-strip.jsx` + `layout/project-strip.css`).

**Behaviour:**

- One button per open project from `groupTabs(sessions)` (or equivalent).
- Visual: 2–3 letter abbreviation from folder basename + fill/border from `OMP_PROJECT_APPEARANCE` accent (fallback muted).
- Active project: stronger border / ring.
- Non-idle group: small run badge (`groupRunState`).
- Hover / `title` / accessible name: project name + path (+ profile chip text if useful).
- Click: `onSelectTab(groupTarget(group, activeId))` (or focus newest).
- Footer / end control: `+` → existing open-folder / `handleNewProject` (same as toolbar).
- Optional: context menu later; not required in phase 1.
- Reorder: nice-to-have; if cheap, reuse `useDragReorder` on projects; else keep tab-bar/old Workspaces reorder until phase 4.

**State:** derive “active project” from the active session’s `(profile, path)` group key.

## 1.3 Project side — Sessions fold

Port **member-row** behaviour from `WorkspacesView` / old sidebar, **scoped to the active project only**:

| Capability | Keep |
|---|---|
| List sessions in this project | Yes — `membersNewestFirst` or registry order as today |
| `TabRunDot` / run state | Yes |
| Select → focus tab | Yes — **this is the primary way to open/focus a tab** |
| Close / rename | Yes |
| New conversation in project | Yes |
| Drag reorder within project | Yes if already wired |

**Fold chrome:** header with ▾/▸; collapse state window-global or per project (pick one in `open-questions.md`; default window-global).

**Not in this fold:** other projects’ sessions (those appear when you switch the strip). Recents for other folders: see open question 1.

## 1.4 Project side — Explorer fold

Mount today’s **`FilesView`** under a second fold header (“资源浏览器” / Explorer).

- Same tree, toggles, context menu, open-at → files detail behaviour as now.
- Fetch rules: keep “open when explorer visible or files detail open” (adapt from `sideActivity.view === "files"`).
- No tab: stub hint to open a workspace.

Both folds may be expanded at once; heights share the side panel (flex: Sessions `fit` / max fraction, Explorer `fill_container` — tune in CSS).

## 1.5 Thin session tabs

- List **open sessions of the active project only** (not `TabGroupChip` project chips).
- Visual weight below today’s tab bar: smaller height, quieter inactive tabs, × to close.
- Click focuses; middle-click close if already supported elsewhere — keep parity.
- Settings tab: keep reachable (toolbar cog / existing Settings entry); do not invent a second settings surface.
- **Retire `TabGroupChip` as the project accordion** on the main strip once the project strip ships. Until strip is solid, a feature flag may keep chips; do not ship both as primary.

## 1.6 Retire activity bar (primary path)

- Stop mounting `ActivityBar` + mutually exclusive Workspaces/Files/Session **as the main navigator**.
- Temporarily: keep components in tree for phase 2 port (SessionView already separate); delete dead mounts.
- `sideActivity` / `OMP_ACTIVITY` state: freeze or bridge — Explorer visibility no longer depends on `view === "files"`; use “project side open && explorer fold expanded” (or always fetch when project side open).

## 1.7 Empty & edge states

- No tabs: strip shows `+` (+ recents if decided); side Sessions empty; Explorer stub; main column `EmptyWorkspace` CTA → open folder.
- Switch project via strip: thin tabs and Sessions list swap to that project’s members; chat follows focused session.

## 1.8 Acceptance

- [ ] Title bar and toolbar remain full width; strip starts below toolbar.
- [ ] Strip lists open projects with accent + abbr; click switches project/session.
- [ ] Sessions fold lists only the active project’s sessions with run dots; click focuses/opens tab.
- [ ] Explorer fold hosts `FilesView`; both folds independently collapsible.
- [ ] Tab strip is thin and session-scoped to the active project (no project chip grouping as primary).
- [ ] Activity bar is not the primary navigator.
- [ ] i18n for new strings; CHANGELOG note; `project-navigation.md` draft update allowed in phase 4 if behaviour still shifting.

## 1.9 Likely files

- `src/design/project-strip.jsx` (new), `layout/project-strip.css` / `sidebar.css` / `stage.css` / `chrome.css`
- `src/design/project-side.jsx` or evolve `SidePanel` + folds
- `src/design/workspaces-view.jsx` — harvest session rows; stop mounting as activity view
- `src/design/files/files-view.jsx` — mount under Explorer fold
- `src/design/activity-bar.jsx`, `src/app/activity.js` — demote / unmount
- `src/design/tab-group-chip.jsx`, `chrome.jsx` TabBar — thin session tabs
- `src/design/toolbar.jsx` — keep full-width actions; sidebar toggle → project side
- `src/app-live.jsx` — layout state machine
- `src/index.html` — script order
- Tests: `test-project-nav.mjs` if helpers added (e.g. `projectAbbr`)
