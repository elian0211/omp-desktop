# Open questions

Choices still free **inside** [`decisions.md`](./decisions.md). Resolve at phase start; update when decided.

## Phase 1 — Project shell

1. **Recents placement** — ~~strip overflow menu vs Sessions fold footer vs empty CTA?~~ **Resolved: strip `+` menu** (recents + "open folder…" as one popover; `ProjectStrip`, always reachable). Empty CTA keeps plain "Open a workspace".
2. **Tab strip when project has one session** — still show a thin tab, or hide until ≥2 open?
3. **Closed but “known” sessions** — Sessions fold lists only **open tabs** in that project, or also resume candidates from history for that folder? (Default lean: open tabs only; History modal stays for resume.)
4. **Project strip order** — match `groupTabs` / registry project order; drag-reorder on the strip in phase 1 or later?
5. **Focus layout** — hide strip + side + dock, or keep strip only?

## Phase 2 — Tool dock

6. **Dock remember last tab** — window-global last dock id vs per session tab? (Implemented: **window-global** `{ tab, open }` in `app-live.jsx`; no per-tab memory.)
7. **Auto-open File dock** — on every preview trigger (yes, locked intent) — also switch away from Session/Tree if they were open? **Resolved: yes** — `OMP_TOOL_DOCK.openFile` always selects the File tab and opens the pane, whatever was open.
8. **Empty File tab** — **Resolved: stub** — "Open a file from the chat or the explorer." (`.dock-pane-stub`); the pane always shows for the File tab, so the tab click is never a no-op and handoffs (git browser / files panel) leave a stub rather than an empty pane.
9. **Widgets** — **Resolved: plugin widget cards render under the SessionView in the Session dock pane**; the stage rail column is suppressed while the Session dock is open (`sideRail` in `app-live.jsx`), so there is never a second right column.

## Phase 3 — Members / cleanup

10. **Usage in dock** — full `UsageStatsPanel` UI or a denser subset?
11. **Tree refresh control** — stay on toolbar when Tree dock open, or move into dock header only?
12. **`side === "files"` detail** vs File dock — exclusive always, or allow both briefly?
13. **Git dock later** — track as follow-up issue; not blocking v1.

## Phase 4

14. **Tweak migration** — map `sidebar` → project side visibility; retire `OMP_ACTIVITY` defaults; rename Settings “Rail” copy to “Session dock” / “Tool dock”?
15. **Keymap** — remap `desktop.sidebar.toggle` to project side; new chords for dock tabs vs reuse activity chords?

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
