// New-project modal (the project strip's + row): pure draft handling over
// the modal's three fields — folder path, display name, icon colour —
// shared by the open ("new project") and edit modes.
//
// Exposes `window.OMP_PROJECT_OPEN`; an IIFE (AGENTS.md "IIFE rule").
(function () {
  const { basename } = window.OMP_PROJECT_NAV; // app/project-nav.js
  const { isHex } = window.OMP_PROJECT_APPEARANCE; // app/project-appearance.js

  /** Blank draft of the open ("new project") mode. `icon` is the display
   *  colour of the project strip's icon — never the tab's theme accent. */
  function emptyDraft() {
    return { path: "", name: "", icon: "" };
  }

  /** Draft after a folder arrived — a browse pick or a submit-time
   *  canonicalisation: the name resets to the folder's own basename (it
   *  described the old folder, not this one); a picked colour survives. */
  function draftForFolder(draft, path) {
    return { path: path || "", name: basename(path), icon: draft?.icon || "" };
  }

  /** Draft prefilling edit mode from a project's stored override: its
   *  label, else the folder basename; its icon colour, else none. The
   *  theme/accent override (`accent`) is the Settings row's business and is
   *  not shown here. */
  function draftForEdit(path, override) {
    return { path: path || "", name: override?.label || basename(path), icon: override?.icon || "" };
  }

  /** The draft's fields, validated and normalised, or `{ error }` — a sync
   *  code the modal renders through OMP_TR (the backend's own validation
   *  errors arrive later, as raw strings, and are shown as-is). `icon`
   *  is `""` or a lowercased `#rrggbb`; a missing `#` is added. A blank
   *  name falls back to the folder basename. `canonical` (the backend's
   *  resolved path) wins over the typed one, so the patch and the spawned
   *  tab use the same key as recents and open tabs. */
  function finalize(draft, canonical) {
    const typed = String(draft?.path || "").trim();
    const path = canonical || typed;
    if (!path) return { error: "folderRequired" };
    let icon = String(draft?.icon || "").trim().toLowerCase();
    if (icon && !icon.startsWith("#")) icon = "#" + icon;
    if (icon && !isHex(icon)) return { error: "badHex" };
    let name = String(draft?.name || "").trim();
    if (!name) name = basename(path);
    return { path, name, icon };
  }

  /** The `projectAppearance` patch a commit applies (`OMP_PROJECT_APPEARANCE.
   *  set`). Open mode stores only an edited name and only a picked colour:
   *  a project left at its defaults gets no entry at all. Edit mode sends
   *  both fields, so erasing the name or colour resets that half — the name
   *  as a blank `label` (blank clears), the colour as `undefined` (the
   *  store's clear sentinel; a present-but-invalid colour is ignored, so ""
   *  would keep the old one). `fields` is `finalize`'s output. The colour
   *  is the strip icon's `icon` — display-only, never the theme accent. */
  function appearancePatch(fields, isEdit) {
    const label = fields.name === basename(fields.path) ? "" : fields.name;
    if (!isEdit) {
      const patch = {};
      if (label) patch.label = label;
      if (fields.icon) patch.icon = fields.icon;
      return patch;
    }
    return { label, icon: fields.icon || undefined };
  }

  /** What the modal's colour input (`type="color"`) holds: the draft colour
   *  normalised to the six-digit `#rrggbb` the control requires, else
   *  `fallback` while none is set — the control cannot be empty, the
   *  "Default" swatch carries that state. */
  function colorInputValue(color, fallback) {
    let a = String(color || "").trim().toLowerCase();
    if (a && !a.startsWith("#")) a = "#" + a;
    let m = /^#([0-9a-f]{6})$/.exec(a);
    if (m) return "#" + m[1];
    m = /^#([0-9a-f]{3})$/.exec(a);
    if (m) return "#" + [...m[1]].map(c => c + c).join("");
    return fallback;
  }

  window.OMP_PROJECT_OPEN = { emptyDraft, draftForFolder, draftForEdit, finalize, appearancePatch, colorInputValue };
})();
