/* ═════════════════════════════════════════════════════════════════════
   app/intelligence.js — the pure side of Settings → Intelligence
   (window.OMP_INTELLIGENCE).

   The rows the page renders read and write omp's Intelligence settings
   and model roles through `intelligence_settings_get` / `_set`
   (src-tauri/src/omp_native_config.rs, allowlisted `omp config` keys).
   This module maps between a schema row id and the snapshot field it
   shows, builds the partial patch a change sends (only the touched
   field is set — Rust merges field-wise), holds the option tables and
   the snapshot-shaped defaults the reset compares against.

   The hook that fetches and patches (app/use-intelligence.jsx) and the
   row renderers (design/settings/rows-intelligence.jsx) come here only
   through this module, so the mapping is testable without React.

   Mirrors Rust's sanitising where the UI pre-checks: empty model-role
   values are dropped, unknown roles never rendered. IIFE per the
   project rule for plain <script> tags.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  const METHODS = Object.freeze(["remote", "snapcompact", "handoff", "soft", "shake"]);
  const MEMORY_BACKENDS = Object.freeze(["off", "local", "mnemopi", "hindsight"]);
  const MEMORY_SCOPES = Object.freeze(["global", "per-project", "per-project-tagged"]);
  const RETRY_CHOICES = Object.freeze([0, 1, 2, 3, 5, 10]);
  /** omp's native set; `default` is required and shown but not editable. */
  const MODEL_ROLES = Object.freeze([
    "default", "smol", "slow", "vision", "plan", "designer", "commit", "tiny", "task", "advisor",
  ]);

  const DEFAULTS = Object.freeze({
    compaction: Object.freeze({
      midTurnEnabled: true, autoContinue: true, methodOrder: Object.freeze([...METHODS]),
    }),
    memory: Object.freeze({ backend: "mnemopi" }),
    autolearn: Object.freeze({ enabled: true, autoContinue: true }),
    mnemopi: Object.freeze({ scoping: "per-project", autoRecall: true, autoRetain: true }),
    retry: Object.freeze({ maxRetries: 2, modelFallback: false }),
    modelRoles: Object.freeze({}),
  });

  // Schema row id → snapshot read path, default and patch builder. The
  // renderers only pass `row.int` here.
  const ROWS = {
    compactionMid:        { read: s => s.compaction.midTurnEnabled, def: DEFAULTS.compaction.midTurnEnabled,
                            patch: v => ({ compaction: { midTurnEnabled: v } }) },
    compactionContinue:   { read: s => s.compaction.autoContinue, def: DEFAULTS.compaction.autoContinue,
                            patch: v => ({ compaction: { autoContinue: v } }) },
    compactionOrder:      { read: s => s.compaction.methodOrder, def: DEFAULTS.compaction.methodOrder,
                            patch: v => ({ compaction: { methodOrder: v } }) },
    memoryBackend:        { read: s => s.memory.backend, def: DEFAULTS.memory.backend,
                            patch: v => ({ memory: { backend: v } }) },
    memoryScope:          { read: s => s.mnemopi.scoping, def: DEFAULTS.mnemopi.scoping,
                            patch: v => ({ mnemopi: { scoping: v } }) },
    memoryRecall:         { read: s => s.mnemopi.autoRecall, def: DEFAULTS.mnemopi.autoRecall,
                            patch: v => ({ mnemopi: { autoRecall: v } }) },
    memoryRetain:         { read: s => s.mnemopi.autoRetain, def: DEFAULTS.mnemopi.autoRetain,
                            patch: v => ({ mnemopi: { autoRetain: v } }) },
    autolearn:            { read: s => s.autolearn.enabled, def: DEFAULTS.autolearn.enabled,
                            patch: v => ({ autolearn: { enabled: v } }) },
    autolearnContinue:    { read: s => s.autolearn.autoContinue, def: DEFAULTS.autolearn.autoContinue,
                            patch: v => ({ autolearn: { autoContinue: v } }) },
    retries:              { read: s => s.retry.maxRetries, def: DEFAULTS.retry.maxRetries,
                            patch: v => ({ retry: { maxRetries: v } }) },
    modelFallback:        { read: s => s.retry.modelFallback, def: DEFAULTS.retry.modelFallback,
                            patch: v => ({ retry: { modelFallback: v } }) },
    modelRoles:           { read: s => s.modelRoles, def: DEFAULTS.modelRoles,
                            patch: v => ({ modelRoles: rolesMap(v) }) },
  };

  /** Trimmed values of the known roles; empty and unknown entries go. */
  const rolesMap = (values) => {
    const out = {};
    for (const role of MODEL_ROLES) {
      const v = (values[role] ?? "").trim();
      if (v) out[role] = v;
    }
    return out;
  };

  const rowValue = (snapshot, id) => ROWS[id].read(snapshot);
  const rowDefault = (id) => ROWS[id].def;
  const rowPatch = (id, value) => ROWS[id].patch(value);

  /** Whether a row's value differs from the snapshot-shaped default
   *  (arrays and role maps compared by content, role values trimmed the
   *  way the patch trims them). */
  const rowModified = (snapshot, id) => {
    const raw = ROWS[id].read(snapshot);
    const v = id === "modelRoles" ? rolesMap(raw) : raw;
    const d = ROWS[id].def;
    if (Array.isArray(d)) return d.length !== v.length || d.some((x, i) => x !== v[i]);
    if (typeof d === "object") {
      const keys = new Set([...Object.keys(d), ...Object.keys(v)]);
      return [...keys].some(k => (d[k] ?? "") !== (v[k] ?? ""));
    }
    return d !== v;
  };

  /** `order` with the method at `index` moved `delta` places; the bounds
   *  hold it, so out-of-range moves return the same array. */
  const moveMethod = (order, index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= order.length) return order;
    const next = [...order];
    next.splice(to, 0, next.splice(index, 1)[0]);
    return next;
  };

  /** The role editor's rows in MODEL_ROLES order. */
  const roleRows = (snapshot) => MODEL_ROLES.map(role => ({
    role,
    value: snapshot.modelRoles[role] ?? "",
  }));

  window.OMP_INTELLIGENCE = {
    METHODS, MEMORY_BACKENDS, MEMORY_SCOPES, RETRY_CHOICES, MODEL_ROLES, DEFAULTS,
    rowValue, rowDefault, rowPatch, rowModified, moveMethod, roleRows, rolesPatch: rolesMap,
  };
})();
