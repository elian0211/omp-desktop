//! Settings → MCP: allowlisted read and edit of omp's MCP server files — the
//! user's `<agent dir>/mcp.json` and the open project's `mcp.json` family
//! (`.omp/mcp.json`, `.omp/.mcp.json`, `mcp.json`, `.mcp.json`; first
//! existing wins), mirroring omp-web's `lib/omp/mcp-config.ts`. omp applies
//! a change on its next spawn, so new tabs pick it up without further work.
//!
//! Secrets: like omp-web's browser-facing view, `env` and `headers` never
//! leave Rust — every read redacts them from each server entry, and an
//! edited server that omits them inherits the stored ones instead of
//! wiping them (the frontend cannot display what it never receives).
//! Files are written `0600` on unix; the whole document is re-serialised
//! (2-space JSON), with every top-level key but `mcpServers` untouched.
//!
//! Validation mirrors omp's loader (`validateMcpServer`): server names match
//! `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`, exactly one of `command`/`url`,
//! `http(s)` URLs only, `args` string array, `env`/`headers` string maps,
//! `timeout` an integer 0..=600000. Reads cap at 5 MiB like omp-web and
//! report rather than swallow parse errors. All read-modify-write cycles
//! share one process mutex (single-instance app), and writes are atomic.
//!
//! No `omp` subprocess: omp has no MCP-config CLI. `profile` is `None` for
//! the built-in profile or `Some(id)`; callers MUST only pass ids from
//! `ProfileStore::resolve_owned`. `project` paths arrive from the frontend
//! and are canonicalised at the command boundary (see `lib.rs`).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde_json::{json, Map, Value as Json};

use crate::profiles;

/// Serialize every read-modify-write so concurrent Settings edits cannot
/// interleave and lose an add or delete. Same rationale as
/// [`crate::omp_native_config::CONFIG_LOCK`].
static MCP_LOCK: Mutex<()> = Mutex::new(());

const MCP_FILENAMES: &[&str] = &[".omp/mcp.json", ".omp/.mcp.json", "mcp.json", ".mcp.json"];
const MAX_CONFIG_BYTES: u64 = 5 * 1024 * 1024;
const MAX_TIMEOUT: i64 = 600_000;
const REDACTED_FIELDS: &[&str] = &["env", "headers"];

/// First existing `mcp.json` family member in `dir`, else the canonical
/// `.omp/mcp.json` (for reads that report absence and writes).
fn config_path(dir: &Path) -> PathBuf {
    for name in MCP_FILENAMES {
        let candidate = dir.join(name);
        if candidate.exists() {
            return candidate;
        }
    }
    dir.join(MCP_FILENAMES[0])
}

/// Redact `env`/`headers` from a server entry (omp-web's browser rule).
fn redact(server: &mut Map<String, Json>) {
    for field in REDACTED_FIELDS {
        server.remove(*field);
    }
}

/// One mcp.json file's snapshot: path, existence, parse error and the
/// redacted servers in name order. `disabledServers` (omp's own list) is
/// carried so the UI can mark them and writes can keep it intact.
fn read_scope(dir: &Path) -> Json {
    let path = config_path(dir);
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return json!({ "path": path.display().to_string(), "exists": false, "error": null, "servers": [], "disabledServers": [] })
        }
        Err(e) => {
            return json!({ "path": path.display().to_string(), "exists": true, "error": format!("could not read: {e}"), "servers": [], "disabledServers": [] })
        }
    };
    let base = json!({ "path": path.display().to_string(), "exists": true });
    if path.metadata().map_or(0, |m| m.len()) > MAX_CONFIG_BYTES {
        return json!({ "path": base["path"], "exists": true, "error": "configuration is too large to inspect", "servers": [], "disabledServers": [] });
    }
    let parsed: Json = match serde_json::from_str(&text) {
        Ok(parsed) => parsed,
        Err(e) => {
            return json!({ "path": base["path"], "exists": true, "error": e.to_string(), "servers": [], "disabledServers": [] })
        }
    };
    let Some(obj) = parsed.as_object() else {
        return json!({ "path": base["path"], "exists": true, "error": "configuration must contain a JSON object", "servers": [], "disabledServers": [] });
    };
    if obj.get("mcpServers").is_some_and(|s| !s.is_object()) {
        return json!({ "path": base["path"], "exists": true, "error": "mcpServers must be an object", "servers": [], "disabledServers": [] });
    }
    let mut servers: Vec<Json> =
        obj.get("mcpServers")
            .and_then(Json::as_object)
            .map_or_else(Vec::new, |map| {
                let mut entries: Vec<(String, &Json)> =
                    map.iter().map(|(k, v)| (k.clone(), v)).collect();
                entries.sort_by(|a, b| a.0.cmp(&b.0));
                entries
                    .into_iter()
                    .filter_map(|(name, server)| {
                        let mut config = server.as_object()?.clone();
                        redact(&mut config);
                        Some(json!({ "name": name, "config": config }))
                    })
                    .collect()
            });
    // A server entry that is not an object is reported, not silently
    // dropped — omp would refuse the whole file.
    if let Some(map) = obj.get("mcpServers").and_then(Json::as_object) {
        for (name, server) in map {
            if !server.is_object() && !servers.iter().any(|s| s["name"] == **name) {
                servers.push(json!({ "name": name, "config": { "invalid": true } }));
            }
        }
        servers.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    }
    let disabled: Vec<&str> = obj
        .get("disabledServers")
        .and_then(Json::as_array)
        .map_or_else(Vec::new, |list| {
            list.iter().filter_map(Json::as_str).collect()
        });
    json!({
        "path": base["path"], "exists": true, "error": null,
        "servers": servers,
        "disabledServers": disabled,
    })
}

