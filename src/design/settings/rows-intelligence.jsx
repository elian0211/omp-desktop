/* ═════════════════════════════════════════════════════════════════════
   design/settings/rows-intelligence.jsx — custom Settings rows of the
   Intelligence section (window.OMP_SETTINGS_ROWS). All twelve types are
   the same renderer: the schema row's `type` names its field in
   app/intelligence.js (OMP_INTELLIGENCE), which maps the row to the
   snapshot value, the default and the partial patch. Values are read and
   written for ctx.goal.profileId (the active profile, same scope as
   Goals) through app/use-intelligence.jsx's shared hook — one
   `omp config get` batch for the whole section, not one per row.

   Compaction and retry details only take effect while the desktop's own
   auto-compaction / auto-retry (Settings → Agent) are on; their
   descriptions say so.
   ═════════════════════════════════════════════════════════════════════ */

const _SII = window.OMP_INTELLIGENCE;

function _SII_profileName(ctx, id) {
  return ctx.profiles.find(p => p.id === id)?.name ?? id;
}

function _SII_orderControl({ intel, busy, value }) {
  const order = _SII.METHODS.filter(m => value.includes(m));
  return (
    <div className="st-int-order">
      {order.map((m, i) => (
        <span className="st-int-method" key={m}>
          <button type="button" aria-label={OMP_TR("move up")} disabled={busy || i === 0}
            onClick={() => intel.patch(_SII.rowPatch("compactionOrder", _SII.moveMethod(order, i, -1)))}>↑</button>
          <button type="button" aria-label={OMP_TR("move down")} disabled={busy || i === order.length - 1}
            onClick={() => intel.patch(_SII.rowPatch("compactionOrder", _SII.moveMethod(order, i, +1)))}>↓</button>
          <span className="mono">{m}</span>
        </span>
      ))}
    </div>
  );
}

function _SII_rolesControl({ intel, busy, value }) {
  const [draft, setDraft] = React.useState(null);
  const current = draft ?? Object.fromEntries(
    _SII.roleRows({ modelRoles: value }).map(r => [r.role, r.value]));
  const commit = () => {
    if (!draft) return;
    setDraft(null);
    intel.patch(_SII.rowPatch("modelRoles", current));
  };
  return (
    <div className="st-int-roles">
      {_SII.roleRows({ modelRoles: current }).map(r => (
        <label className="st-int-role" key={r.role}>
          <span className="mono">{r.role}</span>
          <input type="text" disabled={busy} value={r.value} spellCheck={false}
            placeholder={OMP_TR("omp's own choice")}
            onChange={e => setDraft({ ...current, [r.role]: e.target.value })}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} />
        </label>
      ))}
    </div>
  );
}

function _SII_IntelligenceRow({ row, ctx, query }) {
  const { SettingsRow: Row, SettingsToggle: Toggle, SettingsSeg: Seg } = window;
  const id = row.type;
  const profileId = ctx.goal?.profileId ?? null;
  const intel = window.useIntelligence(ctx.bridge, profileId, ctx.active === true);
  const busy = intel.busy;
  const name = profileId ? _SII_profileName(ctx, profileId) : null;
  const scope = name ? OMP_TR(" Applies to profile “{name}” (omp's config); its running tabs pick it up without a restart.", { name }) : "";

  let control;
  if (intel.snap) {
    const value = _SII.rowValue(intel.snap, id);
    if (typeof value === "boolean") {
      control = <Toggle value={value} label={row.label} onChange={v => { if (!busy) intel.patch(_SII.rowPatch(id, v)); }} />;
    } else if (id === "retries") {
      control = <Seg value={value} label={row.label}
        options={_SII.RETRY_CHOICES.map(n => ({ value: n, label: String(n) }))}
        onChange={v => intel.patch(_SII.rowPatch(id, v))} />;
    } else if (id === "memoryBackend" || id === "memoryScope") {
      const choices = id === "memoryBackend" ? _SII.MEMORY_BACKENDS : _SII.MEMORY_SCOPES;
      control = <Seg value={value} label={row.label}
        options={choices.map(c => ({ value: c, label: c }))}
        onChange={v => intel.patch(_SII.rowPatch(id, v))} />;
    } else if (id === "compactionOrder") {
      control = <_SII_orderControl intel={intel} busy={busy} value={value} />;
    } else {
      control = <_SII_rolesControl intel={intel} busy={busy} value={value} />;
    }
  } else {
    control = <span className="st-ro">{intel.error ? OMP_TR("unavailable") : OMP_TR("reading…")}</span>;
  }

  const modified = intel.snap ? _SII.rowModified(intel.snap, id) : false;
  return (
    <>
      <Row label={row.label} query={query} modified={modified} resettable={modified}
        onReset={() => intel.patch(_SII.rowPatch(id, _SII.rowDefault(id)))}
        desc={`${window.OMP_I18N.t(row.desc)}${scope}`}>
        {control}
      </Row>
      {intel.error && <div className="st-row-error">{intel.error}</div>}
    </>
  );
}

// One renderer per schema type, all the same component; `row.type` picks
// the field.
Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {},
  Object.fromEntries([
    "compactionMid", "compactionContinue", "compactionOrder",
    "memoryBackend", "memoryScope", "memoryRecall", "memoryRetain",
    "autolearn", "autolearnContinue",
    "retries", "modelFallback", "modelRoles",
  ].map(type => [type, _SII_IntelligenceRow])));
