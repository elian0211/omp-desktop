# Open questions

Choices still free **inside** [`decisions.md`](./decisions.md). Resolve at phase start; update when decided.

## Phase 1 — Project shell

1. **Recents placement** — ~~strip overflow menu vs Sessions fold footer vs empty CTA?~~ **Resolved: strip `+` menu** (recents + "open folder…" as one popover; `ProjectStrip`, always reachable). Empty CTA keeps plain "Open a workspace".
2. **Tab strip when project has one session** — **Resolved: always show** (the strip lists `membersNewestFirst` regardless of count; a lone tab keeps its close/rename affordances).
3. **Closed but "known" sessions** — **Resolved: open tabs only**; the History modal stays the resume surface.
4. **Project strip order** — **Resolved: `groupTabs` registry order; no strip drag-reorder** (member drag within a project lives in the Sessions fold and the thin tab strip).
5. **Focus layout** — **Resolved: the `layout: focus` tweak suppresses only the stage's widget rail**; strip, project side and dock panes stay (they are user-toggled chrome, each independently collapsible).

## Phase 2 — Tool dock

6. **Dock remember last tab** — window-global last dock id vs per session tab? (Implemented: **window-global** `{ tab, open }` in `app-live.jsx`; no per-tab memory.)
7. **Auto-open File dock** — on every preview trigger (yes, locked intent) — also switch away from Session/Tree if they were open? **Resolved: yes** — `OMP_TOOL_DOCK.openFile` always selects the File tab and opens the pane, whatever was open.
8. **Empty File tab** — **Resolved: stub** — "Open a file from the chat or the explorer." (`.dock-pane-stub`); the pane always shows for the File tab, so the tab click is never a no-op and handoffs (git browser / files panel) leave a stub rather than an empty pane.
9. **Widgets** — **Resolved: plugin widget cards render under the SessionView in the Session dock pane**; the stage rail column is suppressed while the Session dock is open (`sideRail` in `app-live.jsx`), so there is never a second right column.

## Phase 3 — Members / cleanup

10. **Usage in dock** — **Resolved: the full `UsageStatsPanel`**, docked (`docked` prop drops the scrim; the panel head keeps refresh + close).
11. **Tree refresh control** — **Resolved: dock header** (a refresh button in the dock pane head when the Tree tab is open); the toolbar's tree cluster is gone.
12. **`side === "files"` detail** vs File dock — **Resolved: not exclusive**; the files detail stays a stage column (`side === "files"`), the File preview a dock pane, and both can be open at once (decision 22's "prefer mutual exclusion or handoff" is served by the existing preview→files handoff button).
13. **Git dock later** — still a follow-up, not blocking v1 (decisions 18/3.6 unchanged).

## Phase 4

14. **Tweak migration** — **Resolved:** `sidebar` already maps to project side visibility (phase 1); `OMP_ACTIVITY` deleted with `app/activity.js` (no stored defaults to migrate — the activity view id was never a tweak); Settings → Rail renamed **Session tools**; `treeWidth` removed from `TWEAK_DEFAULTS`/schema (a stored value is inert), `dockWidth` added.
15. **Keymap** — **Resolved:** `desktop.sidebar.toggle` was retargeted to the project side in phase 1; five new chords added (`desktop.dock.toggle`, `desktop.dock.file/.session/.tree/.usage`, no defaults, user-assignable; Rust `ACTION_IDS` kept in sync). No activity-view chords existed to reuse.

## Explicitly closed (this redesign)

| Topic | Resolution |
|---|---|
| Title bar / toolbar displaced by project strip | **No** — both stay full width |
| Activity bar three-view end state | **Superseded** |
| File preview as modal default | **No** — docked File tab |
| Sessions fold + Explorer as exclusive activity views | **No** — two folds, both available |
| Session list click | Opens / focuses a tab |
| Tab bar role | Thin open-set; not project switcher |
| Dock membership v1 | File, Session, Tree, Usage |
| Git / Browser / Terminal / History in dock | **No** for v1 |
| Custom project icons required on add | **No** for v1 (accent + abbr) |
