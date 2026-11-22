// Per-project appearance: a folder can override the global theme and accent,
// carry a display-only name label (the new-project modal's edit mode;
// the strip, the recents rows and the Settings row prefer it, tooltips keep
// the real path) and a display-only strip icon colour (`icon`, the
// new-project modal's field — it never rethemes the tab; that is what
// `accent` is for). Keys are the tab's recorded
// project folder normalised the same way the sidebar groups tabs
// (`OMP_PROJECT_NAV.normPath`); paths that reach the frontend from the OS are
// already canonicalised in Rust, so a symlinked folder shares its target's
// entry.
//
// Exposes `window.OMP_PROJECT_APPEARANCE`; an IIFE (AGENTS.md "IIFE rule").
(function () {
  const { normPath } = window.OMP_PROJECT_NAV; // app/project-nav.js

  /** Comparable key for an absolute project folder, "" for anything else.
   *  Relative paths never become keys: tab paths are absolute by contract. */
  function key(path) {
    const p = normPath(path);
    return p.startsWith("/") || /^[a-z]:(\/|$)/i.test(p) || p.startsWith("//") ? p : "";
  }

  /** The override for `path`, or null. */
  function forProject(map, path) {
    const k = key(path);
    return k && map ? map[k] ?? null : null;
  }

  function isHex(color) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(color ?? "").trim());
  }

  /** `{theme, accent, icon, label}` → only the values worth storing.
   *  `undefined` clears a field, which is how the Settings row removes one
   *  half of an override. `theme`/`accent` retheme the rendered tab
   *  (Settings → Appearance); `icon` is the strip icon's display colour
   *  (the new-project modal) and never touches the theme. */
  function patchValues(patch) {
    const out = {};
    for (const [name, value] of Object.entries(patch || {})) {
      if (name === "theme") {
        if (value === undefined) out.theme = undefined;
        else if (typeof value === "string" && value.trim()) out.theme = value.trim();
      } else if (name === "accent" || name === "icon") {
        if (value === undefined) out[name] = undefined;
        else if (isHex(value)) out[name] = String(value).trim().toLowerCase();
      } else if (name === "label") {
        // Present-but-blank clears (the edit modal's submit sends both
        // fields, so erasing the name falls back to the folder basename);
        // an absent field never reaches this branch and keeps the old label.
        if (typeof value === "string" && value.trim()) out.label = value.trim();
        else out.label = undefined;
      }
    }
    return out;
  }

  /** New map with `patch` merged into `path`'s entry; an entry left empty is
   *  removed. Returns the input map unchanged for an unusable path. */
  function set(map, path, patch) {
    const k = key(path);
    if (!k) return map || {};
    const values = patchValues(patch);
    const current = (map || {})[k] || {};
    const merged = { ...current, ...values };
    for (const name of ["theme", "accent", "icon", "label"]) if (merged[name] === undefined) delete merged[name];
    const next = { ...(map || {}) };
    if (Object.keys(merged).length) next[k] = merged;
    else delete next[k];
    return next;
  }

  /** New map with `path`'s override removed. */
  function clear(map, path) {
    const k = key(path);
    if (!k || !map || !(k in map)) return map || {};
    const next = { ...map };
    delete next[k];
    return next;
  }

  /** The patch for picking `themeId` in the Settings row: the theme with its
   *  own accent (`themeAccentHex`, as the global Theme row resets the accent),
   *  or both fields cleared for "" ("Global"). null when `themeId` is already
   *  `currentTheme` (the stored one, "" for none): a repeat click changes
   *  nothing, as on the global Theme row. */
  function themePatch(themeId, themeAccentHex, currentTheme) {
    const id = String(themeId ?? "").trim();
    if (id === String(currentTheme ?? "").trim()) return null;
    return id ? { theme: id, accent: themeAccentHex } : { theme: undefined, accent: undefined };
  }

  /** What the window should render for `path`: the project's own values when
   *  set, the global ones otherwise. `themed` / `accented` say which half is
   *  the project's. */
  function resolve(tweaks, path) {
    const override = forProject(tweaks?.projectAppearance, path);
    return {
      theme: override?.theme || tweaks?.theme,
      accent: override?.accent || tweaks?.accent,
      themed: !!override?.theme,
      accented: !!override?.accent,
    };
  }

  /** WCAG relative luminance of `#rgb`/`#rrggbb`, `null` otherwise. */
  function luminance(hex) {
    if (!isHex(hex)) return null;
    let h = hex.trim().toLowerCase();
    if (h.length === 4) h = "#" + [...h.slice(1)].map(c => c + c).join("");
    const lin = c => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(h.slice(1, 3)) + 0.7152 * lin(h.slice(3, 5)) + 0.0722 * lin(h.slice(5, 7));
  }

  const L_INK_DARK = luminance("#111");
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  /** The strip ink for an accent background: whichever of the fixed dark
   *  and light inks contrasts better — a palette accent keeps the dark ink
   *  it always had, a custom dark colour flips to the light one. `null`
   *  with no usable accent: the default muted look keeps its own colours. */
  function inkFor(accent) {
    const l = luminance(accent);
    if (l === null) return null;
    return contrast(l, L_INK_DARK) >= contrast(1, l) ? "#111" : "#fff";
  }

  window.OMP_PROJECT_APPEARANCE = { key, forProject, set, clear, themePatch, resolve, inkFor, isHex };
})();
