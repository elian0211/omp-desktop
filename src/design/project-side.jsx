/* project-side.jsx — project side panel: Sessions fold + Explorer fold
   (docs/plans/2026-11-21-project-dock-layout/). Not mutually exclusive
   activity views — both folds can be open. */

const { Icon: _PSideIcon, TabRunDot: _PSideDot, RenameField: _PSideRename, FilesView } = window;
const { membersNewestFirst: _psMembers } = window.OMP_PROJECT_NAV;

/** The side panel's no-content hint (a fold with nothing to show yet). */
function SidePanelStub({ title, hint }) {
  return (
    <div className="side-panel-stub">
      <div className="psb-head">{title}</div>
      <div className="side-panel-stub-body">{hint}</div>
    </div>
  );
}

function _PSideFold({ id, title, open, onToggle, children, grow, extra }) {
  return (
    <section className={`pside-fold${open ? "" : " closed"}${grow ? " grow" : ""}`}>
      <button type="button" className="pside-fold-head" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className={`pside-chev${open ? " open" : ""}`} aria-hidden="true">
          <_PSideIcon name="chevR" size={10} />
        </span>
        <span className="pside-fold-title">{title}</span>
        {extra && <span className="pside-fold-extra" onClick={e => e.stopPropagation()}>{extra}</span>}
      </button>
      {open && <div className="pside-fold-body">{children}</div>}
    </section>
  );
}

/** Sessions of the active project only; click focuses/opens a tab. A row's
 *  right-click menu offers rename, archive and delete (ompweb's session
 *  actions; both file ops need the conversation's persisted file and a
 *  non-busy agent — the tab is closed before the file is touched, which a
 *  busy agent must not be). Delete confirms inline in the row, like
 *  ompweb's; archive just runs (the file survives in the archive). */
