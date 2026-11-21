# Phase 2 — Right tool dock (File preview + Session tools)

**Outcome:** A far-right **vertical text tab strip** toggles one **dock pane**. **File** hosts docked `FilePreview` (modal retired). **Session** hosts today’s `SessionView` (+ widgets). Re-click collapses the pane.

**Depends on:** phase 1 (stable under-toolbar columns)  
**Unblocks:** phase 3 (Tree / Usage membership, toolbar cleanup)

## 2.1 Dock shell

**New chrome** (suggested: `design/tool-dock.jsx` + `layout/tool-dock.css`).

**Layout inside `.workspace` (after phase 1):**

```
.project-strip | .project-side | .main-column | [.dock-pane] | .dock-tabs
```

- `.dock-tabs`: fixed narrow width (~28–32px); vertical labels (stacked letters or `writing-mode` — pick what Pencil/CSS renders cleanly); `aria-label` per tab.
- `.dock-pane`: resizable width (`OMP_LAYOUT_WIDTHS` new pane `dock` or reuse `railWidth`); hidden when collapsed (no grid track).
- State: `{ tab: "file" | "session" | "tree" | "usage" | null, open: boolean }` — **window-global** unless open-questions say per-tab. Phase 2 implements `file` + `session` only; reserve ids for `tree` / `usage` but show them disabled or omit until phase 3.

**Behaviour:**

- Click tab: open pane on that id; if already active and open → collapse (`open: false`).
- Keyboard: phase 4; buttons must be reachable.

## 2.2 File dock = FilePreview

- Move rendering from modal/scrim (`FilePreview` + `useModalLayer`) into `.dock-pane` when `tab === "file"`.
- Keep **data path** unchanged: `preview = { key, target }` in `app-live.jsx`; triggers (read card, markdown link, …) set target **and** select File dock (`open: true`, `tab: "file"`).
- Header actions stay: open in git browser, comment in files panel, close.
- Close (× / Esc): clear preview target and/or collapse dock — pick one UX and test both keyboard and button (document in PR). Prefer: clear target + collapse if File was the dock tab.
- **No scrim** over chat; chat remains usable beside the pane.
- Width: new default ~280–320px; clamp via pane widths.

### Regression watch

- Preview still tab-keyed (`preview.key === planKey`).
- Outside / missing / binary / too-large states still render.
- Comment handoff still opens files detail and closes or yields preview as today.

## 2.3 Session dock = SessionView

- Mount existing `SessionView` (and widget cards section) in the dock when `tab === "session"`.
- Retarget visibility gates that used `sessionViewShown` / activity Session view to **dock open && tab === "session"** (PR automation `railVisible` composition in `app-live.jsx` — update carefully; see `pr-automation.md`).
- Settings → Rail toggles (`showContext`, …) still mean “include section”.
- Do **not** leave a second AmbientRail column for the same cards.

## 2.4 Interaction with phase 1 side

- Opening File dock does **not** collapse Explorer fold.
- Explorer file click → File **preview** dock (decision 20–22; files **detail** stays a comment handoff from the preview header).

## 2.5 Acceptance

- [ ] Vertical dock tabs visible; File + Session selectable; re-click collapses pane.
- [ ] Preview triggers open File dock beside chat (no modal scrim).
- [ ] Session dock shows SessionView sections + widgets; PR/radar gates follow dock visibility.
- [ ] Pane width resizable and persisted (or reuse rail width key with rename in phase 4).
- [ ] i18n for dock tab labels; CHANGELOG note.

## 2.6 Likely files

- `src/design/tool-dock.jsx` (new), `layout/tool-dock.css`, `stage.css`
- `src/design/chat/file-preview.jsx` — pane mode / drop modal shell
- `src/design/side-views/session-view.jsx` — mount site only
- `src/app-live.jsx` — dock state; preview open path; `railVisible` / session visibility
- `src/app/layout-widths.js`, `use-pane-widths.jsx` — dock pane
- `src/app/file-preview.js` — unchanged targets preferred
- Docs: `file-preview.md`, `pr-automation.md` (phase 4 may finish prose)
