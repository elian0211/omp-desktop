/* chat/plan-pill.jsx — the live todo plan as one capsule pinned above the
   composer (bottom of the chat surface), max-width 860px. Data comes from
   the same kanban state as the full plan panel (adapter.js buildKanban of
   omp's todo phases); the summary math is app/plan-pill.js. Clicking opens
   the plan kanban. Renders nothing while the tab has no plan. */

const { Icon: _PP_Icon } = window;

const PlanPill = React.memo(function PlanPill({ kanban, onOpen }) {
  window.OMP_I18N.useLocale();
  const s = window.OMP_PLAN_PILL.summary(kanban);
  if (!s) return null;
  const focusText = s.current ?? s.next;
  return (
    <div className="plan-pill-row">
      <button
        type="button"
        className={`plan-pill selectable ${s.allDone ? "done" : ""}`}
        style={s.allDone ? {} : { "--plan-pill-pct": `${s.pct}%` }}
        title={OMP_TR("plan kanban")}
        onClick={onOpen}>
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
      </button>
    </div>
  );
});

Object.assign(window, { PlanPill });
