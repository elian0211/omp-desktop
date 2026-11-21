/* project-strip.jsx — far-left open-project switcher under the toolbar
   (docs/plans/2026-11-21-project-dock-layout/). One button per
   (profile, folder) group; click focuses that project's target session. */

const { Icon: _PS_Icon, TabRunDot: _PS_RunDot } = window;
const {
  groupTabs: _psGroups, groupRunState: _psRun, groupTarget: _psTarget,
  projectAbbr: _psAbbr, basename: _psBase, parentName: _psParent,
} = window.OMP_PROJECT_NAV;

/** The + menu sits right of the trigger, growing up from its bottom edge. */
function _ps_place(trigger) {
  const rect = trigger.getBoundingClientRect();
  return {
    left: Math.max(8, Math.min(rect.right + 6, window.innerWidth - 248)),
    bottom: window.innerHeight - rect.bottom,
    maxHeight: Math.max(120, rect.bottom - 12),
  };
}

function ProjectStrip({
  tabs, activeId, projectAppearances, recents,
  profileLabel, onSelectTab, onOpenRecent, onForgetRecent, onOpenFolder,
}) {
  const groups = _psGroups(tabs || []);
  // The + opens the recents menu (one recents surface — decisions.md rule 7);
  // outside click leaves focus, Escape returns it, as branch-menu.jsx.
  const [place, setPlace] = React.useState(null);
  const addRef = React.useRef(null);
  const popRef = React.useRef(null);
  const rootRef = React.useRef({
    contains: node => addRef.current?.contains(node) || popRef.current?.contains(node),
  });
  const { busy, pick, close } = window.useMenuPick(addRef, () => setPlace(null));
  window.usePopoverDismiss(place !== null, rootRef, () => close(false), close);
  const openMenu = () => (place ? close() : setPlace(_ps_place(addRef.current)));
  return (
    <nav className="project-strip" aria-label={OMP_TR("Projects")}>
      <div className="project-strip-list">
        {groups.map(group => {
          const active = group.tabs.some(t => t.id === activeId);
          const appearance = window.OMP_PROJECT_APPEARANCE.forProject(projectAppearances, group.path);
          const accent = appearance?.accent || "var(--fg-4)";
          const tip = [
            group.path || group.name,
            profileLabel?.(group.profile),
          ].filter(Boolean).join("\n");
          const abbr = _psAbbr(group.name, 2);
          return (
            <button
              key={group.key}
              type="button"
              className={`project-strip-btn${active ? " active" : ""}`}
              title={tip}
              aria-label={tip}
              aria-pressed={active}
              onClick={() => onSelectTab(_psTarget(group, activeId))}
              style={{ "--ps-accent": accent }}
            >
              <span className="project-strip-abbr mono">{abbr}</span>
              <_PS_RunDot state={_psRun(group.tabs)} />
            </button>
          );
        })}
      </div>
      <button
        ref={addRef}
        type="button"
        className="project-strip-btn add"
        title={OMP_TR("Open a workspace")}
        aria-label={OMP_TR("Open a workspace")}
        aria-haspopup="menu"
        aria-expanded={place !== null}
        onClick={openMenu}
      >
        <_PS_Icon name="plus" size={14} />
      </button>
      {place !== null && ReactDOM.createPortal(
        <div ref={popRef} className={`pstrip-pop${busy ? " busy" : ""}`} style={place} role="menu"
          aria-label={OMP_TR("Open a workspace")}
          onKeyDown={e => window.menuKeyNav(e, popRef.current, '[role="menuitem"]', close)}>
          <div className="pstrip-pop-head mono">{OMP_TR("recent")}</div>
          <div className="pstrip-pop-list">
            {recents.length === 0 && (
              <div className="pstrip-pop-note">{OMP_TR("no recent projects")}</div>
            )}
            {recents.map(r => (
              <div key={r.path} className="pstrip-row">
                <button type="button" className="pstrip-item" role="menuitem" title={r.path}
                  onClick={() => pick(() => onOpenRecent(r.path), e => e.message)}>
                  <_PS_Icon name="folder" size={11} color="var(--fg-5)" />
                  <span className="pstrip-item-name">
                    {_psBase(r.path)}
                    <span className="pstrip-item-parent">{_psParent(r.path)}</span>
                  </span>
                </button>
                <button type="button" className="pstrip-item-x" role="menuitem"
                  title={OMP_TR("remove from recent")}
                  aria-label={`${OMP_TR("remove from recent")}: ${_psBase(r.path)}`}
                  onClick={() => onForgetRecent(r.path)}>
                  <_PS_Icon name="close" size={9} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="pstrip-item pstrip-open" role="menuitem"
            onClick={() => pick(() => onOpenFolder(), e => e.message)}>
            <_PS_Icon name="plus" size={11} />
            <span>{OMP_TR("open folder…")}</span>
          </button>
        </div>,
        document.body,
      )}
    </nav>
  );
}

Object.assign(window, { ProjectStrip });
