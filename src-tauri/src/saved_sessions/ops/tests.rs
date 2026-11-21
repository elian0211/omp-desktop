use super::{archive_in, delete_in};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

fn unique_temp_root(tag: &str) -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    std::env::temp_dir().join(format!(
        "omp-saved-session-ops-{tag}-{}-{n}-{nanos}",
        std::process::id()
    ))
}

/// `<root>/<sub>/<id>.jsonl` holding one line, plus its artifacts directory
/// with one transcript — the shape omp leaves on disk.
fn fixture(root: &Path, sub: &str, id: &str) -> PathBuf {
    let dir = root.join(sub);
    fs::create_dir_all(&dir).expect("create sessions dir");
    let file = dir.join(format!("{id}.jsonl"));
    fs::write(&file, "{\"entry\":1}\n").expect("write session");
    fs::create_dir_all(dir.join(id)).expect("create artifacts");
    fs::write(dir.join(id).join("sub.jsonl"), "sub\n").expect("write artifact");
    file
}

fn gunzip(path: &Path) -> String {
    let mut decoder = flate2::read::GzDecoder::new(fs::File::open(path).expect("open archive"));
    let mut out = String::new();
    std::io::Read::read_to_string(&mut decoder, &mut out).expect("gunzip");
    out
}

fn cleanup(root: &Path) {
    fs::remove_dir_all(root).ok();
}

#[test]
fn an_archive_lands_in_omp_gc_layout_with_its_artifacts() {
    let root = unique_temp_root("archive");
    let archive_root = root.parent().unwrap().join(format!(
        "{}-archive",
        root.file_name().unwrap().to_string_lossy()
    ));
    let file = fixture(&root, "sub", "abc123");
    let archived =
        archive_in(&root, &archive_root, &file.to_string_lossy()).expect("archive succeeds");
    let dest = archive_root.join("sub").join("abc123.jsonl.gz");
    assert_eq!(archived, dest.to_string_lossy());
    assert!(!file.exists(), "source is gone");
    assert_eq!(gunzip(&dest), "{\"entry\":1}\n");
    assert_eq!(
        fs::read_to_string(
            archive_root
                .join("sub")
                .join("abc123.jsonl")
                .join("sub.jsonl")
        )
        .expect("artifacts moved"),
        "sub\n"
    );
    cleanup(&root);
    cleanup(&archive_root);
}

#[test]
fn an_archive_refuses_a_colliding_destination() {
    let root = unique_temp_root("collide");
    let archive_root = root.parent().unwrap().join(format!(
        "{}-archive",
        root.file_name().unwrap().to_string_lossy()
    ));
    let file = fixture(&root, "", "abc123");
    fs::create_dir_all(&archive_root).expect("create archive dir");
    fs::write(archive_root.join("abc123.jsonl.gz"), b"stale").expect("write stale archive");
    let err = archive_in(&root, &archive_root, &file.to_string_lossy()).unwrap_err();
    assert!(err.contains("already exists"), "{err}");
    assert!(file.exists(), "the source survives a refused archive");
    cleanup(&root);
    cleanup(&archive_root);
}

#[test]
fn an_archive_refuses_paths_outside_the_root_and_non_sessions() {
    let root = unique_temp_root("confine");
    let archive_root = root.join("archive").join("sessions");
    fs::create_dir_all(&archive_root).expect("create dirs");
    // Flag-shaped: the same guard validate_resume_against_root has, since
    // the value crosses the IPC boundary.
    assert!(archive_in(&root, &archive_root, "--auto-approve").is_err());
    assert!(archive_in(&root, &archive_root, "/elsewhere/x.jsonl").is_err());
    let dir_as_file = root.join("notasession.jsonl");
    fs::create_dir_all(&dir_as_file).expect("create a directory that ends in .jsonl");
    assert!(archive_in(&root, &archive_root, dir_as_file.to_string_lossy().as_ref()).is_err());
    cleanup(&root);
}

#[test]
fn a_delete_removes_the_file_and_its_artifacts() {
    let root = unique_temp_root("delete");
    let file = fixture(&root, "", "abc123");
    let artifacts = root.join("abc123");
    delete_in(&root, file.to_string_lossy().as_ref()).expect("delete succeeds");
    assert!(!file.exists());
    assert!(!artifacts.exists(), "artifacts directory removed");
    cleanup(&root);
}

#[test]
fn a_delete_of_an_artifactless_session_still_succeeds() {
    let root = unique_temp_root("delete-bare");
    let dir = root.join("nested");
    fs::create_dir_all(&dir).expect("create dir");
    let file = dir.join("abc123.jsonl");
    fs::write(&file, "x\n").expect("write session");
    delete_in(&root, file.to_string_lossy().as_ref()).expect("delete succeeds");
    assert!(!file.exists());
    cleanup(&root);
}

#[test]
fn a_delete_refuses_what_an_archive_refuses() {
    let root = unique_temp_root("delete-confine");
    fs::create_dir_all(&root).expect("create root");
    assert!(delete_in(&root, "/elsewhere/x.jsonl").is_err());
    assert!(delete_in(&root, "missing.jsonl").is_err());
    cleanup(&root);
}
