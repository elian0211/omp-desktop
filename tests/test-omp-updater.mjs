#!/usr/bin/env node
// Regression script for src/app/omp-updater.js — omp update-check state for
// the status bar: check lifecycle, pill visibility, unsupported installs.
// Run: node tests/test-omp-updater.mjs  (or: npm run test:omp-updater)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
// eslint-disable-next-line no-new-func
new Function("window", readFileSync(join(root, "src/app/omp-updater.js"), "utf8"))(win);
const U = win.OMP_OMP_UPDATER;

let passed = 0;
function check(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`FAILED: ${label}`);
    throw err;
  }
  passed++;
}

const INFO = {
  version: "18.19.0",
  available: "18.20.0",
  canUpdate: true,
  reason: null,
};
const run = (...actions) => actions.reduce(U.reduce, U.initialState());
const available = (info = INFO) =>
  run({ type: "check-start" }, { type: "check-done", info });

check("a found update lands in available with the normalized info", () => {
  const s = available();
  assert.equal(s.phase, "available");
  assert.equal(s.update.version, "18.20.0");
  assert.equal(s.update.installed, "18.19.0");
  assert.equal(s.update.canUpdate, true);
  assert.equal(s.installed, "18.19.0");
});

check("a null available means up to date", () => {
  const s = run(
    { type: "check-start" },
    { type: "check-done", info: { version: "18.20.0", available: null, canUpdate: true } },
  );
  assert.equal(s.phase, "uptodate");
  assert.equal(s.update, null);
  assert.equal(s.installed, "18.20.0");
  assert.equal(s.reason, null);
});

check("canUpdate must be literally true", () => {
  const s = available({ ...INFO, canUpdate: "yes" });
  assert.equal(s.update.canUpdate, false);
});

check("an unsupported install keeps the reason when up to date", () => {
  const s = run(
    { type: "check-start" },
    {
      type: "check-done",
      info: {
        version: "18.20.0",
        available: null,
        canUpdate: false,
        reason: "managed by Nix",
      },
    },
  );
  assert.equal(s.phase, "uptodate");
  assert.equal(s.reason, "managed by Nix");
  assert.equal(U.pillVersion(s, null), null);
});

check("a failed check with nothing known is an error", () => {
  const s = run({ type: "check-start" }, { type: "check-failed", error: "offline" });
  assert.equal(s.phase, "error");
  assert.equal(s.error, "offline");
});

check("a failed re-check keeps the update an earlier check found", () => {
  const s = [{ type: "check-start" }, { type: "check-failed", error: "offline" }].reduce(
    U.reduce,
    available(),
  );
  assert.equal(s.phase, "available");
  assert.equal(s.update.version, "18.20.0");
  assert.equal(s.error, "offline");
});

check("a successful up-to-date re-check drops the earlier update", () => {
  const s = [
    { type: "check-start" },
    { type: "check-done", info: { version: "18.20.0", available: null, canUpdate: true } },
  ].reduce(U.reduce, available());
  assert.equal(s.phase, "uptodate");
  assert.equal(s.update, null);
  assert.equal(U.pillVersion(s, null), null);
});

check("a check result arriving outside a check is ignored", () => {
  const s = U.reduce(U.initialState(), { type: "check-done", info: INFO });
  assert.equal(s.phase, "idle");
  assert.equal(s.update, null);
});

check("no second check starts while one is running", () => {
  const checking = U.reduce(U.initialState(), { type: "check-start" });
  assert.equal(U.reduce(checking, { type: "check-start" }), checking);
  assert.equal(U.isBusy(checking), true);
});

check("pill hides a skipped version and shows a newer one", () => {
  const s = available();
  assert.equal(U.pillVersion(s, null), "18.20.0");
  assert.equal(U.pillVersion(s, "18.20.0"), null);
  const newer = available({ ...INFO, available: "18.21.0" });
  assert.equal(U.pillVersion(newer, "18.20.0"), "18.21.0");
});

check("version action records the installed version without a check", () => {
  const s = U.reduce(U.initialState(), { type: "version", version: "18.20.0" });
  assert.equal(s.installed, "18.20.0");
  assert.equal(s.phase, "idle");
});

check("UPDATE_COMMAND is the shell hint the modal copies", () => {
  assert.equal(U.UPDATE_COMMAND, "omp update");
});

console.log(`ok — ${passed} checks passed`);
