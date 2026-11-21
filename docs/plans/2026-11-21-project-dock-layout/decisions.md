# Locked decisions

Product rules agreed in the 2026-11-21 layout discussion (Pencil sketch B). Implementation details may vary; these must not.

## Chrome hierarchy

1. **Window title / chrome is full width.** The project strip must **not** rise into or displace the title bar.
2. **Toolbar is full width.** The project strip must **not** displace the top toolbar button row. Open-workspace, history, agent, browser, terminal, and remaining toolbar actions stay here (until phase 3 moves some into the dock).
3. Below title + toolbar: **project strip | project side | (thin tabs + stage) | dock tabs**, with an optional **dock pane** between stage and dock tabs.

## Projects

4. **A project / workspace is still `(profile, folder)`** (`OMP_PROJECT_NAV`). Path norms and grouping rules unchanged.
5. **Primary project switcher is the left project strip** (abbreviation or short label + existing project accent). One glyph/button per open project; hover shows path / name; run badge when any session in that project is non-idle (`groupRunState`).
6. **Selecting a project** focuses that project’s active session (same idea as today’s `groupTarget`), or the newest member if none active.
7. **Opening a folder** (toolbar `+` / strip `+` / empty CTA) uses the existing folder picker + spawn / focus path (`openProject` / `findProjectTab`). Recents remain available (strip menu, Sessions fold footer, or empty CTA — one primary surface in phase 1; see `open-questions.md`).
8. **Do not keep three project UIs.** After phase 1: strip owns projects; Workspaces activity view and project-grouped tab chips are no longer the primary project UI. `TabGroupChip` project grouping is retired or reduced so the tab strip lists **sessions of the active project only**.

## Sessions & tabs

9. **This project’s sessions** live in the project side panel as a **fold** (“本项目会话” / Sessions): list with `TabRunDot`, rename, close, new conversation in project, reorder within project.
10. **Clicking a session in that list** opens it if needed and focuses it — **equivalent to selecting / opening a tab**.
11. **Tab strip stays**, but becomes **thin and secondary**: shows open session tabs for the **active project** (close with ×). It must not compete with the Sessions fold for browsing; the fold is the browser, the strip is the open set.
12. A tab is still one omp session / process. No change to registry identity.

## Project side panel

13. The panel beside the strip has **exactly two folds** (both can be open; not mutually exclusive activity views):
    - **Sessions** — decision 9–10
    - **Explorer** — today’s `FilesView` tree (toggles as today). Selecting a file opens the tool dock’s **File** preview; the stage files **detail** / comment path stays available via the preview’s “Comment in files panel” handoff (and other existing entry points).
14. Side panel width remains user-resizable (reuse `sidebarWidth` / pane widths). Strip width is fixed (CSS variable), not user-resized.
15. No open tab / no project: strip still shows `+` and any recents affordance; Sessions/Explorer folds show empty hints pointing at open-workspace.

## Right tool dock

16. Far right: **vertical text tabs** (labels, not icon-only). One **dock pane** at a time. **Re-clicking the active tab collapses** the pane (tabs remain).
17. **v1 dock membership** (existing capabilities only):

    | Tab | Hosts | Notes |
    |---|---|---|
    | `File` | `FilePreview` | **Docked column**, not modal. Opened by today’s triggers (read card, project file link, …). |
    | `Session` | `SessionView` (+ widgets) | Context, radar, subagents, Changes, minimap, extension cards. |
    | `Tree` | Conversation tree | Today’s stage `side === "tree"`. |
    | `Usage` | `UsageStatsPanel` content | Leave modal overlay; pin into dock. |

18. **Git** (`GitBrowser`) is **not** a first-class narrow dock member in v1 — keep the existing large overlay / panel. Optional later: dock tab that expands the dock width.
19. **Do not put in the dock:** Browser panel, Terminal, Subagent manager (full), History modal, Approvals, Settings.
20. **File dock tab ≠ Explorer fold.** Explorer browses the tree; File is the read-only preview snapshot (git / comment actions on the preview header stay).

## Preview & stage

21. Default file preview presentation is the **File dock pane**. Modal/scrim preview is retired once the dock File tab works (Esc / × still close → collapse dock or clear preview target).
22. Stage modes that remain toolbar-driven: **browser**, **terminal**, **subagent split**. Conversation **tree** moves to the dock (phase 3). Files **detail** (commentable panel) stays a stage concern when invoked; it must not be confused with File preview — prefer mutual exclusion or “Comment in files panel” handing off as today.

## Narrow window

23. Prefer keeping **chat + File dock** when cramped. Collapse order (guideline): Session/Tree/Usage dock → shrink project side → collapse Explorer fold → only then close File preview.

## i18n & a11y

24. All new chrome strings go through `OMP_TR` (EN source + `i18n-zh.js`). Dock tabs need accessible names; vertical text is visual — `aria-label` carries the full title.
25. Project strip buttons: accessible name = project label / path; run state exposed in name or described by.

## Non-goals

- Do not keep the activity-bar Workspaces / Files / Session **mutual-exclusion** model as the end state.
- Do not put projects primarily on the tab bar again (`TabGroupChip` as project switcher).
- Do not require custom project icons to add a project in v1.
- Do not invent new omp protocol features for this layout.
