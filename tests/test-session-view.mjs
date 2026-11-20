#!/usr/bin/env node
/** Regression for app/session-view.js (Session activity view accordion). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// session-view.js builds on OMP_SESSION_UI's map helpers: load both.
const uiSrc = fs.readFileSync(path.join(root, "src/app/session-ui.js"), "utf8");
const src = fs.readFileSync(path.join(root, "src/app/session-view.js"), "utf8");
const sandbox = { window: {}, console };
vm.runInNewContext(uiSrc, sandbox);
vm.runInNewContext(src, sandbox);
const SV = sandbox.window.OMP_SESSION_VIEW;

function check(label, fn) {
  try { fn(); console.log(`  ok  ${label}`); }
  catch (e) { console.error(`  FAIL  ${label}`); throw e; }
}

console.log("session-view:");
check("every section starts expanded", () => {
  const st = SV.stateOfTab({}, "t1");
  for (const s of SV.SECTIONS) assert.equal(st[s], true, s);
});
check("stateOfTab without a tab id falls back to the default", () => {
  assert.equal(SV.stateOfTab({}, null), SV.IDLE);
});
check("toggle flips only the given section and tab", () => {
  const next = SV.toggle({}, "t1", "radar");
  assert.equal(next.t1.radar, false);
  assert.equal(next.t1.context, true);
  // Back at the default, the tab's entry drops and the state reads default.
  const again = SV.toggle(next, "t1", "radar");
  assert.equal(Object.hasOwn(again, "t1"), false);
  assert.equal(SV.stateOfTab(again, "t1").radar, true);
});
check("a folded section survives toggling another section", () => {
  const one = SV.toggle(SV.toggle({}, "t1", "minimap"), "t1", "radar");
  assert.equal(one.t1.minimap, false);
  assert.equal(one.t1.radar, false);
});
check("prune drops closed tabs, keeps open ones", () => {
  const m = SV.toggle(SV.toggle({}, "a", "context"), "b", "radar");
  const pruned = SV.prune(m, ["b"]);
  assert.equal(Object.hasOwn(pruned, "a"), false);
  assert.equal(pruned.b.radar, false);
});
check("prune with nothing to drop returns the same reference", () => {
  const m = SV.toggle({}, "a", "context");
  assert.equal(SV.prune(m, ["a"]), m);
});
console.log("session-view: 6 checks passed");
