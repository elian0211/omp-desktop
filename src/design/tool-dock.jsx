/* tool-dock.jsx — the right tool dock (project-dock-layout phase 2,
   docs/plans/2026-11-21-project-dock-layout/): vertical text tabs on the
   far right of the workspace, one pane between the chat column and the
   tabs (decisions 16–17). Re-clicking the active tab collapses the pane,
   the tabs stay. The pane body is the caller's (`children`); its × is the
   caller's close (the File pane's own head closes the preview instead —
   no second ×). Dock state lives in app/tool-dock.js. */

const DOCK_MEMBERS = [["file", "File"], ["session", "Session"], ["tree", "Tree"], ["usage", "Usage"]];

function ToolDock({ tab, open, label, head, actions, onSelect, onClose, resize, children }) {
  const active = open ? tab : null;
  return (
    <>
      {active && (
        <section
          className="dock-pane"
          role="region"
          aria-label={label ? OMP_TR(label) : OMP_TR("Tool dock")}
        >
          {head && (
            <div className="dock-pane-head">
              <span className="dock-pane-title">{OMP_TR(label)}</span>
              {actions}
              <button type="button" className="btn ghost icon dock-pane-close"
                title={OMP_TR("Close (Esc)")} aria-label={OMP_TR("Close")}
                onClick={onClose}>
                <span className="dock-pane-x" aria-hidden="true">×</span>
              </button>
            </div>
          )}
          <div className="dock-pane-body">{children}</div>
          {resize && <ResizeHandle className="at-dock" {...resize} />}
        </section>
      )}
      <nav className="dock-tabs" aria-label={OMP_TR("Tool dock")}>
        {DOCK_MEMBERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`dock-tab${active === id ? " active" : ""}`}
            aria-label={OMP_TR(label)}
            aria-pressed={active === id}
            title={OMP_TR(label)}
            onClick={() => onSelect(id)}
          >
            <span className="dock-tab-label">{OMP_TR(label)}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

Object.assign(window, { ToolDock });
