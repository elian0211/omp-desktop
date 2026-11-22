#!/usr/bin/env node
// Regression script for src/app/project-open.js — the new-project modal's
// pure draft transitions, submit normalisation and the appearance patch.
// Run: node tests/test-project-open.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
const load = file => new Function("window", readFileSync(join(root, file), "utf8"))(win);
load("src/app/project-nav.js");
load("src/app/project-appearance.js");
load("src/app/project-open.js");
const O = win.OMP_PROJECT_OPEN;

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

check("emptyDraft starts with no folder, name or colour", () => {
  assert.deepEqual(O.emptyDraft(), { path: "", name: "", icon: "" });
});

check("draftForFolder resets the name to the basename and keeps the colour", () => {
  assert.deepEqual(
    O.draftForFolder({ path: "/old", name: "Old", icon: "#112233" }, "C:\\Work\\Site"),
    { path: "C:\\Work\\Site", name: "Site", icon: "#112233" },
  );
});

check("draftForFolder accepts a blank old draft and a dropped path", () => {
  assert.deepEqual(O.draftForFolder(null, "/a/b"), { path: "/a/b", name: "b", icon: "" });
  assert.deepEqual(O.draftForFolder(O.emptyDraft(), ""), { path: "", name: "", icon: "" });
});

check("draftForEdit prefers the stored label and icon colour", () => {
  assert.deepEqual(
    O.draftForEdit("/a/proj", { label: "Work", icon: "#112233", theme: "phosphor" }),
    { path: "/a/proj", name: "Work", icon: "#112233" },
  );
});

check("draftForEdit falls back to the basename when nothing is stored", () => {
  assert.deepEqual(O.draftForEdit("/a/proj", null), { path: "/a/proj", name: "proj", icon: "" });
});

check("finalize refuses a blank folder", () => {
  assert.deepEqual(O.finalize({ path: "   ", name: "x", icon: "" }), { error: "folderRequired" });
  assert.deepEqual(O.finalize(null), { error: "folderRequired" });
});

check("finalize refuses a colour that is not hex", () => {
  assert.deepEqual(O.finalize({ path: "/a", name: "", icon: "zzz" }), { error: "badHex" });
});

check("finalize adds the # and lowercases the colour", () => {
  assert.deepEqual(O.finalize({ path: "/a", name: "n", icon: " AABBCC " }),
    { path: "/a", name: "n", icon: "#aabbcc" });
});

check("finalize trims and falls back to the basename", () => {
  assert.deepEqual(O.finalize({ path: " /a/Proj ", name: "  ", icon: "" }),
    { path: "/a/Proj", name: "Proj", icon: "" });
  assert.deepEqual(O.finalize({ path: "/a/Proj", name: " My work ", icon: "" }),
    { path: "/a/Proj", name: "My work", icon: "" });
});

check("finalize takes the canonical path over the typed one", () => {
  // The name stays an edit; a fallback name follows the canonical folder.
  assert.deepEqual(O.finalize({ path: "/a/link", name: "Work", icon: "#112233" }, "/a/target"),
    { path: "/a/target", name: "Work", icon: "#112233" });
  assert.deepEqual(O.finalize({ path: "/a/link", name: "", icon: "" }, "/a/target"),
    { path: "/a/target", name: "target", icon: "" });
});

check("appearancePatch in open mode stores only the edits", () => {
  const fields = { path: "/a/Proj", name: "Proj", icon: "" };
  assert.deepEqual(O.appearancePatch(fields, false), {});
  assert.deepEqual(O.appearancePatch({ ...fields, name: "Work" }, false), { label: "Work" });
  assert.deepEqual(O.appearancePatch({ ...fields, icon: "#112233" }, false), { icon: "#112233" });
  assert.deepEqual(O.appearancePatch({ ...fields, name: "Work", icon: "#112233" }, false),
    { label: "Work", icon: "#112233" });
});

check("appearancePatch in edit mode sends both fields so clearing resets", () => {
  const fields = { path: "/a/Proj", name: "Proj", icon: "" };
  assert.deepEqual(O.appearancePatch(fields, true), { label: "", icon: undefined });
  assert.deepEqual(O.appearancePatch({ ...fields, name: "Work" }, true), { label: "Work", icon: undefined });
});

// The patch round-trips through the real store: an edit-mode "" clears.
check("the edit patch round-trips through OMP_PROJECT_APPEARANCE.set", () => {
  const A = win.OMP_PROJECT_APPEARANCE;
  let map = A.set({}, "/a/Proj", { label: "Work", icon: "#112233" });
  map = A.set(map, "/a/Proj", O.appearancePatch({ path: "/a/Proj", name: "Proj", icon: "" }, true));
  assert.deepEqual(map, {});
  map = A.set(map, "/a/Proj", O.appearancePatch(
    { path: "/a/Proj", name: "Work", icon: "#112233" }, true));
  assert.deepEqual(map, { "/a/Proj": { label: "Work", icon: "#112233" } });
});

// The colour input (`type="color"`) needs a six-digit hex; anything else —
// including the empty draft — reads as the fallback the caller supplies.
check("colorInputValue normalises to the six-digit form the control needs", () => {
  assert.equal(O.colorInputValue("#112233", "#8af0c8"), "#112233");
  assert.equal(O.colorInputValue("#AABBCC", "#8af0c8"), "#aabbcc");
  assert.equal(O.colorInputValue("aabbcc", "#8af0c8"), "#aabbcc");
  assert.equal(O.colorInputValue("#abc", "#8af0c8"), "#aabbcc");
  assert.equal(O.colorInputValue("", "#8af0c8"), "#8af0c8");
  assert.equal(O.colorInputValue(null, "#8af0c8"), "#8af0c8");
  assert.equal(O.colorInputValue("zzz", "#8af0c8"), "#8af0c8");
  assert.equal(O.colorInputValue("#11223", "#8af0c8"), "#8af0c8");
});

console.log(`project-open: ${passed} checks passed`);
