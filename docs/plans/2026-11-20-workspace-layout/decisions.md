# Locked decisions

These are product rules already agreed (including the 2026-11-20 activity-bar revision). Implementation details may vary; these must not.

## Workspace & sessions

1. **A workspace is a folder** (canonical project path), grouped with profile as today: `(profile, folder)`.
2. **Opening a workspace** means: focus an existing tab in that group if one is open, else spawn a new session (`live.js` `openProject` / `findProjectTab`).
3. **Workspaces side view lists sessions** under each open folder (reuse sidebar row patterns: expand group, `TabRunDot` / `groupRunState`, rename, close, new conversation in project). This is how the user sees **which sessions are working** after the old permanent sidebar goes away.
4. The **tab bar** remains the primary strip of open conversations; the Workspaces view is the **overview** (all workspaces + run state), not a replacement for tabs.
5. **Recents + Browse / open folder** live in the Workspaces view (and may also be reachable from a small “open” control). A separate modal is optional; prefer in-panel first to avoid two UIs for the same list.

## Activity bar + side panel

6. Far left: a **narrow activity bar** (VS Code–style icon strip). Selecting an icon shows **one** corresponding **side panel** view beside it.
6a. **Hover tooltip:** every activity icon shows a **bubble with its title** on pointer hover (and the same string as `aria-label` / accessible name). Prefer the app’s existing tooltip pattern if one exists (e.g. toolbar `title` / shared tip component); do not rely on icon-only affordance. Titles go through `OMP_TR`.
7. Provisional activity items:

   | Id | View | Notes |
   |---|---|---|
   | `workspaces` | Workspaces | Global/profile: open groups, sessions, recents, browse |
   | `files` | Files | Per active tab: file tree (+ toggles already wired) |
   | `session` | Session tools | Per active tab: context, radar, subagents, minimap, Changes (accordion inside the view) |

   Extra icons later (search, git browser, …) are out of scope unless added deliberately.

8. **Per-tab views** (`files`, `session`) swap data with the active tab. **Workspaces** does not — it always shows the full open/recent set for the profile context used today by the sidebar.
9. **Global overlays stay out of the activity bar:** profile Usage (`UsageStatsPanel`), History modal, Settings tab.

## Right column

10. Prefer an **empty / absent** right column.
11. Right column may show only **widget plugin** cards, approvals, and `widgets.json` errors. Hide the column when empty.
12. Context / radar / subagents / minimap / PR Changes **leave** the right AmbientRail once they live under the Session (or Files) activity view.

## Chrome / empty state

13. Empty window (no tab): activity bar still available; default view **Workspaces** with Browse / recents; empty chat column may show a short CTA that focuses that view or Browse.
14. Old `ProjectSidebar` **mount is removed**; its UI is **ported** into the Workspaces activity view (do not leave two project lists).
15. Toolbar **sidebar** toggle is removed or remapped to **show/hide side panel** / activity bar (phase 4).

## Non-goals

- Do not keep the old permanent sidebar *and* the activity Workspaces view at once.
- Do not keep a full AmbientRail on the right in parallel with the Session activity view.
- Do not move browser / conversation tree / terminal into the activity bar in this redesign.
- Do not put profile Usage into the side panel.
