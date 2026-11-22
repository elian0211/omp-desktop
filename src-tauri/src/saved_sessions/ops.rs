//! Destructive session-file operations for the sessions fold's right-click
//! menu ("归档 / 删除" on a conversation). omp's RPC has no commands for
//! this, so these mirror ompweb's file-level semantics — the same on-disk
//! contract omp itself understands:
//!
//! - **archive** — omp's `gc --archive` layout: the `.jsonl` is gzip-
//!   compressed to `<agent>/archive/sessions/<relative>.jsonl.gz` and its
//!   sibling artifacts directory (same name minus `.jsonl`, holding subagent
//!   transcripts) moves alongside. Atomic per step, with rollback: the
//!   source only disappears once the compressed destination exists, and a
//!   failed artifacts move puts the session back.
//! - **delete** — the file is unlinked and the artifacts directory removed
//!   best-effort.
//!
//! The frontend may send any string, so every path is re-resolved here: it
//! must be an existing regular `.jsonl` file under this profile's sessions
//! root — never a flag-shaped value, another profile's tree or an arbitrary
//! filesystem path (same reasoning as `validate_resume_against_root`).

use std::fs::{self, File};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;

use super::sessions_root_dir;

/// The artifacts directory of a session file or an archived one: the file
/// name minus its `.jsonl` (a source) or minus its `.gz` (an archive — omp
/// keeps the `.jsonl` suffix on the archived artifacts directory, so a
/// restored session's artifacts are already named right).
fn artifacts_dir_of(file: &Path) -> PathBuf {
    let text = file.to_string_lossy();
    let stripped = match (text.strip_suffix(".gz"), text.strip_suffix(".jsonl")) {
        (Some(stem), _) => stem.to_owned(),
        (None, Some(stem)) => stem.to_owned(),
        (None, None) => text.into_owned(),
    };
    PathBuf::from(stripped)
}

/// The canonical session file for `path`, plus the canonical `root` it must
/// live under. `# Errors` as in [`super::validate_resume_against_root`] —
/// nonexistent, outside the root, wrong extension, not a regular file.
fn resolve_session_file(root: &Path, path: &str) -> Result<(PathBuf, PathBuf), String> {
    if path.starts_with('-') {
        return Err(format!("invalid session path: {path:?}"));
    }
    let canonical = Path::new(path)
        .canonicalize()
        .map_err(|e| format!("session path does not exist: {path:?} ({e})"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("sessions directory unavailable: {e}"))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(format!(
            "session path {path:?} is outside the sessions directory"
        ));
    }
    if canonical.extension().and_then(|e| e.to_str()) != Some("jsonl") {
        return Err(format!(
            "session path {path:?} is not a .jsonl session file"
        ));
    }
    if !canonical.is_file() {
        return Err(format!("session path {path:?} is not a regular file"));
    }
    Ok((canonical, canonical_root))
}

/// The archive destination of `source` under `archive_root`, mirroring
/// `omp gc --archive`: the sessions-root-relative path with `.gz` appended
/// (the artifacts directory keeps the plain name beside it). `legacy` is the
/// same path without `.gz`, where older omp builds kept the raw file.
fn archive_destinations(
    archive_root: &Path,
    canonical_root: &Path,
    source: &Path,
) -> Result<(PathBuf, PathBuf), String> {
    let relative = source
        .strip_prefix(canonical_root)
        .map_err(|e| format!("session path is outside the sessions directory: {e}"))?;
    let mut name = relative.as_os_str().to_owned();
    name.push(".gz");
    let destination = archive_root.join(name);
    let legacy = match destination.to_string_lossy().strip_suffix(".gz") {
        Some(stripped) => PathBuf::from(stripped),
        None => unreachable!(".gz was just appended"),
    };
    Ok((destination, legacy))
}

