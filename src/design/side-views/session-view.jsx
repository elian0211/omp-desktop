/* ═════════════════════════════════════════════════════════════════════
   side-views/session-view.jsx — the Session activity view in the side
   panel (docs/plans/2026-11-20-workspace-layout/phase-2-side-views.md):
   the per-tab tools that used to be right-rail cards, as one accordion —
   Context (token gauge + sparkline), agent radar, Subagents, Minimap,
   PR Changes and Extensions (omp setStatus/setWidget cards). Sections a
   Settings → Rail toggle hides are not rendered; the rest collapse via
   OMP_SESSION_VIEW (app/session-view.js), per tab, in memory.

   Props:
     tabId, show     — the tab id and the Settings → Rail flags
                       { context, radar, subagents, minimap, changes }
     folds, onToggleFold — the per-tab collapse map (OMP_SESSION_VIEW) and
                       its `section → toggle` handler, owned by app-live
     ctx, sparklineValues, activity — context / radar data
     subagents, subagentPaneOpen, onOpenSubagent, onToggleSubagentPane
     messages, hoveredMsgIdx, onMinimapHover, onMinimapClick
     prAutomation, prAvailable      — the PR card's hook state and gate
     bridge                         — the PR card's dispatch
     extCards, onWidgetInsert       — extension cards (WidgetCard props)
   ═════════════════════════════════════════════════════════════════════ */
const {
  ContextCard: _SV_Context, RadarCard: _SV_Radar, MinimapCard: _SV_Minimap,
  SubagentRailCard: _SV_Subagents, PrAutomationCard: _SV_Changes,
  WidgetBoundary: _SV_Boundary, WidgetCard: _SV_WidgetCard,
} = window;
const { stateOfTab: _SV_state, toggle: _SV_toggle } = window.OMP_SESSION_VIEW;

function _SV_Section({ id, title, open, onToggle, children }) {
  return (
    <section className={`sv-section rail-card glass${open ? "" : " closed"}`}>
      <button type="button" className="sv-head" aria-expanded={open} onClick={onToggle}>
        <span className="mono">{title}</span>
        <span className={`sv-caret${open ? "" : " folded"}`} aria-hidden="true" />
      </button>
      {open && <div className="sv-body">{children}</div>}
    </section>
  );
}

function SessionView(props) {
  const {
    tabId, show, folds, onToggleFold, ctx, sparklineValues, activity,
    subagents, subagentPaneOpen, onOpenSubagent, onToggleSubagentPane,
    messages, hoveredMsgIdx, onMinimapHover, onMinimapClick,
    prAutomation, prAvailable, bridge,
    extCards, onWidgetInsert,
  } = props;
  const state = _SV_state(folds, tabId);
  return (
    <div className="sv-view" aria-label={OMP_TR("session tools")}>
      {show.context !== false && (
        <_SV_Section id="context" title={OMP_TR("context")} open={state.context} onToggle={() => onToggleFold("context")}>
          <_SV_Context ctx={ctx} sparkValues={sparklineValues} />
        </_SV_Section>
      )}
      {show.radar !== false && (
        <_SV_Section id="radar" title={OMP_TR("agent radar")} open={state.radar} onToggle={() => onToggleFold("radar")}>
          <_SV_Radar activity={activity} tps={ctx.tokensPerSec} flat />
        </_SV_Section>
      )}
      {show.subagents !== false && (
        <_SV_Section id="subagents" title={OMP_TR("subagents")} open={state.subagents} onToggle={() => onToggleFold("subagents")}>
          <_SV_Subagents agents={subagents} paneOpen={subagentPaneOpen}
            onOpen={onOpenSubagent} onTogglePane={onToggleSubagentPane} />
        </_SV_Section>
      )}
      {show.changes !== false && (
        <_SV_Section id="changes" title={OMP_TR("changes")} open={state.changes} onToggle={() => onToggleFold("changes")}>
          {/* Hidden without the GitHub CLI; the hook keeps checking on
              focus, so installing gh brings it back. */}
          <_SV_Changes key={tabId} automation={prAutomation} bridge={bridge} available={prAvailable} />
        </_SV_Section>
      )}
      {show.minimap !== false && (
        <_SV_Section id="minimap" title={OMP_TR("minimap")} open={state.minimap} onToggle={() => onToggleFold("minimap")}>
          <_SV_Minimap flat messages={messages} hoveredIdx={hoveredMsgIdx}
            onHover={onMinimapHover} onClick={onMinimapClick} />
        </_SV_Section>
      )}
      {extCards.length > 0 && (
        <_SV_Section id="extensions" title={OMP_TR("extensions")} open={state.extensions} onToggle={() => onToggleFold("extensions")}>
          {extCards.map(c => (
            <_SV_Boundary key={c.id} title={c.title} resetKey={c.run}>
              <_SV_WidgetCard title={c.title} run={c.run} source="extension" onInsert={onWidgetInsert} />
            </_SV_Boundary>
          ))}
        </_SV_Section>
      )}
    </div>
  );
}

Object.assign(window, { SessionView });
