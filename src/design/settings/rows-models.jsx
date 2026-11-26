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

function _SM_providerCard({ provider, onChange, onRemove, onImageAgent, busy }) {
  const { SettingsSeg: Seg } = window;
  const setModel = (i, m) => onChange({
    ...provider,
    models: provider.models.map((old, j) => (j === i ? m : old)),
  });
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
          <_SM_field type="password" mono value={provider.apiKey ?? ""} placeholder={OMP_TR("unchanged")}
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
          <button type="button" className="st-ghost" disabled={busy}
            onClick={() => onChange({ ...provider, models: [...provider.models, { id: "" }] })}>
            {OMP_TR("+ model")}
          </button>
        </div>
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
