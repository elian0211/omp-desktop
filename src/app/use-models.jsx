/* app/use-models.jsx — the React side of Settings → Models: the profile's
   models.yml snapshot (`models_config_get`, src-tauri models_config.rs)
   plus a `save(list, apiKeys)` that patches the file and adopts the fresh
   snapshot. Shared module-level cache like useIntelligence
   (app/use-intelligence.jsx): one read for the whole section; a reply for
   a profile left meanwhile is never shown. Refresh is explicit — the file
   only changes through this row (or the user's own edit, which "reload"
   picks up). */

const _UM_store = {
  profile: null, snap: null, error: null, busy: false,
  load: null, listeners: new Set(),
};

const _UM_notify = () => { for (const fn of _UM_store.listeners) fn(); };
const _UM_set = (part) => { Object.assign(_UM_store, part); _UM_notify(); };

const _UM_ensure = (bridge, profileId, force) => {
  if (!bridge || !profileId) return;
  if (!force && _UM_store.profile === profileId && (_UM_store.snap || _UM_store.error || _UM_store.load)) return;
  const load = bridge.modelsConfig(profileId).then(res => {
    if (_UM_store.load !== load) return;
    _UM_set({
      profile: profileId, load: null, busy: false,
      snap: res?.ok ? res.value : null,
      error: res?.ok ? null : res?.error ?? "could not read models.yml",
    });
  });
  _UM_set({ profile: profileId, snap: null, error: null, busy: false, load });
};

/** Write the edited provider list; adopts the fresh snapshot or reports
 *  omp's validation reason. The draft's error state stays until the next
 *  action either way. */
const _UM_save = async (bridge, profileId, providers, apiKeys) => {
  if (!bridge || !profileId || _UM_store.busy) return false;
  _UM_set({ busy: true, error: null });
  const res = await bridge.setModelsConfig(profileId, providers, apiKeys);
  if (_UM_store.profile !== profileId) return false;
  _UM_set(res?.ok
    ? { busy: false, snap: res.value, error: null }
    : { busy: false, error: res?.error ?? "could not save models.yml" });
  return !!res?.ok;
};

/** Writes the image-generation subagent definition (image_agent.rs). A
 *  file that is already there is only replaced after the user confirms. */
const _UM_writeImageAgent = async (bridge, profileId, model, force) => {
  if (!bridge || !profileId) return { ok: false, error: "unavailable" };
  const res = await bridge.writeImageAgent(profileId, "", model, force);
  if (!res?.ok) return { ok: false, error: res?.error ?? "could not write the agent file" };
  if (res.value?.wrote) return { ok: true, path: res.value.path };
  const yes = window.confirm(`${OMP_TR("image agent file already exists: {path}", { path: res.value.path })}`);
  if (!yes) return { ok: false, error: "cancelled" };
  const again = await bridge.writeImageAgent(profileId, "", model, true);
  return again?.ok
    ? { ok: true, path: again.value.path }
    : { ok: false, error: again?.error ?? "could not write the agent file" };
};

/** `useModels(bridge, profileId, active)` — `{snap, error, busy, save,
 *  refresh}` for the shared snapshot. */
function useModels(bridge, profileId, active) {
  const [, bump] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    _UM_store.listeners.add(bump);
    return () => { _UM_store.listeners.delete(bump); };
  }, []);
  React.useEffect(() => {
    if (active) _UM_ensure(bridge, profileId, false);
  }, [bridge, profileId, active]);
  const mine = _UM_store.profile === profileId;
  return {
    snap: mine ? _UM_store.snap : null,
    error: mine ? _UM_store.error : null,
    busy: mine && _UM_store.busy,
    save: (providers, apiKeys) => _UM_save(bridge, profileId, providers, apiKeys),
    writeImageAgent: (model, force) => _UM_writeImageAgent(bridge, profileId, model, force),
    refresh: () => _UM_ensure(bridge, profileId, true),
  };
}

window.useModels = useModels;
