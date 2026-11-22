/* ═════════════════════════════════════════════════════════════════════
   design/settings/rows-session.jsx — Settings → Session's custom `version`
   row (window.OMP_SETTINGS_ROWS): the running OMP Desktop and omp versions
   and what the last update checks found (ctx.updater / ctx.ompUpdater),
   "Check now" for each (opens the matching update modal), and any release
   skipped from those modals with "Clear", so the status-bar pills offer
   them again.
   ═════════════════════════════════════════════════════════════════════ */

/** What the last desktop check found, as a short phrase ("" before any). */
function _SRS_phase(state) {
  switch (state.phase) {
    case "checking": return OMP_TR("checking…");
    case "uptodate": return OMP_TR("up to date");
    case "available": return state.update ? OMP_TR("`{version}` available", { version: state.update.version }) : "";
    case "downloading": return OMP_TR("downloading the update…");
    case "restarting": return OMP_TR("restarting…");
    case "error": return OMP_TR("the last check failed");
    default: return "";
  }
}

/** What the last omp check found (no download/install phases). */
function _SRS_ompPhase(state) {
  switch (state.phase) {
    case "checking": return OMP_TR("checking…");
    case "uptodate": return state.reason ? OMP_TR("cannot self-update") : OMP_TR("up to date");
    case "available": return state.update ? OMP_TR("`{version}` available", { version: state.update.version }) : "";
    case "error": return OMP_TR("the last check failed");
    default: return "";
  }
}

// The schema desc is search text only: the shown desc is the runtime state.
function _SRS_Version({ row, ctx, query }) {
  const { SettingsRow: Row, SettingsButton: Button, Icon } = window;
  const { updater, ompUpdater } = ctx;
  const skipped = ctx.t.skippedUpdate ?? null;
  const skippedOmp = ctx.t.skippedOmpUpdate ?? null;
  const desktopPhase = _SRS_phase(updater.state);
  const ompPhase = ompUpdater ? _SRS_ompPhase(ompUpdater.state) : "";
  const desc = [
    `OMP Desktop \`${updater.version ?? "…"}\``,
    desktopPhase,
    skipped ? `${OMP_TR("skipped")} \`${skipped}\`` : "",
    ompUpdater ? `omp \`${ompUpdater.version ?? "…"}\`` : "",
    ompPhase,
    skippedOmp ? `${OMP_TR("skipped")} \`${skippedOmp}\`` : "",
  ].filter(Boolean).join(" · ");
  return (
    <Row label={row.label} desc={desc} query={query}>
      <div className="st-btns">
        {skipped && (
          <Button onClick={updater.clearSkipped} title={OMP_TR("offer {version} again", { version: skipped })}>{OMP_TR("Clear skipped")}</Button>
        )}
        <Button onClick={updater.check} disabled={window.OMP_UPDATER.isBusy(updater.state)}>
          <Icon name="refresh" size={11} />{OMP_TR("Check desktop")}
        </Button>
        {skippedOmp && ompUpdater && (
          <Button onClick={ompUpdater.clearSkipped} title={OMP_TR("offer {version} again", { version: skippedOmp })}>{OMP_TR("Clear skipped")}</Button>
        )}
        {ompUpdater && (
          <Button onClick={ompUpdater.check} disabled={window.OMP_OMP_UPDATER.isBusy(ompUpdater.state)}>
            <Icon name="refresh" size={11} />{OMP_TR("Check omp")}
          </Button>
        )}
      </div>
    </Row>
  );
}

Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {}, { version: _SRS_Version });
