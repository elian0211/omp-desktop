/* app/use-intelligence.jsx — the React side of Settings → Intelligence:
   one shared snapshot of omp's Intelligence settings + model roles for a
   profile (src-tauri `intelligence_settings_get`/`_set`), fetched while
   the Settings tab is active and shared by every row of the section
   through a module-level cache — `omp config get` spawns omp per key, so
   twelve rows must not mean twelve fetches.

   Same per-profile shape as useGoalContinuation (app/use-goal-mode.jsx):
   per profile, not per tab; a reply for a profile left meanwhile is
   never shown; omp's reason for a failed read or write is. */

const _UI_store = {
  profile: null, snap: null, error: null, busy: false,
  load: null, listeners: new Set(),
};

const _UI_notify = () => { for (const fn of _UI_store.listeners) fn(); };

const _UI_set = (part) => { Object.assign(_UI_store, part); _UI_notify(); };

/** Fetch the snapshot for `profileId` unless one is already known or in
 *  flight for it. Returns nothing; subscribers re-render on arrival. */
const _UI_ensure = (bridge, profileId) => {
  if (!bridge || !profileId) return;
  if (_UI_store.profile === profileId && (_UI_store.snap || _UI_store.error || _UI_store.load)) return;
  const load = bridge.intelligenceSettings(profileId).then(res => {
    if (_UI_store.load !== load) return;
    _UI_set({
      profile: profileId, load: null, busy: false,
      snap: res?.ok ? res.value : null,
      error: res?.ok ? null : res?.error ?? "could not read omp's settings",
    });
  });
  _UI_set({ profile: profileId, snap: null, error: null, busy: false, load });
};

/** Apply a partial patch (app/intelligence.js `rowPatch` shape) and adopt
 *  the re-read snapshot omp reports; the error keeps the old snapshot. */
const _UI_patch = async (bridge, profileId, patch) => {
  if (!bridge || !profileId || _UI_store.busy) return;
  _UI_set({ busy: true, error: null });
  const res = await bridge.setIntelligenceSettings(profileId, patch);
  if (_UI_store.profile !== profileId) return;
  _UI_set(res?.ok
    ? { busy: false, snap: res.value, error: null }
    : { busy: false, error: res?.error ?? "could not save the change" });
};

/** `useIntelligence(bridge, profileId, active)` — the shared snapshot for
 *  `profileId` (`{snap, error, busy, patch}`), or `snap: null` while it
 *  loads / for another profile. */
function useIntelligence(bridge, profileId, active) {
  const [, bump] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    _UI_store.listeners.add(bump);
    return () => { _UI_store.listeners.delete(bump); };
  }, []);
  React.useEffect(() => {
    if (active) _UI_ensure(bridge, profileId);
  }, [bridge, profileId, active]);
  const mine = _UI_store.profile === profileId;
  return {
    snap: mine ? _UI_store.snap : null,
    error: mine ? _UI_store.error : null,
    busy: mine && _UI_store.busy,
    patch: (p) => _UI_patch(bridge, profileId, p),
  };
}

window.useIntelligence = useIntelligence;
