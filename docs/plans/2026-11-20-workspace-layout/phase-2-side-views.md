# Phase 2 — Files & Session side views

**Outcome:** Activity icons for **Files** and **Session tools**; per-tab rail cards move out of AmbientRail into the Session view (accordion). Side panel content follows the active tab for these views.

**Depends on:** phase 1 (activity bar host exists)  
**Unblocks:** phase 3 (right column can drop per-tab cards)

## 2.1 Files view (`activeView === "files"`)

- Side panel shows the project **file tree** for the active tab (`GitFileTree` + changed / all-files / commented toggles).
- **Recommended:** tree in the side panel; commentable **file detail** stays the existing files stage / full panel when needed (avoid cramming the editor into the narrow panel). Toolbar “files” focuses this activity view and/or opens detail.
- Data: `useFileComments` / `gitBrowserStatus(allFiles)` — fetch when Files view is active (or when detail is open), keyed by active tab.
- No tab open: Files view shows empty / “open a workspace” hint.

## 2.2 Session tools view (`activeView === "session"`)

One side panel with an **accordion** (collapse state per tab or window — see `open-questions.md`):

| Section | Source today |
|---|---|
| Context | AmbientRail token gauge + sparkline |
| Agent radar | AmbientRail radar |
| Subagents | `SubagentRailCard` (full manager stays toolbar/split) |
| Minimap | `SessionMinimap` |
| Changes (PR) | `PrAutomationCard` (`gh` / `showChanges` gates) |

Settings toggles (`showContext`, …) mean “include section”, same as before.

**Visibility for PR / hooks:** retarget `railVisible`-style gates to “Session view visible” or “side panel visible && view === session” so monitoring does not depend on the old right rail.

Optional later: split Session into multiple activity icons; **not** required for v1 of this redesign.

## 2.3 Extension widgets

Per-tab omp `setStatus` / `setWidget` cards: place under Session view (section “Extensions”) or a dedicated activity icon later. Default: **Session accordion section**.

## 2.4 Mutual exclusion with old `side`

Today `side ∈ { rail, files, tree, browser }`. After this phase:

- Activity bar owns **workspaces | files | session**.
- `tree` / `browser` remain toolbar stage modes (center/right), not activity icons.
- Remove the need for `side === "files"` to steal the same column as the rail; Files is an activity view.

## 2.5 Acceptance

- [x] Files icon → tree for active tab; tab switch updates tree (shared `useFileComments` state, per tab).
- [x] Session icon → accordion sections; data follows active tab.
- [x] Minimap + Changes live here; Settings → Rail toggles respected.
- [x] No duplicate context/radar/… on the right — the rail keeps only the widget plugin cards (decisions 12; done now rather than in phase 3).
- [x] Architecture: `file-comments.md`, `pr-automation.md`, `project-navigation.md` updated.

## 2.6 Likely files

- Activity host + new view components
- `src/design/files/*`, `use-file-comments.jsx`
- `src/design/chrome.jsx` (extract AmbientRail bodies)
- `src/design/pr-automation-card.jsx`, `use-pr-automation.jsx`
- `src/app-live.jsx`, `stage.css`
- `CHANGELOG.md`
