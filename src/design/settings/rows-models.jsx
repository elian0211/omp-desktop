/* ═══════════════════════════════════════════════════════════════════════
   design/settings/rows-models.jsx — the Models section's provider editor
   (window.OMP_SETTINGS_ROWS.providers): the profile's models.yml
   (src-tauri models_config.rs) edited through app/models.js drafts and
   app/use-models.jsx's shared snapshot. apiKey values are write-only:
   typing one sends it once (`apiKeys`), the backend never echoes it back —
   the row shows `hasApiKey` and a last-four hint instead. Providers are
   saved as a whole file; Rust validates with omp's own loader rules and
   refuses an unparseable file. A change applies to tabs started after it.
   ═══════════════════════════════════════════════════════════════════════ */

const _SM_M = window.OMP_MODELS;

function _SM_field({ value, onChange, placeholder, type = "text", mono = false, className = "" }) {
  return (
    <input type={type} value={value ?? ""} placeholder={placeholder} spellCheck={false}
      className={`${mono ? "mono " : ""}${className}`.trim() || undefined}
      onChange={e => onChange(e.target.value)} />
  );
}

function _SM_modelRow({ model, provider, onChange, onRemove, onImageAgent, busy }) {
  const responses = _SM_M.isResponsesApi(provider, model);
  const image = responses && _SM_M.imageGeneration(model);
  return (
    <div className="st-mdl">
      <button type="button" className="st-ghost st-mdl-x" title={OMP_TR("remove model")}
        disabled={busy} onClick={onRemove}>×</button>
      <_SM_field mono value={model.id} placeholder="model-id"
        onChange={v => onChange({ ...model, id: v })} className="st-mdl-id" />
      <_SM_field value={model.name} placeholder={OMP_TR("display name")}
        onChange={v => onChange({ ...model, name: v })} className="st-mdl-name" />
      <_SM_field value={model.contextWindow} placeholder={OMP_TR("context window")}
        onChange={v => onChange({ ...model, contextWindow: v === "" ? undefined : Number(v) })}
        className="st-mdl-num" />
      <label className="st-mdl-r">
        <input type="checkbox" checked={!!model.reasoning} disabled={busy}
          onChange={e => onChange({ ...model, reasoning: e.target.checked })} />
        <span>{OMP_TR("reasoning")}</span>
      </label>
      {responses && (
        <label className="st-mdl-r" title={OMP_TR("provider-native image_generation (openai-responses)")}>
          <input type="checkbox" checked={image} disabled={busy}
            onChange={e => onChange(_SM_M.setImageGeneration(model, e.target.checked))} />
          <span>{OMP_TR("image gen")}</span>
        </label>
      )}
      {image && model.id?.trim() && (
        <button type="button" className="st-ghost st-mdl-agent" disabled={busy}
          title={OMP_TR("writes the image_generator subagent for this model")}
          onClick={() => onImageAgent(model)}>{OMP_TR("image subagent")}</button>
      )}
    </div>
  );
}

