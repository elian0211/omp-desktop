//! `project_tree`: the tab folder's plain file system folded into the same
//! [`TreeNode`] tree the git status tree uses — the files panel's data
//! source for a project folder that is not (only) a repository, where
//! `git_browser_status` has nothing to list. Browsing must not depend on
//! git: the walk lists every file and directory (skipping the
//! conventional build and dependency directories in [`SKIPPED_DIRS`]), and
//! each repository found inside the folder contributes only its changes
//! as status marks ([`crate::git_browser::status::nested_changes`]) — the
//! innermost repository containing a file decides its mark, so an outer
//! repository's stale view of a nested checkout (say, an untracked
//! directory that later became a repository) never overrides the inner
//! repository's own, current answer.

use crate::git_browser::{fold, StatusKind, TreeNode, MAX_FILES};
use std::collections::BTreeMap;
use std::path::Path;

/// Directories the walk never enters. Git's own status view draws the
/// line with the repository's ignore rules; this fallback walk has no
/// repository to ask at the top level, and listing `node_modules` et al.
/// would drown the tree (and burn the [`MAX_FILES`] cap on noise), so the
/// conventional build, dependency and cache directories are skipped
/// everywhere — inside a nested repository too, where they are ignored
/// anyway.
const SKIPPED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    ".next",
    ".cache",
    ".gradle",
];

/// Walk recursion and path depth stop: a legitimate project tree is far
/// shallower; past it the walk is capping, not browsing.
const MAX_DEPTH: usize = 128;

/// The plain file-system tree of the tab folder.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTreeView {
    pub tree: TreeNode,
    /// Changed files in `tree` (a nested repository's changes against its
    /// `HEAD`).
    pub changed: u32,
    /// [`MAX_FILES`] files or [`MAX_DEPTH`] levels reached: the walk was
    /// cut off.
    pub truncated: bool,
}

/// One walked file: `/`-separated path relative to the walk root, its
/// overlaid status, its size on disk, and the git-tree "directory row"
/// flag (always false here — real directories are tree nodes).
pub type Entry = (String, Option<StatusKind>, Option<u64>, bool);

/// A repository found inside the folder: its files' prefix relative to the
/// tab folder (`""` for a repository at the top) and its files' changes
/// against `HEAD`, `/`-separated and relative to the repository's work
/// dir.
struct Nested {
    prefix: String,
    kinds: BTreeMap<String, StatusKind>,
}

impl Nested {
    /// Whether `path` (tab-folder-relative) lies in this repository.
    fn covers(&self, path: &str) -> bool {
        self.prefix.is_empty()
            || path
                .strip_prefix(&self.prefix)
                .is_some_and(|rest| rest.starts_with('/'))
    }

    /// The change this repository reports for the file `path`
    /// (tab-folder-relative); `None` when it is unchanged.
    fn mark(&self, path: &str) -> Option<StatusKind> {
        let rel = if self.prefix.is_empty() {
            path
        } else {
            path.strip_prefix(&self.prefix)?.strip_prefix('/')?
        };
        self.kinds.get(rel).copied()
    }
}

/// `project_tree(path)` — the folder's file system, with the changes of
/// every repository found inside it overlaid as status marks.
pub fn project_tree(path: &Path) -> Result<ProjectTreeView, String> {
    let root = std::fs::canonicalize(path).map_err(|e| format!("cannot read the folder: {e}"))?;
    if !root.is_dir() {
        return Err(format!("{} is not a folder", path.display()));
    }
    let (files, truncated) = entries(&root);
    let tree = fold(files, Vec::new());
    Ok(ProjectTreeView {
        changed: tree.changed,
        tree,
        truncated,
    })
}

/// The walked files of `root` (which must be a directory): the file-system
/// walk of [`project_tree`] without the fold — the git status tree's
/// submodules splice their work-tree files in through this
/// ([`crate::git_browser::status`]).
/// Paths are `/`-separated and relative to `root` as given (not
/// canonicalised); the flag says whether the walk was cut off.
pub fn entries(root: &Path) -> (Vec<Entry>, bool) {
    let mut files = Vec::new();
    let mut nested = Vec::new();
    let truncated = walk(root, "", 0, &mut files, &mut nested);
    // Deleted files are in a repository's changes but not on disk, so the
    // walk never saw them: add them as size-less rows.
    if !nested.is_empty() {
        let mut deleted = Vec::new();
        for nested_repo in &nested {
            for (rel, kind) in &nested_repo.kinds {
                if *kind != StatusKind::Deleted {
                    continue;
                }
                let path = if nested_repo.prefix.is_empty() {
                    rel.clone()
                } else {
                    format!("{}/{rel}", nested_repo.prefix)
                };
                deleted.push(path);
            }
        }
        let walked: std::collections::HashSet<String> =
            files.iter().map(|(p, ..)| p).cloned().collect();
        for path in deleted {
            if !walked.contains(&path) {
                files.push((path, Some(StatusKind::Deleted), None, false));
            }
        }
    }
    (files, truncated)
}

