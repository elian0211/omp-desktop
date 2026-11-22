/* ═════════════════════════════════════════════════════════════════════
   chat/image-lightbox.jsx — enlarged view of a message's attached images
   (issue #25). Opens with a FLIP "pop out" from the clicked thumbnail and
   shrinks back into the current one on close.

   Props: { images, index, onIndex, onClose, thumbFor }
     images   — image src strings (data URLs) of one message
     index    — image shown; onIndex(i) switches it
     onClose  — called once the close animation has finished
     thumbFor — i → the thumbnail element to fly from / back into

   Also ImageThumbs (a message's thumbnail strip, opening the viewer) and
   useModalLayer (scrim + focus trap for this lightbox).
   ═════════════════════════════════════════════════════════════════════ */
const { Icon: _LB_Icon } = window;
const { fitRect: _LB_fitRect, flipTransform: _LB_flipTransform, stepIndex: _LB_stepIndex } = window.OMP_LIGHTBOX;
const { toDataUrl: _LB_toDataUrl } = window.OMP_IMAGES;

const _LB_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // --ease-out
const _LB_OPEN_MS = 320;
const _LB_CLOSE_MS = 220;

function _LB_reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function _LB_viewport() {
  // The lightbox's own space: the window's inner box below the title bar —
  // the scrim anchors there (absolute, top 39px = .chrome 38px + 1px
  // border), inside the window's 1px borders.
  const host = document.querySelector(".window");
  if (!host) return { w: window.innerWidth, h: window.innerHeight };
  const r = host.getBoundingClientRect();
  return { w: r.width - 2, h: r.height - 41 };
}

