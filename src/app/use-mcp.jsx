/* app/use-mcp.jsx — the React side of Settings → MCP: one shared snapshot
   of the profile's user mcp.json plus the open project's (Rust
   `mcp_config_get`, src-tauri mcp_config.rs), fetched while the Settings
   tab is active and shared by every row of the section through a
   module-level cache (same shape as use-intelligence.jsx). `save` and
   `remove` apply one server mutation and adopt the refreshed snapshot
   the backend returns; `projectPath` changes refetch. */

const _UM_store = {
  key: null, snap: null, error: null, busy: false,
  load: null, listeners: new Set(),
};

const _UM_notify = () => { for (const fn of _UM_store.listeners) fn(); };
const _UM_set = (part) => { Object.assign(_UM_store, part); _UM_notify(); };

// profile + project identify the snapshot; the project path may be null.
const _UM_keyOf = (profileId, projectPath) => `${profileId ?? ""}|${projectPath ?? ""}`;

const _UM_ensure = (bridge, profileId, projectPath, force) => {
  if (!bridge || !profileId) return;
  const key = _UM_keyOf(profileId, projectPath);
  if (!force && _UM_store.key === key && (_UM_store.snap || _UM_store.error || _UM_store.load)) return;
  const load = bridge.mcpConfig(profileId, projectPath).then(res => {
    if (_UM_store.load !== load) return;
    _UM_set({
      key, load: null, busy: false,
      snap: res?.ok ? res.value : null,
      error: res?.ok ? null : res?.error ?? "could not read the MCP configuration",
    });
  });
  _UM_set({ key, snap: null, error: null, busy: false, load });
};

const _UM_mutate = async (bridge, profileId, projectPath, op) => {
  const key = _UM_keyOf(profileId, projectPath);
  if (!bridge || !profileId || _UM_store.busy) return false;
  _UM_set({ busy: true, error: null });
  const res = await op();
  if (_UM_store.key !== key) return false;
  _UM_set(res?.ok
    ? { busy: false, snap: res.value, error: null }
    : { busy: false, error: res?.error ?? "could not save the MCP configuration" });
  return !!res?.ok;
};

/** `useMcp(bridge, profileId, projectPath, active)` — the shared snapshot
 *  (`{snap, error, busy, save, remove}`), or `snap: null` while it loads. */
function useMcp(bridge, profileId, projectPath, active) {
  const [, bump] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    _UM_store.listeners.add(bump);
    return () => { _UM_store.listeners.delete(bump); };
  }, []);
  React.useEffect(() => {
    if (active) _UM_ensure(bridge, profileId, projectPath, false);
  }, [bridge, profileId, projectPath, active]);
  const mine = _UM_store.key === _UM_keyOf(profileId, projectPath);
  return {
    snap: mine ? _UM_store.snap : null,
    error: mine ? _UM_store.error : null,
    busy: mine && _UM_store.busy,
    save: (scope, name, server, previousName) =>
      _UM_mutate(bridge, profileId, projectPath,
        () => bridge.setMcpServer(profileId, projectPath, scope, name, server, previousName ?? null)),
    remove: (scope, name) =>
      _UM_mutate(bridge, profileId, projectPath,
        () => bridge.deleteMcpServer(profileId, projectPath, scope, name)),
  };
}

window.useMcp = useMcp;
