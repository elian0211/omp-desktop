#!/usr/bin/env node
// Regression for src/app/process-details.js — turn-level "Process details"
// fold over the desktop's flattened transcript (ompweb chat-transcript-plan).
// Run: node tests/test-process-details.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/app/process-details.js"), "utf8");
const win = {};
new Function("window", src)(win);
const P = win.OMP_PROCESS_DETAILS;

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

const user = (text = "go") => ({ kind: "user", text });
const reply = (text, extra = {}) => ({ kind: "assistant", thought: null, blocks: [{ type: "text", text }], streaming: false, ...extra });
const thoughtOnly = (thought = "hmm") => ({ kind: "assistant", thought, blocks: [], streaming: false });
const tool = (id = "t1", status = "ok") => ({ kind: "tool", tool: "bash", status, _toolCallId: id });
const ask = () => ({ kind: "ask", status: "pending" });
const compact = () => ({ kind: "compact", status: "ok", summary: "sum" });

function shape(row) {
  if (row.kind === "message") return ["message", row.index];
  return row.segments.map((s) =>
    s.kind === "visible" ? ["visible", s.index] : ["activity", s.indices, s.toolCallCount]);
}

check("plain Q/A stays standalone", () => {
  const rows = P.planTranscriptRows([user(), reply("ok")]);
  assert.deepEqual(rows.map(shape), [["message", 0], ["message", 1]]);
});

check("tools between user and reply fold into one activity segment", () => {
  const msgs = [user(), tool("a"), tool("b"), reply("done")];
  const [row] = P.planTranscriptRows(msgs);
  assert.equal(row.kind, "group");
  assert.deepEqual(shape(row), [["activity", [1, 2], 2], ["visible", 3]]);
  assert.equal(row.segments[0].stepCount, 2);
});

check("mid-turn text splits activity around it", () => {
  const msgs = [user(), reply("Checking."), tool("a"), tool("b"), reply("Done.")];
  const [row] = P.planTranscriptRows(msgs);
  assert.deepEqual(shape(row), [["visible", 1], ["activity", [2, 3], 2], ["visible", 4]]);
});

check("thought-only assistant folds with tools", () => {
  const msgs = [user(), thoughtOnly(), tool("a"), reply("ok")];
  const [row] = P.planTranscriptRows(msgs);
  assert.deepEqual(shape(row), [["activity", [1, 2], 1], ["visible", 3]]);
});

check("showToolCalls keeps tool cards outside the fold", () => {
  const msgs = [user(), tool("a"), reply("ok")];
  const rows = P.planTranscriptRows(msgs, { showToolCalls: true });
  assert.deepEqual(rows.map(shape), [["message", 0], ["message", 1], ["message", 2]]);
});

check("showThinking keeps thought-only bubbles visible", () => {
  const msgs = [user(), thoughtOnly(), reply("ok")];
  const rows = P.planTranscriptRows(msgs, { showThinking: true });
  assert.deepEqual(rows.map(shape), [["message", 0], ["message", 1], ["message", 2]]);
});

check("neverFold renders every message standalone", () => {
  const msgs = [user(), tool("a"), reply("ok")];
  const rows = P.planTranscriptRows(msgs, { neverFold: true });
  assert.deepEqual(rows.map(shape), [["message", 0], ["message", 1], ["message", 2]]);
});

check("ask stays visible and splits the fold", () => {
  const msgs = [user(), tool("a"), ask(), tool("b"), reply("ok")];
  const [row] = P.planTranscriptRows(msgs);
  assert.deepEqual(shape(row), [["activity", [1], 1], ["visible", 2], ["activity", [3], 1], ["visible", 4]]);
});

check("compaction anchors a turn like a user message", () => {
  const msgs = [compact(), tool("a"), reply("after")];
  const [row] = P.planTranscriptRows(msgs);
  assert.equal(row.kind, "group");
  assert.equal(row.userIndex, 0);
  assert.deepEqual(shape(row), [["activity", [1], 1], ["visible", 2]]);
});

check("hidden messages are skipped", () => {
  const msgs = [user(), { ...tool("x"), superseded: true }, tool("a"), reply("ok")];
  const hidden = (m) => !!m.superseded;
  const [row] = P.planTranscriptRows(msgs, { hidden });
  assert.deepEqual(shape(row), [["activity", [2], 1], ["visible", 3]]);
});

check("looksLikeRunningTurn detects a pending tool", () => {
  assert.equal(P.looksLikeRunningTurn([user(), tool("a", "running")]), true);
  assert.equal(P.looksLikeRunningTurn([user(), tool("a"), reply("done")]), false);
  assert.equal(P.looksLikeRunningTurn([user(), reply("…", { streaming: true })]), true);
});

check("rendersFlat only for the live tail when hideToolActivity is off", () => {
  const msgs = [user(), tool("a", "running")];
  const [row] = P.planTranscriptRows(msgs);
  assert.equal(P.rendersFlat(row, msgs, { hideToolActivity: true }), false);
  assert.equal(P.rendersFlat(row, msgs, { hideToolActivity: false }), true);
  const finished = [user(), tool("a"), reply("ok")];
  const [done] = P.planTranscriptRows(finished);
  assert.equal(P.rendersFlat(done, finished, { hideToolActivity: false }), false);
});

check("a failed assistant with no text stays visible", () => {
  const msgs = [user(), tool("a"), { kind: "assistant", thought: null, blocks: [], failure: { headline: "overloaded" }, streaming: false }];
  const [row] = P.planTranscriptRows(msgs);
  assert.deepEqual(shape(row), [["activity", [1], 1], ["visible", 2]]);
});

console.log(`ok — ${passed} checks`);
