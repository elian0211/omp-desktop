//! Allowlisted reads and writes of omp's profile `config.yml` keys used by
//! Settings → Intelligence (memory, compaction details, retry details) and
//! model roles (including `advisor`).
//!
//! Goes through `omp config get|set` like [`crate::goal_config`], so omp owns
//! path, format and live reload. Keys that conflict with desktop-owned
//! controls (`compaction.enabled`, `retry.enabled`, approval, thinking
//! defaults, advisor lifecycle) are deliberately absent from the allowlist.
//!
//! `profile` is `None` for the built-in profile or `Some(id)` for a named
//! one; callers MUST only pass ids from `ProfileStore::resolve_owned`.

use std::collections::BTreeMap;
use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Names the subcommand in `omp_cli::run`'s failure messages.
const OMP_CONFIG: &str = "omp config";

const OUTPUT_SNIPPET_MAX_CHARS: usize = 120;

/// Compaction method ids omp accepts in `compaction.methodOrder`.
const COMPACTION_METHODS: &[&str] = &["remote", "snapcompact", "handoff", "soft", "shake"];

const MEMORY_BACKENDS: &[&str] = &["off", "local", "mnemopi", "hindsight"];

const MEMORY_SCOPES: &[&str] = &["global", "per-project", "per-project-tagged"];

/// Roles the model-roles editor exposes (omp's native set).
pub const MODEL_ROLES: &[&str] = &[
    "default", "smol", "slow", "vision", "plan", "designer", "commit", "tiny", "task", "advisor",
];

/// Serialises every read and write so concurrent Settings patches cannot
/// interleave. Same rationale as `goal_config::CONFIG_LOCK`.
static CONFIG_LOCK: Mutex<()> = Mutex::new(());

/// The Intelligence + modelRoles snapshot the Settings page edits.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceSettings {
    #[serde(default)]
    pub compaction: CompactionDetails,
    #[serde(default)]
    pub memory: MemorySettings,
    #[serde(default)]
    pub autolearn: AutolearnSettings,
    #[serde(default)]
    pub mnemopi: MnemopiSettings,
    #[serde(default)]
    pub retry: RetryDetails,
    #[serde(default)]
    pub model_roles: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompactionDetails {
    pub mid_turn_enabled: bool,
    pub auto_continue: bool,
    pub method_order: Vec<String>,
}

