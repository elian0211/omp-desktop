/* ═════════════════════════════════════════════════════════════════════
   chat/file-preview.jsx — quick look at a project file (issue #39): a read
   card's target or a file link in the agent's text. Text highlighted, the
   read lines tinted and scrolled to; images shown whole. Read-only, a
   snapshot taken when it opens. Renders as the tool dock's File pane
   (project-dock-layout phase 2): no modal scrim, the chat beside it
   stays usable.

   Props: { target, onClose, onOpenGit, headless, onMeta }
     target    — { path, range } (app/file-preview.js readTarget/linkTarget)
     onClose   — Esc (and the dock head × when headless)
     onOpenGit — path → the git browser on that file (preview stays open)
     headless  — dock owns the title bar (path / git / lines / truncated /
                 size); this panel is body-only
     onMeta    — (meta) → parent fills the dock head; called whenever the
                 loaded snapshot changes

   Also exports FILE_STATES and FileState (the non-text states), which the
   files panel (design/files/) shows too, and FilePreviewTitle for the
   dock head.
   ═════════════════════════════════════════════════════════════════════ */
const { Icon: _FP_Icon } = window;
const {
  highlightLines: _FP_highlight, clipLines: _FP_clip,
  inRange: _FP_inRange, MAX_LINES: _FP_MAX_LINES, MAX_LINE_CHARS: _FP_MAX_LINE_CHARS,
  shouldReveal: _FP_shouldReveal, REVEAL_INITIAL: _FP_REVEAL_INITIAL, REVEAL_CHUNK: _FP_REVEAL_CHUNK,
} = window.OMP_FILE_PREVIEW;
const { formatBytes: _FP_size } = window.OMP_UPDATER;
const { toDataUrl: _FP_toDataUrl } = window.OMP_IMAGES;
const _FP_preview = window.OMP_FILE_PREVIEW;

// Lines kept above the first read line when scrolling to it.
const _FP_LEAD_LINES = 4;

// The non-content kinds of Rust's `FilePreview` (TooLarge's text names the
// size, below).
const FILE_STATES = {
  Binary:   { title: "Binary file", sub: "There is no text preview for this file." },
  TooLarge: { title: "Too large to preview" },
  Missing:  { title: "File no longer exists", sub: "It was deleted or moved after the agent touched it." },
  Outside:  { title: "Outside the project", sub: "The preview reads only files inside this tab's project folder." },
};

