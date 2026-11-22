//! Installed omp version and `omp update --check` for the status bar.
//!
//! omp owns its own updater (`omp update` / `omp update --check`); the
//! desktop never installs omp itself. These helpers only surface what that
//! CLI already prints, so channels, package rename, binary-only releases and
//! managed installs stay omp's problem.
//!
//! - [`version`] runs `omp --version` (`omp/X.Y.Z…`).
//! - [`check`] runs `omp update --check` and parses the human stdout into
//!   [`OmpUpdateInfo`]. There is no machine-readable flag yet; the parser
//!   strips ANSI and matches the known phrases from omp's update CLI.

use crate::agent::spawn::omp_output_plain;

/// What the frontend needs after an `omp update --check`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpUpdateInfo {
    /// Installed version (`18.5.1`, or a prerelease such as `18.5.1-canary.1`).
    pub version: String,
    /// Newer version when one is offered; `None` when up to date (or when
    /// the install cannot update itself and nothing newer was named).
    pub available: Option<String>,
    /// `false` when this install is managed outside omp (Nix, another app)
    /// or otherwise refuses self-update — the UI then shows [`Self::reason`]
    /// instead of "run `omp update`".
    pub can_update: bool,
    /// Human reason when [`Self::can_update`] is false.
    pub reason: Option<String>,
}

/// The installed omp version from `omp --version`, or an error when omp is
/// missing / unreadable. Spawns omp, so callers MUST run this off the main
/// thread.
pub fn version() -> Result<String, String> {
    let output = omp_output_plain(&["--version"])?;
    let text = combine_output(&output.stdout, &output.stderr);
    parse_version_output(&text).ok_or_else(|| {
        let printed: String = text.trim().chars().take(200).collect();
        format!("could not read the omp version (`omp --version` printed {printed:?})")
    })
}

/// Ask omp whether a newer release is available (`omp update --check`).
/// Spawns omp and may hit the network; callers MUST run this off the main
/// thread.
pub fn check() -> Result<OmpUpdateInfo, String> {
    let output = omp_output_plain(&["update", "--check"])?;
    let text = combine_output(&output.stdout, &output.stderr);
    let plain = strip_ansi(&text);
    if !output.status.success() {
        return Err(check_failure_message(output.status, &plain));
    }
    match parse_check_output(&plain)? {
        ParsedCheck::Ready(info) => Ok(info),
        // Managed-app / Nix refusals often print only the reason, before
        // "Current version". A fresh `--version` still fills the status bar.
        ParsedCheck::UnsupportedOnly(reason) => Ok(OmpUpdateInfo {
            version: version().unwrap_or_else(|_| "—".into()),
            available: None,
            can_update: false,
            reason: Some(reason),
        }),
    }
}

fn combine_output(stdout: &[u8], stderr: &[u8]) -> String {
    format!(
        "{}\n{}",
        String::from_utf8_lossy(stdout),
        String::from_utf8_lossy(stderr),
    )
}

fn check_failure_message(status: impl std::fmt::Display, plain: &str) -> String {
    let trimmed = plain.trim();
    if trimmed.is_empty() {
        format!("omp update --check exited with {status} and produced no output")
    } else {
        let preview: String = trimmed.chars().take(400).collect();
        format!("omp update --check failed ({status}): {preview}")
    }
}

/// `X.Y.Z` or `X.Y.Z-prerelease` from one `omp --version` line (`omp/18.5.1`).
fn parse_version_output(output: &str) -> Option<String> {
    output.lines().find_map(parse_version_line)
}

fn parse_version_line(line: &str) -> Option<String> {
    let line = strip_ansi(line.trim());
    let version = line.strip_prefix("omp/")?.trim();
    if version.is_empty() {
        return None;
    }
    // Mirror omp's `parseReportedVersion`: digits.digits.digits with an
    // optional prerelease / build suffix.
    let mut parts = version.splitn(3, '.');
    let major = parts.next()?;
    let minor = parts.next()?;
    let rest = parts.next()?;
    if !major.chars().all(|c| c.is_ascii_digit()) || !minor.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let digits = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    if digits == 0 {
        return None;
    }
    Some(version.to_string())
}

/// Outcome of parsing a successful `omp update --check` stdout.
enum ParsedCheck {
    Ready(OmpUpdateInfo),
    /// Reason only — caller fills [`OmpUpdateInfo::version`] from `--version`.
    UnsupportedOnly(String),
}

/// Parse the human stdout of a successful `omp update --check`.
/// Accepts chalk-coloured text — ANSI is stripped here so callers and
/// tests need not pre-clean it.
fn parse_check_output(output: &str) -> Result<ParsedCheck, String> {
    let plain = strip_ansi(output);
    let installed = plain
        .lines()
        .find_map(parse_current_version_line)
        .or_else(|| plain.lines().find_map(parse_version_line));
    let available = plain.lines().find_map(parse_available_version_line);
    let uptodate = plain.lines().any(is_uptodate_line);
    let unsupported = plain.lines().find_map(parse_unsupported_reason);

    let Some(version) = installed else {
        return unsupported.map_or_else(
            || Err("omp update --check printed no version (expected `Current version: …`)".into()),
            |reason| Ok(ParsedCheck::UnsupportedOnly(reason)),
        );
    };

    if let Some(available) = available {
        return Ok(ParsedCheck::Ready(OmpUpdateInfo {
            version,
            available: Some(available),
            can_update: unsupported.is_none(),
            reason: unsupported,
        }));
    }

    if uptodate || unsupported.is_some() {
        return Ok(ParsedCheck::Ready(OmpUpdateInfo {
            version,
            available: None,
            can_update: unsupported.is_none(),
            reason: unsupported,
        }));
    }

    Err("omp update --check finished without saying whether an update is available".into())
}

