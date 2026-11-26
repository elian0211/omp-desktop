#!/usr/bin/env node
// Regression script for src/app/models.js — the pure draft/validate/payload
// layer behind Settings → Models: sanitize drops blank editor rows,
// validate mirrors Rust's models_config rules (baseUrl + key required when
// models exist unless auth is none, api somewhere, positive windows), and
// savePayload strips the masked pseudo fields and carries only typed keys.
// The schema's Models row and the renderer registration stay in step.
// Run: node tests/test-models.mjs

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
vm.runInNewContext(readFileSync(join(root, "src/app/models.js"), "utf8"), { window });
const M = window.OMP_MODELS;

const provider = (id, fields = {}, models = []) => ({
  id, baseUrl: "https://x.example", auth: "none", hasApiKey: false, apiKeyHint: "", ...fields,
  models,
});
const model = (id, fields = {}) => ({ id, api: "openai-completions", ...fields });

check("providersFromSnapshot copies and defaults models", () => {
  const snap = { providers: [{ id: "a", models: [{ id: "m1" }] }, { id: "b" }] };
  const list = M.providersFromSnapshot(snap);
  assert.equal(list.length, 2);
  assert.deepEqual([...list[1].models], []);
  list[0].models[0].id = "changed";
  assert.equal(snap.providers[0].models[0].id, "m1", "the snapshot is never aliased");
});

check("sanitize drops blank rows but keeps malformed non-blank ones", () => {
  const clean = M.sanitize([
    provider("a"),
    { id: "  ", models: [] },
    provider("b", {}, [model("m1"), { id: "", api: "x" }, { id: "  ", api: "y" }]),
  ]);
  assert.deepEqual(clean.map(p => p.id), ["a", "b"]);
  assert.deepEqual(clean[1].models.map(m => m.id), ["m1"]);
});

check("validate accepts a keyless provider with auth none", () => {
  assert.equal(M.validate([provider("a", { auth: "none" }, [model("m1")])]), "");
  assert.equal(M.validate([provider("a", { auth: "oauth", hasApiKey: false }, [])]), "");
});

check("validate rejects configs omp's loader refuses", () => {
  assert.match(M.validate([provider("a", { baseUrl: "" }, [model("m1")])]), /baseUrl/);
  assert.match(M.validate([provider("a", { auth: "apiKey", hasApiKey: false }, [model("m1")])]), /apiKey/);
  assert.match(M.validate([provider("a"), [/* no models */]].slice(0, 1) && [provider("a", {}, [{ id: "m1" }])]), /no "api"/);
  assert.match(M.validate([provider("a", {}, [{ id: " ", api: "x" }])]), /missing its "id"/);
  assert.match(M.validate([provider("a", {}, [model("m1", { contextWindow: 0 })])]), /invalid contextWindow/);
  assert.match(M.validate([provider("a", {}, [model("m1", { maxTokens: -3 })])]), /invalid maxTokens/);
  assert.match(M.validate([provider("a", { auth: "yolo" })]), /unknown auth mode/);
});

check("savePayload strips pseudo fields and carries typed keys only", () => {
  const { providers, apiKeys } = M.savePayload([
    provider("a", { apiKey: "  sk-new  " }, [model("m1")]),
    { id: "b", hasApiKey: true, apiKeyHint: "…9999", models: [] },
    { id: "", models: [] },
  ]);
  assert.deepEqual(providers.map(p => p.id), ["a", "b"]);
  for (const p of providers) {
    assert.ok(!("hasApiKey" in p), "hasApiKey never travels");
    assert.ok(!("apiKeyHint" in p), "apiKeyHint never travels");
    assert.ok(!("apiKey" in p), "the key rides in apiKeys, not the provider");
  }
  assert.deepEqual({ ...apiKeys }, { a: "sk-new" }, "trimmed typed key, untouched provider has none");
});

check("compat.openaiProviderTools flags edit, prune, and keep siblings", () => {
  const gateway = provider("g", { api: "openai-responses" }, [model("m1", { api: "openai-responses" })]);
  // Model-level imageGeneration.
  assert.equal(M.imageGeneration(gateway.models[0]), false);
  const withImage = M.setImageGeneration(gateway.models[0], true);
  assert.equal(M.imageGeneration(withImage), true);
  assert.equal(JSON.stringify(withImage.compat), JSON.stringify({ openaiProviderTools: { imageGeneration: true } }));
  // Unset prunes the empty branches entirely.
  assert.equal("compat" in M.setImageGeneration(withImage, false), false);
  // Sibling leaves and provider-level fields survive.
  const busy = M.setImageGeneration(
    { ...withImage, compat: { ...withImage.compat, openaiProviderTools: { ...withImage.compat.openaiProviderTools, outputDirectory: "./imgs" }, stream: true } },
    true,
  );
  assert.equal(busy.compat.stream, true);
  assert.equal(busy.compat.openaiProviderTools.outputDirectory, "./imgs");
  const off = M.setImageGeneration(busy, false);
  assert.equal(off.compat.stream, true);
  assert.equal(off.compat.openaiProviderTools.imageGeneration, undefined);
  // Provider-level enabled.
  const enabled = M.setProviderToolsEnabled(gateway, true);
  assert.equal(M.providerToolsEnabled(enabled), true);
  assert.equal("compat" in M.setProviderToolsEnabled(enabled, false), false);
  // The edited model still passes the whole-payload round trip untouched.
  const payload = M.savePayload([{ ...gateway, models: [M.setImageGeneration(gateway.models[0], true)] }]);
  assert.equal(JSON.stringify(payload.providers[0].models[0].compat), JSON.stringify({ openaiProviderTools: { imageGeneration: true } }));
});

check("isResponsesApi gates on model api over provider api", () => {
  const p = { api: "openai-responses" };
  assert.equal(M.isResponsesApi(p, { api: "openai-completions" }), false);
  assert.equal(M.isResponsesApi(p, {}), true);
  assert.equal(M.isResponsesApi({ api: "openai-completions" }, {}), false);
  assert.equal(M.isResponsesApi(p, undefined), true);
  // Hand-typed values tolerate stray whitespace.
  assert.equal(M.isResponsesApi({ api: " openai-responses " }, {}), true);
});

check("the schema's Models row and the renderer stay registered", () => {
  const src = readFileSync(join(root, "src/app/settings-schema.js"), "utf8");
  const section = src.slice(src.indexOf('{ id: "models"'), src.indexOf('{ id: "session"'));
  assert.match(section, /custom\("providers"/);
  const rows = readFileSync(join(root, "src/design/settings/rows-models.jsx"), "utf8");
  assert.match(rows, /providers: _SM_ProvidersRow/);
});

console.log(`ok — ${passed.length} checks passed`);
