/* app/use-mcp.jsx — the React side of Settings → MCP: one shared snapshot
   of the profile's user mcp.json plus the open project's (Rust
   `mcp_config_get`, src-tauri mcp_config.rs), fetched while the Settings
   tab is active and shared by every row of the section through a
   module-level cache (same shape as use-intelligence.jsx). `save` and
   `remove` apply one server mutation and adopt the refreshed snapshot
   the backend returns; `projectPath` changes refetch. */

const _MC_store = {
  key: null, snap: null, error: null, busy: false,
  load: null, listeners: new Set(),
};

const _MC_notify = () => { for (const fn of _MC_store.listeners) fn(); };
const _MC_set = (part) => { Object.assign(_MC_store, part); _MC_notify(); };

// profile + project identify the snapshot; the project path may be null.
const _MC_keyOf = (profileId, projectPath) => `${profileId ?? ""}|${projectPath ?? ""}`;

const _MC_ensure = (bridge, profileId, projectPath, force) => {
  if (!bridge || !profileId) return;
  const key = _MC_keyOf(profileId, projectPath);
  if (!force && _MC_store.key === key && (_MC_store.snap || _MC_store.error || _MC_store.load)) return;
  const load = bridge.mcpConfig(profileId, projectPath).then(res => {
    if (_MC_store.load !== load) return;
    _MC_set({
      key, load: null, busy: false,
      snap: res?.ok ? res.value : null,
      error: res?.ok ? null : res?.error ?? "could not read the MCP configuration",
    });
  });
  _MC_set({ key, snap: null, error: null, busy: false, load });
};

const _MC_mutate = async (bridge, profileId, projectPath, op) => {
  const key = _MC_keyOf(profileId, projectPath);
  if (!bridge || !profileId || _MC_store.busy) return false;
  _MC_set({ busy: true, error: null });
  const res = await op();
  if (_MC_store.key !== key) return false;
  _MC_set(res?.ok
    ? { busy: false, snap: res.value, error: null }
    : { busy: false, error: res?.error ?? "could not save the MCP configuration" });
  return !!res?.ok;
};

/** `useMcp(bridge, profileId, projectPath, active)` — the shared snapshot
 *  (`{snap, error, busy, save, remove}`), or `snap: null` while it loads. */
function useMcp(bridge, profileId, projectPath, active) {
  const [, bump] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    _MC_store.listeners.add(bump);
    return () => { _MC_store.listeners.delete(bump); };
  }, []);
  React.useEffect(() => {
    if (active) _MC_ensure(bridge, profileId, projectPath, false);
  }, [bridge, profileId, projectPath, active]);
  const mine = _MC_store.key === _MC_keyOf(profileId, projectPath);
  return {
    snap: mine ? _MC_store.snap : null,
    error: mine ? _MC_store.error : null,
    busy: mine && _MC_store.busy,
    save: (scope, name, server, previousName) =>
      _MC_mutate(bridge, profileId, projectPath,
        () => bridge.setMcpServer(profileId, projectPath, scope, name, server, previousName ?? null)),
    remove: (scope, name) =>
      _MC_mutate(bridge, profileId, projectPath,
        () => bridge.deleteMcpServer(profileId, projectPath, scope, name)),
  };
}

window.useMcp = useMcp;