fn parse_current_version_line(line: &str) -> Option<String> {
    let line = line.trim();
    let rest = line.strip_prefix("Current version:")?;
    let version = rest.trim();
    if version.is_empty() {
        None
    } else {
        Some(version.to_string())
    }
}

fn parse_available_version_line(line: &str) -> Option<String> {
    let line = line.trim();
    let rest = line.strip_prefix("New version available:")?;
    let version = rest.trim();
    if version.is_empty() {
        None
    } else {
        Some(version.to_string())
    }
}

fn is_uptodate_line(line: &str) -> bool {
    let line = line.trim();
    // chalk may leave a leading status glyph when colour is forced back on;
    // strip common prefixes so "✔ Already up to date" still matches.
    let body = line
        .trim_start_matches(|c: char| !c.is_ascii_alphabetic())
        .trim_start();
    body.eq_ignore_ascii_case("Already up to date")
        || body.to_ascii_lowercase().starts_with("already up to date")
}

fn parse_unsupported_reason(line: &str) -> Option<String> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    let lower = line.to_ascii_lowercase();
    if lower.contains("cannot update itself")
        || lower.contains("kept up to date by")
        || lower.contains("canary updates are only supported")
        || lower.contains("managed by nix")
    {
        Some(line.to_string())
    } else {
        None
    }
}

/// Drop CSI / OSC sequences so chalk-coloured lines still match.
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\u{1b}' {
            out.push(c);
            continue;
        }
        match chars.peek().copied() {
            Some('[') => {
                chars.next();
                for c in chars.by_ref() {
                    if c.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            Some(']') => {
                chars.next();
                while let Some(c) = chars.next() {
                    if c == '\u{7}' {
                        break;
                    }
                    if c == '\u{1b}' && chars.peek() == Some(&'\\') {
                        chars.next();
                        break;
                    }
                }
            }
            _ => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_omp_version_lines() {
        assert_eq!(parse_version_output("omp/18.5.1\n"), Some("18.5.1".into()));
        assert_eq!(
            parse_version_output("  omp/18.5.1-canary.3\r\n"),
            Some("18.5.1-canary.3".into())
        );
        assert_eq!(parse_version_output("omp/18.10.0"), Some("18.10.0".into()));
        assert_eq!(parse_version_output("not a version"), None);
        assert_eq!(parse_version_output("omp/"), None);
    }

    #[test]
    fn strips_ansi_before_matching_version() {
        let coloured = "\u{1b}[2momp/18.20.0\u{1b}[0m\n";
        assert_eq!(parse_version_output(coloured), Some("18.20.0".into()));
    }

    fn ready(plain: &str) -> OmpUpdateInfo {
        match parse_check_output(plain).expect("parse") {
            ParsedCheck::Ready(info) => info,
            ParsedCheck::UnsupportedOnly(reason) => panic!("unexpected unsupported-only: {reason}"),
        }
    }

    #[test]
    fn check_uptodate() {
        assert_eq!(
            ready("Current version: 18.20.0\n✔ Already up to date\n"),
            OmpUpdateInfo {
                version: "18.20.0".into(),
                available: None,
                can_update: true,
                reason: None,
            }
        );
    }

    #[test]
    fn check_available() {
        let info = ready("Current version: 18.19.0\nNew version available: 18.20.0\n");
        assert_eq!(info.version, "18.19.0");
        assert_eq!(info.available.as_deref(), Some("18.20.0"));
        assert!(info.can_update);
        assert!(info.reason.is_none());
    }

    #[test]
    fn check_unsupported_with_current_version() {
        let info = ready(
            "Current version: 18.20.0\nThis installation is managed by Nix and cannot update itself.\n",
        );
        assert_eq!(info.version, "18.20.0");
        assert!(info.available.is_none());
        assert!(!info.can_update);
        assert!(info
            .reason
            .as_deref()
            .is_some_and(|r| r.contains("cannot update itself")));
    }

    #[test]
    fn check_unsupported_reason_only() {
        match parse_check_output(
            "/nix/store/…/bin/omp is installed and kept up to date by Tern; update it from Tern.\n",
        )
        .expect("parse")
        {
            ParsedCheck::UnsupportedOnly(reason) => {
                assert!(reason.contains("kept up to date by Tern"), "{reason}");
            }
            ParsedCheck::Ready(info) => panic!("expected unsupported-only, got {info:?}"),
        }
    }

    #[test]
    fn check_coloured_available_line() {
        let info = ready(
            "\u{1b}[2mCurrent version: 18.1.0\u{1b}[0m\n\u{1b}[36mNew version available: 18.2.0\u{1b}[0m\n",
        );
        assert_eq!(info.available.as_deref(), Some("18.2.0"));
    }

    #[test]
    fn check_failure_names_empty_output() {
        let msg = check_failure_message("exit status: 1", "  \n");
        assert!(msg.contains("produced no output"), "{msg}");
    }

    #[test]
    fn check_failure_keeps_stderr_preview() {
        let msg = check_failure_message("exit status: 1", "Failed to check for updates: timed out");
        assert!(msg.contains("timed out"), "{msg}");
    }
}
