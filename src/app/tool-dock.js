// app/tool-dock.js — the right tool dock's state (project-dock-layout
// phase 2, docs/plans/2026-11-21-project-dock-layout/). No DOM:
//   MEMBERS            the dock tabs in display order ("file", "session";
//                      "tree" / "usage" join in phase 3)
//   isOpen(dock)       whether a pane is shown
//   tabOf(dock)        the active tab id, or null
//   select(dock, id)   click on a tab: open the pane on `id`; re-clicking
//                      the active tab collapses the pane (tabs remain)
//   openFile(dock)     a preview trigger: select the File tab and open the
//                      pane, whatever was open before (open question 7)
//   close(dock)        the pane's × / Esc: collapse the pane, keep the tab
//                      so a re-click on it reopens the pane on it
// `dock` is `{ tab, open }`; every function returns the next state.
(function () {
  const MEMBERS = ["file", "session"];

  const isOpen = (dock) => !!(dock && dock.open && dock.tab);
  const tabOf = (dock) => (isOpen(dock) ? dock.tab : null);

  function select(dock, id) {
    if (isOpen(dock) && dock.tab === id) return { tab: id, open: false };
    return { tab: id, open: true };
  }

  function openFile(dock) {
    if (isOpen(dock) && dock.tab === "file") return dock;
    return { tab: "file", open: true };
  }

  const close = (dock) => ({ tab: tabOf(dock), open: false });

  window.OMP_TOOL_DOCK = { MEMBERS, isOpen, tabOf, select, openFile, close };
})();
