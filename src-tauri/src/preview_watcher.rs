//! Watch for changes to the file a tab's preview shows (`preview://changed`).
//!
//! [`PreviewWatchState`] is Tauri managed state owning one
//! [`notify::RecommendedWatcher`] per (session, path) pair. The frontend
//! starts a watch when a preview loads and stops it when the preview or its
//! tab goes away; each change event re-fires the frontend's debounced
//! re-read of `project_file_read`.

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Mutex,
};

use notify::{RecursiveMode, Watcher as _};
use tauri::{AppHandle, Emitter as _};

pub struct PreviewWatchState {
    watchers: Mutex<HashMap<String, notify::RecommendedWatcher>>,
}

impl PreviewWatchState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }

    /// Watch `file`'s parent directory non-recursively; every change to
    /// `file` itself emits `preview://changed/{session_id}` with `path` (the
    /// path as the frontend sent it) as payload. A second `start` for the
    /// same pair replaces the watcher. `file` may not exist yet — the
    /// watcher still catches its creation through the parent directory.
    pub fn start(
        &self,
        session_id: &str,
        path: &str,
        file: PathBuf,
        app: AppHandle,
    ) -> Result<(), String> {
        let sid = session_id.to_owned();
        let sent = path.to_owned();
        let watcher = Self::watch(file, move || {
            let _ = app.emit(&format!("preview://changed/{sid}"), sent.clone());
        })?;
        self.watchers.lock().map_or_else(
            |_| Err("preview watch state poisoned".to_owned()),
            |mut map| {
                map.insert(key(session_id, path), watcher);
                Ok(())
            },
        )
    }

    /// The notify setup behind [`start`](Self::start): watch `file`'s
    /// parent, call `sink` on every change to `file` itself. Separated so
    /// tests can observe real filesystem events without an `AppHandle`.
    fn watch(
        file: PathBuf,
        sink: impl Fn() + Send + 'static,
    ) -> Result<notify::RecommendedWatcher, String> {
        let name = file
            .file_name()
            .map(std::ffi::OsStr::to_owned)
            .ok_or_else(|| "preview path has no file name".to_owned())?;
        let dir = file
            .parent()
            .map(Path::to_owned)
            .ok_or_else(|| "preview path has no parent".to_owned())?;

        // Like the git HEAD watcher: the parent directory, not the file —
        // editors save through a rename over the target, which orphans a
        // file-level watch. `is_change` filters sibling noise. The frontend
        // debounces, so no Rust-side coalescing is needed.
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            if !is_change(&event, &name) {
                return;
            }
            sink();
        })
        .map_err(|e| e.to_string())?;
        watcher
            .watch(&dir, RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
        Ok(watcher)
    }

    /// Stop one watch (`Some(path)`) or every watch of the session (`None`,
    /// the tab-close path). No-op when none is active.
    pub fn stop(&self, session_id: &str, path: Option<&str>) {
        if let Ok(mut map) = self.watchers.lock() {
            if let Some(p) = path {
                map.remove(&key(session_id, p));
            } else {
                let prefix = format!("{session_id}\0");
                map.retain(|k, _| !k.starts_with(&prefix));
            }
        }
    }
}

impl Default for PreviewWatchState {
    fn default() -> Self {
        Self::new()
    }
}

fn key(session_id: &str, path: &str) -> String {
    format!("{session_id}\0{path}")
}

/// Whether `event` is a change to a file named `name`.
///
/// Name filter: the parent directory is watched everywhere (Windows'
/// `ReadDirectoryChangesW` reports names regardless), so sibling events
/// arrive too. Access filter: notify 7's inotify reports `IN_OPEN` as
/// `Access(Open)`, and the preview's own re-read would re-trigger forever.
fn is_change(event: &notify::Event, name: &std::ffi::OsStr) -> bool {
    !event.kind.is_access() && event.paths.iter().any(|p| p.file_name() == Some(name))
}

