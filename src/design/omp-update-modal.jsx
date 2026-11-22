/* ═════════════════════════════════════════════════════════════════════
   omp-update-modal.jsx — omp update check (status-bar omp version).

   Props: { ompUpdater }
     ompUpdater — result of useOmpUpdater(); closing is `ompUpdater.close`.

   The desktop never installs omp: when a newer release is available the
   primary action copies `omp update` for a terminal. Managed installs
   (Nix, another app) only show omp's reason.
   ═════════════════════════════════════════════════════════════════════ */

const { Icon: _OmpUpdIcon } = window;

function OmpUpdateModal({ ompUpdater }) {
  const U = window.OMP_OMP_UPDATER;
  const { state, version, close, updateCommand, copied } = ompUpdater;
  const { phase, update, error, reason } = state;
  const panelRef = React.useRef(null);
  const checking = phase === "checking";

  window.useModalFocus(panelRef);

  React.useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (!panelRef.current?.contains(e.target)) {
        e.preventDefault();
        panelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const showOffer = !!update;
  const canCopy = showOffer && update.canUpdate !== false;

  return (
    <div className="bridge-scrim" onClick={close} style={{ paddingTop: "12vh" }}>
      <div className="update-panel" ref={panelRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="update-head">
          <_OmpUpdIcon name="arrowUp" size={13} color="var(--accent)" />
          <span className="mono" style={{ color: "var(--fg-2)" }}>
            {OMP_TR("updates · omp")} {version ? `v${version}` : ""}
          </span>
          <button className="btn icon ghost" style={{ marginLeft: "auto" }} title={OMP_TR("check again")}
            onClick={ompUpdater.check} disabled={U.isBusy(state)}>
            <_OmpUpdIcon name="refresh" size={11} />
          </button>
          <button className="btn icon ghost" onClick={close} title={OMP_TR("close")}>
            <_OmpUpdIcon name="close" size={11} />
          </button>
        </div>

        <div className="update-body">
          {phase === "idle" && <div className="panel-empty mono">{OMP_TR("not checked yet")}</div>}
          {checking && !update && <div className="panel-empty mono">{OMP_TR("checking for updates…")}</div>}
          {phase === "uptodate" && !reason && (
            <div className="panel-empty mono">{OMP_TR("you're on the latest version")}</div>
          )}
          {phase === "uptodate" && reason && (
            <div className="update-hint mono">{reason}</div>
          )}
          {phase === "error" && <div className="panel-empty mono update-error">{error}</div>}

          {showOffer && (
            <>
              <div className="update-title">
                <span className="mono" style={{ color: "var(--accent)" }}>v{update.version}</span>
                <span className="mono" style={{ color: "var(--fg-4)" }}>{OMP_TR("available")}</span>
              </div>
              {canCopy ? (
                <div className="update-hint mono">
                  {OMP_TR("Run `{cmd}` in a terminal, then restart any open tabs so they pick up the new omp.", { cmd: updateCommand })}
                </div>
              ) : (
                <div className="update-hint mono">
                  {update.reason || reason || OMP_TR("This omp install cannot update itself.")}
                </div>
              )}
              {error && <div className="update-error mono">{error}</div>}
            </>
          )}
        </div>

        {showOffer && (
          <div className="update-foot">
            <button className="btn ghost" onClick={ompUpdater.skip} title={OMP_TR("hide the notice until a newer version")}>{OMP_TR("skip this version")}</button>
            <div style={{ flex: 1 }} />
            <button className="btn ghost" onClick={close}>{OMP_TR("later")}</button>
            {canCopy && (
              <button className="btn primary" onClick={ompUpdater.copyCommand}>
                {copied ? OMP_TR("copied") : OMP_TR("copy `{cmd}`", { cmd: updateCommand })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { OmpUpdateModal });
