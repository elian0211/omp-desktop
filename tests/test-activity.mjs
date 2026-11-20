#!/usr/bin/env node
/** Regression for app/activity.js (activity bar select / collapse). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/app/activity.js"), "utf8");
const sandbox = { window: {}, console };
vm.runInNewContext(src, sandbox);
const A = sandbox.window.OMP_ACTIVITY;

function check(label, fn) {
  try { fn(); console.log(`  ok  ${label}`); }
  catch (e) { console.error(`  FAIL  ${label}`); throw e; }
}

console.log("activity:");
check("VIEWS has workspaces, files, session", () => {
  assert.equal(A.VIEWS.map(v => v.id).join(","), "workspaces,files,session");
});
check("DEFAULT opens workspaces", () => {
  assert.equal(A.DEFAULT.view, "workspaces");
  assert.equal(A.DEFAULT.open, true);
});
check("selectView opens a closed panel on the clicked view", () => {
  const next = A.selectView({ view: "workspaces", open: false }, "files");
  assert.equal(next.view, "files");
  assert.equal(next.open, true);
});
check("selectView switches view while keeping the panel open", () => {
  const next = A.selectView({ view: "workspaces", open: true }, "session");
  assert.equal(next.view, "session");
  assert.equal(next.open, true);
});
check("selectView re-click collapses (VS Code)", () => {
  const next = A.selectView({ view: "files", open: true }, "files");
  assert.equal(next.view, "files");
  assert.equal(next.open, false);
});
check("openView forces open without toggle", () => {
  const a = A.openView({ view: "files", open: false }, "workspaces");
  assert.equal(a.view, "workspaces");
  assert.equal(a.open, true);
  const b = A.openView({ view: "workspaces", open: true }, "workspaces");
  assert.equal(b.view, "workspaces");
  assert.equal(b.open, true);
});
console.log("activity: 6 checks passed");