/// The absolute file path to watch for `root`/`path` — the same trust
/// checks as [`project_file::read`](crate::project_file::read), tolerant of
/// a missing file (the watch still catches its creation). Returns the path
/// as resolved; the watcher watches its parent directory.
pub fn watch_target(root: &Path, path: &str) -> Result<PathBuf, String> {
    let rel = crate::git_browser::project_relative(root, path)?;
    let canonical_root =
        std::fs::canonicalize(root).map_err(|e| format!("failed to resolve project: {e}"))?;
    let as_written = canonical_root.join(&rel);
    // Canonicalise what exists: the file when it does, else its parent —
    // a symlinked parent directory must resolve like `read` resolves it.
    let dir = as_written
        .parent()
        .map(Path::to_owned)
        .ok_or_else(|| "preview path has no parent".to_owned())?;
    let resolved_dir = if let Ok(d) = std::fs::canonicalize(&dir) {
        d
    } else {
        std::fs::canonicalize(root).map_err(|e| format!("failed to resolve project: {e}"))?
    };
    let name = as_written
        .file_name()
        .map(std::ffi::OsStr::to_owned)
        .ok_or_else(|| "preview path has no file name".to_owned())?;
    let file = resolved_dir.join(&name);
    if as_written.is_file() {
        if let Ok(c) = std::fs::canonicalize(&file) {
            return Ok(c);
        }
    }
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::{is_change, watch_target};
    use notify::event::{
        AccessKind, AccessMode, CreateKind, DataChange, EventKind, ModifyKind, RenameMode,
    };
    use notify::Event;
    use std::path::Path;

    #[test]
    fn opening_the_file_is_not_a_change() {
        // The frontend's own re-read opens the file; reacting to that would
        // re-trigger forever.
        let open = Event::new(EventKind::Access(AccessKind::Open(AccessMode::Any)))
            .add_path("/p/a.rs".into());
        assert!(!is_change(&open, "a.rs".as_ref()));
    }

    #[test]
    fn writes_and_renames_onto_the_file_are_changes() {
        let write = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path("/p/a.rs".into());
        assert!(is_change(&write, "a.rs".as_ref()));
        let rename = Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::To)))
            .add_path("/p/a.rs".into());
        assert!(is_change(&rename, "a.rs".as_ref()));
    }

    #[test]
    fn sibling_files_are_ignored() {
        let other = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path("/p/b.rs".into());
        assert!(!is_change(&other, "a.rs".as_ref()));
    }

    #[test]
    fn creating_a_missing_file_is_a_change() {
        let create = Event::new(EventKind::Create(CreateKind::File)).add_path("/p/new.rs".into());
        assert!(is_change(&create, "new.rs".as_ref()));
    }

    #[test]
    fn watch_target_resolves_through_a_symlinked_parent() {
        let dir = std::env::temp_dir().join(format!("omp-preview-watch-{}", std::process::id()));
        let real = dir.join("real");
        let link = dir.join("link");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&real).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&real, &link).unwrap();
        #[cfg(windows)]
        {
            // Only exercise the plain case here; junction creation needs
            // privileges the CI runner may not grant.
            std::fs::create_dir_all(&link).unwrap();
        }
        let root = &link;
        let t = watch_target(Path::new(&root), "a.rs").unwrap();
        assert!(t.file_name().is_some_and(|n| n == "a.rs"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    // Real filesystem → notify → sink, without an AppHandle.
    #[test]
    fn a_write_and_a_rename_over_the_file_both_fire_the_sink() {
        use super::PreviewWatchState;
        use crate::test_support::wait_until;
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;

        let dir =
            std::env::temp_dir().join(format!("omp-preview-watch-live-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.rs");
        std::fs::write(&file, "v1").unwrap();

        let hits = Arc::new(AtomicUsize::new(0));
        let h2 = Arc::clone(&hits);
        let state = PreviewWatchState::new();
        // Keep the watcher alive — dropping it cancels the OS watch.
        let watcher = PreviewWatchState::watch(file.clone(), move || {
            h2.fetch_add(1, Ordering::SeqCst);
        })
        .unwrap();

        // Direct write. Windows delivers several events for one write
        // (data + metadata; the rename below adds From/To) — the frontend
        // debounces, so the sink may fire more than once per save.
        std::fs::write(&file, "v2").unwrap();
        assert!(wait_until(std::time::Duration::from_secs(5), || hits
            .load(Ordering::SeqCst)
            > 0));

        // Editor-style save: write a sibling, then rename it over the file
        // (the watcher survives it — it watches the directory).
        let tmp = dir.join("a.rs.tmp");
        std::fs::write(&tmp, "v3").unwrap();
        std::fs::rename(&tmp, &file).unwrap();
        assert!(wait_until(std::time::Duration::from_secs(5), || hits
            .load(Ordering::SeqCst)
            >= 2));

        // A sibling write that stays a sibling never fires.
        let after_renames = hits.load(Ordering::SeqCst);
        std::fs::write(dir.join("b.rs"), "noise").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert_eq!(hits.load(Ordering::SeqCst), after_renames);

        // Dropping the watcher cancels the OS watch.
        drop(watcher);
        std::fs::write(&file, "v4").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert_eq!(hits.load(Ordering::SeqCst), after_renames);
        drop(state);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
