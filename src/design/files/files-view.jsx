/* ═════════════════════════════════════════════════════════════════════
   files/files-view.jsx — the Explorer fold's project file tree
   (docs/plans/2026-11-21-project-dock-layout/). Selecting a file goes
   through `onOpen`; app-live wires that to the tool dock's File preview
   (`handlePreviewFile`). The stage FilesPanel (comment detail) stays a
   separate handoff from the preview header.

   Props: { ui, onOpen, onReference, onReveal }
     ui    — useFileComments (app/use-file-comments.jsx); the same object
             the stage FilesPanel gets, so selection and marks stay shared
     onOpen— path → open that file (File dock preview in app-live)
     onReference — path → appends `@path` to the tab's composer draft
                   (the tree's right-click menu)
     onReveal    — path → reveal the file in the OS file manager
   ═════════════════════════════════════════════════════════════════════ */
const { Icon: _FV_Icon, GitFileTree: _FV_Tree, FilesMenu: _FV_Menu } = window;

function FilesView({ ui, onOpen, onReference, onReveal, showFilter = true }) {
  // A file row's right-click menu ({x, y, path, deleted}); opened from the
  // tree, closed by click-away, Escape, a scroll or a resize. Hooks stay
  // above the no-folder early return.
  const [menu, setMenu] = React.useState(null);
  const closeMenu = React.useCallback(() => setMenu(null), []);
  if (!ui.hasFolder) {
    return (
      <div className="side-view-empty">
        <_FV_Icon name="folder" size={18} />
        <p>{OMP_TR("No project folder")}</p>
        <p className="side-view-empty-sub">{OMP_TR("This tab was opened without a folder.")}</p>
      </div>
    );
  }
  const repo = ui.scope === "repo";
  const tree = repo ? ui.repoTree : ui.tree;
  const changedCount = repo ? (ui.repoTree?.changed ?? 0) : ui.changedCount;
  const activeTab = ui.view.changedOnly ? "changes" : repo ? "repo" : "project";
  return (
    <div className="files-view">
      <_FV_Tree
        headless
        root={tree} error={ui.treeError} truncated={repo ? false : ui.truncated}
        expanded={ui.expanded} onToggle={ui.toggleDir}
        selected={ui.view.selected}
        onSelect={repo && ui.repoRoot ? p => onOpen(`${ui.repoRoot}/${p}`) : onOpen}
        changedOnly={ui.view.changedOnly && !ui.searchMode}
        filter={ui.view.filter} onFilter={ui.setFilter}
        changedCount={changedCount}
        badges={repo ? null : ui.counts.byPath}
        searched={ui.searchMode}
        filterOpen={showFilter}
        emptyText={ui.searchMode && !ui.view.filter.trim()
          ? OMP_TR("Not a git repository: type to search the folder.") : undefined}
        onFileContext={(node, e) => setMenu({
          x: e.clientX, y: e.clientY,
          path: repo && ui.repoRoot ? `${ui.repoRoot}/${node.path}` : node.path,
          deleted: node.status === "Deleted",
        })}
      />
      {/* 项目文件 / 仓库文件 / 改动文件: the folder-cut tree, the whole
          repository tree, and the changed-files filter; 改动文件 keeps the
          folder scope (the read paths are folder-relative). */}
      <div className="fv-foot">
        <div className="fv-tabs" role="tablist" aria-label={OMP_TR("file filter")}>
          {[
            { id: "project", label: OMP_TR("project files") },
            { id: "repo", label: OMP_TR("repository files") },
            { id: "changes", label: <><_FV_Icon name="diff2" size={11} /> {changedCount} {OMP_TR("changed files")}</> },
          ].map(tab => (
            <button type="button" key={tab.id} role="tab" aria-selected={activeTab === tab.id}
              className={`fv-tab${activeTab === tab.id ? " on" : ""}`}
              onClick={() => (tab.id === "changes" ? ui.setChangedOnly(true)
                : (ui.setChangedOnly(false), ui.setScope(tab.id)))}>
              {tab.label}
            </button>
          ))}
        </div>
        <span className="fv-spacer" />
        {ui.counts.files > 0 && !repo && !ui.searchMode && (
          <button type="button" className={`btn ghost gitb-toggle gitb-commented ${ui.commentedOnly ? "on" : ""}`}
            onClick={() => ui.setCommentedOnly(!ui.commentedOnly)} aria-pressed={ui.commentedOnly}
            title={ui.commentedOnly ? OMP_TR("show every file") : OMP_TR("show commented files only")}>
            <_FV_Icon name="edit" size={11} /> {ui.counts.files} {OMP_TR("commented")}
          </button>
        )}
      </div>
      {menu && <_FV_Menu menu={menu} close={closeMenu} onReference={onReference} onReveal={onReveal} />}
    </div>
  );
}

window.FilesView = FilesView;