function _SM_keyField({ provider, onChange, busy }) {
  // A saved key is write-only (the backend never echoes it), so the field
  // shows a masked hint by default; the eye switches to typing a new one.
  const [editing, setEditing] = React.useState(false);
  const saved = provider.hasApiKey && typeof provider.apiKey !== "string";
  if (saved && !editing) {
    return (
      <div className="st-mkey">
        <span className="st-mkey-mask mono">{OMP_TR("key saved · {hint}", { hint: provider.apiKeyHint ?? "" })}</span>
        <button type="button" className="st-ghost st-mkey-eye" title={OMP_TR("replace the key")}
          aria-label={OMP_TR("replace the key")} disabled={busy}
          onClick={() => setEditing(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M12 5C6.5 5 2.4 9.2 1 12c1.4 2.8 5.5 7 11 7s9.6-4.2 11-7c-1.4-2.8-5.5-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9Zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    );
  }
  return (
    <div className="st-mkey">
      <_SM_field type="password" mono value={provider.apiKey ?? ""} placeholder={OMP_TR("unchanged")}
        onChange={v => onChange(v)} />
      {saved && (
        <button type="button" className="st-ghost st-mkey-eye" title={OMP_TR("keep the saved key")}
          aria-label={OMP_TR("keep the saved key")} disabled={busy}
          onClick={() => { onChange(undefined); setEditing(false); }}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M12 5C6.5 5 2.4 9.2 1 12c1.4 2.8 5.5 7 11 7s9.6-4.2 11-7c-1.4-2.8-5.5-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9Zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm4.2 3.9 1.4 1.4L20.8 17 23 19.2l-1.4 1.4L19.4 18.4 17.2 20.6l-1.4-1.4L18 17l-2.2-2.2Z" fill="currentColor" fillRule="evenodd"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function _SM_providerCard({ provider, onChange, onRemove, onImageAgent, onDiscover, busy }) {
  const { SettingsSeg: Seg } = window;
  const [pick, setPick] = React.useState(null); // null | {ids, error, busy, checked}
  const setModel = (i, m) => onChange({
    ...provider,
    models: provider.models.map((old, j) => (j === i ? m : old)),
  });

  /** Queries the gateway with the *saved* key (models.yml) and opens the
   *  checkbox list; a failure keeps the manual blank-row fallback. */
  const fetchModels = async () => {
    setPick({ ids: [], error: "", busy: true, checked: {} });
    const res = await onDiscover(provider.id);
    if (res.ok) setPick({ ids: res.value, error: "", busy: false, checked: {} });
    else setPick({ ids: [], error: res.error, busy: false, checked: {} });
  };
  const addChecked = () => {
    const existing = new Set(provider.models.map(m => m.id));
    const add = pick.ids.filter(id => pick.checked[id] && !existing.has(id));
    if (add.length > 0) onChange({ ...provider, models: [...provider.models, ...add.map(id => ({ id, name: id }))] });
    setPick(null);
  };
  return (
    <div className="st-mprv">
      <div className="st-mprv-head">
        <_SM_field mono value={provider.id} placeholder="provider-id" className="st-mprv-id"
          onChange={v => onChange({ ...provider, id: v })} />
        <span className="st-mprv-hint">
          {provider.hasApiKey ? OMP_TR("key saved · {hint}", { hint: provider.apiKeyHint ?? "" }) : OMP_TR("no key")}
        </span>
        <button type="button" className="st-ghost" disabled={busy} onClick={onRemove}>
          {OMP_TR("remove provider")}
        </button>
      </div>
      <div className="st-mprv-grid">
        <label>{OMP_TR("Base URL")}
          <_SM_field mono value={provider.baseUrl} placeholder="https://api.example.com/v1"
            onChange={v => onChange({ ...provider, baseUrl: v })} />
        </label>
        <label>{OMP_TR("API")}
          <_SM_field mono value={provider.api} placeholder="openai-completions"
            onChange={v => onChange({ ...provider, api: v })} />
        </label>
        <label>{OMP_TR("Auth")}
          <Seg value={provider.auth ?? "apiKey"} label={OMP_TR("Auth")}
            options={_SM_M.AUTH_MODES.map(a => ({ value: a, label: a }))}
            onChange={v => onChange({ ...provider, auth: v })} />
        </label>
        <label>{OMP_TR("API key")}
          <_SM_keyField provider={provider} busy={busy}
            onChange={v => onChange({ ...provider, apiKey: v })} />
        </label>
        {String(provider.api ?? "") === "openai-responses" && (
          <label className="st-mdl-r" title={OMP_TR("opt-in provider-native tools on an OpenAI-compatible gateway (official OpenAI has web_search by default)")}>
            <input type="checkbox" disabled={busy}
              checked={_SM_M.providerToolsEnabled(provider)}
              onChange={e => onChange(_SM_M.setProviderToolsEnabled(provider, e.target.checked))} />
            <span>{OMP_TR("provider tools")}</span>
          </label>
        )}
      </div>
      <div className="st-mmodels">
        <div className="st-mmodels-head">{OMP_TR("Models")}
          <button type="button" className="st-ghost"
            title={OMP_TR("queries {baseUrl}/models with the saved key — save a typed key first", { baseUrl: provider.baseUrl ?? "" })}
            disabled={busy || !String(provider.baseUrl ?? "").trim()}
            onClick={fetchModels}>
            {OMP_TR("pick from gateway")}
          </button>
          <button type="button" className="st-ghost" disabled={busy}
            onClick={() => onChange({ ...provider, models: [...provider.models, { id: "" }] })}>
            {OMP_TR("+ model")}
          </button>
        </div>
        {pick && (
          <div className="st-mpick">
            {pick.busy && <span className="st-ro">{OMP_TR("querying…")}</span>}
            {pick.error && (
              <>
                <span className="st-row-error">{pick.error}</span>
                <button type="button" className="st-ghost" onClick={() => setPick(null)}>{OMP_TR("close")}</button>
              </>
            )}
            {!pick.busy && !pick.error && (
              <>
                {pick.ids.length > 0 && (
                  <div className="st-mpick-list">
                    {pick.ids.map(id => (
                      <label key={id} className="st-mdl-r">
                        <input type="checkbox" checked={!!pick.checked[id]}
                          onChange={e => setPick({ ...pick, checked: { ...pick.checked, [id]: e.target.checked } })} />
                        <span className="mono">{id}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="st-mpick-actions">
                  <button type="button" className="st-ghost st-models-save" disabled={busy}
                    onClick={addChecked}>{OMP_TR("add selected")}</button>
                  <button type="button" className="st-ghost" onClick={() => setPick(null)}>{OMP_TR("close")}</button>
                </div>
              </>
            )}
          </div>
        )}
        {provider.models.map((m, i) => (
          <_SM_modelRow key={i} model={m} provider={provider} busy={busy}
            onChange={m2 => setModel(i, m2)}
            onImageAgent={onImageAgent}
            onRemove={() => onChange({ ...provider, models: provider.models.filter((_, j) => j !== i) })} />
        ))}
      </div>
    </div>
  );
}

function _SM_ProvidersRow({ row, ctx, query }) {
  const { SettingsRow: Row } = window;
  const profileId = ctx.goal?.profileId ?? null;
  const models = window.useModels(ctx.bridge, profileId, ctx.active === true);
  // Draft null = untouched; edits copy the snapshot list. Typed keys live
  // on the draft provider as `apiKey` (never echoed back by the backend).
  const [draft, setDraft] = React.useState(null);
  const [formError, setFormError] = React.useState("");
  const [agentNote, setAgentNote] = React.useState("");
  const busy = models.busy;
  const list = draft ?? (_models_snap_list(models.snap));
  const dirty = draft != null;

  const update = (next) => { setDraft(next); setFormError(""); };

  /** Writes the image_generator subagent for a model marked 生图: the
   *  alias omp routes is `<provider>/<model>`. An existing file is only
   *  replaced after the hook's own confirm. */
  const makeImageAgent = async (provider, model) => {
    setAgentNote("");
    const res = await models.writeImageAgent(`${provider.id}/${model.id}`, false);
    if (res.ok) setAgentNote(OMP_TR("image agent written: {path}", { path: res.path }));
    else if (res.error !== "cancelled") setFormError(res.error);
  };

  const save = async () => {
    const clean = _SM_M.sanitize(draft);
    const problem = _SM_M.validate(clean);
    if (problem) { setFormError(problem); return; }
    const payload = _SM_M.savePayload(clean);
    if (await models.save(payload.providers, payload.apiKeys)) {
      setDraft(null);
      setFormError("");
    }
  };

  let body;
  if (!models.snap) {
    body = <span className="st-ro">{models.error ? OMP_TR("unavailable") : OMP_TR("reading…")}</span>;
  } else if (models.snap.parseError) {
    body = (
      <div className="st-row-error">
        {OMP_TR("models.yml does not parse: {detail}", { detail: models.snap.parseError })}
      </div>
    );
  } else {
    body = (
      <div className="st-models">
        {list.map((p, i) => (
          <_SM_providerCard key={i} provider={p} busy={busy}
            onChange={p2 => update(list.map((old, j) => (j === i ? p2 : old)))}
            onImageAgent={m => makeImageAgent(p, m)}
            onDiscover={providerId => models.discover(providerId)}
            onRemove={() => update(list.filter((_, j) => j !== i))} />
        ))}
        <div className="st-models-actions">
          <button type="button" className="st-ghost" disabled={busy}
            onClick={() => update([...list, { id: "", baseUrl: "", api: "", models: [] }])}>
            {OMP_TR("+ provider")}
          </button>
          <button type="button" className="st-ghost" disabled={busy}
            onClick={() => models.refresh()}>{OMP_TR("reload")}</button>
          {dirty && (
            <button type="button" className="st-ghost" disabled={busy}
              onClick={() => { setDraft(null); setFormError(""); }}>{OMP_TR("discard")}</button>
          )}
          {dirty && (
            <button type="button" className="st-ghost st-models-save" disabled={busy} onClick={save}>
              {OMP_TR("save models.yml")}
            </button>
          )}
        </div>
        <div className="st-mpath mono">{models.snap.path}</div>
        {agentNote && <div className="st-mnote">{agentNote}</div>}
        {formError && <div className="st-row-error">{formError}</div>}
        {models.error && <div className="st-row-error">{models.error}</div>}
      </div>
    );
  }

  return <Row label={row.label} desc={row.desc} query={query} stack>{body}</Row>;
}

// `_SM_M` is undefined when the snapshot is null and the draft unset —
// list must fall back to empty rather than crash the row.
function _models_snap_list(snap) {
  return snap ? _SM_M.providersFromSnapshot(snap) : [];
}

Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {}, {
  providers: _SM_ProvidersRow,
});
