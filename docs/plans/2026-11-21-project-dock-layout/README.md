# Project strip + tool dock layout

**Status:** implemented (phases 1–4, 2026-11-21) · **supersedes** [`../2026-11-20-workspace-layout/`](../2026-11-20-workspace-layout/)  
**Date:** 2026-11-21  
**Sketch:** Pencil canvas (layout B iterations); earlier HTML explorers under `.temp/layout-sketch-b.html` are non-normative.

**Goal:** Replace the activity-bar three-view model (Workspaces / Files / Session) with:

1. a **project strip** (switch open projects),
2. a **project side panel** with two **folds** — this project’s **sessions** + **file explorer**,
3. a **thin session tab strip** (open tabs; opened from the session list),
4. a **right tool dock** with vertical text tabs that host existing panels (File preview, Session tools, Tree, Usage) one at a time,
5. while keeping the **window title bar** and **toolbar** full width above all of that.

## Why this replaces the previous plan

The 2026-11-20 redesign restored glanceable sessions via a Workspaces activity view, but left an awkward redundancy: **projects already appear as `TabGroupChip`s** on the tab bar, again in Workspaces, and session tools competed with Files for the same side panel. Users also need **file preview as a durable column** (not a modal), and want secondary tools (preview / session stats / tree / usage) in one **right dock** instead of scattered toolbar overlays and activity icons.

This plan resolves **one home for projects** (strip) and **one home for this project’s sessions** (side fold → opens thin tabs), and moves ambient/tool UIs to the dock.

## Reading order

| File | What |
|---|---|
| [`decisions.md`](./decisions.md) | Locked product rules |
| [`phase-1-project-shell.md`](./phase-1-project-shell.md) | Chrome hierarchy; project strip; dual-fold side; thin tabs |
| [`phase-2-tool-dock.md`](./phase-2-tool-dock.md) | Right dock shell; File preview docked; Session tools in dock |
| [`phase-3-dock-members.md`](./phase-3-dock-members.md) | Tree + Usage into dock; toolbar cleanup; stage `side` cleanup |
| [`phase-4-settings-docs.md`](./phase-4-settings-docs.md) | Tweaks, keymap, widths, i18n, architecture docs |
| [`file-map.md`](./file-map.md) | Code / test / doc touch list |
| [`open-questions.md`](./open-questions.md) | Defaults still free within locked rules |

## Target layout

```
┌──────────────────────────────────────────────────────────────┐
│ Window title / chrome                              (full width) │
├──────────────────────────────────────────────────────────────┤
│ Toolbar (+ open workspace, hist, agent, web, term, …) (full width) │
├────┬────────────────┬────────────────────────────────────┬───┤
│ P  │ Project side   │ Thin session tabs                  │ D │
│ r  │ ┌────────────┐ │────────────────────────────────────│ o │
│ o  │ │ Sessions ▾ │ │ Chat + composer                    │ c │
│ j  │ │  · sess…   │ │                                    │ k │
│ e  │ │  + new     │ │         [ File | Session | … pane ]│   │
│ c  │ ├────────────┤ │                                    │ T │
│ t  │ │ Explorer ▾ │ │                                    │ a │
│    │ │  tree…     │ │                                    │ b │
│ +  │ └────────────┘ │                                    │ s │
└────┴────────────────┴────────────────────────────────────┴───┘
│ Status bar                                                     │
```

- **P** = project strip (under toolbar only — does **not** cover title bar or toolbar).
- **Dock tabs** = vertical text labels on the far right; one dock pane at a time; re-click collapses.
- **D** dock pane sits between chat and the vertical tabs when open.

## Phase order

1. **Project shell** — strip + dual-fold side + thin tabs; retire activity bar as the primary navigator.
2. **Tool dock** — dock host; File preview as dock pane (leave modal); Session tools move from activity Session view into dock.
3. **Dock members + cleanup** — Tree + Usage; shrink toolbar; reconcile stage `side` modes.
4. **Settings / keymap / docs** — widths, chords, architecture, CHANGELOG; close out superseded plan.

## Relationship to shipped 2026-11-20 work

Keep and **repurpose**:

| Shipped | Role in this plan |
|---|---|
| `WorkspacesView` session rows / run dots / reorder | Feed **Sessions** fold (scoped to active project) + strip project list |
| `FilesView` | **Explorer** fold |
| `SessionView` accordion | **Session** dock tab |
| `FilePreview` | **File** dock tab (container changes from modal → pane) |
| Widget-only right rail behaviour | Merge into Session dock (or remain as part of that pane) |
| `OMP_PROJECT_NAV`, appearance accent | Strip glyphs + grouping |

Remove / stop extending as end-state:

| Piece | Fate |
|---|---|
| `OMP_ACTIVITY` views `workspaces` / `files` / `session` | Retire after phase 1–2 migration |
| Activity bar icon strip (three views) | Replaced by project strip |
| `TabGroupChip` as primary project switcher | Projects move to strip; tabs become session-only for the active project |
| Modal-only file preview as the default | Docked File tab |

## Out of scope

- Changing what a tab/session is (still one omp process).
- Putting Browser, Terminal, History, Approvals, or Settings into the dock.
- Forcing GitBrowser into a narrow dock (stays large overlay / panel unless a later decision widens the dock).
- Custom project icon picker as a hard requirement for add-project (accent + abbreviation is enough for v1; optional icons later — see `open-questions.md`).
- Remote, updater, and unrelated Settings sections.