impl Default for CompactionDetails {
    fn default() -> Self {
        Self {
            mid_turn_enabled: true,
            auto_continue: true,
            method_order: COMPACTION_METHODS.iter().map(|s| (*s).to_string()).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemorySettings {
    pub backend: String,
}

impl Default for MemorySettings {
    fn default() -> Self {
        Self {
            backend: "mnemopi".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutolearnSettings {
    pub enabled: bool,
    pub auto_continue: bool,
}

impl Default for AutolearnSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_continue: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MnemopiSettings {
    pub scoping: String,
    pub auto_recall: bool,
    pub auto_retain: bool,
}

impl Default for MnemopiSettings {
    fn default() -> Self {
        Self {
            scoping: "per-project".to_string(),
            auto_recall: true,
            auto_retain: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RetryDetails {
    pub max_retries: u32,
    pub model_fallback: bool,
}

impl Default for RetryDetails {
    fn default() -> Self {
        Self {
            max_retries: 2,
            model_fallback: false,
        }
    }
}

/// A partial patch: only set fields are written. Nested objects merge field-wise.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligencePatch {
    pub compaction: Option<CompactionPatch>,
    pub memory: Option<MemoryPatch>,
    pub autolearn: Option<AutolearnPatch>,
    pub mnemopi: Option<MnemopiPatch>,
    pub retry: Option<RetryPatch>,
    pub model_roles: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactionPatch {
    pub mid_turn_enabled: Option<bool>,
    pub auto_continue: Option<bool>,
    pub method_order: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPatch {
    pub backend: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutolearnPatch {
    pub enabled: Option<bool>,
    pub auto_continue: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MnemopiPatch {
    pub scoping: Option<String>,
    pub auto_recall: Option<bool>,
    pub auto_retain: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryPatch {
    pub max_retries: Option<u32>,
    pub model_fallback: Option<bool>,
}

/// Read the Intelligence + modelRoles snapshot for `profile`.
///
/// Spawns `omp` once per key, so callers MUST run this off the main thread.
pub fn get(profile: Option<&str>) -> Result<IntelligenceSettings, String> {
    let _guard = CONFIG_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    read_locked(profile)
}

/// Apply a patch and return the re-read snapshot.
pub fn set(profile: Option<&str>, patch: IntelligencePatch) -> Result<IntelligenceSettings, String> {
    let _guard = CONFIG_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    validate_patch(&patch)?;
    if let Some(c) = &patch.compaction {
        if let Some(v) = c.mid_turn_enabled {
            set_value(profile, "compaction.midTurnEnabled", Value::Bool(v))?;
        }
        if let Some(v) = c.auto_continue {
            set_value(profile, "compaction.autoContinue", Value::Bool(v))?;
        }
        if let Some(ref order) = c.method_order {
            let cleaned = sanitize_method_order(order);
            set_value(
                profile,
                "compaction.methodOrder",
                Value::Array(cleaned.into_iter().map(Value::String).collect()),
            )?;
        }
    }
    if let Some(m) = &patch.memory {
        if let Some(ref backend) = m.backend {
            set_value(profile, "memory.backend", Value::String(backend.clone()))?;
        }
    }
    if let Some(a) = &patch.autolearn {
        if let Some(v) = a.enabled {
            set_value(profile, "autolearn.enabled", Value::Bool(v))?;
        }
        if let Some(v) = a.auto_continue {
            set_value(profile, "autolearn.autoContinue", Value::Bool(v))?;
        }
    }
    if let Some(m) = &patch.mnemopi {
        if let Some(ref scoping) = m.scoping {
            set_value(profile, "mnemopi.scoping", Value::String(scoping.clone()))?;
        }
        if let Some(v) = m.auto_recall {
            set_value(profile, "mnemopi.autoRecall", Value::Bool(v))?;
        }
        if let Some(v) = m.auto_retain {
            set_value(profile, "mnemopi.autoRetain", Value::Bool(v))?;
        }
    }
    if let Some(r) = &patch.retry {
        if let Some(v) = r.max_retries {
            set_value(profile, "retry.maxRetries", Value::Number(v.into()))?;
        }
        if let Some(v) = r.model_fallback {
            set_value(profile, "retry.modelFallback", Value::Bool(v))?;
        }
    }
    if let Some(roles) = patch.model_roles {
        let cleaned = sanitize_model_roles(&roles)?;
        let obj = Value::Object(
            cleaned
                .into_iter()
                .map(|(k, v)| (k, Value::String(v)))
                .collect(),
        );
        set_value(profile, "modelRoles", obj)?;
    }
    // Not `get`: the lock is held, and `std::sync::Mutex` is not reentrant.
    read_locked(profile)
}

/// Assumes [`CONFIG_LOCK`] is already held.
fn read_locked(profile: Option<&str>) -> Result<IntelligenceSettings, String> {
    let mut out = IntelligenceSettings::default();
    if let Some(v) = get_bool(profile, "compaction.midTurnEnabled")? {
        out.compaction.mid_turn_enabled = v;
    }
    if let Some(v) = get_bool(profile, "compaction.autoContinue")? {
        out.compaction.auto_continue = v;
    }
    if let Some(v) = get_string_array(profile, "compaction.methodOrder")? {
        out.compaction.method_order = sanitize_method_order(&v);
    }
    if let Some(v) = get_string(profile, "memory.backend")? {
        if MEMORY_BACKENDS.contains(&v.as_str()) {
            out.memory.backend = v;
        }
    }
    if let Some(v) = get_bool(profile, "autolearn.enabled")? {
        out.autolearn.enabled = v;
    }
    if let Some(v) = get_bool(profile, "autolearn.autoContinue")? {
        out.autolearn.auto_continue = v;
    }
    if let Some(v) = get_string(profile, "mnemopi.scoping")? {
        if MEMORY_SCOPES.contains(&v.as_str()) {
            out.mnemopi.scoping = v;
        }
    }
    if let Some(v) = get_bool(profile, "mnemopi.autoRecall")? {
        out.mnemopi.auto_recall = v;
    }
    if let Some(v) = get_bool(profile, "mnemopi.autoRetain")? {
        out.mnemopi.auto_retain = v;
    }
    if let Some(v) = get_u32(profile, "retry.maxRetries")? {
        out.retry.max_retries = v.min(20);
    }
    if let Some(v) = get_bool(profile, "retry.modelFallback")? {
        out.retry.model_fallback = v;
    }
    out.model_roles = get_model_roles(profile)?;
    Ok(out)
}

fn validate_patch(patch: &IntelligencePatch) -> Result<(), String> {
    if let Some(c) = &patch.compaction {
        if let Some(ref order) = c.method_order {
            for method in order {
                if !COMPACTION_METHODS.contains(&method.as_str()) {
                    return Err(format!("invalid compaction method: {method}"));
                }
            }
        }
    }
    if let Some(m) = &patch.memory {
        if let Some(ref backend) = m.backend {
            if !MEMORY_BACKENDS.contains(&backend.as_str()) {
                return Err(format!("invalid memory backend: {backend}"));
            }
        }
    }
    if let Some(m) = &patch.mnemopi {
        if let Some(ref scoping) = m.scoping {
            if !MEMORY_SCOPES.contains(&scoping.as_str()) {
                return Err(format!("invalid memory scope: {scoping}"));
            }
        }
    }
    if let Some(r) = &patch.retry {
        if let Some(n) = r.max_retries {
            if n > 20 {
                return Err("retry attempts must be between 0 and 20".to_string());
            }
        }
    }
    if let Some(roles) = &patch.model_roles {
        sanitize_model_roles(roles)?;
    }
    Ok(())
}

fn sanitize_method_order(order: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for method in order {
        if COMPACTION_METHODS.contains(&method.as_str()) && seen.insert(method.clone()) {
            out.push(method.clone());
        }
    }
    out
}

fn sanitize_model_roles(roles: &BTreeMap<String, String>) -> Result<BTreeMap<String, String>, String> {
    let mut out = BTreeMap::new();
    for (role, selector) in roles {
        if !MODEL_ROLES.contains(&role.as_str()) {
            return Err(format!("unknown model role: {role}"));
        }
        let trimmed = selector.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.len() > 256 || trimmed.contains(['\n', '\r', '\0']) {
            return Err(format!("invalid model selector for role {role}"));
        }
        out.insert(role.clone(), trimmed.to_string());
    }
    Ok(out)
}

fn get_model_roles(profile: Option<&str>) -> Result<BTreeMap<String, String>, String> {
    match get_raw(profile, "modelRoles")? {
        None | Some(Value::Null) => Ok(BTreeMap::new()),
        Some(Value::Object(map)) => {
            let mut out = BTreeMap::new();
            for (k, v) in map {
                if !MODEL_ROLES.contains(&k.as_str()) {
                    continue;
                }
                if let Value::String(s) = v {
                    let t = s.trim();
                    if !t.is_empty() {
                        out.insert(k, t.to_string());
                    }
                }
            }
            Ok(out)
        }
        Some(other) => Err(unexpected("modelRoles", &other)),
    }
}

fn get_bool(profile: Option<&str>, key: &str) -> Result<Option<bool>, String> {
    match get_raw(profile, key)? {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(v)) => Ok(Some(v)),
        Some(other) => Err(unexpected(key, &other)),
    }
}

fn get_u32(profile: Option<&str>, key: &str) -> Result<Option<u32>, String> {
    match get_raw(profile, key)? {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(n)) => match n.as_u64().and_then(|v| u32::try_from(v).ok()) {
            Some(v) => Ok(Some(v)),
            None => Err(unexpected(key, &Value::Number(n))),
        },
        Some(other) => Err(unexpected(key, &other)),
    }
}

fn get_string(profile: Option<&str>, key: &str) -> Result<Option<String>, String> {
    match get_raw(profile, key)? {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s)),
        Some(other) => Err(unexpected(key, &other)),
    }
}

fn get_string_array(profile: Option<&str>, key: &str) -> Result<Option<Vec<String>>, String> {
    match get_raw(profile, key)? {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Array(items)) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                match item {
                    Value::String(s) => out.push(s),
                    other => return Err(unexpected(key, &other)),
                }
            }
            Ok(Some(out))
        }
        Some(other) => Err(unexpected(key, &other)),
    }
}

fn get_raw(profile: Option<&str>, key: &str) -> Result<Option<Value>, String> {
    let stdout = crate::omp_cli::run(&get_args(profile, key), OMP_CONFIG)?;
    parse_config_value(&stdout, key)
}

fn set_value(profile: Option<&str>, key: &str, value: Value) -> Result<(), String> {
    let encoded =
        serde_json::to_string(&value).map_err(|e| format!("could not encode {key}: {e}"))?;
    crate::omp_cli::run(&set_args(profile, key, &encoded), OMP_CONFIG)?;
    Ok(())
}

fn get_args(profile: Option<&str>, key: &str) -> Vec<String> {
    let mut args = Vec::with_capacity(5);
    args.extend(crate::agent::spawn::profile_flag(profile));
    args.extend(["config", "get", key, "--json"].map(String::from));
    args
}

fn set_args(profile: Option<&str>, key: &str, encoded: &str) -> Vec<String> {
    let mut args = Vec::with_capacity(5);
    args.extend(crate::agent::spawn::profile_flag(profile));
    args.extend(["config", "set", key].map(String::from));
    args.push(encoded.to_string());
    args
}

/// Parse `omp config get <key> --json` → the `value` field, or `None` when
/// omp reports the key is unset (`null` / missing).
fn parse_config_value(stdout: &[u8], key: &str) -> Result<Option<Value>, String> {
    let text = String::from_utf8_lossy(stdout);
    let text = text.trim();
    let unexpected_raw = || {
        let snippet: String = text.chars().take(OUTPUT_SNIPPET_MAX_CHARS).collect();
        let ellipsis = if snippet.len() < text.len() { "…" } else { "" };
        format!("unexpected {key} from omp: {snippet}{ellipsis}")
    };
    let mut parsed: Value = serde_json::from_str(text).map_err(|_| unexpected_raw())?;
    let Some(value) = parsed.get_mut("value").map(Value::take) else {
        return Err(unexpected_raw());
    };
    if value.is_null() {
        return Ok(None);
    }
    Ok(Some(value))
}

fn unexpected(key: &str, value: &Value) -> String {
    let rendered = value.to_string();
    let snippet: String = rendered.chars().take(OUTPUT_SNIPPET_MAX_CHARS).collect();
    let ellipsis = if snippet.len() < rendered.len() {
        "…"
    } else {
        ""
    };
    format!("unexpected {key} from omp: {snippet}{ellipsis}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn get_args_put_profile_before_subcommand() {
        assert_eq!(
            get_args(Some("work"), "memory.backend"),
            v(&[
                "--profile=work",
                "config",
                "get",
                "memory.backend",
                "--json"
            ])
        );
        assert_eq!(
            get_args(None, "retry.maxRetries"),
            v(&["config", "get", "retry.maxRetries", "--json"])
        );
    }

    #[test]
    fn set_args_pass_json_as_one_element() {
        assert_eq!(
            set_args(None, "retry.modelFallback", "true"),
            v(&["config", "set", "retry.modelFallback", "true"])
        );
    }

    #[test]
    fn parse_config_value_reads_bool_and_null() {
        let out = br#"{"key":"autolearn.enabled","value":true,"type":"boolean"}"#;
        assert_eq!(
            parse_config_value(out, "autolearn.enabled").unwrap(),
            Some(Value::Bool(true))
        );
        let null = br#"{"key":"x","value":null,"type":"null"}"#;
        assert_eq!(parse_config_value(null, "x").unwrap(), None);
    }

    #[test]
    fn parse_config_value_rejects_non_json() {
        assert!(parse_config_value(b"nope", "k").unwrap_err().contains("nope"));
    }

    #[test]
    fn sanitize_method_order_dedupes_and_drops_unknown() {
        assert_eq!(
            sanitize_method_order(&v(&["soft", "nope", "soft", "remote"])),
            v(&["soft", "remote"])
        );
    }

    #[test]
    fn sanitize_model_roles_keeps_known_nonempty() {
        let mut roles = BTreeMap::new();
        roles.insert("advisor".into(), " anthropic/claude-x:high ".into());
        roles.insert("smol".into(), String::new());
        let cleaned = sanitize_model_roles(&roles).unwrap();
        assert_eq!(cleaned.get("advisor").map(String::as_str), Some("anthropic/claude-x:high"));
        assert!(!cleaned.contains_key("smol"));
    }

    #[test]
    fn sanitize_model_roles_rejects_unknown_role() {
        let mut roles = BTreeMap::new();
        roles.insert("wizard".into(), "x/y".into());
        assert!(sanitize_model_roles(&roles).unwrap_err().contains("wizard"));
    }

    #[test]
    fn validate_patch_rejects_bad_backend() {
        let patch = IntelligencePatch {
            memory: Some(MemoryPatch {
                backend: Some("cloud".into()),
            }),
            ..IntelligencePatch::default()
        };
        assert!(validate_patch(&patch).unwrap_err().contains("memory backend"));
    }

    #[test]
    fn validate_patch_rejects_high_retries() {
        let patch = IntelligencePatch {
            retry: Some(RetryPatch {
                max_retries: Some(99),
                model_fallback: None,
            }),
            ..IntelligencePatch::default()
        };
        assert!(validate_patch(&patch).unwrap_err().contains("0 and 20"));
    }

    #[test]
    fn defaults_match_omp_web_defaults() {
        let d = IntelligenceSettings::default();
        assert!(d.compaction.mid_turn_enabled);
        assert!(d.compaction.auto_continue);
        assert_eq!(d.memory.backend, "mnemopi");
        assert_eq!(d.retry.max_retries, 2);
        assert!(!d.retry.model_fallback);
        assert_eq!(d.mnemopi.scoping, "per-project");
    }
}
