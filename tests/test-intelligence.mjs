#!/usr/bin/env node
// Regression script for src/app/intelligence.js — the pure row↔snapshot
// mapping behind Settings → Intelligence: every schema row reads, defaults
// and patches the snapshot field it claims; modified detection covers
// bools, seg choices, the method order and the role map; moveMethod holds
// the bounds; rolesPatch drops empty and unknown roles (mirroring Rust's
// sanitising); the schema's Intelligence rows and the option tables stay
// in step with the module and with Rust's allowlists.
// Run: node tests/test-intelligence.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const passed = [];
const check = (label, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`FAILED: ${label}`);
    throw err;
  }
  passed.push(label);
};

// Load the module exactly as index.html does (plain script, window scope).
const window = {};
vm.runInNewContext(readFileSync(join(root, "src/app/intelligence.js"), "utf8"), { window });
const I = window.OMP_INTELLIGENCE;

const snapshot = () => JSON.parse(JSON.stringify(I.DEFAULTS));
// Objects come from the vm realm; normalise so deepStrictEqual compares
// plain shapes, not prototypes.
const j = (x) => JSON.parse(JSON.stringify(x));

check("option tables match omp's allowlists (Rust's constants)", () => {
  assert.deepEqual([...I.METHODS], ["remote", "snapcompact", "handoff", "soft", "shake"]);
  assert.deepEqual([...I.MEMORY_BACKENDS], ["off", "local", "mnemopi", "hindsight"]);
  assert.deepEqual([...I.MEMORY_SCOPES], ["global", "per-project", "per-project-tagged"]);
  assert.equal(I.RETRY_CHOICES.every(n => n >= 0 && n <= 20), true);
  assert.deepEqual([...I.MODEL_ROLES],
    ["default", "smol", "slow", "vision", "plan", "designer", "commit", "tiny", "task", "advisor"]);
});

check("every row reads and patches its snapshot field", () => {
  const s = snapshot();
  const cases = [
    ["compactionMid", s.compaction.midTurnEnabled, false, { compaction: { midTurnEnabled: false } }],
    ["compactionContinue", s.compaction.autoContinue, false, { compaction: { autoContinue: false } }],
    ["compactionOrder", s.compaction.methodOrder, ["soft"], { compaction: { methodOrder: ["soft"] } }],
    ["memoryBackend", s.memory.backend, "local", { memory: { backend: "local" } }],
    ["memoryScope", s.mnemopi.scoping, "global", { mnemopi: { scoping: "global" } }],
    ["memoryRecall", s.mnemopi.autoRecall, false, { mnemopi: { autoRecall: false } }],
    ["memoryRetain", s.mnemopi.autoRetain, false, { mnemopi: { autoRetain: false } }],
    ["autolearn", s.autolearn.enabled, false, { autolearn: { enabled: false } }],
    ["autolearnContinue", s.autolearn.autoContinue, false, { autolearn: { autoContinue: false } }],
    ["retries", s.retry.maxRetries, 5, { retry: { maxRetries: 5 } }],
    ["modelFallback", s.retry.modelFallback, true, { retry: { modelFallback: true } }],
  ];
  for (const [id, expected, changed, patch] of cases) {
    assert.deepEqual(j(I.rowValue(s, id)), expected, id);
    assert.deepEqual(j(I.rowDefault(id)), expected, id);
    assert.deepEqual(j(I.rowPatch(id, changed)), patch, id);
  }
  assert.deepEqual(j(I.rowValue(s, "modelRoles")), {}, "modelRoles starts empty");
  assert.deepEqual(j(I.rowPatch("modelRoles", { smol: " x/y ", advisor: "" })),
    { modelRoles: { smol: "x/y" } }, "roles patch trims and drops empties");
});

