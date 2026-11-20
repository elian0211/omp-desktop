/* chat/process-details.jsx — collapsed "Process details" toggle for a
   turn's folded tool/thinking activity (ompweb ProcessDetailsGroup).
   Counts come from OMP_PROCESS_DETAILS; children render only when open. */

const { Icon: _PD_Icon } = window;

function ProcessDetailsGroup({ messageCount, toolCallCount, children }) {
  window.OMP_I18N.useLocale();
  const [expanded, setExpanded] = React.useState(false);
  const parts = [
    OMP_TR("Process details"),
    OMP_I18N.plural(messageCount, "{n} message", "{n} messages"),
  ];
  if (toolCallCount > 0) {
    parts.push(OMP_I18N.plural(toolCallCount, "{n} tool call", "{n} tool calls"));
  }
  return (
    <div className="process-details">
      <button
        type="button"
        className="process-details-toggle"
        aria-expanded={expanded}
        title={expanded ? OMP_TR("Collapse process details") : OMP_TR("Expand process details")}
        onClick={() => setExpanded((v) => !v)}
      >
        <_PD_Icon name="layers" size={12} color="var(--accent)" />
        <_PD_Icon
          name="chev"
          size={12}
          color="currentColor"
          style={{
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.12s ease",
          }}
        />
        <span className="process-details-label">{parts.join(" · ")}</span>
      </button>
      {expanded && (
        <div className="process-details-body">
          {typeof children === "function" ? children() : children}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProcessDetailsGroup });
