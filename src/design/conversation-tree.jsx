/* design/conversation-tree.jsx — the conversation-tree pane: the active tab's
   conversation as a git-style graph, one row per prompt, each with its
   prompt-cache state (src/app/conversation-tree.js builds the rows; the data
   flow is app/use-conversation-tree.jsx). It renders in the tool dock's
   Tree pane (design/tool-dock.css). Props mirror the hook's result;
   `onBranch`/`onFork`/`onOpenFile` are its actions. */

const {
  TreeFmt: _CT_Fmt, TreeRow: _CT_Row,
  TreeCompaction: _CT_Compaction, TreeDetail: _CT_Detail,
} = window;

const TREE_NO_FILE = "No conversation yet. The tree appears once the tab has a session file.";

const treeTtlLabel = ttlMs => (ttlMs == null ? "cache lifetime unknown" : `cache · ${_CT_Fmt.dur(ttlMs)}`);

function TreeSummary({ model }) {
  const c = model.counts;
  const unknown = c.total > 0 && c.unknown === c.total;
  return (
    <div className="tree-summary">
      {unknown ? (
        <div>{OMP_TR("The provider reports no cache lifetime, so cache status and prices are unknown.")}</div>
      ) : (<>
        <div>
          {OMP_TR("{warm} of {total} prompts can be re-asked at cache-read price", { warm: c.warm + c.expiring, total: c.total })}
          {c.partial > 0 && <>, <b className="cyan">{c.partial}</b> {OMP_TR("partly cached")}</>}.
        </div>
        <div className="tree-legend mono">
          <span><i className="lg warm" />{OMP_TR("cached")}</span>
          <span><i className="lg expiring" />{OMP_TR("< 10 min")}</span>
          <span><i className="lg partial" />{OMP_TR("partly cached")}</span>
          <span><i className="lg cold" />{OMP_TR("cold")}</span>
          <span className="muted">{OMP_TR("price = re-ask now")}</span>
        </div>
      </>)}
    </div>
  );
}