check("rowModified flags only real deviations from the defaults", () => {
  const s = snapshot();
  for (const id of ["compactionMid", "compactionContinue", "compactionOrder", "memoryBackend",
    "memoryScope", "memoryRecall", "memoryRetain", "autolearn", "autolearnContinue",
    "retries", "modelFallback", "modelRoles"]) {
    assert.equal(I.rowModified(s, id), false, id);
  }
  const changed = snapshot();
  changed.compaction.methodOrder = ["soft", "remote", "snapcompact", "handoff", "shake"];
  assert.equal(I.rowModified(changed, "compactionOrder"), true);
  const roles = snapshot();
  roles.modelRoles.advisor = "x/y";
  assert.equal(I.rowModified(roles, "modelRoles"), true);
  // Key order in the map does not matter, only the content.
  const rolesReordered = snapshot();
  rolesReordered.modelRoles = { advisor: "x/y" };
  assert.deepEqual(j(I.rowValue(roles, "modelRoles")), j(I.rowValue(rolesReordered, "modelRoles")));
  // A role cleared back to empty returns to unmodified.
  const rolesCleared = snapshot();
  rolesCleared.modelRoles.advisor = "  ";
  assert.equal(I.rowModified(rolesCleared, "modelRoles"), false);
});

check("moveMethod moves within bounds only", () => {
  const order = ["a", "b", "c"];
  assert.deepEqual(j(I.moveMethod(order, 0, -1)), order, "past the start holds");
  assert.deepEqual(j(I.moveMethod(order, 2, +1)), order, "past the end holds");
  assert.deepEqual(j(I.moveMethod(order, 1, -1)), ["b", "a", "c"]);
  assert.deepEqual(j(I.moveMethod(order, 1, +1)), ["a", "c", "b"]);
  assert.deepEqual(order, ["a", "b", "c"], "the input order is never mutated");
});

check("roleRows lists every role in omp's order", () => {
  const rows = I.roleRows({ modelRoles: { advisor: "x/y", default: "m/n" } });
  assert.deepEqual(j(rows.map(r => r.role)), [...I.MODEL_ROLES]);
  assert.equal(rows.find(r => r.role === "advisor").value, "x/y");
  assert.equal(rows.find(r => r.role === "smol").value, "");
});

check("rolesPatch mirrors Rust's sanitising", () => {
  assert.deepEqual(j(I.rolesPatch({ advisor: " x/y ", smol: "", default: " m/n " })),
    { advisor: "x/y", default: "m/n" });
  assert.deepEqual(j(I.rolesPatch({ wizard: "x/y", smol: "a/b" })), { smol: "a/b" },
    "unknown roles never reach the patch");
  assert.deepEqual(j(I.rolesPatch({})), {});
});

check("the schema's Agent rows are exactly the module's rows plus profiles/goals", () => {
  const src = readFileSync(join(root, "src/app/settings-schema.js"), "utf8");
  const section = src.slice(src.indexOf('{ id: "agent"'), src.indexOf('{ id: "session"'));
  const types = [...section.matchAll(/custom\("([a-zA-Z]+)"/g)].map(m => m[1]).sort();
  const known = Object.keys({
    startupProfile: 1, goalContinue: 1,
    compactionMid: 1, compactionContinue: 1, compactionOrder: 1, memoryBackend: 1, memoryScope: 1,
    memoryRecall: 1, memoryRetain: 1, autolearn: 1, autolearnContinue: 1, retries: 1,
    modelFallback: 1, modelRoles: 1,
  }).sort();
  assert.deepEqual(types, known);
});

check("the rows renderer registers every schema type", () => {
  const src = readFileSync(join(root, "src/design/settings/rows-intelligence.jsx"), "utf8");
  const registered = [...src.matchAll(/"([a-zA-Z]+)",/g)].map(m => m[1]);
  for (const id of ["compactionMid", "compactionContinue", "compactionOrder", "memoryBackend",
    "memoryScope", "memoryRecall", "memoryRetain", "autolearn", "autolearnContinue",
    "retries", "modelFallback", "modelRoles"]) {
    assert.ok(registered.includes(id), id);
  }
});

console.log(`ok — ${passed.length} checks passed`);
