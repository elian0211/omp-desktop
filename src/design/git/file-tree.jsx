/* git/file-tree.jsx — the git browser's files pane: Rust's tree with git
   status marks, a changed-only filter and a name filter. While a commit is
   browsed the tree is the files it touched: changed-only is forced on, its
   toggle hidden and the head names the commit. Changed-only shows every
   directory open, so a directory row is inert there (the shared expansion
   set is the full tree's). Row logic is app/git-browser.js
   (OMP_GIT_BROWSER). `onFileContext` fires for file **and folder** rows
   (node, event) — the Files activity view's menu references folders too.

   The files panel (design/files/) mounts it too, with optional props:
   `badges` (Map path → count, a number after the file's name),
   `commented` ({ count, on, onToggle }: a head toggle), `allFiles`
   ({ on, onToggle }: ignored paths from Rust), `searched` (the root
   already holds the filter's hits: listed flat, unfiltered), `emptyText`
   (the message for an empty list) and `onFileContext` (node, event: a
   file or folder row's right click; the git browser passes its own
   `allFiles`). */

const { Icon: _GT_Icon } = window;
const { flatten: _GT_flatten, filterFiles: _GT_filterFiles } = window.OMP_GIT_BROWSER;

const GIT_STATUS_META = {
  Modified:  { label: "M", color: "var(--amber)",  title: "modified" },
  Added:     { label: "+", color: "var(--accent)", title: "added" },
  Deleted:   { label: "D", color: "var(--rose)",   title: "deleted" },
  Renamed:   { label: "R", color: "var(--cyan)",   title: "renamed" },
  Untracked: { label: "+", color: "var(--fg-3)",   title: "untracked" },
  Ignored:   { label: "×", color: "var(--fg-4)",   title: "ignored" },
};

function GitFileTree({
  root, error, expanded, onToggle, selected, onSelect, changedOnly, onChangedOnly,
  filter, onFilter, changedCount, commit, truncated, badges, commented, searched = false, emptyText, onFileContext, allFiles, headless = false, filterOpen = true,
}) {
  const rows = React.useMemo(() => {
    if (searched) return (root?.children ?? []).map(node => ({ node, depth: 0, flat: true }));
    // A name filter lists matching files flat: the tree would need every
    // ancestor expanded to show them, and the match is on the whole path.
    if (filter.trim()) return _GT_filterFiles(root, filter, changedOnly).map(node => ({ node, depth: 0, flat: true }));
    return _GT_flatten(root, expanded, changedOnly);
  }, [root, expanded, changedOnly, filter, searched]);

  let empty = null;
  if (error) empty = error;
  // A failed status replaces the whole browser, so no root and no error
  // means still loading.
  else if (!root) empty = "loading…";
  else if (rows.length === 0) empty = emptyText ?? (filter.trim() ? "no match" : changedOnly && !commit ? "no changes" : "no files");

  return (
    <div className="gitb-pane gitb-files">
      {!headless && (
      <div className="gitb-pane-head">
        <span className="gitb-pane-title">{OMP_TR("files")}</span>
        {commit && (
          <span className="gitb-pane-sub mono" title={commit.id}>{commit.short} · {window.OMP_I18N.plural(commit.files, "{n} file", "{n} files", { n: commit.files })}</span>
        )}
        {commented && (
          <button type="button" className={`btn ghost gitb-toggle gitb-commented ${commented.on ? "on" : ""}`}
            onClick={() => commented.onToggle(!commented.on)} aria-pressed={commented.on}
            title={commented.on ? OMP_TR("show every file") : OMP_TR("show commented files only")}>
            <_GT_Icon name="edit" size={11} />
            <span>{commented.count} {OMP_TR("commented")}</span>
          </button>
        )}
        {onChangedOnly && (
          <button type="button" className={`btn ghost gitb-toggle ${changedOnly ? "on" : ""}`}
            onClick={() => onChangedOnly(!changedOnly)} title={changedOnly ? "show every file" : "show changed files only"}
            aria-pressed={changedOnly}>
            <_GT_Icon name="diff2" size={11} />
            <span>{changedCount} {OMP_TR("changed")}</span>
          </button>
        )}
        {allFiles && (
          <button type="button" className={`btn ghost gitb-toggle ${allFiles.on ? "on" : ""}`}
            onClick={() => allFiles.onToggle(!allFiles.on)}
            title={allFiles.on ? OMP_TR("hide ignored files") : OMP_TR("show ignored files too")}
            aria-pressed={allFiles.on}>
            <span>{OMP_TR("all files")}</span>
          </button>
        )}
      </div>
      )}
      {/* Hidden until asked for: the Explorer fold's header toggle opens it
          (`filterOpen`); the git browser keeps it always on. */}
      {filterOpen && (
        <div className="gitb-filter">
          <_GT_Icon name="search" size={11} color="var(--fg-4)" />
          <input className="gitb-filter-input mono" value={filter} onChange={e => onFilter(e.target.value)}
            placeholder={OMP_TR("filter files")} spellCheck={false} />
          {filter && <button type="button" className="btn ghost icon" onClick={() => onFilter("")} aria-label={OMP_TR("clear filter")}><_GT_Icon name="close" size={10} /></button>}
        </div>
      )}
      <div className="gitb-tree" role="tree">
        {empty && <div className={`gitb-empty ${error ? "gitb-error" : ""}`}>{empty}</div>}
        {!error && rows.map(({ node, depth, flat }) => {
          const meta = node.status ? GIT_STATUS_META[node.status] : null;
          const active = !node.dir && node.path === selected;
          // An ignored directory is collapsed by Rust (its content is all
          // ignored): rendered like a file, no expansion.
          const leaf = !node.dir || node.status === "Ignored";
          // A file and a dir can share a path ("x" deleted, "x/a" added).
          return (
            <div key={`${node.dir ? "d" : "f"}:${node.path}`} role="treeitem" aria-selected={active}
              aria-expanded={node.dir && !leaf ? changedOnly || expanded.has(node.path) : undefined}
              className={`gitb-row ${node.dir ? "dir" : "file"} ${node.dir && (changedOnly || leaf) ? "inert" : ""} ${active ? "active" : ""} ${node.status === "Deleted" ? "deleted" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                if (leaf) { if (!node.dir) onSelect(node.path); }
                else if (!changedOnly) onToggle(node.path);
              }}
              onContextMenu={(e) => {
                if (!onFileContext) return;
                e.preventDefault();
                onFileContext(node, e);
              }}>
              {leaf
                ? <span className="gitb-row-pad" />
                : <_GT_Icon name={changedOnly || expanded.has(node.path) ? "chev" : "chevR"} size={11} color="var(--fg-4)" />}
              <span className="gitb-row-name" style={meta ? { color: meta.color } : undefined}>
                {flat ? node.path : node.name}
              </span>
              {node.dir && node.changed > 0 && !changedOnly && <span className="gitb-dot" title={OMP_TR("{n} changed", { n: node.changed })} />}
              {!node.dir && badges?.get(node.path) > 0 && <span className="gitb-badge mono">{badges.get(node.path)}</span>}
              {meta && <span className="gitb-mark mono" style={{ color: meta.color }} title={meta.title}>{meta.label}</span>}
            </div>
          );
        })}
        {!error && root && truncated && <div className="gitb-empty">{OMP_TR("list truncated — too many files to show them all")}</div>}
      </div>
    </div>
  );
}

window.GitFileTree = GitFileTree;
window.GIT_STATUS_META = GIT_STATUS_META;
