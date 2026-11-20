/* ═══════════════════════════════════════════════════════════════════════
   app/models.js — the pure side of Settings → Models (window.OMP_MODELS).

   The row edits the profile's models.yml through Rust's
   `models_config_get` / `models_config_set` (src-tauri models_config.rs):
   providers with baseUrl, api, auth mode, an apiKey the backend masks
   (`hasApiKey` + last-four `apiKeyHint`, never echoed), and model rows.
   This module holds the editable draft helpers, the client-side pre-check
   that mirrors Rust's validation (same rules omp's loader enforces), and
   the save payload builder: untouched providers go back as they arrived,
   typed keys travel separately in `apiKeys` (empty string clears).

   IIFE per the project rule for plain <script> tags.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  const AUTH_MODES = Object.freeze(["apiKey", "none", "oauth"]);
  const KNOWN_MODEL_FIELDS = Object.freeze([
    "id", "name", "api", "reasoning", "contextWindow", "maxTokens",
  ]);

  /** The editable provider list from a `models_config_get` snapshot. */
  const providersFromSnapshot = (snap) => (snap?.providers ?? []).map(p => ({ ...p, models: (p.models ?? []).map(m => ({ ...m })) }));

  /** Deep copy of a draft, so row edits never alias the snapshot. */
  const copy = (providers) => JSON.parse(JSON.stringify(providers));

  /** Blank model rows and blank provider ids are editor artefacts, not
   *  config; drop them before validating or saving (same rule Rust applies
   *  to blank sequence entries). Malformed non-blank rows are kept so the
   *  pre-check can report them. */
  const sanitize = (providers) => providers
    .filter(p => String(p.id ?? "").trim() !== "")
    .map(p => ({ ...p, models: (p.models ?? []).filter(m => String(m.id ?? "").trim() !== "") }));

  /** The client-side mirror of models_config::validate. Returns "" or the
   *  first problem; Rust re-checks before writing. */
  const validate = (providers) => {
    for (const p of providers) {
      const models = p.models ?? [];
      if (models.length > 0) {
        if (!String(p.baseUrl ?? "").trim()) return `Provider ${p.id}: "baseUrl" is required when defining custom models.`;
        if (!p.hasApiKey && !String(p.apiKey ?? "").trim() && p.auth !== "none") {
          return `Provider ${p.id}: "apiKey" is required when defining custom models unless auth is "none".`;
        }
      }
      if (p.auth != null && !AUTH_MODES.includes(p.auth)) return `Provider ${p.id}: unknown auth mode "${p.auth}".`;
      for (const m of models) {
        if (!String(m.id ?? "").trim()) return `Provider ${p.id}: a model is missing its "id".`;
        if (!String(m.api ?? p.api ?? "").trim()) {
          return `Provider ${p.id}, model ${m.id}: no "api" specified. Set at provider or model level.`;
        }
        for (const field of ["contextWindow", "maxTokens"]) {
          if (m[field] != null && !(Number(m[field]) > 0)) return `Provider ${p.id}, model ${m.id}: invalid ${field}.`;
        }
      }
    }
    return "";
  };

  /** Providers are saved whole; only a provider whose draft differs from
   *  the snapshot (by content) is a change worth sending a key for. */
  const sameProvider = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /** The `models_config_set` payload from a draft: `providers` is the full
   *  edited list (pseudo fields and keys stripped; Rust merges the typed
   *  keys from `apiKeys` over the stored entry), `apiKeys` carries only
   *  typed keys — a non-empty string sets it, an empty string clears it. */
  const savePayload = (providers) => {
    const clean = sanitize(providers).map(p => {
      const { hasApiKey, apiKeyHint, apiKey, ...rest } = p;
      return rest;
    });
    const apiKeys = {};
    for (const p of sanitize(providers)) {
      if (typeof p.apiKey === "string") apiKeys[p.id] = p.apiKey.trim();
    }
    return { providers: clean, apiKeys };
  };

  window.OMP_MODELS = {
    AUTH_MODES, KNOWN_MODEL_FIELDS, providersFromSnapshot, copy, sanitize, validate, savePayload,
  };
})();
