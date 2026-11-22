/* ═════════════════════════════════════════════════════════════════════
   app/omp-updater.js — omp update-check state for the status bar.
   Pure functions only. Rust (`omp_update.rs`) runs `omp --version` and
   `omp update --check`; the desktop never installs omp itself — the modal
   tells the user to run `omp update` in a terminal.

   Same check phases as app/updater.js (idle → checking → available |
   uptodate | error), without download/install transitions.
   Regression: test-omp-updater.mjs.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // Stagger after the desktop updater's first check so the two CLI/network
  // hits don't start together on launch.
  const STARTUP_DELAY_MS = 20 * 1000;
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const UPDATE_COMMAND = "omp update";

  const initialState = () => ({
    phase: "idle",
    update: null, // normalized info with an `available` version, or null
    error: null,
    /** Last known installed version (from version() or a check). */
    installed: null,
    /** Set when the install cannot self-update (Nix, managed app, …). */
    reason: null,
  });

  const str = (v) => (typeof v === "string" && v ? v : null);

  // `omp_update_check`'s payload → the shape the UI renders when a newer
  // release exists, or null when up to date / nothing to offer.
  function normalizeInfo(raw) {
    const available = str(raw?.available);
    if (!available) return null;
    return {
      version: available,
      installed: str(raw?.version),
      canUpdate: raw?.canUpdate === true,
      reason: str(raw?.reason),
    };
  }

  const isBusy = (state) => state.phase === "checking";

  function reduce(state, action) {
    switch (action?.type) {
      case "version": {
        const installed = str(action.version);
        return installed ? { ...state, installed } : state;
      }

      case "check-start":
        if (isBusy(state)) return state;
        return { ...state, phase: "checking", error: null };

      case "check-done": {
        if (state.phase !== "checking") return state;
        const installed = str(action.info?.version) || state.installed;
        const update = normalizeInfo(action.info);
        const reason =
          action.info?.canUpdate === false ? str(action.info?.reason) : null;
        return {
          ...state,
          phase: update ? "available" : "uptodate",
          update,
          installed: installed ?? state.installed,
          reason,
          error: null,
        };
      }

      case "check-failed":
        if (state.phase !== "checking") return state;
        return {
          ...state,
          phase: state.update ? "available" : "error",
          error: String(action.error ?? "omp update check failed"),
        };

      default:
        return state;
    }
  }

  function pillVersion(state, skippedVersion) {
    const version = state.update?.version;
    return version && version !== skippedVersion ? version : null;
  }

  window.OMP_OMP_UPDATER = Object.freeze({
    STARTUP_DELAY_MS,
    CHECK_INTERVAL_MS,
    UPDATE_COMMAND,
    initialState,
    normalizeInfo,
    reduce,
    isBusy,
    pillVersion,
  });
})();
