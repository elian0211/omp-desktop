/* activity-bar.jsx — VS Code–style activity bar + side panel host
   (docs/plans/2026-11-20-workspace-layout phase 1). Icons switch one side
   view; re-click collapses the panel. Hover shows a title bubble. */

const { Icon: _ActIcon } = window;
const { VIEWS: _ACT_VIEWS, selectView: _actSelect } = window.OMP_ACTIVITY;

function ActivityBar({ view, open, onChange }) {
  return (
    <nav className="activity-bar" aria-label={OMP_TR("Activity bar")}>
      {_ACT_VIEWS.map(item => {
        const title = OMP_TR(item.title);
        const active = open && view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`activity-btn${active ? " active" : ""}`}
            aria-label={title}
            aria-pressed={active}
            onClick={() => onChange(_actSelect({ view, open }, item.id))}
          >
            <_ActIcon name={item.icon} size={18} />
            <span className="activity-tip" role="tooltip">{title}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Host beside the activity bar: width `--w-sidebar`; one child view. */
function SidePanel({ open, children }) {
  if (!open) return null;
  return (
    <div className="side-panel" role="region" aria-label={OMP_TR("Side panel")}>
      {children}
    </div>
  );
}

/** Placeholder until Files / Session views land (phase 2). */
function SidePanelStub({ title, hint }) {
  return (
    <div className="side-panel-stub">
      <div className="psb-head">{title}</div>
      <div className="side-panel-stub-body">{hint}</div>
    </div>
  );
}

Object.assign(window, { ActivityBar, SidePanel, SidePanelStub });