/// omp's server-name rule, hand-checked (no regex dependency).
pub fn valid_server_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && chars.count() <= 127
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

fn string_record(value: &Json, field: &str) -> Result<(), String> {
    let Some(map) = value.as_object() else {
        return Err(format!("{field} must be an object"));
    };
    if map.values().any(|v| !v.is_string()) {
        return Err(format!("{field} must map strings to strings"));
    }
    Ok(())
}

/// The rules omp's loader enforces, so the editor rejects a server the next
/// tab would refuse to start with rather than writing it.
pub fn validate_server(name: &str, server: &Json) -> Result<(), String> {
    if !valid_server_name(name) {
        return Err(
            "server name may contain letters, numbers, dots, dashes, and underscores (max 128)"
                .into(),
        );
    }
    let Some(obj) = server.as_object() else {
        return Err("server configuration must be an object".into());
    };
    let get = |field: &str| obj.get(field);
    if let Some(kind) = get("type") {
        let kind = kind.as_str().unwrap_or_default();
        if !matches!(kind, "stdio" | "http" | "sse") {
            return Err("server type must be stdio, http, or sse".into());
        }
    }
    let has = |field: &str| {
        get(field)
            .and_then(Json::as_str)
            .is_some_and(|v| !v.trim().is_empty())
    };
    let has_command = has("command");
    let has_url = has("url");
    if has_command == has_url {
        return Err("provide exactly one of command or url".into());
    }
    let kind = get("type").and_then(Json::as_str).unwrap_or("stdio");
    if kind == "stdio" && !has_command {
        return Err("a stdio server requires a command".into());
    }
    if matches!(kind, "http" | "sse") && !has_url {
        return Err("an HTTP or SSE server requires a URL".into());
    }
    if has_url {
        let parsed = url::Url::parse(get("url").and_then(Json::as_str).unwrap_or_default())
            .map_err(|_| "server URL must be an http or https URL".to_string())?;
        if !matches!(parsed.scheme(), "http" | "https") {
            return Err("server URL must be an http or https URL".into());
        }
    }
    if let Some(args) = get("args") {
        let Some(list) = args.as_array() else {
            return Err("args must be an array of strings".into());
        };
        if list.iter().any(|a| !a.is_string()) {
            return Err("args must be an array of strings".into());
        }
    }
    if let Some(env) = get("env") {
        string_record(env, "env")?;
    }
    if let Some(headers) = get("headers") {
        string_record(headers, "headers")?;
    }
    if let Some(cwd) = get("cwd") {
        if !cwd.is_string() {
            return Err("cwd must be a string".into());
        }
    }
    if let Some(enabled) = get("enabled") {
        if !enabled.is_boolean() {
            return Err("enabled must be a boolean".into());
        }
    }
    if let Some(timeout) = get("timeout") {
        let Some(n) = timeout.as_i64() else {
            return Err("timeout must be an integer between 0 and 600000".into());
        };
        if !(0..=MAX_TIMEOUT).contains(&n) {
            return Err("timeout must be an integer between 0 and 600000".into());
        }
    }
    if let Some(format) = get("requestIdFormat") {
        if format != "number" && format != "string" {
            return Err("requestIdFormat must be number or string".into());
        }
    }
    Ok(())
}

