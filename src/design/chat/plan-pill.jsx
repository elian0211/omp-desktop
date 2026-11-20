/* chat/plan-pill.jsx — the live todo plan as one capsule pinned above the
   composer (bottom of the chat surface), max-width 860px. Data is omp's
   raw todo phases (same shape as ompweb's TodoList) — not the kanban remap.
   Clicking expands the phase/task list upward above the capsule; clicking
   again collapses it. Renders nothing while the tab has no plan. */

const { Icon: _PP_Icon } = window;

function PlanStatusIcon({ status }) {
  if (status === "completed")   return <_PP_Icon name="check"  size={12} color="var(--accent)" />;
  if (status === "in_progress") return <_PP_Icon name="live"   size={12} color="var(--accent)" />;
  if (status === "blocked")     return <_PP_Icon name="warn"   size={12} color="var(--fg-3)" />;
  if (status === "abandoned")   return <_PP_Icon name="stop"   size={12} color="var(--fg-4)" />;
  return <_PP_Icon name="circle" size={12} color="var(--fg-4)" />;
}

const PlanPill = React.memo(function PlanPill({ phases, expanded, onToggle }) {
  window.OMP_I18N.useLocale();
  const rootRef = React.useRef(null);
  const [showAll, setShowAll] = React.useState(false);
  // Must stay above the early return: a first render with no plan used to
  // skip this hook, then a later plan tripped "Rendered more hooks".
  React.useEffect(() => {
    if (!expanded) setShowAll(false);
  }, [expanded]);
  // Same dismiss as thinking/profile menus: click outside or Escape.
  window.usePopoverDismiss(!!expanded, rootRef, () => { if (expanded) onToggle(); });

  const s = window.OMP_PLAN_PILL.summary(phases);
  if (!s) return null;

  const focusText = s.current ?? s.next;
  const displayed = expanded
    ? window.OMP_PLAN_PILL.previewPhases(phases, showAll)
    : [];
  // Preview budget is 5 tasks (ompweb TodoList); offer show-all whenever
  // the plan is longer than that, including after the user already expanded.
  const canToggleAll = s.total > window.OMP_PLAN_PILL.PREVIEW_TASKS;
  const truncated = expanded && window.OMP_PLAN_PILL.isTruncated(phases, displayed);

  return (
    <div className="plan-pill-row" ref={rootRef}>
      {expanded && (
        <div className="plan-pill-expand" role="dialog" aria-label={OMP_TR("tasks")}>
          <div
            className="plan-pill-panel"
            role="group"
            aria-label={OMP_TR("task list")}
            tabIndex={0}>
            {displayed.map(phase => (
              <div key={phase.id} className="plan-pill-phase">
                {phase.name && <div className="plan-pill-phase-name">{phase.name}</div>}
                <div className="plan-pill-tasks">
                  {phase.tasks.map((task, ti) => {
                    const dim = task.status === "completed" || task.status === "abandoned";
                    return (
                      <div
                        key={task.id ?? `${task.content}-${ti}`}
                        className="plan-pill-task-row"
                        aria-label={`${task.status}: ${task.content}`}>
                        <span className="plan-pill-task-icon"><PlanStatusIcon status={task.status} /></span>
                        <span className="plan-pill-task-body">
                          <span className={dim ? "plan-pill-task-dim" : undefined}>{task.content}</span>
                          {task.blocker && (
                            <span className="plan-pill-blocker">
                              {OMP_TR("Blocked: {blocker}", { blocker: task.blocker })}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {canToggleAll && (truncated || showAll) && (
            <button
              type="button"
              className="plan-pill-more"
              onClick={e => { e.stopPropagation(); setShowAll(v => !v); }}>
              {showAll ? OMP_TR("Show fewer tasks") : OMP_TR("Show all tasks")}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className={`plan-pill selectable ${s.allDone ? "done" : ""}${expanded ? " open" : ""}`}
        style={s.allDone ? {} : { "--plan-pill-pct": `${s.pct}%` }}
        title={expanded ? OMP_TR("collapse") : OMP_TR("expand")}
        aria-expanded={expanded}
        onClick={onToggle}>
        <_PP_Icon name="plan" size={12} color={s.allDone ? "var(--lime)" : "var(--accent)"} />
        <span className="plan-pill-count mono">{s.done}/{s.total}</span>
        {s.allDone
          ? <span className="plan-pill-task">{OMP_TR("plan complete ·")}</span>
          : focusText
            ? <span className="plan-pill-task">{focusText}</span>
            : <span className="plan-pill-task" style={{ color: "var(--fg-3)" }}>{s.phaseTitle}</span>}
        <span className="plan-pill-bar" aria-hidden="true">
          <span className="plan-pill-bar-fill" style={{ width: `${s.pct}%` }} />
        </span>
        <_PP_Icon
          name="chev"
          size={11}
          color="var(--fg-4)"
          style={{
            flex: "none",
            transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 160ms var(--ease-out)",
          }}
        />
      </button>
    </div>
  );
});

Object.assign(window, { PlanPill });