// Memoised: a re-render of the head (a copy click) must not rebuild every row.
// Rows render lazily in chunks (OMP_FILE_PREVIEW scroll reveal): the text is
// fully in memory, only the DOM is built as the scroller approaches the end.
const _FP_TextBody = React.memo(function _FP_TextBody({ path, text, range }) {
  const lines = React.useMemo(() => _FP_highlight(path, text, window.hljs), [path, text]);
  const bodyRef = React.useRef(null);
  const applied = React.useRef(null);
  const [shown, setShown] = React.useState(_FP_REVEAL_INITIAL);
  React.useEffect(() => { setShown(_FP_REVEAL_INITIAL); }, [path]);
  const extend = React.useCallback(() => {
    const sc = bodyRef.current?.parentElement;
    if (shown < lines.length && _FP_shouldReveal(sc)) setShown(Math.min(shown + _FP_REVEAL_CHUNK, lines.length));
  }, [shown, lines.length]);
  React.useEffect(() => {
    const sc = bodyRef.current?.parentElement;
    if (!sc) return undefined;
    sc.addEventListener("scroll", extend, { passive: true });
    return () => sc.removeEventListener("scroll", extend);
  }, [extend]);
  React.useLayoutEffect(() => {
    if (!range) { applied.current = null; return; }
    if (applied.current === range) return;
    const want = Math.max(1, range.from - _FP_LEAD_LINES);
    // A target below the rendered window: reveal up to it first, the next
    // pass (shown changed) finds the row and scrolls to it.
    if (want > shown) { setShown(Math.min(lines.length, want + _FP_REVEAL_CHUNK)); return; }
    const row = bodyRef.current?.querySelector(`[data-ln="${want}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "start" });
    applied.current = range;
  }, [lines, range, shown, lines.length]);
  const single = range?.to === range?.from;
  return (
    <div className="fp-lines mono hljs selectable" ref={bodyRef}>
      {lines.slice(0, shown).map((html, i) => {
        const n = i + 1;
        const hot = _FP_inRange(n, range) ? (single ? " is-target" : " is-read") : "";
        return (
          <div key={i} className={`fp-line${hot}`} data-ln={n}>
            <span className="fp-ln">{n}</span>
            <span className="fp-code" dangerouslySetInnerHTML={{ __html: html || " " }} />
          </div>
        );
      })}
    </div>
  );
});

function FileState({ title, sub }) {
  return (
    <div className="fp-state">
      <div>
        <div className="fp-state-title">{title}</div>
        <div className="fp-state-sub">{sub}</div>
      </div>
    </div>
  );
}

/** Icon-only git affordance for the dock / panel head. */
function _FP_GitBtn({ path, onOpenGit }) {
  if (!onOpenGit || !path) return null;
  return (
    <button type="button" className="btn ghost icon fp-git"
      onClick={() => onOpenGit(path)}
      title={OMP_TR("Open in the git browser")}
      aria-label={OMP_TR("Open in the git browser")}>
      <_FP_Icon name="branch" size={12} />
    </button>
  );
}

/** Dock title-bar: path, git (before chips), lines / truncated / size / range. */
function FilePreviewTitle({ meta, fallbackPath, onOpenGit }) {
  const path = meta?.path ?? fallbackPath ?? "";
  const slash = path.search(/[^/\\]*$/);
  const openable = meta ? meta.openable : true;
  return (
    <span className="dock-file-meta">
      <_FP_Icon name={meta?.kind === "Image" ? "image" : "file"} size={13} color="var(--cyan)" />
      <span className="fp-crumb mono" title={path}>
        {path.slice(0, slash)}<b>{path.slice(slash)}</b>
      </span>
      {openable && <_FP_GitBtn path={path} onOpenGit={onOpenGit} />}
      {meta?.lines != null && (
        <span className="chip muted mono">{meta.lines} {OMP_TR("lines")}</span>
      )}
      {meta?.truncated && (
        <span className="chip warn mono" title={OMP_TR("Keep scrolling: the rest loads as you go (up to {n} lines); each line cut at {m} characters.", { n: _FP_MAX_LINES, m: _FP_MAX_LINE_CHARS })}>{OMP_TR("truncated")}</span>
      )}
      {meta?.sizeLabel && (
        <span className="chip muted mono">{meta.sizeLabel}</span>
      )}
      {meta?.range && (
        <span className="chip accent mono">
          {meta.range.to === meta.range.from ? `line ${meta.range.from}` : `read ${meta.range.from}–${meta.range.to}`}
        </span>
      )}
    </span>
  );
}

function FilePreview({ target, onClose, onOpenGit, headless = false, onMeta, sessionId }) {
  // null while loading; then the bridge's `{ok, value | error}`.
  // `rev` bumps on a watched change: the refresh is silent — the old text
  // stays until the re-read lands, no loading flash.
  const [res, setRes] = React.useState(null);
  const [rev, setRev] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    if (rev === 0) setRes(null);
    // `{ok, value | error}`, never a rejection (live.js `_invokeResult`).
    window.OMP_BRIDGE.readProjectFile(target.path)
      .then((r) => { if (live) setRes(r ?? { ok: false, error: "No tab is open." }); });
    return () => { live = false; };
  }, [target.path, rev]);

  // Live updates: watch while open, re-read (debounced) on a change. Rust
  // applies the preview's own trust checks and watches the parent
  // directory, so editor-style rename-over saves are caught; the event
  // names the path as sent, so the match here is exact.
  React.useEffect(() => {
    if (!sessionId) return undefined;
    let timer = null;
    let last = null;
    const sub = window.OMP_BRIDGE.onPreviewChanged((ev) => {
      if (!ev || ev.sessionId !== sessionId || ev.path !== target.path) return;
      const now = Date.now();
      if (!_FP_preview.shouldNudge(last, now)) return;
      last = now;
      clearTimeout(timer);
      timer = setTimeout(() => setRev(r => r + 1), _FP_preview.NUDGE_MIN_MS);
    });
    window.OMP_BRIDGE.watchProjectFile(target.path);
    return () => {
      sub.stop();
      clearTimeout(timer);
      window.OMP_BRIDGE.unwatchProjectFile(target.path);
    };
  }, [target.path, sessionId]);

  // Capture phase + preventDefault: the global keymap dispatcher skips
  // defaultPrevented events, so Esc closes the preview and nothing else.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const value = res?.ok ? res.value : null;
  // Rust's project-relative path once known, the link's or card's before.
  const shownPath = value?.path ?? target.path;
  const slash = shownPath.search(/[^/\\]*$/);
  const state = value && FILE_STATES[value.kind];
  // A refused or unreadable path has nothing to open in the git browser.
  const openable = !res || (res.ok && value.kind !== "Outside");
  const clip = React.useMemo(() => (value?.kind === "Text" ? _FP_clip(value.text) : null), [value]);
  // Memoised: a rebuilt multi-megabyte data URL is one React has to compare.
  const imgSrc = React.useMemo(() => (value?.kind === "Image" ? _FP_toDataUrl(value) : null), [value]);
  const range = target.range;

  // Parent clears meta on close; no cleanup null here — that would flash
  // the dock head empty between path changes.
  React.useEffect(() => {
    if (!onMeta) return;
    const sizeOk = value && value.kind !== "Missing" && value.kind !== "Outside";
    onMeta({
      path: shownPath,
      kind: value?.kind ?? null,
      lines: clip?.total ?? null,
      truncated: !!clip?.truncated,
      sizeLabel: sizeOk ? _FP_size(value.size) : null,
      range: value?.kind === "Text" ? range ?? null : null,
      openable,
    });
  }, [onMeta, shownPath, value, clip, range, openable]);

  let body;
  if (!res) body = <div className="fp-state"><span className="shimmer-text">{OMP_TR("Loading…")}</span></div>;
  else if (!res.ok) body = <FileState title={OMP_TR("Can't preview this file")} sub={res.error} />;
  else if (state) {
    const sub = state.sub ? OMP_TR(state.sub) : OMP_TR("{size} is over the preview limit.", { size: _FP_size(value.size) });
    body = <FileState title={OMP_TR(state.title)} sub={sub} />;
  } else if (imgSrc) {
    body = (
      <div className="fp-img-wrap">
        <img src={imgSrc} alt={shownPath} />
      </div>
    );
  } else body = <_FP_TextBody path={shownPath} text={clip.text} range={range} />;

  // Docked pane: the panel is the tool dock's File pane body — no scrim.
  // With `headless`, path / git / chips live in the dock head.
  return (
    <div
      className={`fp-panel${headless ? " is-headless" : ""}`}
      role="region"
      aria-label={OMP_TR("Preview of {path}", { path: shownPath })}
    >
      {!headless && (
        <div className="fp-head">
          <_FP_Icon name={value?.kind === "Image" ? "image" : "file"} size={13} color="var(--cyan)" />
          <span className="fp-crumb mono" title={shownPath}>
            {shownPath.slice(0, slash)}<b>{shownPath.slice(slash)}</b>
          </span>
          {openable && <_FP_GitBtn path={shownPath} onOpenGit={onOpenGit} />}
          {clip && <span className="chip muted mono">{clip.total} {OMP_TR("lines")}</span>}
          {clip?.truncated && (
            <span className="chip warn mono" title={OMP_TR("Keep scrolling: the rest loads as you go (up to {n} lines); each line cut at {m} characters.", { n: _FP_MAX_LINES, m: _FP_MAX_LINE_CHARS })}>{OMP_TR("truncated")}</span>
          )}
          {value && value.kind !== "Missing" && value.kind !== "Outside" && <span className="chip muted mono">{_FP_size(value.size)}</span>}
          {value?.kind === "Text" && range && (
            <span className="chip accent mono">
              {range.to === range.from ? `line ${range.from}` : `read ${range.from}–${range.to}`}
            </span>
          )}
          <div className="fp-spacer" />
          <button type="button" className="btn ghost icon" onClick={onClose} title={OMP_TR("Close (Esc)")} aria-label={OMP_TR("Close")}>
            <_FP_Icon name="close" size={12} />
          </button>
        </div>
      )}
      <div className="fp-body">{body}</div>
    </div>
  );
}

Object.assign(window, { FilePreview, FilePreviewTitle, FILE_STATES, FileState });
