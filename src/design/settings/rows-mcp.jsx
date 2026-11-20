/* ═══════════════════════════════════════════════════════════════════════
   design/settings/rows-mcp.jsx — the MCP section's custom Settings rows
   (window.OMP_SETTINGS_ROWS):
     mcpUser     the profile's user mcp.json: add, edit, rename, remove and
                 enable/disable servers. `env`/`headers` never reach the
                 frontend — an edited server keeps the stored ones (Rust
                 inherits them), typed secrets would be visible in the file.
     mcpProject  the open project's mcp.json family, read-only (the file is
                 usually committed; edit it in the repo).
   Both read app/mcp.js drafts and app/use-mcp.jsx's shared snapshot.
   ═══════════════════════════════════════════════════════════════════════ */

const _MC = window.OMP_MCP;

function _MC_serverFields({ server, onChange, busy }) {
  const { SettingsSeg: Seg } = window;
  const type = _MC.typeOf(server);
  const set = (part) => onChange({ ...server, ...part });
  return (
    <div className="st-mcp-grid">
      <label>{OMP_TR("Type")}
        <Seg value={type} label={OMP_TR("Type")}
          options={_MC.TYPES.map(t => ({ value: t, label: t }))}
          onChange={v => set({ type: v })} />
      </label>
      <label>{OMP_TR("Command")}
        <input type="text" className="mono" disabled={busy} spellCheck={false}
          value={server.command ?? ""} placeholder={OMP_TR("executable")} 
          onChange={e => set({ command: e.target.value })} />
      </label>
      <label>{OMP_TR("URL")}
        <input type="text" className="mono" disabled={busy} spellCheck={false}
          value={server.url ?? ""} placeholder="https://…"
          onChange={e => set({ url: e.target.value })} />
      </label>
      <label>{OMP_TR("Arguments")}
        <input type="text" disabled={busy} spellCheck={false}
          value={(server.args ?? []).join(" ")}
          placeholder={OMP_TR("space-separated")}
          onChange={e => set({ args: e.target.value.split(" ").filter(s => s !== "") })} />
      </label>
    </div>
  );
}

