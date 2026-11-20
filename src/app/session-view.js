/* app/session-view.js — the Session activity view's accordion state
   (docs/plans/2026-11-20-workspace-layout/phase-2-side-views.md): which
   sections of the per-tab Session side view are collapsed, kept per tab
   in memory (like the files panel's per-tab views; nothing persisted).
   Sections a Settings → Rail toggle hides are not rendered at all, so
   their collapse state is simply ignored while hidden.

   Exposes `window.OMP_SESSION_VIEW`; wrapped as an IIFE per the project
   rule for plain <script> tags (AGENTS.md "IIFE rule"). Pure, so the
   toggle and prune rules are testable (test-session-view.mjs). */
(function () {
  // Order of the accordion. Every section starts expanded (parity with
  // the old right rail, which showed them all at once).
  const SECTIONS = Object.freeze(["context", "radar", "subagents", "minimap", "changes", "extensions"]);
  const IDLE = Object.freeze(SECTIONS.reduce((m, s) => Object.freeze({ ...m, [s]: true }), Object.freeze({})));

  const { entryOf, updateEntry, pruneEntries } = window.OMP_SESSION_UI;

  /** The tab's collapse map (section → boolean, `true` = expanded). */
  function stateOfTab(map, tabId) { return entryOf(map, tabId, IDLE); }

  /** `fn(state) → state` applied to tab `tabId` only; a falsy id and an
   *  unchanged result both return `map` itself. */
  function updateTab(map, tabId, fn) {
    return updateEntry(map, tabId, IDLE, fn);
  }

  /** Flip one section. A tab back at the all-expanded default drops its
   *  entry (updateEntry drops the shared idle). */
  function toggle(map, tabId, section) {
    return updateTab(map, tabId, st => {
      const next = { ...st, [section]: !st[section] };
      return SECTIONS.every(s => next[s] === true) ? IDLE : next;
    });
  }

  /** Drops closed tabs' state. Same reference when nothing to drop. */
  function prune(map, liveIds) {
    return pruneEntries(map, liveIds);
  }

  window.OMP_SESSION_VIEW = { SECTIONS, IDLE, stateOfTab, toggle, prune, updateTab };
})();
