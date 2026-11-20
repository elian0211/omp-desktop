#!/usr/bin/env node
// Regression script for src/app/mcp.js — the pure validation/type layer
// behind Settings → MCP: name rule, exactly one of command/url, transport
// implication, args/timeout checks, and the serversOf/isDisabled views of a
// redacted snapshot. The schema's MCP rows and the renderer registration
// stay in step.
// Run: node tests/test-mcp.mjs

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

const window = {};
vm.runInNewContext(readFileSync(join(root, "src/app/mcp.js"), "utf8"), { window });
const M = window.OMP_MCP;

check("typeOf implies the transport from the fields", () => {
  assert.equal(M.typeOf({}), "stdio");
  assert.equal(M.typeOf({ type: "sse", url: "https://x" }), "sse");
  assert.equal(M.typeOf({ url: "https://x" }), "http", "a url without type is http");
  assert.equal(M.typeOf({ command: "n" }), "stdio");
});

check("validate mirrors omp's loader rules", () => {
  assert.equal(M.validate("ok.1", { command: "n" }), "");
  assert.equal(M.validate("ok", { type: "http", url: "https://x/mcp" }), "");
  assert.match(M.validate("-bad", { command: "n" }), /name/i);
  assert.match(M.validate(`a`.repeat(129), { command: "n" }), /name/i);
  assert.match(M.validate("a", { command: "n", url: "https://x" }), /exactly one/);
  assert.match(M.validate("a", {}), /exactly one/);
  assert.match(M.validate("a", { type: "http", command: "n" }), /requires a URL/);
  assert.match(M.validate("a", { url: "https://x" }), /stdio server requires a command/);
  assert.match(M.validate("a", { type: "http", url: "ftp://x" }), /http or https/);
  assert.match(M.validate("a", { command: "n", url: "ftp://x", type: "http" }), /exactly one/, "both fields still fail first");
  assert.match(M.validate("a", { url: "https://x", type: "http", args: [1] }), /args/);
  assert.match(M.validate("a", { command: "n", timeout: 600001 }), /timeout/);
  assert.match(M.validate("a", { command: "n", timeout: -1 }), /timeout/);
  assert.equal(M.validate("a", { command: "n", timeout: 0 }), "");
});

check("serversOf reads a redacted snapshot and flags invalid entries", () => {
  const snap = {
    servers: [
      { name: "b", config: { command: "n" } },
      { name: "a", config: { invalid: true } },
    ],
    disabledServers: ["b"],
  };
  const servers = M.serversOf(snap);
  assert.deepEqual(servers.map(s => s.name), ["b", "a"], "file order kept");
  assert.equal(servers[0].type, "stdio");
  assert.equal(servers[1].invalid, true);
  assert.equal(M.isDisabled(snap, "b"), true);
  assert.equal(M.isDisabled(snap, "a"), false);
  assert.deepEqual([...M.serversOf(undefined)], []);
});

check("typeOf tolerates malformed entries and blankServer validates once filled", () => {
  assert.equal(M.typeOf(undefined), "stdio");
  assert.equal(M.typeOf({ invalid: true }), "stdio", "a non-object entry from the file reads as stdio");
  const s = M.blankServer();
  assert.equal(M.typeOf(s), "stdio");
  assert.match(M.validate("x", s), /exactly one/, "blank until the user fills it");
  assert.equal(M.validate("x", { ...s, command: "n" }), "");
});

check("the schema's MCP rows and the renderer stay registered", () => {
  const src = readFileSync(join(root, "src/app/settings-schema.js"), "utf8");
  const section = src.slice(src.indexOf('{ id: "mcp"'), src.indexOf('{ id: "session"'));
  assert.match(section, /custom\("mcpUser"/);
  assert.match(section, /custom\("mcpProject"/);
  const rows = readFileSync(join(root, "src/design/settings/rows-mcp.jsx"), "utf8");
  assert.match(rows, /mcpUser: _MC_UserRow/);
  assert.match(rows, /mcpProject: _MC_ProjectRow/);
});

console.log(`ok — ${passed.length} checks passed`);