/// Read-modify-write under the process mutex: re-read INSIDE the lock, apply
/// `apply` to the parsed document and atomically rewrite the file `0600` on
/// unix.
fn with_locked_doc(
    dir: &Path,
    apply: impl FnOnce(&mut Map<String, Json>) -> Result<(), String>,
) -> Result<(), String> {
    let _guard = MCP_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let path = config_path(dir);
    let mut doc: Map<String, Json> = match fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<Json>(&text) {
            Ok(Json::Object(doc)) => doc,
            Ok(_) => {
                return Err(format!(
                    "{}: configuration must contain a JSON object",
                    path.display()
                ))
            }
            Err(e) => return Err(format!("{} does not parse: {e}", path.display())),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Map::new(),
        Err(e) => return Err(format!("could not read {}: {e}", path.display())),
    };
    apply(&mut doc)?;
    let text = serde_json::to_string_pretty(&Json::Object(doc))
        .map_err(|e| format!("could not serialise mcp.json: {e}"))?;
    let _ = fs::create_dir_all(dir);
    let temp = dir.join(".mcp.json.omp-desktop.tmp");
    fs::write(&temp, format!("{text}\n"))
        .map_err(|e| format!("could not write {}: {e}", temp.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&temp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&temp, &path).map_err(|e| format!("could not move the new mcp.json into place: {e}"))
}

/// The `mcpServers` map of `doc`, cloned out for editing; written back with
/// [`write_servers`].
fn servers_of(doc: &Map<String, Json>) -> Map<String, Json> {
    doc.get("mcpServers")
        .and_then(Json::as_object)
        .cloned()
        .unwrap_or_default()
}

fn write_servers(doc: &mut Map<String, Json>, servers: Map<String, Json>) {
    doc.insert("mcpServers".into(), Json::Object(servers));
}

/// Insert or rename one server in `dir`'s mcp.json. `server` comes from the
/// frontend redacted (no `env`/`headers`); fields the frontend never sees are
/// inherited from the stored entry instead of being wiped by the edit.
pub fn set_server(
    dir: &Path,
    name: &str,
    server: &Json,
    previous_name: Option<&str>,
) -> Result<Json, String> {
    validate_server(name, server)?;
    if let Some(previous) = previous_name {
        if !valid_server_name(previous) {
            return Err("invalid previous server name".into());
        }
    }
    with_locked_doc(dir, |doc| {
        let mut servers = servers_of(doc);
        let key = previous_name.unwrap_or(name);
        let mut incoming = server.clone();
        // Inherit secrets the frontend never received.
        if let Some(previous_entry) = servers.get(key).and_then(Json::as_object) {
            if let Some(incoming_obj) = incoming.as_object_mut() {
                for field in REDACTED_FIELDS {
                    if let Some(stored) = previous_entry.get(*field) {
                        incoming_obj
                            .entry((*field).to_string())
                            .or_insert(stored.clone());
                    }
                }
            }
        }
        if previous_name.is_some_and(|p| p != name) {
            servers.remove(previous_name.unwrap());
        }
        servers.insert(name.to_string(), incoming);
        write_servers(doc, servers);
        Ok(())
    })?;
    Ok(read_scope(dir))
}

/// Remove one server from `dir`'s mcp.json.
pub fn delete_server(dir: &Path, name: &str) -> Result<Json, String> {
    if !valid_server_name(name) {
        return Err("invalid server name".into());
    }
    with_locked_doc(dir, |doc| {
        let mut servers = servers_of(doc);
        if servers.remove(name).is_none() {
            return Err("MCP server was not found".into());
        }
        write_servers(doc, servers);
        Ok(())
    })?;
    Ok(read_scope(dir))
}

/// The Settings payload: the user file plus, when a project is open, its
/// file. Both redacted.
pub fn get(
    home: &Path,
    profile: Option<&str>,
    env_dir: Option<&std::ffi::OsStr>,
    project: Option<&Path>,
) -> Json {
    let mut map = Map::new();
    map.insert(
        "user".into(),
        read_scope(&profiles::agent_dir_for(home, profile, env_dir)),
    );
    if let Some(project) = project {
        map.insert("project".into(), read_scope(project));
    }
    Json::Object(map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn write_config(dir: &Path, text: &str) {
        let path = config_path(dir);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn config_path_prefers_the_family_order() {
        let dir = std::env::temp_dir().join(format!("omp-mcp-path-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(".omp")).unwrap();
        assert!(config_path(&dir).ends_with(".omp/mcp.json"));
        fs::write(dir.join(".omp/mcp.json"), "{}").unwrap();
        assert!(config_path(&dir).ends_with(".omp/mcp.json"));
        fs::remove_file(dir.join(".omp/mcp.json")).unwrap();
        fs::write(dir.join("mcp.json"), "{}").unwrap();
        assert!(config_path(&dir).ends_with("mcp.json"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_redacts_secrets_and_reports_errors() {
        let dir = std::env::temp_dir().join(format!("omp-mcp-read-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_config(
            &dir,
            r#"{"mcpServers":{"acme":{"command":"n","args":["-y"],"env":{"TOKEN":"x"}},"zz":{"broken":1}},"disabledServers":["acme"],"other":true}"#,
        );
        let snap = read_scope(&dir);
        assert_eq!(snap["error"], Json::Null);
        assert_eq!(snap["disabledServers"][0], "acme");
        assert_eq!(snap["servers"][0]["name"], "acme");
        let cfg = &snap["servers"][0]["config"];
        assert!(cfg.get("env").is_none(), "env never leaves Rust");
        assert_eq!(cfg["command"], "n");
        assert_eq!(snap["servers"][1]["name"], "zz", "servers sort by name");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_reports_a_broken_file_instead_of_swallowing() {
        let dir = std::env::temp_dir().join(format!("omp-mcp-bad-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_config(&dir, "{oops");
        let snap = read_scope(&dir);
        assert_eq!(snap["exists"], true);
        assert!(snap["error"].as_str().is_some());
        assert_eq!(snap["servers"].as_array().unwrap().len(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_inherits_secrets_and_renames_without_losing_them() {
        let dir = std::env::temp_dir().join(format!("omp-mcp-set-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_config(
            &dir,
            r#"{"mcpServers":{"old":{"command":"n","env":{"TOKEN":"keep-me"}}},"disabledServers":["old"]}"#,
        );
        // Edit under a new name, omitting env: the stored secret survives.
        let snap = set_server(&dir, "new", &json!({ "command": "n2" }), Some("old")).unwrap();
        let servers = snap["servers"].as_array().unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0]["name"], "new");
        let text = fs::read_to_string(config_path(&dir)).unwrap();
        assert!(
            text.contains("keep-me"),
            "the stored secret survives the edit"
        );
        assert!(text.contains("disabledServers"), "omp's own keys survive");
        assert!(
            !text.contains("\"old\": {"),
            "the renamed entry is gone (disabledServers may still list it)"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_clears_secrets_on_explicit_null_and_deletes_servers() {
        let dir = std::env::temp_dir().join(format!("omp-mcp-del-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_config(
            &dir,
            r#"{"mcpServers":{"a":{"command":"n","env":{"T":"x"}}}}"#,
        );
        // An explicit empty object for env removes it (the user cleared it).
        set_server(&dir, "a", &json!({ "command": "n", "env": {} }), None).unwrap();
        let text = fs::read_to_string(config_path(&dir)).unwrap();
        assert!(
            text.contains("\"env\": {}"),
            "an explicit env object replaces the stored one"
        );
        delete_server(&dir, "a").unwrap();
        let text = fs::read_to_string(config_path(&dir)).unwrap();
        assert!(text.contains("\"mcpServers\": {}"));
        assert!(
            delete_server(&dir, "a").is_err(),
            "deleting a missing server fails"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn validate_rejects_omp_refused_servers() {
        assert!(validate_server("ok-name.1", &json!({ "command": "n" })).is_ok());
        assert!(validate_server(
            "ok",
            &json!({ "type": "http", "url": "https://x.example/mcp" })
        )
        .is_ok());
        assert!(
            validate_server("ok", &json!({ "url": "https://x.example/mcp" })).is_err(),
            "stdio (the default) needs a command"
        );
        assert!(validate_server("-bad", &json!({ "command": "n" })).is_err());
        assert!(validate_server(&"a".repeat(129), &json!({ "command": "n" })).is_err());
        assert!(
            validate_server("a", &json!({ "command": "n", "url": "https://x" })).is_err(),
            "both command and url"
        );
        assert!(
            validate_server("a", &json!({})).is_err(),
            "neither command nor url"
        );
        assert!(
            validate_server("a", &json!({ "type": "http", "command": "n" })).is_err(),
            "http needs a url"
        );
        assert!(validate_server("a", &json!({ "url": "ftp://x" })).is_err());
        assert!(validate_server("a", &json!({ "command": "n", "args": [1] })).is_err());
        assert!(validate_server("a", &json!({ "command": "n", "env": { "T": 1 } })).is_err());
        assert!(validate_server("a", &json!({ "command": "n", "timeout": 600_001 })).is_err());
        assert!(validate_server("a", &json!({ "command": "n", "timeout": -1 })).is_err());
        assert!(validate_server("a", &json!({ "command": "n", "requestIdFormat": "x" })).is_err());
    }
}