/// A not-yet-existing sibling of `target` for atomic placement. No temp-dir
/// dance: the rename must land on the same volume anyway.
fn unique_temp_sibling(target: &Path) -> Result<PathBuf, String> {
    let dir = target.parent().ok_or("target has no parent")?;
    let name = target
        .file_name()
        .ok_or("target has no file name")?
        .to_string_lossy()
        .into_owned();
    for attempt in 0..64 {
        let candidate = dir.join(format!(
            ".omp-desktop-{name}-{}-{attempt}",
            std::process::id()
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("could not find a free temporary name".to_owned())
}

/// Decompress `archive` back over `source` (the rollback path): temp file in
/// the source's directory, fsync, rename. Returns the restored path.
fn restore_source_from(archive: &Path, source: &Path) -> Result<PathBuf, String> {
    let temp = unique_temp_sibling(source)?;
    let mut decoder =
        GzDecoder::new(File::open(archive).map_err(|e| format!("archive unreadable: {e}"))?);
    let mut out = File::create_new(&temp).map_err(|e| format!("temp restore file: {e}"))?;
    std::io::copy(&mut decoder, &mut out).map_err(|e| format!("restore copy: {e}"))?;
    out.sync_all().map_err(|e| format!("restore sync: {e}"))?;
    if let Some(parent) = source.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("restore directory: {e}"))?;
    }
    fs::rename(&temp, source).map_err(|e| format!("restore rename: {e}"))?;
    Ok(source.to_path_buf())
}

/// Archive the session at `path` (resolved against `sessions_root`) into
/// `archive_root`. Returns the archive path. Every failure leaves either the
/// original session or a complete archive — never half of each, and when the
/// archive ends up the only copy, the error says so instead of deleting it.
pub fn archive_in(sessions_root: &Path, archive_root: &Path, path: &str) -> Result<String, String> {
    let (source, canonical_root) = resolve_session_file(sessions_root, path)?;
    // omp's leaf-only rule: a conversation other files were branched/forked
    // from stays put until its children are archived first (elsewhere the
    // tree still shows them continuing from a moved file).
    let dir = source
        .parent()
        .ok_or_else(|| "session file has no parent directory".to_owned())?;
    let name = source
        .file_name()
        .ok_or_else(|| "session file has no name".to_owned())?
        .to_string_lossy()
        .into_owned();
    let children = crate::conversation_tree::family::children_of(dir, &name)
        .map_err(|e| format!("cannot list the conversation family: {e}"))?;
    if !children.is_empty() {
        let pronoun = if children.len() == 1 { "it" } else { "them" };
        return Err(format!(
            "this conversation has {} later branch{} — archive {pronoun} first, or delete it instead",
            children.len(),
            if children.len() == 1 { "" } else { "es" },
        ));
    }
    let (destination, legacy) = archive_destinations(archive_root, &canonical_root, &source)?;
    if destination.exists() || legacy.exists() {
        return Err(format!(
            "archived session destination already exists: {}",
            destination.display()
        ));
    }
    let source_artifacts = artifacts_dir_of(&source);
    let destination_artifacts = artifacts_dir_of(&destination);
    fs::create_dir_all(
        destination
            .parent()
            .ok_or_else(|| "archive destination has no parent".to_owned())?,
    )
    .map_err(|e| format!("failed to create the archive directory: {e}"))?;

    // Gzip into a temp file next to the destination, fsync, then rename —
    // a crash mid-write leaves the old tree untouched (omp's own atomic
    // session rewrite works the same way).
    let temp = unique_temp_sibling(&destination)?;
    let compressed = (|| -> std::io::Result<()> {
        let mut input = File::open(&source)?;
        let mut encoder = GzEncoder::new(File::create_new(&temp)?, Compression::new(9));
        std::io::copy(&mut input, &mut encoder)?;
        encoder.finish()?.sync_all()
    })();
    if let Err(e) = compressed {
        let _ = fs::remove_file(&temp);
        return Err(format!("failed to compress the session: {e}"));
    }
    if let Err(e) = fs::rename(&temp, &destination) {
        let _ = fs::remove_file(&temp);
        return Err(format!("failed to place the archive: {e}"));
    }
    if let Err(e) = fs::remove_file(&source) {
        // The archive now holds the only copy — put the session back before
        // failing, and only then drop the archive.
        match restore_source_from(&destination, &source) {
            Ok(_) => {
                let _ = fs::remove_file(&destination);
                return Err(format!("failed to remove the session after archiving: {e}"));
            }
            Err(restore) => {
                return Err(format!(
                    "failed to remove the session after archiving: {e}; the archive at {} holds \
                     the only copy of the session (restore failed: {restore})",
                    destination.display()
                ));
            }
        }
    } else if source_artifacts.exists() {
        if destination_artifacts.exists() {
            return match restore_source_from(&destination, &source) {
                Ok(_) => {
                    let _ = fs::remove_file(&destination);
                    Err(format!(
                        "archived artifacts destination already exists: {} (the session was \
                         restored to {})",
                        destination_artifacts.display(),
                        source.display()
                    ))
                }
                Err(restore) => Err(format!(
                    "archived artifacts destination already exists: {} (restore failed: {restore}; \
                     the archive at {} holds the only copy of the session)",
                    destination_artifacts.display(),
                    destination.display()
                )),
            };
        }
        // The rename is atomic: a failure leaves the artifacts where they
        // were, so only the session file needs putting back.
        if let Err(e) = fs::rename(&source_artifacts, &destination_artifacts) {
            return match restore_source_from(&destination, &source) {
                Ok(_) => {
                    let _ = fs::remove_file(&destination);
                    Err(format!("failed to move the session artifacts: {e}"))
                }
                Err(restore) => Err(format!(
                    "failed to move the session artifacts: {e}; the archive at {} holds the \
                     only copy of the session (restore failed: {restore})",
                    destination.display()
                )),
            };
        }
    }
    Ok(destination.to_string_lossy().into_owned())
}

/// Delete the session at `path` (resolved against `sessions_root`): the file
/// is unlinked, the artifacts directory removed best-effort.
pub fn delete_in(sessions_root: &Path, path: &str) -> Result<(), String> {
    let (source, _) = resolve_session_file(sessions_root, path)?;
    fs::remove_file(&source).map_err(|e| format!("failed to delete the session: {e}"))?;
    // The session file itself is already gone; artifact cleanup is
    // best-effort, as in ompweb.
    let artifacts = artifacts_dir_of(&source);
    if artifacts.exists() {
        let _ = fs::remove_dir_all(&artifacts);
    }
    Ok(())
}

/// [`archive_in`] against `profile`'s sessions directory; the archive lives
/// beside it, at `<agent>/archive/sessions`. Returns the archive path.
pub fn archive_session(
    app: &tauri::AppHandle,
    profile: Option<&str>,
    path: &str,
) -> Result<String, String> {
    let root = sessions_root_dir(app, profile)
        .ok_or_else(|| "could not resolve home directory".to_owned())?;
    let archive_root = root
        .parent()
        .ok_or_else(|| "sessions directory has no parent".to_owned())?
        .join("archive")
        .join("sessions");
    archive_in(&root, &archive_root, path)
}

/// [`delete_in`] against `profile`'s sessions directory.
pub fn delete_session(
    app: &tauri::AppHandle,
    profile: Option<&str>,
    path: &str,
) -> Result<(), String> {
    let root = sessions_root_dir(app, profile)
        .ok_or_else(|| "could not resolve home directory".to_owned())?;
    delete_in(&root, path)
}

#[cfg(test)]
mod tests;
