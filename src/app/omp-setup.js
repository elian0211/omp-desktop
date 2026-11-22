/* ═════════════════════════════════════════════════════════════════════
   app/omp-setup.js — the setup guide shown when no omp binary is found
   (boot check; design/omp-setup-modal.jsx reads window.OMP_OMP_SETUP).
   Pure helpers only.

   The desktop never installs omp: the modal shows the official install
   one-liner for the OS (omp.sh) and the npm package to copy into a
   terminal. Rust's `omp_locate` resolves per call, so an install takes
   effect on the modal's re-check without an app restart.
   Regression: test-omp-setup.mjs.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const SITE_URL = "https://omp.sh/";

  // The official install one-liners per platform: PowerShell on Windows,
  // the POSIX script on macOS and Linux. npm installs the same release and
  // works wherever a Node toolchain already exists.
  const SCRIPT_COMMANDS = {
    win: "irm omp.sh/install.ps1 | iex",
    mac: "curl -fsSL omp.sh/install | sh",
    linux: "curl -fsSL omp.sh/install | sh",
  };
  const NPM_COMMAND = "npm install -g @oh-my-pi/pi-coding-agent";

  // Unknown platforms fall back to the POSIX script.
  function normalizePlatform(platform) {
    return platform === "win" || platform === "mac" || platform === "linux" ? platform : "linux";
  }

  // The modal's copyable rows, in display order.
  function installCommands(platform) {
    const p = normalizePlatform(platform);
    return [
      { id: "script", command: SCRIPT_COMMANDS[p] },
      { id: "npm", command: NPM_COMMAND },
    ];
  }

  function installUrl() {
    return SITE_URL;
  }

  window.OMP_OMP_SETUP = Object.freeze({ normalizePlatform, installCommands, installUrl });
})();
