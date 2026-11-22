/* ═════════════════════════════════════════════════════════════════════
   omp-setup-modal.jsx — first-run guide when no `omp` binary is found
   (boot check; app/use-omp-setup.jsx drives it). Same chrome as
   omp-update-modal.jsx: copyable install commands for a terminal and the
   official site in the default browser. The desktop never installs omp
   itself, and `omp_locate` resolves per run — the modal's re-check picks a
   fresh install up without an app restart.
   ═════════════════════════════════════════════════════════════════════ */

const { Icon: _SetupIcon } = window;

function OmpSetupModal({ ompSetup }) {
  const { checking, close, recheck, copyCommand, copiedId, commands, siteUrl } = ompSetup;
  const panelRef = React.useRef(null);

  window.useModalFocus(panelRef);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.stopPropagation();
      if (e.key === "Escape") {
        close();
      } else if (!panelRef.current?.contains(e.target)) {
        e.preventDefault();
        panelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const openSite = () =>
    window.__TAURI__.core.invoke("open_url_external", { url: siteUrl })
      .catch((err) => console.warn("[omp-setup] open_url_external failed:", err));

  return (
    <div className="bridge-scrim" onClick={close} style={{ paddingTop: "12vh" }}>
      <div className="update-panel" ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="update-head">
          <_SetupIcon name="agent" size={13} color="var(--accent)" />
          <span className="mono" style={{ color: "var(--fg-2)" }}>{OMP_TR("setup · omp")}</span>
          <button className="btn icon ghost" style={{ marginLeft: "auto" }} title={OMP_TR("check again")}
            onClick={recheck} disabled={checking}>
            <_SetupIcon name="refresh" size={11} />
          </button>
          <button className="btn icon ghost" onClick={close} title={OMP_TR("close")}>
            <_SetupIcon name="close" size={11} />
          </button>
        </div>

        <div className="update-body">
          <div className="update-hint">
            {OMP_TR("OMP Desktop needs the omp command-line agent, but it isn't installed or can't be found on PATH. Install it with one of these commands, then check again — no restart needed.")}
          </div>
          {commands.map(({ id, command }) => (
            <div key={id} className="update-hint mono">
              <div style={{ color: "var(--fg-4)", marginBottom: 4 }}>
                {id === "script" ? OMP_TR("official install script") : OMP_TR("or with npm")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, overflowWrap: "anywhere" }}>{command}</span>
                <button className="btn ghost" style={{ height: 20, padding: "0 8px", flex: "none" }}
                  onClick={() => copyCommand(id, command)}>
                  {copiedId === id ? OMP_TR("copied") : OMP_TR("copy")}
                </button>
              </div>
            </div>
          ))}
          {checking && <div className="panel-empty mono">{OMP_TR("checking for updates…")}</div>}
        </div>

        <div className="update-foot">
          <button className="btn ghost" onClick={openSite} title={siteUrl}>
            <_SetupIcon name="external" size={11} />
            {OMP_TR("official website")}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={close}>{OMP_TR("later")}</button>
          <button className="btn primary" onClick={recheck} disabled={checking}>
            {OMP_TR("check again")}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OmpSetupModal });
