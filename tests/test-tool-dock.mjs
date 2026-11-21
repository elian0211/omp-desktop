#!/usr/bin/env node
// Regression script for src/app/tool-dock.js — the right tool dock's state
// (project-dock-layout phase 2): tab select / re-click collapse, the
// preview trigger's File selection, pane close keeping the tab.
// Run: node tests/test-tool-dock.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root  = join(dirname(fileURLToPath(import.meta.url)), "..");
const src   = readFileSync(join(root, "src/app/tool-dock.js"), "utf8");
const win   = {};
// eslint-disable-next-line no-new-func
new Function("window", src)(win);
const D = win.OMP_TOOL_DOCK;

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

const closed = { tab: null, open: false };

check("membership is file then session in phase 2", () => {
  assert.deepEqual(D.MEMBERS, ["file", "session"]);
});

check("a fresh dock shows no pane", () => {
  assert.equal(D.isOpen(closed), false);
  assert.equal(D.tabOf(closed), null);
});

check("select opens the pane on the picked tab", () => {
  const next = D.select(closed, "session");
  assert.deepEqual(next, { tab: "session", open: true });
  assert.equal(D.tabOf(next), "session");
});

check("re-clicking the active tab collapses, keeping the tab", () => {
  const next = D.select({ tab: "file", open: true }, "file");
  assert.deepEqual(next, { tab: "file", open: false });
  assert.equal(D.isOpen(next), false);
});

check("switching tabs keeps the pane open", () => {
  assert.deepEqual(D.select({ tab: "file", open: true }, "session"), { tab: "session", open: true });
});

check("re-click on a collapsed pane reopens it on its tab", () => {
  assert.deepEqual(D.select({ tab: "file", open: false }, "file"), { tab: "file", open: true });
});

check("a preview trigger selects File from any state", () => {
  assert.deepEqual(D.openFile(closed), { tab: "file", open: true });
  assert.deepEqual(D.openFile({ tab: "session", open: true }), { tab: "file", open: true });
  // Already on an open File pane: nothing changes (no needless re-render).
  const file = { tab: "file", open: true };
  assert.equal(D.openFile(file), file);
});

check("close collapses but remembers the tab", () => {
  const next = D.close({ tab: "session", open: true });
  assert.deepEqual(next, { tab: "session", open: false });
  // `tabOf` reports the *visible* tab; the remembered one is `.tab`.
  assert.equal(next.tab, "session");
  assert.equal(D.tabOf(next), null);
});

check("close of a never-opened dock stays empty", () => {
  assert.deepEqual(D.close(closed), { tab: null, open: false });
});

check("a dock without a tab is not open even when flagged", () => {
  assert.equal(D.isOpen({ tab: null, open: true }), false);
});

console.log(`tool-dock: ${passed} checks passed`);
