# Open questions

Choices still free **inside** [`decisions.md`](./decisions.md). Resolve at phase start; update when decided.

## Phase 1 — Activity bar / Workspaces

1. **Collapse on re-click** — **Decided:** re-click collapses (VS Code).
2. **Remember last view** — **Decided:** window-global (`sideActivity` in `app-live.jsx`).
3. **Activity bar when focus layout** — still open (bar stays for now).
4. **Browse UX** — **Decided:** Workspaces footer + toolbar `+` / empty CTA (all open the folder picker after focusing Workspaces).
5. **Workspaces view when another profile’s tabs exist** — **Decided:** same as old sidebar (`groupTabs` over all open tabs).

## Phase 2 — Files / Session

6. **Files: tree-only vs full FilesPanel** — **Decided:** tree-only in the side panel (`GitFileTree` + toggles); clicking a file selects it and opens the existing stage FilesPanel as the detail.
7. **Session accordion defaults** — **Decided:** all sections expanded (parity with the old rail, which showed them all at once).
8. **Collapse persistence** — **Decided:** in-memory per tab (`OMP_SESSION_VIEW`, pruned on tab close), like the files panel's per-tab views.
9. **One Session icon vs many** — **Decided:** one icon, one accordion, for v1 (matches the locked table).
10. **Browser / tree vs side panel** — **Decided:** no exclusivity — the side panel stays visible while browser/tree occupy the stage.

## Phase 3

11. **Widget column empty** — **Decided:** hide (no grid track, no handle); no placeholder.
12. **`widgetsSetView` when column hidden** — **Decided:** "rail visible" is the desktop rule *layout ≠ focus && a tab is open* (`app-live.jsx`), not a column check, so interval plugins keep running while the column is hidden. Documented in `widgets.md`.

## Phase 4

13. **Settings section title** — “Side panels” vs “Workspace tools”?
14. **Migrate `sidebar` / `sidebarWidth` tweaks** — ignore vs map to side panel?

## Explicitly closed (incl. revision)

| Topic | Resolution |
|---|---|
| Workspace = folder | Locked |
| Need glanceable **session run state** | Locked → Workspaces **activity view lists sessions** with run dots |
| VS Code–style activity bar | Locked |
| Activity icon hover → title bubble (`OMP_TR`) | Locked |
| Left activity views: Workspaces (global) + Files/Session (per tab) | Locked |
| Right = widgets only, else absent | Locked |
| Minimap + PR Changes under Session (for now) | Locked |
| Usage stats = toolbar overlay | Locked |
| Old permanent ProjectSidebar not mounted beside activity Workspaces | Locked |
