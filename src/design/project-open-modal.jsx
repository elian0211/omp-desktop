/* ═════════════════════════════════════════════════════════════════════
   project-open-modal.jsx — the new-project / edit-project modal (the
   project strip's + menu row, and a strip button's right-click "Edit
   project…"). Draft state transitions live in app/project-open.js; the
   commit flow (backend validation, the appearance patch, openProject)
   in app-live.jsx.
   ═════════════════════════════════════════════════════════════════════ */

const { ACCENTS: _POM_ACCENTS } = window.OMP_SETTINGS;

function ProjectOpenModal({ mode, draft, error, busy, profileLabel, onChange, onBrowse, onCommit, onCancel }) {
  const panelRef = React.useRef(null);
  const firstRef = React.useRef(null);
  window.useModalFocus(firstRef);
  const edit = mode === "edit";
  const title = edit ? OMP_TR("Edit project") : OMP_TR("New project");

  // Same capture guard as confirm-close.jsx: while the modal is open no key
  // reaches the composer or the window keymap. Escape cancels, Tab cycles
  // the panel's fields and buttons; everything else keeps its native
  // meaning inside the form (typing, arrows, clipboard, Enter submitting),
  // and a key aimed outside is swallowed with focus pulled back in.
  React.useEffect(() => {
    const onKey = e => {
      e.stopPropagation();
      const panel = panelRef.current;
      const inside = !!panel?.contains(e.target);
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const focusable = [...(panel?.querySelectorAll("input, button") ?? [])];
        if (!focusable.length) return;
        const i = focusable.indexOf(document.activeElement);
        const n = focusable.length;
        focusable[i < 0 ? 0 : (i + (e.shiftKey ? n - 1 : 1)) % n].focus();
        return;
      }
      if (!inside) {
        e.preventDefault();
        return;
      }
      // Inside: native meaning stays (typing, arrows, clipboard, Enter
      // submitting); stopPropagation above already kept the app keymap out.
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  // Sync codes from OMP_PROJECT_OPEN.finalize; a backend validation error
  // (raw text, like any Rust message) shows as-is.
  const errorText = error
    ? ({ folderRequired: OMP_TR("Enter a folder to open."), badHex: OMP_TR("Colours look like #RRGGBB.") })[error] ?? error
    : null;

  return (
    <div className="bridge-scrim pom-scrim" onClick={onCancel}>
      <form className="pom-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); if (!busy) onCommit(draft); }}>
        <div className="pom-head mono">{title}</div>
        <label className="pom-field">
          <span className="pom-label">{OMP_TR("Folder")}</span>
          {edit ? (
            <span className="pom-path mono" title={draft.path}>{draft.path}</span>
          ) : (
            <span className="pom-row">
              <input ref={firstRef} className="pom-input mono" type="text" value={draft.path}
                spellCheck={false} placeholder="C:\path\to\project"
                onChange={e => onChange({ ...draft, path: e.target.value })} />
              <button type="button" className="btn ghost pom-browse" disabled={busy}
                onClick={() => { void onBrowse(); }}>{OMP_TR("Browse…")}</button>
            </span>
          )}
        </label>
        <label className="pom-field">
          <span className="pom-label">{OMP_TR("Name")}</span>
          <input ref={edit ? firstRef : null} className="pom-input" type="text" value={draft.name}
            spellCheck={false} placeholder={OMP_TR("the folder name")}
            onChange={e => onChange({ ...draft, name: e.target.value })} />
        </label>
        <div className="pom-field">
          <span className="pom-label">{OMP_TR("Accent")}</span>
          <div className="pom-swatches" role="radiogroup" aria-label={OMP_TR("Accent")}>
            <button type="button" role="radio" aria-checked={!draft.accent} className="pom-sw-default"
              title={OMP_TR("Default")} onClick={() => onChange({ ...draft, accent: "" })}>
              {OMP_TR("Default")}
            </button>
            {_POM_ACCENTS.map(c => (
              <button key={c} type="button" role="radio" className="pom-sw"
                aria-checked={!!draft.accent && draft.accent.toLowerCase() === c.toLowerCase()}
                aria-label={c} title={c} style={{ background: c }}
                onClick={() => onChange({ ...draft, accent: c })} />
            ))}
            <input className="pom-hex mono" type="text" spellCheck={false} aria-label={OMP_TR("Accent")}
              value={draft.accent} placeholder="#RRGGBB" maxLength={7}
              onChange={e => onChange({ ...draft, accent: e.target.value })} />
          </div>
        </div>
        {!edit && (
          <div className="pom-hint">
            {profileLabel
              ? OMP_TR("New conversations open with profile {profile}", { profile: profileLabel })
              : OMP_TR("New conversations open with the default profile")}
          </div>
        )}
        {errorText && <div className="pom-error" role="alert">{errorText}</div>}
        <div className="pom-foot">
          <button type="button" className="btn ghost" onClick={onCancel}>{OMP_TR("Cancel")}</button>
          <button type="submit" className="btn outlined" disabled={busy}>
            {edit ? OMP_TR("Save") : OMP_TR("Open")}
          </button>
        </div>
      </form>
    </div>
  );
}

window.ProjectOpenModal = ProjectOpenModal;
