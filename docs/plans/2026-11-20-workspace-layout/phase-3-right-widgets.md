# Phase 3 — Right column (widgets only)

**Outcome:** The right column is no longer a general AmbientRail. It shows **widget plugin UI only**, and **disappears** when there is nothing to show.

**Depends on:** phase 2 (per-tab cards live under Session activity view)  
**Unlocks:** phase 4 Rail settings copy

## 3.1 What stays on the right

| Content | Why right |
|---|---|
| `WidgetCard` | App-global `widgets.json`; approval global |
| `WidgetApprovalCard` | Fingerprint approval |
| `WidgetErrorCard` / config fatal | Host / config level |

Project-path matching still follows the active tab’s folder; that does not make plugins “session tools” — they stay off the activity bar.

## 3.2 What must not remain on the right

- Context, radar, subagents, minimap, PR Changes (Session view owns them)
- Workspaces / files (activity bar owns them)

Replace `AmbientRail` with a slim `WidgetRail` (or equivalent) that only renders widget children.

## 3.3 Visibility

- Show right column iff approvals, config errors, or visible widget cards exist.
- Hide = no grid track, no empty aside, no resize handle.
- `useWidgets` `railVisible`: prefer **window focused + tab open** (or “widget column would show”), not “AmbientRail mounted”, so interval plugins do not stall when the column is empty/hidden. Document the chosen rule in `widgets.md`.

## 3.4 Toolbar “ambient rail”

Retarget or remove: must not reopen old AmbientRail. Prefer “focus Session activity view” or “toggle side panel”. Final binding in phase 4.

## 3.5 Acceptance

- [x] No per-tab ambient cards on the right (Session view owns them; `AmbientRail` deleted).
- [x] Right column absent when no widget UI (`sideRail`/render gated on `widgetUI`); present with cards/approvals.
- [x] Approve / refresh / insert unchanged (same cards, new mount).
- [x] `docs/architecture/widgets.md` updated (visibility rule); `extension-widgets.md` placement row updated.
- [x] CHANGELOG note.

## 3.6 Likely files

- `src/design/chrome.jsx` / new widget rail
- `src/app/use-widgets.jsx`, `src/design/widgets/*`
- `src/app-live.jsx`, `stage.css`, `rail.css`
