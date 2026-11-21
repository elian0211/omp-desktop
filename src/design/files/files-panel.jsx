/* ═════════════════════════════════════════════════════════════════════
   files/files-panel.jsx — the files detail in the stage column
   (docs/architecture/file-comments.md): the selected file with its marks
   (FileCode), and a footer with the tab's mark counts, "clear all" and
   "send now". The tree lives in the project side's Explorer fold
   (design/files/files-view.jsx), which opens this panel on a pick — the
   panel shows the picked file only, no second tree.

   Props: { ui, canSendNow, onSendNow, onClose, onOpenGit, onReference, onReveal }
     ui         — useFileComments (app/use-file-comments.jsx)
     canSendNow — whether the marks can go out without typed text now
     onSendNow  — sends the marks with no typed text
     onClose    — closes the panel (the bar's × beside the copy button)
     onOpenGit  — path → the git browser on that file
     onReference — path → appends `@path` to the tab's composer draft
     onReveal   — path → reveals the file in the OS file manager; resolves
                  to the bridge's `{ok, value | error}` (or null)
   ═════════════════════════════════════════════════════════════════════ */
const {
  Icon: _FCP_Icon, CopyButton: _FCP_Copy, FileCode: _FCP_Code,
  FileState: _FCP_State, FILE_STATES: _FCP_STATES,
} = window;
const { clipLines: _FCP_clip, MAX_LINES: _FCP_MAX_LINES, MAX_LINE_CHARS: _FCP_MAX_LINE_CHARS } = window.OMP_FILE_PREVIEW;
const { formatBytes: _FCP_size } = window.OMP_UPDATER;
const { clampMenu: _FCP_clampMenu } = window.OMP_FILE_COMMENTS;
const _FCP_NO_MARKS = Object.freeze([]);

function _FCP_Body({ ui, path, clip }) {
  const f = ui.file;
  const value = f?.value;
  const marks = React.useMemo(
    () => (path ? ui.marks.filter(m => m.path === path) : _FCP_NO_MARKS), [ui.marks, path]);
  if (!ui.hasFolder) return <_FCP_State title={OMP_TR("No project folder")} sub={OMP_TR("This tab was opened without a folder.")} />;
  if (!ui.view.selected) {
    return <_FCP_State title={OMP_TR("No file open")} sub={OMP_TR("Pick a file in the tree, or type part of its path in the filter box.")} />;
  }
  if (!f) return <div className="fp-state"><span className="shimmer-text">{OMP_TR("Loading…")}</span></div>;
  if (f.error) return <_FCP_State title={OMP_TR("Can't open this file")} sub={f.error} />;
  const state = _FCP_STATES[value.kind];
  if (state) {
    const sub = state.sub ? OMP_TR(state.sub) : OMP_TR("{size} is over the preview limit.", { size: _FCP_size(value.size) });
    return <_FCP_State title={OMP_TR(state.title)} sub={sub} />;
  }
  if (!clip) return <_FCP_State title={OMP_TR("Not a text file")} sub={OMP_TR("Only text files take explain marks and comments.")} />;
  return (
    <_FCP_Code key={path} path={path} text={clip.text} marks={marks} target={ui.view.target}
      onAdd={ui.addMark} onUpdate={ui.updateMark} onRemove={ui.removeMark} onTargetDone={ui.targetDone} />
  );
}

function _FCP_Foot({ ui, canSendNow, onSendNow }) {
  const { explain, comment, files } = ui.counts;
  const plural = window.OMP_I18N.plural;
  const parts = [];
  if (explain) parts.push(plural(explain, "{n} to explain", "{n} to explain", { n: explain }));
  if (comment) parts.push(plural(comment, "{n} comment", "{n} comments", { n: comment }));
  return (
    <div className="fc-foot">
      <span className="fc-foot-text">
        {parts.length ? (
          <>
            <b>{parts.join(", ")}</b> {plural(files, "in {n} file", "in {n} files", { n: files })}
            {" · "}{OMP_TR("they go out with your next message")}
          </>
        ) : OMP_TR("Pick lines or select text, then explain or comment.")}
      </span>
      <span className="fc-spacer" />
      <button type="button" className="btn ghost" onClick={ui.clearMarks} disabled={!parts.length}>
        <_FCP_Icon name="trash" size={11} /> {OMP_TR("clear all")}
      </button>
      <button type="button" className="btn outlined" onClick={onSendNow} disabled={!parts.length || !canSendNow}
        title={OMP_TR("Send the marks now, with no typed text")}>
        <_FCP_Icon name="send" size={11} /> {OMP_TR("send now")}
      </button>
    </div>
  );
}

/* The file row's right-click menu: reference the file into the composer as
   an `@path` mention, copy its project-relative path, or hand it to the OS
   file manager. Fixed-positioned at the click, clamped into the viewport
   (OMP_FILE_COMMENTS.clampMenu) once its real size is known; closed by any
   pointer-down outside it (capture), Escape (stopped here so it does not
   also drop the code view's pick), a scroll or a resize. A failed reveal
   keeps the menu open and shows the reason. Deleted rows can only copy:
   the agent cannot read a file the work tree no longer has. */
