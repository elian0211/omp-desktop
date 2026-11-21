/* project-side.jsx — project side panel: Sessions fold + Explorer fold
   (docs/plans/2026-11-21-project-dock-layout/). Not mutually exclusive
   activity views — both folds can be open. */

const { Icon: _PSideIcon, TabRunDot: _PSideDot, RenameField: _PSideRename, FilesView, SidePanelStub } = window;
const { membersNewestFirst: _psMembers } = window.OMP_PROJECT_NAV;

function _PSideFold({ id, title, open, onToggle, children, grow }) {
  return (
    <section className={`pside-fold${open ? "" : " closed"}${grow ? " grow" : ""}`}>
      <button type="button" className="pside-fold-head" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className={`pside-chev${open ? " open" : ""}`} aria-hidden="true">
          <_PSideIcon name="chevR" size={10} />
        </span>
        <span className="pside-fold-title">{title}</span>
      </button>
      {open && <div className="pside-fold-body">{children}</div>}
    </section>
  );
}

/** Sessions of the active project only; click focuses/opens a tab. */
function ProjectSessionsFold({
  group, activeId, onSelectTab, onCloseTab, onRenameTab, onNewInProject, onReorder,
}) {
  const [renaming, setRenaming] = React.useState(null);
  const reorder = window.useDragReorder(onReorder);
  if (!group) {
    return <div className="pside-empty">{OMP_TR("Open a workspace to see its sessions.")}</div>;
  }
  const members = `members:${group.key}`;
  const rows = _psMembers(group);
  return (
    <div className="pside-sessions" onPointerDown={reorder.onPointerDown}>
      {rows.map(t => (
        <div key={t.id}
          {...reorder.itemProps(members, t.id, "y")}
          className={`psb-row psb-tab ${t.id === activeId ? "active" : ""}${reorder.dropClass(members, t.id)}`}>
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
      ))}
      {group.path && (
        <button type="button" className="pside-new"
          onClick={() => onNewInProject(group.path, group.profile)}>
          <_PSideIcon name="plus" size={10} />
          {OMP_TR("new conversation")}
        </button>
      )}
    </div>
  );
}

function ProjectSide({
  open, folds, onToggleFold,
  group, activeId, noTab,
  onSelectTab, onCloseTab, onRenameTab, onNewInProject, onReorder,
  files, onOpenFile, onReference, onReveal,
}) {
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
        />
      </_PSideFold>
      <_PSideFold id="explorer" title={OMP_TR("Explorer")} open={folds.explorer !== false}
        onToggle={onToggleFold} grow>
        {noTab
          ? <SidePanelStub title={OMP_TR("Explorer")} hint={OMP_TR("Open a workspace to browse this tab's files.")} />
          : <FilesView ui={files} onOpen={onOpenFile}
            onReference={onReference}
            onReveal={onReveal} />}
      </_PSideFold>
    </div>
  );
}

Object.assign(window, { ProjectSide, ProjectSessionsFold });