function ProjectSessionsFold({
  group, activeId, onSelectTab, onCloseTab, onRenameTab, onNewInProject, onReorder,
  onArchiveSession, onDeleteSession,
}) {
  const [renaming, setRenaming] = React.useState(null);
  const [menu, setMenu] = React.useState(null); // { x, y, tab }
  const [confirmDelete, setConfirmDelete] = React.useState(null); // tab id
  const menuRef = React.useRef(null);
  const reorder = window.useDragReorder(onReorder);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onDown = e => { if (!menuRef.current?.contains(e.target)) close(); };
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  if (!group) {
    return <div className="pside-empty">{OMP_TR("Open a workspace to see its sessions.")}</div>;
  }
  const members = `members:${group.key}`;
  const rows = _psMembers(group);
  // Archive/delete need a persisted session file and an idle agent: the
  // handler closes the tab before touching the file, which a busy agent
  // must not allow, and a conversation that never wrote a file has nothing
  // to operate on.
  const opBlocked = t => !t.sessionFile || ["running", "retrying", "waiting-user"].includes(t.runState);
  const opBlockTitle = t => !t.sessionFile
    ? OMP_TR("the conversation has no file yet")
    : OMP_TR("the conversation is still working");
  const closeMenu = () => setMenu(null);
  return (
    <div className="pside-sessions" onPointerDown={reorder.onPointerDown}>
      {rows.map(t => (
        confirmDelete === t.id ? (
          <div key={t.id} className="psb-row psb-confirm">
            <span className="psb-confirm-q">{OMP_TR("delete this conversation?")}</span>
            <button type="button" className="psb-confirm-btn danger"
              onClick={() => { setConfirmDelete(null); onDeleteSession(t); }}>
              {OMP_TR("delete")}
            </button>
            <button type="button" className="psb-confirm-btn"
              onClick={() => setConfirmDelete(null)}>
              {OMP_TR("Cancel")}
            </button>
          </div>
        ) : (
        <div key={t.id}
          {...reorder.itemProps(members, t.id, "y")}
          className={`psb-row psb-tab ${t.id === activeId ? "active" : ""}${reorder.dropClass(members, t.id)}`}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            if (renaming !== t.id) setMenu({ x: e.clientX, y: e.clientY, tab: t });
          }}>
          {renaming === t.id ? (
            <div className="psb-main psb-editing">
              <_PSideRename value={t.name}
                onCommit={name => onRenameTab(t.id, name)}
                onClose={() => setRenaming(null)} />
            </div>
          ) : (
            <button type="button" className="psb-main" title={t.name}
              onClick={() => onSelectTab(t.id)}
              onDoubleClick={() => { onSelectTab(t.id); setRenaming(t.id); }}>
              <span className="psb-name">{t.name}</span>
              <_PSideDot state={t.runState} />
            </button>
          )}
          <span className="psb-actions">
            {renaming !== t.id && (
              <button type="button" className="psb-act" title={OMP_TR("rename conversation")}
                onClick={() => { onSelectTab(t.id); setRenaming(t.id); }}>
                <_PSideIcon name="edit" size={10} />
              </button>
            )}
            <button type="button" className="psb-act" title={OMP_TR("close tab")}
              onClick={() => onCloseTab(t.id)}>
              <_PSideIcon name="close" size={9} />
            </button>
          </span>
        </div>
        )
      ))}
      {group.path && (
        <button type="button" className="pside-new"
          onClick={() => onNewInProject(group.path, group.profile)}>
          <_PSideIcon name="plus" size={10} />
          {OMP_TR("new conversation")}
        </button>
      )}
      {menu && ReactDOM.createPortal(
        <div ref={menuRef} className="pstrip-pop" style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 208)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 140)) }}
          role="menu" aria-label={menu.tab.name}
          onKeyDown={e => window.menuKeyNav(e, menuRef.current, '[role="menuitem"]', closeMenu)}>
          <button type="button" className="pstrip-item" role="menuitem"
            onClick={() => { closeMenu(); onSelectTab(menu.tab.id); setRenaming(menu.tab.id); }}>
            <_PSideIcon name="edit" size={11} />
            <span>{OMP_TR("rename conversation")}</span>
          </button>
          <button type="button" className="pstrip-item" role="menuitem" title={menu.tab.sessionFile}
            disabled={opBlocked(menu.tab)}
            onClick={() => { closeMenu(); onArchiveSession(menu.tab); }}>
            <_PSideIcon name="layers" size={11} />
            <span>{OMP_TR("archive session")}</span>
          </button>
          <button type="button" className="pstrip-item" role="menuitem"
            title={opBlocked(menu.tab) ? opBlockTitle(menu.tab) : menu.tab.sessionFile}
            disabled={opBlocked(menu.tab)}
            onClick={() => { closeMenu(); setConfirmDelete(menu.tab.id); }}>
            <_PSideIcon name="trash" size={11} />
            <span>{OMP_TR("delete session")}</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ProjectSide({
  open, folds, onToggleFold,
  group, activeId, noTab,
  onSelectTab, onCloseTab, onRenameTab, onNewInProject, onReorder,
  onArchiveSession, onDeleteSession,
  files, onOpenFile, onReference, onReveal,
}) {
  // The Explorer's name filter stays hidden until the fold header's
  // search icon asks for it; closing it clears the text.
  const [filterOpen, setFilterOpen] = React.useState(false);
  if (!open) return null;
  return (
    <div className="side-panel project-side" role="region" aria-label={OMP_TR("Project side")}>
      <_PSideFold id="sessions" title={OMP_TR("Sessions")} open={folds.sessions !== false}
        onToggle={onToggleFold}>
        <ProjectSessionsFold
          group={group}
          activeId={activeId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onRenameTab={onRenameTab}
          onNewInProject={onNewInProject}
          onReorder={onReorder}
          onArchiveSession={onArchiveSession}
          onDeleteSession={onDeleteSession}
        />
      </_PSideFold>
      <_PSideFold id="explorer" title={OMP_TR("Explorer")} open={folds.explorer !== false}
        onToggle={onToggleFold} grow
        extra={!noTab && (
          <button type="button" className={`pside-head-btn${filterOpen ? " on" : ""}`}
            aria-pressed={filterOpen} aria-label={OMP_TR("filter files")}
            title={filterOpen ? OMP_TR("hide the filter") : OMP_TR("filter files")}
            onClick={() => { if (filterOpen) files.setFilter(""); setFilterOpen(!filterOpen); }}>
            <_PSideIcon name="search" size={11} />
          </button>
        )}>
        {noTab
          ? <SidePanelStub title={OMP_TR("Explorer")} hint={OMP_TR("Open a workspace to browse this tab's files.")} />
          : <FilesView ui={files} onOpen={onOpenFile} showFilter={filterOpen}
            onReference={onReference}
            onReveal={onReveal} />}
      </_PSideFold>
    </div>
  );
}

Object.assign(window, { ProjectSide, ProjectSessionsFold, SidePanelStub });