function _MC_UserRow({ row, ctx, query }) {
  const { SettingsRow: Row } = window;
  const profileId = ctx.goal?.profileId ?? null;
  const projectPath = ctx.activeProject?.path ?? null;
  const mcp = window.useMcp(ctx.bridge, profileId, projectPath, ctx.active === true);
  // Draft: {name, previousName, server} list edits; null = untouched.
  const [draft, setDraft] = React.useState(null);
  const [formError, setFormError] = React.useState("");
  // Collapsed by default: the head shows name + enabled toggle, the fields
  // open on click. A just-added server starts expanded (it is blank).
  const [expanded, setExpanded] = React.useState(() => new Set());
  const busy = mcp.busy;
  const current = _MC.serversOf(mcp.snap?.user)
    .map(s => ({ name: s.name, server: s.config }));
  const list = draft ?? current;

  const update = (next) => { setDraft(next); setFormError(""); };
  const editAt = (i, name, server, previousName) => update(
    list.map((s, j) => (j === i ? { name, server, previousName: previousName ?? s.previousName ?? s.name } : s)));

  const save = async () => {
    for (const s of list) {
      const problem = _MC.validate(s.name, s.server);
      if (problem) { setFormError(`${s.previousName || s.name}: ${problem}`); return; }
    }
    // One mutation per changed/new entry; renames ride on the same call.
    for (const s of list) {
      const before = current.find(c => c.name === (s.previousName ?? s.name));
      if (before && before.name === s.name
        && JSON.stringify({ ...before.server, args: before.server.args ?? [] }) === JSON.stringify({ ...s.server, args: s.server.args ?? [] })) continue;
      if (!(await mcp.save("user", s.name, s.server, s.previousName !== s.name ? s.previousName : null))) return;
    }
    for (const c of current) {
      if (!list.some(s => (s.previousName ?? s.name) === c.name)) {
        if (!(await mcp.remove("user", c.name))) return;
      }
    }
    setDraft(null);
    setFormError("");
  };

  let body;
  if (!mcp.snap) {
    body = <span className="st-ro">{mcp.error ? OMP_TR("unavailable") : OMP_TR("reading…")}</span>;
  } else if (mcp.snap.user?.error) {
    body = <div className="st-row-error">{OMP_TR("mcp.json could not be read: {detail}", { detail: mcp.snap.user.error })}</div>;
  } else {
    body = (
      <div className="st-mcp">
        {list.map((s, i) => {
          const isOpen = expanded.has(i);
          return (
            <div className={`st-mcp-srv${isOpen ? " open" : ""}`} key={s.previousName ?? s.name ?? i}>
              <div className="st-mcp-head" onClick={e => {
                if (e.target.closest("input, button, label")) return;
                setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  return next;
                });
              }}>
                <button type="button" className="st-mcp-fold" aria-expanded={isOpen}
                  title={OMP_TR(isOpen ? "collapse" : "expand")}
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}>{isOpen ? "▾" : "▸"}</button>
                <input type="text" className={`mono st-mcp-name${s.server.enabled === false ? " off" : ""}`} disabled={busy} spellCheck={false}
                  value={s.name} placeholder="server-name"
                  onChange={e => editAt(i, e.target.value, s.server)} />
                <label className="st-mcp-check">
                  <input type="checkbox" disabled={busy}
                    checked={s.server.enabled !== false}
                    onChange={e => editAt(i, s.name, { ...s.server, enabled: e.target.checked })} />
                  <span>{OMP_TR("enabled")}</span>
                </label>
                <button type="button" className="st-ghost" disabled={busy}
                  onClick={() => update(list.filter((_, j) => j !== i))}>{OMP_TR("remove server")}</button>
              </div>
              {isOpen && (
                <_MC_serverFields server={s.server} busy={busy}
                  onChange={srv => editAt(i, s.name, srv)} />
              )}
            </div>
          );
        })}
        <div className="st-mcp-actions">
          <button type="button" className="st-ghost" disabled={busy}
            onClick={() => {
              update([...list, { name: "", previousName: null, server: _MC.blankServer() }]);
              setExpanded(prev => new Set(prev).add(list.length));
            }}>
            {OMP_TR("+ server")}
          </button>
          {draft && (
            <>
              <button type="button" className="st-ghost" disabled={busy}
                onClick={() => { setDraft(null); setFormError(""); }}>{OMP_TR("discard")}</button>
              <button type="button" className="st-ghost st-mcp-save" disabled={busy} onClick={save}>
                {OMP_TR("save mcp.json")}
              </button>
            </>
          )}
        </div>
        {formError && <div className="st-row-error">{formError}</div>}
        {mcp.error && <div className="st-row-error">{mcp.error}</div>}
      </div>
    );
  }
  return <Row label={row.label} desc={row.desc} query={query} stack>{body}</Row>;
}

function _MC_ProjectRow({ row, ctx, query }) {
  const { SettingsRow: Row } = window;
  const profileId = ctx.goal?.profileId ?? null;
  const projectPath = ctx.activeProject?.path ?? null;
  const mcp = window.useMcp(ctx.bridge, profileId, projectPath, ctx.active === true);
  const scope = mcp.snap?.project;
  let body;
  if (!projectPath) {
    body = <span className="st-ro">{OMP_TR("no project open")}</span>;
  } else if (!mcp.snap) {
    body = <span className="st-ro">{OMP_TR("reading…")}</span>;
  } else if (scope?.error) {
    body = <div className="st-row-error">{OMP_TR("mcp.json could not be read: {detail}", { detail: scope.error })}</div>;
  } else {
    const servers = _MC.serversOf(scope);
    body = servers.length === 0
      ? <span className="st-ro">{OMP_TR("this project defines no MCP servers")}</span>
      : (
        <div className="st-mcp">
          {servers.map(s => (
            <div className="st-mcp-srv st-mcp-ro" key={s.name}>
              <span className="mono st-mcp-name">{s.name}</span>
              <span className="st-mcp-type mono">{s.type}</span>
              <span className="st-mcp-src mono">{scope.path}</span>
              {s.invalid && <span className="st-row-error">{OMP_TR("invalid entry")}</span>}
            </div>
          ))}
        </div>
      );
  }
  return <Row label={row.label} desc={row.desc} query={query} stack>{body}</Row>;
}

Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {}, {
  mcpUser: _MC_UserRow,
  mcpProject: _MC_ProjectRow,
});
