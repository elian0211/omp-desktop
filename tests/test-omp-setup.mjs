import assert from "node:assert";
import { readFileSync } from "node:fs";

// Load the IIFE the way the app does: evaluate it, read window.OMP_OMP_SETUP.
const src = readFileSync(new URL("../src/app/omp-setup.js", import.meta.url), "utf8");
const window = {};
new Function("window", src)(window);
const S = window.OMP_OMP_SETUP;

// normalizePlatform: known ids pass, unknown/undefined fall back to the
// POSIX script (the app only ever sends win/mac/linux).
for (const p of ["win", "mac", "linux"]) assert.equal(S.normalizePlatform(p), p);
assert.equal(S.normalizePlatform("win32"), "linux");
assert.equal(S.normalizePlatform(undefined), "linux");
assert.equal(S.normalizePlatform(""), "linux");

// The platform script command is first, npm second, in every row set.
const rows = S.installCommands("win");
assert.deepEqual(rows.map((r) => r.id), ["script", "npm"]);
assert.equal(rows[0].command, "irm omp.sh/install.ps1 | iex");
assert.equal(S.installCommands("mac")[0].command, "curl -fsSL omp.sh/install | sh");
assert.equal(S.installCommands("linux")[0].command, S.installCommands("mac")[0].command);
assert.match(rows[1].command, /@oh-my-pi\/pi-coding-agent/);

// Every command is a single copyable line: no line breaks a terminal would
// split, and none embeds a trailing shell hazard.
for (const r of rows) {
  assert.ok(!r.command.includes("\n"), "commands copy as one line");
  assert.equal(r.command, r.command.trim());
}

// The site URL is https (navigation_guard::open_external checks the scheme).
assert.equal(S.installUrl(), "https://omp.sh/");

console.log("test-omp-setup: ok");
