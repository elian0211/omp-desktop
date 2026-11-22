/* app/use-omp-setup.jsx — the setup guide's state: one `omp_locate` check
   at boot, re-checks from the modal's button. A missing omp opens the
   modal; finding it closes it (and a dismissed modal stays dismissed until
   the re-check finds something changed). No timer, no tweak — unlike the
   update checks this only runs when omp is absent. */

const OMP_SETUP_S = window.OMP_OMP_SETUP;

function useOmpSetup() {
  const [phase, setPhase] = React.useState("checking"); // checking | missing | found
  const [dismissed, setDismissed] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(null);

  const platform = React.useMemo(() => {
    const ua = navigator.userAgent;
    return ua.includes("Windows") ? "win" : ua.includes("Mac") ? "mac" : "linux";
  }, []);

  const check = React.useCallback(async () => {
    setPhase("checking");
    let path = null;
    try {
      path = await window.__TAURI__.core.invoke("omp_locate");
    } catch (err) {
      console.warn("[omp-setup] omp_locate failed:", err);
    }
    setPhase(path ? "found" : "missing");
    return Boolean(path);
  }, []);

  // The boot check. omp is normally present: the resolve is a few filesystem
  // lookups, and a `found` result renders nothing.
  React.useEffect(() => { check(); }, [check]);

  const copyCommand = React.useCallback(async (id, command) => {
    const ok = await window.copyText(command);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    }
  }, []);

  return {
    phase,
    checking: phase === "checking",
    // `found` closes a dismissed-or-open modal; `dismissed` only mutes an
    // unresolved `missing`.
    open: phase === "missing" && !dismissed,
    platform,
    commands: OMP_SETUP_S.installCommands(platform),
    siteUrl: OMP_SETUP_S.installUrl(),
    recheck: check,
    close: React.useCallback(() => setDismissed(true), []),
    copyCommand,
    copiedId,
  };
}

Object.assign(window, { useOmpSetup });
