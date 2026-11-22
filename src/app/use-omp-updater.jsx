/* app/use-omp-updater.jsx — drives the omp update check: the
   app/omp-updater.js reducer, the background check timer, and whether the
   omp update modal is open. `autoCheck` shares the desktop's `updateCheck`
   tweak; `skipped` is `skippedOmpUpdate`.

   A background check never opens anything — a found update only surfaces
   as the status-bar pill. A manual check (the status-bar omp version label)
   opens the modal so "checking…" / "up to date" / the error are visible.
   The desktop never runs `omp update`; the modal copies that command. */

const OMP_U = window.OMP_OMP_UPDATER;

function useOmpUpdater({ bridge, autoCheck, skipped, setTweak }) {
  const [state, dispatch] = React.useReducer(OMP_U.reduce, undefined, OMP_U.initialState);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    if (!bridge) return undefined;
    let cancelled = false;
    bridge.ompVersion().then((res) => {
      if (cancelled) return;
      if (res?.ok && res.value) dispatch({ type: "version", version: res.value });
    });
    return () => { cancelled = true; };
  }, [bridge]);

  const runCheck = React.useCallback(async (manual) => {
    if (manual) setOpen(true);
    if (!bridge || OMP_U.isBusy(stateRef.current)) return;
    dispatch({ type: "check-start" });
    const res = await bridge.checkOmpUpdate();
    dispatch(res.ok
      ? { type: "check-done", info: res.value }
      : { type: "check-failed", error: res.error });
    if (!res.ok && !manual) console.warn("[omp-updater] background check failed:", res.error);
  }, [bridge]);

  const check = React.useCallback(() => { runCheck(true); }, [runCheck]);

  React.useEffect(() => {
    if (!autoCheck || !bridge) return undefined;
    const first = setTimeout(() => runCheck(false), OMP_U.STARTUP_DELAY_MS);
    const every = setInterval(() => runCheck(false), OMP_U.CHECK_INTERVAL_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [autoCheck, bridge, runCheck]);

  const skip = React.useCallback(() => {
    const v = stateRef.current.update?.version;
    if (v) setTweak("skippedOmpUpdate", v);
    setOpen(false);
  }, [setTweak]);

  const clearSkipped = React.useCallback(() => setTweak("skippedOmpUpdate", null), [setTweak]);

  const copyCommand = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(OMP_U.UPDATE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("[omp-updater] copy failed:", err);
    }
  }, []);

  return {
    state,
    version: state.installed,
    open,
    pillVersion: OMP_U.pillVersion(state, skipped),
    openModal: React.useCallback(() => setOpen(true), []),
    close: React.useCallback(() => setOpen(false), []),
    check,
    skip,
    clearSkipped,
    copyCommand,
    copied,
    updateCommand: OMP_U.UPDATE_COMMAND,
  };
}

Object.assign(window, { useOmpUpdater });
