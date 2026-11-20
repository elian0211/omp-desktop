#!/usr/bin/env node
// Regression script for src/app/plan-pill.js — the summary behind the
// composer's plan pill (live todo phases as one capsule; clicking opens
// the plan kanban).
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
    { title: "Setup", tasks: [{ text: "read config", status: "pending" }] },
    { title: "Implementation", tasks: [{ text: "wire panels", status: "pending" }] },
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
    { title: "Setup", tasks: [{ text: "read config", status: "done" }] },
    { title: "Implementation", tasks: [
      { text: "wire panels", status: "in_progress" },
      { text: "tests", status: "pending" },
    ] },
  ]);
  assert.equal(s.current, "wire panels");
  assert.equal(s.next, null);
  assert.equal(s.phaseTitle, "Implementation");
  assert.equal(s.done, 1);
  assert.equal(s.total, 3);
  assert.equal(s.pct, 33);
});

check("all done reports completion at 100%", () => {
  const s = P.summary([{ title: "Ship", tasks: [
    { text: "a", status: "done" },
    { text: "b", status: "done" },
  ] }]);
  assert.equal(s.done, 2);
  assert.equal(s.total, 2);
  assert.equal(s.allDone, true);
  assert.equal(s.pct, 100);
  assert.equal(s.current, null);
});

// Raw omp statuses ("completed", "abandoned") are mapped to the design
// shape by adapter.js buildKanban before the pill ever sees them; here
// they must count as unknown, not silently as done.
check("unknown statuses are neither done nor focusable", () => {
  const s = P.summary([{ title: "Ship", tasks: [
    { text: "a", status: "completed" },
    { text: "b", status: "abandoned" },
  ] }]);
  assert.equal(s.done, 0);
  assert.equal(s.allDone, false);
  assert.equal(s.current, null);
  assert.equal(s.next, null); // nothing in a known state to focus
});

check("missing fields and malformed columns do not throw", () => {
  const s = P.summary([null, {}, { title: "X", tasks: [null, {}] }]);
  assert.equal(s, null);
  const s2 = P.summary([{ tasks: [{ text: "", status: "in_progress" }] }]);
  assert.equal(s2.total, 1);
  assert.equal(s2.current, "");
});

console.log(`plan-pill: ${passed} checks passed`);