function ConversationTree({
  model, currentFile, error, loading, treeKey, now, since, streaming,
  onBranch, onFork, onOpenFile, onArchiveFile, onDeleteFile, openFiles,
}) {
  const [selectedId, setSelectedId] = React.useState(null);
  React.useEffect(() => { setSelectedId(null); }, [treeKey]);

  // A row's right-click menu. Branch/fork work on any prompt; the file
  // operations target the family file the row belongs to when that is not
  // the tab's own (`row.openFile`) — the tree is where a conversation's
  // branches are visible, so a stale parent branch can be archived or
  // deleted right where it shows. Delete confirms inside the menu (the
  // second click on the item); archive is leaf-only — a file other files
  // continue from must wait, and Rust refuses it again regardless.
  const [menu, setMenu] = React.useState(null); // { x, y, row }
  const [confirming, setConfirming] = React.useState(false);
  const menuRef = React.useRef(null);
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
  const openRowMenu = React.useCallback((e, r) => {
    setConfirming(false);
    setMenu({ x: e.clientX, y: e.clientY, row: r });
  }, []);

  const listRef = React.useRef(null);
  const scrolledFor = React.useRef("");
  // First load of a conversation: show the end (newest prompts).
  React.useLayoutEffect(() => {
    if (!model || model.rows.length === 0 || scrolledFor.current === treeKey) return;
    scrolledFor.current = treeKey;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [model, treeKey]);

  const prompts = React.useMemo(() => (model ? model.rows.filter(r => r.kind === "prompt") : []), [model]);
  const fallback = prompts.findLast(r => r.onCurrentPath) ?? prompts[prompts.length - 1] ?? null;
  const selected = prompts.find(r => r.id === selectedId) ?? fallback;
  // A tip tag has no inline error slot: the bridge files a failed open as a note.
  // Stable, so the memoized rows skip the re-renders every bridge update causes.
  const openTip = React.useCallback(
    path => onOpenFile(path).catch(err => console.error("[tree] open failed:", err)),
    [onOpenFile],
  );
  const branches = model?.tips.length ?? 0;
  const compactions = model ? model.rows.length - prompts.length : 0;

  let empty = null;
  if (error) empty = error;
  else if (!model) empty = treeKey && loading ? "Loading…" : TREE_NO_FILE;
  else if (prompts.length === 0) empty = "No prompts in this conversation yet.";

  return (
    <aside className="tree-drawer">
      <div className="tree-head">
        <span className="tree-title">{OMP_TR("conversation tree")}</span>
        {model && (
          <span className="chip muted mono">
            {model.counts.total} {OMP_TR("prompts")}
            {branches > 1 ? ` · ${branches} branches` : ""}
            {compactions > 0 ? ` · ${compactions} compactions` : ""}
          </span>
        )}
        {model && <span className="chip muted mono">{treeTtlLabel(model.ttlMs)}</span>}
      </div>
      {model && prompts.length > 0 && <TreeSummary model={model} />}
      <div className="tree-list" ref={listRef}>
        {empty && <div className="tree-empty">{empty}</div>}
        {model && model.rows.map(row => row.kind === "compaction"
          ? <_CT_Compaction key={row.id} row={row} now={now} />
          : <_CT_Row key={row.id} row={row} model={model} now={now} since={since}
              selected={selected?.id === row.id} currentFile={currentFile}
              onSelect={setSelectedId} onOpenTip={openTip}
              onContext={onArchiveFile ? openRowMenu : undefined} />)}
      </div>
      {model && selected && (
        <_CT_Detail key={selected.id} row={selected} tips={model.tips} now={now} since={since}
          streaming={streaming} onBranch={onBranch} onFork={onFork} onOpenFile={onOpenFile} />
      )}
      {menu && ReactDOM.createPortal(
        <div ref={menuRef} className="pstrip-pop" role="menu" aria-label={OMP_TR("conversation actions")}
          style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 240)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 190)) }}
          onKeyDown={e => window.menuKeyNav(e, menuRef.current, '[role="menuitem"]', () => setMenu(null))}>
          <button type="button" className="pstrip-item" role="menuitem"
            onClick={() => { setMenu(null); onBranch(menu.row.id); }}>
            <span className="mono">{OMP_TR("Branch here")}</span>
          </button>
          <button type="button" className="pstrip-item" role="menuitem"
            onClick={() => { setMenu(null); onFork(menu.row.id); }}>
            <span className="mono">{OMP_TR("Fork after the reply")}</span>
          </button>
          {menu.row.openFile && onArchiveFile && (
            <>
              <button type="button" className="pstrip-item" role="menuitem"
                onClick={() => { setMenu(null); onOpenFile(menu.row.openFile); }}>
                <span>{OMP_TR("Open in new tab")}</span>
              </button>
              <button type="button" className="pstrip-item" role="menuitem"
                disabled={openFiles?.has(menu.row.openFile) || (model.fileChildren.get(menu.row.openFile) ?? 0) > 0}
                title={(model.fileChildren.get(menu.row.openFile) ?? 0) > 0
                  ? OMP_TR("{n} later branches continue from this conversation — archive them first", { n: model.fileChildren.get(menu.row.openFile) })
                  : openFiles?.has(menu.row.openFile) ? OMP_TR("the conversation is open in another tab") : menu.row.openFile}
                onClick={() => { setMenu(null); onArchiveFile(menu.row.openFile); }}>
                <span>{OMP_TR("archive session")}</span>
              </button>
              <button type="button" className="pstrip-item" role="menuitem"
                disabled={openFiles?.has(menu.row.openFile)}
                title={openFiles?.has(menu.row.openFile) ? OMP_TR("the conversation is open in another tab") : menu.row.openFile}
                onClick={() => {
                  // Two-step: the first pick turns the item into the
                  // confirmation; anything else closes the menu.
                  if (!confirming) { setConfirming(true); return; }
                  setMenu(null);
                  onDeleteFile(menu.row.openFile);
                }}>
                <span className={confirming ? "tree-menu-danger" : undefined}>
                  {confirming ? OMP_TR("delete this conversation?") : OMP_TR("delete session")}
                </span>
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </aside>
  );
}

Object.assign(window, { ConversationTree });