// Modal: the app behind is inert, so Tab can't reach, and Enter can't
// press, what opened it and stack a second one. The lightbox portals into
// .window (inside #root), and inert inherits down the tree — so it goes on
// the scrim's siblings there (the title bar, the workspace, the status
// bar), never on an ancestor. On the very first commit the portal can land
// in <body> (.window is not in the document yet); nothing is inerted then,
// and the ResizeObserver re-applies once the scrim moves into the window
// and its box changes. `scrimRef` takes focus; it goes back where it was
// on close.
function useModalLayer(scrimRef) {
  React.useEffect(() => {
    const prev = document.activeElement;
    return () => {
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);
  // Re-applied after every render (idempotent, before paint): on the very
  // first commit the portal can land in <body> (.window is not in the
  // document yet), and the re-render that follows the portal moving into
  // the window re-applies with the right host.
  React.useLayoutEffect(() => {
    const s = scrimRef.current;
    if (!s) return undefined;
    const host = s.closest(".window");
    const siblings = host ? [...host.children].filter(el => el !== s) : [];
    siblings.forEach(el => { el.inert = true; });
    if (host) s.focus();
    return () => siblings.forEach(el => { el.inert = false; });
  });
}

function ImageLightbox({ images, index, onIndex, onClose, thumbFor }) {
  const count = images.length;
  const [view, setView] = React.useState(_LB_viewport);
  // Natural size of images[index]; tagged with its index so a stale size
  // never lays out the next image while that one is still decoding.
  const [natural, setNatural] = React.useState(null);
  const [closing, setClosing] = React.useState(false);
  const imgRef = React.useRef(null);
  const scrimRef = React.useRef(null);
  const openedRef = React.useRef(false);
  const closingRef = React.useRef(false);
  // Set by the first prev/next: from then on a newly shown image fades in
  // (the first one pops out of its thumbnail instead).
  const [navigated, setNavigated] = React.useState(false);

  const size = natural?.index === index ? natural : null;
  const rect = size ? _LB_fitRect(size.w, size.h, view.w, view.h) : null;
  const rectRef = React.useRef(rect);
  rectRef.current = rect;

  const readNatural = (el) => {
    if (el?.naturalWidth) setNatural({ index, w: el.naturalWidth, h: el.naturalHeight });
  };

  // A data URL the thumbnail already decoded is usually `complete` at
  // mount; reading it here (before paint) avoids a hidden first frame.
  React.useLayoutEffect(() => {
    if (imgRef.current?.complete) readNatural(imgRef.current);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pop out of the thumbnail — once, on the first laid-out frame.
  React.useLayoutEffect(() => {
    if (openedRef.current || !rect) return;
    openedRef.current = true;
    const thumb = thumbFor(index);
    if (!thumb || _LB_reducedMotion()) return;
    imgRef.current.animate(
      [{ transform: _LB_flipTransform(thumbRect(thumb), rect) }, { transform: "none" }],
      { duration: _LB_OPEN_MS, easing: _LB_EASE },
    );
  });

  const close = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const rect = rectRef.current;
    const thumb = thumbFor(index);
    if (!rect || !thumb || _LB_reducedMotion()) { onClose(); return; }
    setClosing(true);
    // Closing mid-open (a double-click, or Esc right away): shrink back from
    // where the pop-out has got to, not from full size — the open animation
    // is cancelled, and a new one would otherwise start at `transform: none`.
    const img = imgRef.current;
    const start = getComputedStyle(img).transform;
    img.getAnimations().forEach((a) => a.cancel());
    const anim = img.animate(
      [{ transform: start }, { transform: _LB_flipTransform(thumbRect(thumb), rect) }],
      { duration: _LB_CLOSE_MS, easing: _LB_EASE, fill: "forwards" },
    );
    anim.onfinish = onClose;
    anim.oncancel = onClose;
  }, [index, thumbFor, onClose]);

  const step = React.useCallback((delta) => {
    if (count < 2 || closingRef.current) return;
    setNavigated(true);
    onIndex(_LB_stepIndex(index, delta, count));
  }, [count, index, onIndex]);

  // Capture phase + preventDefault: the global keymap dispatcher skips
  // defaultPrevented events, so Escape closes the viewer instead of also
  // interrupting a running turn.
  React.useEffect(() => {
    const onKey = (e) => {
      let handled = true;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, step]);

  // The view is the scrim's own box (the window's inner area below the
  // title bar). Measured via a ResizeObserver: on the very first commit the
  // portal may still land in <body> (.window is not in the document yet)
  // and moves into the window on the next render — the box changes then,
  // and the observer re-measures.
  const measure = React.useCallback(() => {
    const s = scrimRef.current;
    if (!s) return;
    const r = s.getBoundingClientRect();
    setView({ w: r.width, h: r.height });
  }, []);
  React.useEffect(() => {
    const s = scrimRef.current;
    if (!s) return undefined;
    const measureNow = () => measure();
    measureNow();
    const ro = new ResizeObserver(measureNow);
    ro.observe(s);
    window.addEventListener("resize", measureNow);
    return () => { ro.disconnect(); window.removeEventListener("resize", measureNow); };
  }, [measure]);

  useModalLayer(scrimRef);

  const imgStyle = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : { visibility: "hidden" };
  const nav = (delta) => (e) => { e.stopPropagation(); step(delta); };
  // The thumbnail's rect is viewport-based; the img and its transforms live
  // in the scrim's space (.window below the title bar), so bring it over.
  const thumbRect = (el) => {
    const r = el.getBoundingClientRect();
    const s = scrimRef.current?.getBoundingClientRect();
    return s
      ? { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height }
      : r;
  };

  return ReactDOM.createPortal(
    <div
      ref={scrimRef}
      className={`lightbox${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={OMP_TR("Attached image")}
      tabIndex={-1}
      onClick={close}
    >
      <img
        key={index}
        ref={imgRef}
        className={`lightbox-img${navigated ? " is-swap" : ""}`}
        src={images[index]}
        alt={`attached image ${index + 1} of ${count}`}
        style={imgStyle}
        onLoad={(e) => readNatural(e.currentTarget)}
      />
      <button className="lightbox-btn lightbox-close" title={OMP_TR("Close (Esc)")} onClick={(e) => { e.stopPropagation(); close(); }}>
        <_LB_Icon name="close" size={14} />
      </button>
      {count > 1 && (
        <React.Fragment>
          <button className="lightbox-btn lightbox-prev" title={OMP_TR("Previous (←)")} onClick={nav(-1)}>
            <_LB_Icon name="chevR" size={16} />
          </button>
          <button className="lightbox-btn lightbox-next" title={OMP_TR("Next (→)")} onClick={nav(1)}>
            <_LB_Icon name="chevR" size={16} />
          </button>
          <div className="lightbox-count mono">{index + 1} / {count}</div>
        </React.Fragment>
      )}
    </div>,
    // Inside .window: the scrim is absolute and must not cover the title
    // bar (top 39px), like every other overlay.
    document.querySelector(".window") ?? document.body,
  );
}

// A message's images (`{ data, mimeType }`) as a strip of thumbnails in a
// `className` box; a click opens the viewer on that one (issue #25).
function ImageThumbs({ images, className, alt }) {
  // Index of the image shown enlarged, or null.
  const [openIdx, setOpenIdx] = React.useState(null);
  const thumbsRef = React.useRef([]);
  const srcs = React.useMemo(() => (images ?? []).map(_LB_toDataUrl), [images]);
  const thumbFor = React.useCallback((i) => thumbsRef.current[i] ?? null, []);
  const closeViewer = React.useCallback(() => setOpenIdx(null), []);
  if (srcs.length === 0) return null;
  return (
    <React.Fragment>
      <div className={className}>
        {srcs.map((src, i) => (
          <button
            key={i}
            type="button"
            className="user-image-btn"
            title={OMP_TR("View image")}
            onClick={() => setOpenIdx(i)}
          >
            {/* Hidden, not removed, while it is the one enlarged: the
                viewer flies out of and back into its rect. */}
            <img
              ref={(el) => { thumbsRef.current[i] = el; }}
              className={`user-image${openIdx === i ? " is-lifted" : ""}`}
              src={src}
              alt={alt}
            />
          </button>
        ))}
      </div>
      {openIdx != null && openIdx < srcs.length && (
        <ImageLightbox
          images={srcs}
          index={openIdx}
          onIndex={setOpenIdx}
          onClose={closeViewer}
          thumbFor={thumbFor}
        />
      )}
    </React.Fragment>
  );
}

Object.assign(window, { ImageLightbox, ImageThumbs, useModalLayer });