/// Walk `dir` (whose files are prefixed `prefix`) into `files`, collecting
/// the repositories found below it into `nested` (outer first). Returns
/// whether the walk hit a cap.
fn walk(
    dir: &Path,
    prefix: &str,
    depth: usize,
    files: &mut Vec<Entry>,
    nested: &mut Vec<Nested>,
) -> bool {
    if depth > MAX_DEPTH || files.len() >= MAX_FILES {
        return true;
    }
    // A directory with a `.git` beside it is a repository (the `.git` of a
    // worktree or submodule checkout is a file, a plain one a directory).
    if dir.join(".git").exists() {
        if let Ok(kinds) = crate::git_browser::nested_changes(dir) {
            nested.push(Nested {
                prefix: prefix.to_string(),
                kinds,
            });
        }
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        // An unreadable directory is a gap in the tree, not a failed walk
        // (an unreadable root still is: `project_tree` reports it).
        return false;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let child_prefix = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        // `DirEntry::metadata` never follows symlinks: a symlink is a file
        // row, never descended into — no cycles, no leaving the folder.
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            if SKIPPED_DIRS.contains(&name.as_str()) {
                continue;
            }
            if walk(&entry.path(), &child_prefix, depth + 1, files, nested) {
                return true;
            }
        } else {
            if files.len() >= MAX_FILES {
                return true;
            }
            // The innermost repository covering the file decides its mark,
            // changed or not (see the module doc).
            let status = nested
                .iter()
                .rev()
                .find(|n| n.covers(&child_prefix))
                .and_then(|n| n.mark(&child_prefix));
            files.push((child_prefix, status, Some(meta.len()), false));
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::{project_tree, SKIPPED_DIRS};
    use crate::git_browser::fixture;
    use crate::git_browser::StatusKind::Modified;
    use crate::git_browser::TreeNode;
    use std::path::Path;

    /// Look up a `/`-separated path in the tree ("" is the root).
    fn find<'a>(tree: &'a TreeNode, path: &str) -> Option<&'a TreeNode> {
        if path.is_empty() {
            return Some(tree);
        }
        let (head, rest) = path.split_once('/').unwrap_or((path, ""));
        let node = tree.children.iter().find(|c| c.name == head)?;
        if rest.is_empty() {
            Some(node)
        } else {
            find(node, rest)
        }
    }

    fn status_of(tree: &TreeNode, path: &str) -> Option<crate::git_browser::StatusKind> {
        find(tree, path).and_then(|n| n.status)
    }

    fn size_of(tree: &TreeNode, path: &str) -> Option<u64> {
        find(tree, path).and_then(|n| n.size)
    }

    #[test]
    fn skipped_dirs_are_the_conventional_build_and_dependency_ones() {
        assert!(SKIPPED_DIRS.contains(&".git"));
        assert!(SKIPPED_DIRS.contains(&"node_modules"));
    }

    #[test]
    fn a_plain_folder_walks_with_no_marks() {
        let dir =
            std::env::temp_dir().join(format!("omp-project-tree-plain-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).expect("mkdir");
        std::fs::write(dir.join("a.txt"), "a\n").expect("write");
        std::fs::write(dir.join("sub").join("b.md"), "b\n").expect("write");
        std::fs::create_dir_all(dir.join("node_modules")).expect("mkdir");
        std::fs::write(dir.join("node_modules").join("dep.js"), "d\n").expect("write");

        let view = project_tree(&dir).expect("tree");
        assert_eq!(size_of(&view.tree, "a.txt"), Some(2));
        assert!(find(&view.tree, "sub").is_some_and(|n| n.dir));
        assert!(find(&view.tree, "sub/b.md").is_some());
        assert!(find(&view.tree, "node_modules").is_none(), "skipped");
        assert_eq!(view.changed, 0);
        assert_eq!(status_of(&view.tree, "a.txt"), None);
        assert_eq!(view.tree.status, None);
        assert!(!view.truncated);

        std::fs::remove_dir_all(&dir).ok();
    }

    /// `git args` in `dir`, panicking on failure — setup only, as the
    /// shared fixture's `run`.
    fn git(dir: &Path, args: &[&str]) {
        let status = std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .env(
                "GIT_CONFIG_GLOBAL",
                std::env::temp_dir().join("omp-nonexistent-gitconfig"),
            )
            .env(
                "GIT_CONFIG_SYSTEM",
                std::env::temp_dir().join("omp-nonexistent-gitconfig"),
            )
            .status()
            .expect("run git");
        assert!(status.success(), "git {args:?} failed");
    }

    /// A repository at `dir` with one committed file and one later edit.
    fn init_nested(dir: &Path) {
        std::fs::create_dir_all(dir).expect("mkdir");
        git(dir, &["init", "-q"]);
        git(dir, &["config", "user.name", "Test"]);
        git(dir, &["config", "user.email", "test@example.com"]);
        std::fs::write(dir.join("keep.txt"), "keep\n").expect("write");
        std::fs::write(dir.join("edit.txt"), "edit\n").expect("write");
        std::fs::write(dir.join("gone.txt"), "gone\n").expect("write");
        git(dir, &["add", "."]);
        git(dir, &["commit", "-q", "-m", "init"]);
        std::fs::write(dir.join("edit.txt"), "edited\n").expect("write");
        std::fs::remove_file(dir.join("gone.txt")).expect("delete");
    }

    #[test]
    fn a_repository_one_level_down_marks_its_changes_and_lists_deleted_files() {
        if !fixture::git_available() {
            return;
        }
        let root =
            std::env::temp_dir().join(format!("omp-project-tree-nested-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("mkdir");
        std::fs::write(root.join("readme.md"), "root file\n").expect("write");
        init_nested(&root.join("code"));

        let view = project_tree(&root).expect("tree");
        assert_eq!(status_of(&view.tree, "readme.md"), None, "outside any repo");
        assert_eq!(size_of(&view.tree, "code/edit.txt"), Some(7));
        assert_eq!(status_of(&view.tree, "code/edit.txt"), Some(Modified));
        assert_eq!(status_of(&view.tree, "code/keep.txt"), None);
        assert!(
            find(&view.tree, "code/gone.txt").is_some(),
            "a deleted file keeps its row"
        );
        assert_eq!(find(&view.tree, "code/gone.txt").and_then(|n| n.size), None);
        assert_eq!(view.changed, 2, "the edit and the deletion");
        assert_eq!(find(&view.tree, "code").map(|n| n.changed), Some(2));
        assert!(!view.truncated);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn the_innermost_repository_decides_a_shared_files_mark() {
        if !fixture::git_available() {
            return;
        }
        let root = std::env::temp_dir().join(format!(
            "omp-project-tree-nested-inner-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).expect("mkdir");
        init_nested(&root.join("outer"));
        // `outer/inner` is its own repository whose `a.txt` is committed
        // and unchanged; to the outer repository it is an untracked path.
        init_nested(&root.join("outer").join("inner"));

        let view = project_tree(&root).expect("tree");
        assert_eq!(
            status_of(&view.tree, "outer/inner/keep.txt"),
            None,
            "the inner repository's unchanged file is not the outer one's Untracked"
        );
        assert_eq!(status_of(&view.tree, "outer/edit.txt"), Some(Modified));

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_folder_that_is_itself_a_repository_gets_its_own_marks() {
        if !fixture::git_available() {
            return;
        }
        let repo = fixture::init("project-tree-self").expect("git on PATH");
        repo.write("a.txt", "one\n");
        repo.git(&["add", "."]);
        repo.commit("init", 1_700_000_000);
        repo.write("a.txt", "two\n");

        let view = project_tree(repo.path()).expect("tree");
        assert_eq!(status_of(&view.tree, "a.txt"), Some(Modified));
        assert_eq!(view.changed, 1);
    }
}
