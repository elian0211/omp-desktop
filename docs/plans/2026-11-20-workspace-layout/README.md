# Workspace layout redesign

**Status:** phases 1–3 done (activity bar; Workspaces + Files + Session side views; right column widget-only and hidden when empty); phase 4 (Settings / keymap) next · **revised** 2026-11-20 (activity bar)  
**Date:** 2026-11-20  
**Goal:** VS Code–style **activity bar** (icon strip) + **switchable side panel**; a **Workspaces** view shows folders **and** their sessions with run state; other views (files, session tools, …) are per active tab; right column stays **widgets-only (often absent)**.

## Why the revision

Removing the project list made it hard to see **which sessions are running**. A modal-only workspace picker is not enough. An activity-bar icon for **Workspaces** restores that glanceable list (with `TabRunDot` / `groupRunState`) without bringing back a permanent second navigator beside the tab bar.

## Reading order

| File | What |
|---|---|
| [`decisions.md`](./decisions.md) | Locked product rules |
| [`phase-1-activity-bar.md`](./phase-1-activity-bar.md) | Activity bar shell; Workspaces view; empty CTA; retire old sidebar mount |
| [`phase-2-side-views.md`](./phase-2-side-views.md) | Other activity icons: Files + session tools (context, radar, …) |
| [`phase-3-right-widgets.md`](./phase-3-right-widgets.md) | AmbientRail → widgets-only; hide when empty |
| [`phase-4-settings-cleanup.md`](./phase-4-settings-cleanup.md) | Tweaks, keymap, widths, Settings copy |
| [`file-map.md`](./file-map.md) | Code / test / doc touch list |
| [`open-questions.md`](./open-questions.md) | Defaults still free within locked rules |

Superseded draft names: `phase-1-workspace-nav.md`, `phase-2-left-stack.md` (replaced by the two files above).

## Target layout

```
┌─ tabs: [folder · session ▾] … [Settings]     (optional: + opens Browse / new session)
├─ toolbar (browser / tree / terminal / …)
├────┬─────────────┬──────────────────────┬──────────────┐
│ ▣  │ SIDE PANEL  │ Chat + composer      │ RIGHT        │
│ ▤  │ (one view)  │                      │ widgets only │
│ ⚙  │             │                      │ (or absent)  │
│ …  │ Workspaces  │                      │              │
│    │  or Files   │                      │              │
│    │  or Session │                      │              │
│    │  tools …    │                      │              │
└────┴─────────────┴──────────────────────┴──────────────┘
│ status bar
```

Activity bar (narrow, always on the far left when the side UI is shown):

| Icon (provisional) | Side panel view | Scope |
|---|---|---|
| Workspaces / folders | Open workspaces + **sessions** (run dots), recents, open folder | App / profile (not “one tab’s tools”) |
| Files | Project file tree for the **active** tab | Per tab |
| Session (or split icons) | Context, radar, subagents, minimap, Changes — accordion or sub-icons | Per tab |

Hovering an activity icon shows a **title bubble** (localized). Clicking the **active** icon again may collapse the side panel (VS Code behaviour) — see `open-questions.md`.

No open tab:

```
│ activity │ Workspaces view (recents + Browse) │ empty chat / CTA
```

## Phase order

1. **Activity bar + Workspaces view** — replace `ProjectSidebar` mount; sessions visible again with run state.
2. **Other side views** — Files + move per-tab rail cards into Session (or dedicated) views.
3. **Right column** — widgets only; hide when empty.
4. **Settings / keymap** — remove old sidebar toggle semantics; activity / panel actions.

## Out of scope

- Changing what a tab is (still one omp process / session).
- Moving Usage stats into the activity bar (stays toolbar overlay).
- Browser / conversation tree / full subagent manager / terminal as activity icons (stay toolbar-driven unless later decided).
- Remote access, updater, Settings page structure beyond Layout / Rail keys this redesign touches.
