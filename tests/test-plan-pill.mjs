#!/usr/bin/env node
// Regression script for src/app/plan-pill.js — the summary + expanded
// preview behind the composer's plan pill (raw omp TodoPhase[]; clicking
// expands the list upward, matching ompweb's TodoList).
// Run: node tests/test-plan-pill.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root  = join(dirname(fileURLToPath(import.meta.url)), "..");
const src   = readFileSync(join(root, "src/app/plan-pill.js"), "utf8");
const win   = {};
// eslint-disable-next-line no-new-func
new Function("window", src)(win);
const P = win.OMP_PLAN_PILL;

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

check("no plan (empty array) yields null — the pill renders nothing", () => {
  assert.equal(P.summary([]), null);
  assert.equal(P.summary(undefined), null);
});

check("a plan straight from omp (nothing started) focuses the first pending task", () => {
  const s = P.summary([
    { name: "Setup", tasks: [{ content: "read config", status: "pending" }] },
    { name: "Implementation", tasks: [{ content: "wire panels", status: "pending" }] },
  ]);
  assert.equal(s.total, 2);
  assert.equal(s.done, 0);
  assert.equal(s.allDone, false);
  assert.equal(s.current, null);
  assert.equal(s.next, "read config");
  assert.equal(s.phaseTitle, "Setup");
  assert.equal(s.pct, 0);
});

check("the in-progress task wins over pending ones, with its phase", () => {
  const s = P.summary([
    { name: "Setup", tasks: [{ content: "read config", status: "completed" }] },
    { name: "Implementation", tasks: [
      { content: "wire panels", status: "in_progress" },
      { content: "tests", status: "pending" },
    ] },
  ]);
  assert.equal(s.current, "wire panels");
  assert.equal(s.next, null);
  assert.equal(s.phaseTitle, "Implementation");
  assert.equal(s.done, 1);
  assert.equal(s.total, 3);
  assert.equal(s.pct, 33);
});

check("all completed reports completion at 100%", () => {
  const s = P.summary([{ name: "Ship", tasks: [
    { content: "a", status: "completed" },
    { content: "b", status: "completed" },
  ] }]);
  assert.equal(s.done, 2);
  assert.equal(s.total, 2);
  assert.equal(s.allDone, true);
  assert.equal(s.pct, 100);
  assert.equal(s.current, null);
});

check("abandoned counts toward allDone but not the done fraction (ompweb)", () => {
  const s = P.summary([{ name: "Ship", tasks: [
    { content: "a", status: "completed" },
    { content: "b", status: "abandoned" },
  ] }]);
  assert.equal(s.done, 1);
  assert.equal(s.total, 2);
  assert.equal(s.allDone, true);
  assert.equal(s.pct, 50);
});

check("blocked is neither done nor the focus; blocker is kept for the panel", () => {
  const s = P.summary([{ name: "Ship", tasks: [
    { content: "a", status: "blocked", blocker: "Server down" },
    { content: "b", status: "pending" },
  ] }]);
  assert.equal(s.done, 0);
  assert.equal(s.current, null);
  assert.equal(s.next, "b");
  const preview = P.previewPhases([{
    name: "Ship",
    tasks: [
      { content: "a", status: "blocked", blocker: "Server down" },
      { content: "b", status: "pending" },
    ],
  }], true);
  assert.equal(preview[0].tasks[0].blocker, "Server down");
});

check("design kanban statuses (done) are not treated as omp completed", () => {
  // The pill now eats raw omp phases; a leftover kanban remap must not
  // silently inflate the done count.
  const s = P.summary([{ name: "Ship", tasks: [
    { content: "a", status: "done" },
    { content: "b", status: "abandoned" },
  ] }]);
  assert.equal(s.done, 0);
  assert.equal(s.allDone, false); // "done" is unknown; abandoned alone is not every-task
});

check("preview puts in_progress ahead of completed within the 5-task budget", () => {
  const phases = [{
    name: "Tasks",
    tasks: [
      { content: "One", status: "completed" },
      { content: "Two", status: "abandoned" },
      { content: "Three", status: "pending" },
      { content: "Four", status: "pending" },
      { content: "Five", status: "pending" },
      { content: "Six", status: "in_progress" },
    ],
  }];
  const preview = P.previewPhases(phases, false);
  assert.equal(preview[0].tasks.length, 5);
  assert.equal(preview[0].tasks[0].content, "Six");
  assert.equal(preview[0].tasks[1].content, "One");
  assert.ok(P.isTruncated(phases, preview));
  assert.equal(P.previewPhases(phases, true)[0].tasks.length, 6);
});

check("missing fields and malformed columns do not throw", () => {
  const s = P.summary([null, {}, { name: "X", tasks: [null, {}] }]);
  assert.equal(s, null);
  const s2 = P.summary([{ tasks: [{ content: "", status: "in_progress" }] }]);
  assert.equal(s2.total, 1);
  assert.equal(s2.current, "");
});

console.log(`plan-pill: ${passed} checks passed`);
