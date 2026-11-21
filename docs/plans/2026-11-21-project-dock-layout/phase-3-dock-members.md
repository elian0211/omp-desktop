# Phase 3 — Dock members (Tree, Usage) + toolbar / stage cleanup

**Outcome:** **Tree** and **Usage** join the tool dock. Toolbar drops controls that moved. Stage `side === "tree"` (and related) no longer owns a parallel column for the tree. Git / Browser / Terminal stay out of the dock per decisions.

**Depends on:** phase 2 (dock shell + File + Session)  
**Unblocks:** phase 4 (settings copy, keymap, delete dead activity code)

## 3.1 Tree dock tab

- Host today’s conversation tree UI (`ConversationTree` / `useConversationTree`) in the dock when `tab === "tree"`.
- Open triggers: former toolbar tree toggle → `dock.open + tab=tree`; refresh control moves to dock header or a small toolbar cluster **only while Tree is open** (open-questions 11).
- Stop using `side === "tree"` as a stage column mode for the tree (remove grid track). If `side` enum still needed for browser/files detail, keep those values only.
- Acceptance: tree data still keyed by active session; refresh behaviour preserved.

## 3.2 Usage dock tab

- Host `UsageStatsPanel` content in the dock when `tab === "usage"`.
- Toolbar usage button → opens Usage dock (not a modal). Esc / re-click collapses.
- Preserve whatever profile/scope the panel already uses; do not invent new billing APIs.

## 3.3 Toolbar cleanup

Remove or remap buttons that are now dock tabs:

| Before | After |
|---|---|
| Conversation tree toggle | Dock → Tree |
| Usage statistics | Dock → Usage |
| Session activity (if any leftover) | Dock → Session |
| Git | **Unchanged** (large overlay) |
| Browser / terminal / agent manager | **Unchanged** |
| Sidebar / side panel | Project side show/hide (phase 1) |

Keep the toolbar **full width** (decision 2).

## 3.4 Stage `side` reconciliation

Document and implement the post-migration `side` (or replacement) map:

| Mode | Where |
|---|---|
| Browser | Stage (toolbar) |
| Files detail (comments) | Stage |
| Tree | **Dock** |
| File preview | **Dock** |
| Session tools | **Dock** |
| Subagent split | Stage / split (unchanged) |
| Terminal | Bottom / existing host |

Ensure `defaultSide` tweak and `seedEntries` either migrate or are deleted in phase 4.

## 3.5 Narrow-window behaviour

Implement or approximate decision 23: when fitting panes, prefer chat + File dock; collapse other dock tabs first. Reuse `OMP_LAYOUT_WIDTHS.fit` patterns.

## 3.6 Git (explicit non-goal for v1)

- Do not add a Git dock tab that clips `GitBrowser`.
- Optional follow-up issue: “Git dock with expanded width”.

## 3.7 Delete dead activity chrome

Once Tree/Usage/Session/File no longer need it:

- Remove `ActivityBar` mount, `OMP_ACTIVITY` if unused, Workspaces-as-activity routing.
- Keep harvested list helpers; delete dead CSS for activity-only layouts.

## 3.8 Acceptance

- [ ] Dock tabs: File, Session, Tree, Usage — all functional; mutual exclusion; re-click collapse.
- [ ] Toolbar no longer duplicates tree/usage (and session) as primary opens.
- [ ] No stage column for conversation tree.
- [ ] Usage no longer modal-only.
- [ ] Git / browser / terminal behaviours unchanged in place.
- [ ] CHANGELOG note.

## 3.9 Likely files

- `src/design/tool-dock.jsx` — register Tree + Usage
- `src/design/toolbar.jsx` — remove moved toggles
- `src/app-live.jsx` — `side` map; dock open helpers; remove tree stage branch
- `src/design/` conversation tree host, `UsageStatsPanel`
- `src/app/session-ui.js` — `seedEntries` / defaultSide consumers
- `src/design/activity-bar.jsx`, `src/app/activity.js` — delete if unused
- `src/design/workspaces-view.jsx` — only if still referenced; else delete or rename to sessions-fold module