function _FCP_Menu({ menu, close, onReference, onReveal }) {
  window.OMP_I18N.useLocale();
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ x: menu.x, y: menu.y });
  const [err, setErr] = React.useState("");
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(_FCP_clampMenu(menu.x, menu.y, r.width, r.height, window.innerWidth, window.innerHeight));
  }, [menu.x, menu.y]);
  React.useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const onMove = () => close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [close]);
  const deletedTitle = OMP_TR("the file is deleted from the work tree");
  const reveal = () => {
    const res = onReveal?.(menu.path);
    if (!res?.then) return;
    res.then((r) => {
      if (!r || r.ok === false) {
        setErr(r?.error || OMP_TR("this tab has no project folder"));
        return;
      }
      close();
    });
  };
  const items = [
    {
      key: "reference", icon: "file", label: OMP_TR("Reference in composer"),
      disabled: menu.deleted, title: menu.deleted ? deletedTitle : OMP_TR("insert @path into the prompt"),
      onClick: () => { onReference?.(menu.path); close(); },
    },
    {
      key: "copy", icon: "copy", label: OMP_TR("Copy path"),
      title: OMP_TR("Copy the project-relative path"),
      onClick: () => { window.copyText(menu.path); close(); },
    },
    {
      key: "reveal", icon: "folder", label: OMP_TR("Reveal in file manager"),
      disabled: menu.deleted, title: menu.deleted ? deletedTitle : undefined,
      onClick: reveal,
    },
  ];
  return (
    <div className="fc-menu" ref={ref} role="menu" aria-label={OMP_TR("file actions")} style={{ left: pos.x, top: pos.y }}>
      {items.map((it) => (
        <button key={it.key} type="button" role="menuitem" className="fc-menu-item"
          disabled={it.disabled} title={it.title}
          onClick={it.onClick}>
          <_FCP_Icon name={it.icon} size={12} />
          <span>{it.label}</span>
        </button>
      ))}
      {err && <div className="fc-menu-err">{err}</div>}
    </div>
  );
}

function FilesPanel({ ui, canSendNow, onSendNow, onClose, onOpenGit, onReference, onReveal }) {
  const value = ui.file?.value;
  const clip = React.useMemo(() => (value?.kind === "Text" ? _FCP_clip(value.text) : null), [value]);
  const path = value?.path ?? ui.view.selected;
  const slash = path ? path.search(/[^/]*$/) : 0;
  // A file row's right-click menu ({x, y, path, deleted}); opened from the
  // tree, closed by click-away, Escape, a scroll or a resize.
  const [menu, setMenu] = React.useState(null);
  const closeMenu = React.useCallback(() => setMenu(null), []);
  return (
    <section className="fc-panel" aria-label={OMP_TR("files panel")}>
      <div className="fc-bar">
        <span className="fc-crumb mono" title={path ?? ""}>
          {path ? <>{path.slice(0, slash)}<b>{path.slice(slash)}</b></> : null}
        </span>
        {clip && <span className="chip muted mono">{clip.total} {OMP_TR("lines")}</span>}
        {clip?.truncated && (
          <span className="chip warn mono" title={OMP_TR("Keep scrolling: the rest loads as you go (up to {n} lines); each line cut at {m} characters.", { n: _FCP_MAX_LINES, m: _FCP_MAX_LINE_CHARS })}>{OMP_TR("truncated")}</span>
        )}
        <span className="fc-spacer" />
        <button type="button" className="btn ghost icon" onClick={ui.refresh} title={OMP_TR("reload from disk")} aria-label={OMP_TR("reload from disk")}>
          <_FCP_Icon name="refresh" size={12} />
        </button>
        {value && value.kind !== "Outside" && !ui.searchMode && (
          <button type="button" className="btn ghost icon" onClick={() => onOpenGit(value.path)}
            title={OMP_TR("Open in the git browser")} aria-label={OMP_TR("Open in the git browser")}>
            <_FCP_Icon name="diff2" size={12} />
          </button>
        )}
        {value && <_FCP_Copy className="fp-copy" label={OMP_TR("Copy the project-relative path")} text={value.path} />}
        {onClose && (
          <button type="button" className="btn ghost icon" onClick={onClose}
            title={OMP_TR("close the files panel")} aria-label={OMP_TR("close the files panel")}>
            <_FCP_Icon name="close" size={12} />
          </button>
        )}
      </div>
      <div className="fc-body">
        <_FCP_Body ui={ui} path={value?.path ?? null} clip={clip} />
      </div>
      <_FCP_Foot ui={ui} canSendNow={canSendNow} onSendNow={onSendNow} />
      {menu && <_FCP_Menu menu={menu} close={closeMenu} onReference={onReference} onReveal={onReveal} />}
    </section>
  );
}

window.FilesPanel = FilesPanel;
// The file row's right-click menu; the Files activity view's tree mounts it.
window.FilesMenu = _FCP_Menu;
