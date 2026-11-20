/* ═════════════════════════════════════════════════════════════════════
   workspaces-view.jsx — Workspaces activity view (phase 1 of
   docs/plans/2026-11-20-workspace-layout/). Port of the former project
   sidebar: open tabs grouped by folder+profile, sessions with run dots,
   recents, browse. Tab bar stays the strip of open conversations.
   ═════════════════════════════════════════════════════════════════════ */

const { Icon, TabRunDot, TabLabel, RenameField } = window;
const { groupTabs, groupRunState, groupTarget, membersNewestFirst, basename, parentName } = window.OMP_PROJECT_NAV;

function WorkspacesView({
  tabs, activeId, recents, profileLabel, projectAppearances,
  onSelectTab, onCloseTab, onRenameTab, onNewInProject, onOpenRecent, onForgetRecent, onOpenFolder, onReorder,
}) {
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = key => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const [renaming, setRenaming] = React.useState(null);
  const startRename = id => { onSelectTab(id); setRenaming(id); };
  const renameField = t => (
    <RenameField value={t.name}
      onCommit={name => onRenameTab(t.id, name)}
      onClose={() => setRenaming(null)} />
  );
  const actButton = (title, icon, size, onClick) => (
    <button className="psb-act" title={title} onClick={onClick}>
      <Icon name={icon} size={size} />
    </button>
  );
  const renameButton = t => actButton(OMP_TR("rename conversation"), "edit", 10, () => startRename(t.id));
  const closeButton = id => actButton(OMP_TR("close tab"), "close", 9, () => onCloseTab(id));
  const groups = groupTabs(tabs);
  const reorder = window.useDragReorder(onReorder);

  return (
    <div className="workspaces-view" aria-label={OMP_TR("Workspaces")}>
      <div className="psb-head">{OMP_TR("Workspaces")}</div>

      <div className="psb-scroll" onPointerDown={reorder.onPointerDown}>
        <div className="psb-section">{OMP_TR("open tabs")}</div>
        {groups.length === 0 && <div className="psb-empty">{OMP_TR("no open tabs")}</div>}
        {groups.map(group => {
          const multi = group.tabs.length > 1;
          const expanded = multi && !collapsed[group.key];
          const containsActive = group.tabs.some(t => t.id === activeId);
          const profile = profileLabel(group.profile);
          const editing = !multi && renaming === group.tabs[0].id;
          const appearance = window.OMP_PROJECT_APPEARANCE.forProject(projectAppearances, group.path);
          const folderColor = appearance?.accent || (containsActive ? "var(--accent)" : "var(--fg-4)");
          const folderIcon = <Icon name="folder" size={11} color={folderColor} />;
          const cardTip = multi
            ? (group.path || group.name)
            : [group.tabs[0].name, group.path].filter(Boolean).join("\n");
          const members = `members:${group.key}`;
          return (
            <div key={group.key} {...reorder.itemProps("projects", group.key, "y")}
              className={`psb-group${reorder.dropClass("projects", group.key)}`}>
              <div className={`psb-row psb-project ${containsActive && !expanded ? "active" : ""}`}>
                {multi ? (
                  <button className={`psb-chev ${expanded ? "open" : ""}`}
                    title={expanded ? OMP_TR("collapse") : OMP_TR("expand")} aria-expanded={expanded}
                    onClick={e => { e.stopPropagation(); toggle(group.key); }}>
                    <Icon name="chevR" size={10} />
                  </button>
                ) : <span className="psb-chev-spacer" />}
                {editing ? (
                  <div className="psb-main psb-editing">
                    {folderIcon}
                    {renameField(group.tabs[0])}
                  </div>
                ) : (
                  <button className="psb-main" title={cardTip}
                    onClick={() => onSelectTab(groupTarget(group, activeId))}
                    onDoubleClick={() => { if (!multi) startRename(group.tabs[0].id); }}>
                    {folderIcon}
                    {multi
                      ? <span className="psb-name">{group.name}</span>
                      : <TabLabel tab={group.tabs[0]} className="psb-name" />}
                    {profile && (
                      <span className="chip muted tab-profile" title={`${OMP_TR("profile:")} ${profile}`}>{profile}</span>
                    )}
                    <TabRunDot state={groupRunState(group.tabs)} />
                    {multi && <span className="tab-count psb-count">{group.tabs.length}</span>}
                  </button>
                )}
                <span className="psb-actions">
                  {group.path && actButton(OMP_TR("new conversation here"), "plus", 10, () => onNewInProject(group.path, group.profile))}
                  {!multi && !editing && renameButton(group.tabs[0])}
                  {!multi && closeButton(group.tabs[0].id)}
                </span>
              </div>
              {expanded && membersNewestFirst(group).map(t => (
                <div key={t.id} {...reorder.itemProps(members, t.id, "y")}
                  className={`psb-row psb-tab ${t.id === activeId ? "active" : ""}${reorder.dropClass(members, t.id)}`}>
                  {renaming === t.id ? (
                    <div className="psb-main psb-editing">{renameField(t)}</div>
                  ) : (
                    <button className="psb-main" title={t.name} onClick={() => onSelectTab(t.id)}
                      onDoubleClick={() => startRename(t.id)}>
                      <span className="psb-name">{t.name}</span>
                      <TabRunDot state={t.runState} />
                    </button>
                  )}
                  <span className="psb-actions">
                    {renaming !== t.id && renameButton(t)}
                    {closeButton(t.id)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        <div className="psb-section">{OMP_TR("recent")}</div>
        {recents.length === 0 && <div className="psb-empty">{OMP_TR("no recent projects")}</div>}
        {recents.map(r => (
          <div key={r.path} className="psb-row psb-recent">
            <span className="psb-chev-spacer" />
            <button className="psb-main" title={r.path} onClick={() => onOpenRecent(r.path)}>
              <Icon name="folder" size={11} color="var(--fg-5)" />
              <span className="psb-name">
                {basename(r.path)}
                <span className="psb-parent">{parentName(r.path)}</span>
              </span>
            </button>
            <span className="psb-actions">
              {actButton(OMP_TR("remove from recent"), "close", 9, () => onForgetRecent(r.path))}
            </span>
          </div>
        ))}
      </div>

      <button className="psb-foot" onClick={onOpenFolder}>
        <Icon name="plus" size={11} />{OMP_TR("open folder…")}
      </button>
    </div>
  );
}

Object.assign(window, { WorkspacesView });
