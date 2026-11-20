/* ═════════════════════════════════════════════════════════════════════
   app/activity.js — activity bar view ids and select/collapse rules
   (docs/plans/2026-11-20-workspace-layout/). Window-global side panel:
   one active view; re-selecting it collapses the panel (VS Code parity).
   Exposes window.OMP_ACTIVITY; IIFE per AGENTS.md.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const VIEWS = Object.freeze([
    Object.freeze({ id: "workspaces", icon: "folder", title: "Workspaces" }),
    Object.freeze({ id: "files", icon: "file", title: "Files" }),
    Object.freeze({ id: "session", icon: "radar", title: "Session" }),
  ]);

  const DEFAULT = Object.freeze({ view: "workspaces", open: true });

  /** Next `{ view, open }` after clicking activity icon `id`. */
  function selectView(state, id) {
    const cur = state && typeof state === "object" ? state : DEFAULT;
    const view = typeof id === "string" && id ? id : DEFAULT.view;
    if (cur.open && cur.view === view) return { view, open: false };
    return { view, open: true };
  }

  /** Ensure the panel is open on `id` (empty-state CTA, keymap). */
  function openView(state, id) {
    const view = typeof id === "string" && id ? id : DEFAULT.view;
    return { view, open: true };
  }

  window.OMP_ACTIVITY = { VIEWS, DEFAULT, selectView, openView };
})();
