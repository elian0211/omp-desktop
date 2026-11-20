//! Settings → Models: direct, allowlisted IO on the profile's `models.yml`
//! (`~/.omp/agent/models.yml`, `models.yaml` fallback on read), mirroring
//! omp-web's `lib/omp/models-config.ts`. Validation rejects configs omp
//! itself refuses to load (`validateProviderConfiguration`, mode
//! "models-config"): custom models need a provider `baseUrl` and an `apiKey`
//! unless `auth: none`, every model an `id` and an `api` somewhere, positive
//! context/max-token windows, and complete cost tables.
//!
//! Secrets: `get` replaces each provider's `apiKey` with `hasApiKey` and a
//! last-four `apiKeyHint`; `set` restores the previous key for providers the
//! frontend sends back unchanged, applies `api_keys` (`""` clears), and
//! writes the file `0600` on unix. Everything else on the provider —
//! `headers`, `compat`, unknown fields — passes through untouched.
//!
//! Hand-written comments and formatting are not preserved across a write:
//! the file is re-serialised from the parsed document. A file that does not
//! parse blocks writes entirely — overwriting it would silently delete every
//! provider the user wrote by hand — so the error names the file and the
//! parse problem and the user repairs it themselves.
//!
//! Unlike [`crate::omp_native_config`], this is no `omp` subprocess: omp has
//! no `models.yml` CLI, and omp-web edits the file directly too. omp picks
//! the file up on its next spawn, so a change applies to new tabs (and
//! respawns) without further work. `profile` is `None` for the built-in
//! profile or `Some(id)`; callers MUST only pass ids from
//! `ProfileStore::resolve_owned`.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value as Json};

use crate::profiles;

const MODELS_YML: &str = "models.yml";
const MODELS_YAML: &str = "models.yaml";
const AUTH_MODES: &[&str] = &["apiKey", "none", "oauth"];
const COST_FIELDS: &[&str] = &["input", "output", "cacheRead", "cacheWrite"];

/// `models.yml` if it exists, else the `.yaml` fallback, else the canonical
/// path (for reads that report absence and writes).
fn models_path(dir: &Path) -> PathBuf {
    let canonical = dir.join(MODELS_YML);
    if canonical.exists() {
        canonical
    } else {
        let fallback = dir.join(MODELS_YAML);
        if fallback.exists() {
            fallback
        } else {
            canonical
        }
    }
}

/// `(path, Some(text))` when a models file exists, `(canonical, None)` when
/// neither name does.
fn read_file(dir: &Path) -> Result<(PathBuf, Option<String>), String> {
    let path = models_path(dir);
    match fs::read_to_string(&path) {
        Ok(text) => Ok((path, Some(text))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok((path, None)),
        Err(e) => Err(format!("could not read {}: {e}", path.display())),
    }
}

fn parse_document(text: &str) -> Result<serde_yaml::Value, String> {
    serde_yaml::from_str(text).map_err(|e| e.to_string())
}

fn yaml_to_json(v: &serde_yaml::Value) -> Result<Json, String> {
    Ok(match v {
        serde_yaml::Value::Null => Json::Null,
        serde_yaml::Value::Bool(b) => Json::Bool(*b),
        serde_yaml::Value::Number(n) => {
            let s = n.to_string();
            let number = s
                .parse::<i64>()
                .map(serde_json::Number::from)
                .or_else(|_| s.parse::<u64>().map(serde_json::Number::from))
                .or_else(|_| {
                    s.parse::<f64>()
                        .map_err(|_| format!("number {s} is not representable as JSON"))
                        .and_then(|f| {
                            serde_json::Number::from_f64(f)
                                .ok_or_else(|| format!("number {s} is not representable as JSON"))
                        })
                })?;
            Json::Number(number)
        }
        serde_yaml::Value::String(s) => Json::String(s.clone()),
        serde_yaml::Value::Sequence(items) => {
            Json::Array(items.iter().map(yaml_to_json).collect::<Result<_, _>>()?)
        }
        serde_yaml::Value::Mapping(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                let key = k.as_str().ok_or_else(|| {
                    format!("mapping key {k:?} is not a string; the Settings editor can only round-trip string keys")
                })?;
                out.insert(key.to_string(), yaml_to_json(val)?);
            }
            Json::Object(out)
        }
        serde_yaml::Value::Tagged(t) => yaml_to_json(&t.value)?,
    })
}

fn json_to_yaml(v: &Json) -> Result<serde_yaml::Value, String> {
    Ok(match v {
        Json::Null => serde_yaml::Value::Null,
        Json::Bool(b) => serde_yaml::Value::Bool(*b),
        Json::Number(n) => {
            serde_yaml::Value::Number(serde_yaml::Number::from(n.as_f64().unwrap_or_default()))
        }
        Json::String(s) => serde_yaml::Value::String(s.clone()),
        Json::Array(items) => {
            serde_yaml::Value::Sequence(items.iter().map(json_to_yaml).collect::<Result<_, _>>()?)
        }
        Json::Object(map) => {
            let mut out = serde_yaml::Mapping::new();
            for (k, val) in map {
                out.insert(serde_yaml::Value::String(k.clone()), json_to_yaml(val)?);
            }
            serde_yaml::Value::Mapping(out)
        }
    })
}

fn as_str(v: &Json) -> Option<&str> {
    v.as_str().filter(|s| !s.trim().is_empty())
}

fn last4(secret: &str) -> String {
    let chars: Vec<char> = secret.chars().collect();
    let tail: String = chars[chars.len().saturating_sub(4)..].iter().collect();
    format!("…{tail}")
}

/// The snapshot one provider goes to the frontend as: every field but
/// `apiKey`, which becomes `hasApiKey` / `apiKeyHint`.
fn provider_json(id: &str, provider: &serde_yaml::Mapping) -> Result<Json, String> {
    let mut entry = Map::new();
    entry.insert("id".into(), json!(id));
    for (k, v) in provider {
        let key = k
            .as_str()
            .ok_or_else(|| format!("provider {id}: mapping key {k:?} is not a string"))?;
        if key == "apiKey" {
            continue;
        }
        entry.insert(key.to_string(), yaml_to_json(v)?);
    }
    let has = provider.contains_key(serde_yaml::Value::String("apiKey".into()));
    entry.insert("hasApiKey".into(), json!(has));
    if let Some(serde_yaml::Value::String(key)) =
        provider.get(serde_yaml::Value::String("apiKey".into()))
    {
        entry.insert("apiKeyHint".into(), json!(last4(key)));
    }
    Ok(Json::Object(entry))
}

/// The full `get` payload: path, existence, parse failure and the provider
/// list in file order. A parse failure still reports the path so the UI can
/// show it; `providers` stays empty.
pub fn snapshot(dir: &Path) -> Json {
    let (path, text) = match read_file(dir) {
        Ok(pair) => pair,
        Err(e) => return json!({ "error": e, "providers": [] }),
    };
    let base = json!({
        "path": path.display().to_string(),
        "exists": text.is_some(),
    });
    let Some(text) = text else {
        return json!({ "path": base["path"], "exists": false, "parseError": null, "providers": [] });
    };
    let doc = match parse_document(&text) {
        Ok(doc) => doc,
        Err(detail) => {
            return json!({ "path": base["path"], "exists": true, "parseError": detail, "providers": [] })
        }
    };
    let mut providers = Vec::new();
    if let Some(serde_yaml::Value::Mapping(map)) = doc.get("providers") {
        for (k, v) in map {
            let Ok(name) = k.as_str().ok_or("provider name is not a string") else {
                continue;
            };
            let serde_yaml::Value::Mapping(p) = v else {
                continue;
            };
            match provider_json(name, p) {
                Ok(p) => providers.push(p),
                Err(e) => {
                    return json!({ "path": base["path"], "exists": true, "parseError": e, "providers": [] })
                }
            }
        }
    }
    json!({ "path": base["path"], "exists": true, "parseError": null, "providers": providers })
}

/// `get` for a profile's agent dir.
pub fn get(home: &Path, profile: Option<&str>, env_dir: Option<&std::ffi::OsStr>) -> Json {
    snapshot(&profiles::agent_dir_for(home, profile, env_dir))
}

/// The rules omp's own loader enforces, so the editor rejects a config the
/// next tab would refuse to boot with rather than writing it.
pub fn validate(config: &serde_yaml::Mapping) -> Result<(), String> {
    fn api_of(provider: &serde_yaml::Mapping) -> Option<&str> {
        provider
            .get(serde_yaml::Value::String("api".into()))
            .and_then(serde_yaml::Value::as_str)
    }
    let Some(serde_yaml::Value::Mapping(providers)) =
        config.get(serde_yaml::Value::String("providers".into()))
    else {
        return Err("models.yml: \"providers\" must be a mapping".into());
    };
    for (k, v) in providers {
        let name = k
            .as_str()
            .ok_or("models.yml: provider name is not a string")?;
        let serde_yaml::Value::Mapping(provider) = v else {
            return Err(format!("models.yml: provider {name} must be a mapping"));
        };
        if let Some(auth) = provider.get(serde_yaml::Value::String("auth".into())) {
            let auth = auth.as_str().unwrap_or_default();
            if !AUTH_MODES.contains(&auth) {
                return Err(format!(
                    "models.yml: provider {name}: unknown auth mode {auth:?}"
                ));
            }
        }
        let provider_api = api_of(provider);
        let models = provider
            .get(serde_yaml::Value::String("models".into()))
            .and_then(serde_yaml::Value::as_sequence);
        let models = models.cloned().unwrap_or_default();
        if !models.is_empty() {
            let base_url = provider
                .get(serde_yaml::Value::String("baseUrl".into()))
                .and_then(serde_yaml::Value::as_str)
                .unwrap_or_default();
            if base_url.trim().is_empty() {
                return Err(format!("models.yml: provider {name}: \"baseUrl\" is required when defining custom models"));
            }
            let has_key = provider.contains_key(serde_yaml::Value::String("apiKey".into()));
            let auth = provider
                .get(serde_yaml::Value::String("auth".into()))
                .and_then(serde_yaml::Value::as_str)
                .unwrap_or("apiKey");
            if !has_key && auth != "none" {
                return Err(format!(
                    "models.yml: provider {name}: \"apiKey\" is required when defining custom models unless auth is \"none\""
                ));
            }
        }
        for model in models {
            let serde_yaml::Value::Mapping(model) = model else {
                return Err(format!(
                    "models.yml: provider {name}: each model must be a mapping"
                ));
            };
            let id = model
                .get(serde_yaml::Value::String("id".into()))
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            if id.trim().is_empty() {
                return Err(format!("models.yml: provider {name}: model missing \"id\""));
            }
            if provider_api.is_none() && api_of(&model).is_none() {
                return Err(format!(
                    "models.yml: provider {name}, model {id}: no \"api\" specified. Set at provider or model level"
                ));
            }
            for field in ["contextWindow", "maxTokens"] {
                if let Some(n) = model
                    .get(serde_yaml::Value::String(field.into()))
                    .and_then(serde_yaml::Value::as_f64)
                {
                    if n <= 0.0 {
                        return Err(format!(
                            "models.yml: provider {name}, model {id}: invalid {field}"
                        ));
                    }
                }
            }
            if let Some(serde_yaml::Value::Mapping(cost)) =
                model.get(serde_yaml::Value::String("cost".into()))
            {
                for field in COST_FIELDS {
                    let key = serde_yaml::Value::String((*field).into());
                    let value = cost.get(&key).and_then(serde_yaml::Value::as_f64);
                    if !value.is_some_and(f64::is_finite) {
                        return Err(format!(
                            "models.yml: provider {name}, model {id}: cost.{field} is required (cost needs input, output, cacheRead, and cacheWrite)"
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

/// Rebuilds the file from the editor's provider list: entries pass through
/// with all their fields (the frontend sends what `get` returned, edited),
/// `hasApiKey`/`apiKeyHint` pseudo fields are stripped, an untouched
/// provider's real key is carried over, and `api_keys` applies the typed one
/// (`""` clears). Providers missing from `providers` are removed; unknown
/// top-level keys of the document survive. Returns the fresh snapshot.
pub fn set(
    home: &Path,
    profile: Option<&str>,
    env_dir: Option<&std::ffi::OsStr>,
    providers: &[Json],
    api_keys: &BTreeMap<String, String>,
) -> Result<Json, String> {
    let dir = profiles::agent_dir_for(home, profile, env_dir);
    let (path, text) = read_file(&dir)?;
    if let Some(text) = &text {
        if parse_document(text).is_err() {
            return Err(format!(
                "{} does not parse; fix or delete it by hand before editing providers here",
                path.display()
            ));
        }
    }
    let mut doc: serde_yaml::Mapping = match &text {
        Some(text) => match parse_document(text)? {
            serde_yaml::Value::Mapping(map) => map,
            _ => return Err(format!("{}: root must be a mapping", path.display())),
        },
        None => serde_yaml::Mapping::new(),
    };
    // Old provider entries by id, for the untouched `apiKey` carry-over.
    let old: BTreeMap<String, serde_yaml::Mapping> = doc
        .get(serde_yaml::Value::String("providers".into()))
        .and_then(|v| v.as_mapping().cloned())
        .map_or_else(BTreeMap::new, |map| {
            map.into_iter()
                .filter_map(|(k, v)| {
                    let id = k.as_str()?.to_string();
                    let serde_yaml::Value::Mapping(p) = v else {
                        return None;
                    };
                    Some((id, p))
                })
                .collect()
        });

    let mut out = serde_yaml::Mapping::new();
    for entry in providers {
        let Json::Object(entry) = entry else {
            return Err("each provider must be an object".into());
        };
        let mut cleaned = Map::new();
        for (k, v) in entry {
            if k == "hasApiKey" || k == "apiKeyHint" {
                continue;
            }
            cleaned.insert(k.clone(), v.clone());
        }
        let Some(id) = cleaned.get("id").and_then(|v| as_str(v)).map(String::from) else {
            return Err("each provider needs an id".into());
        };
        // Overlay the incoming fields onto the stored entry, so provider
        // fields the editor does not render (`headers`, `compat`, …)
        // survive even when the frontend drops them. The stored `apiKey`
        // comes along too, so an untouched provider keeps its key.
        let mut merged = old.get(&id).cloned().unwrap_or_default();
        let serde_yaml::Value::Mapping(incoming) = json_to_yaml(&Json::Object(cleaned))? else {
            return Err("each provider must be a mapping".into());
        };
        for (k, v) in incoming {
            merged.insert(k, v);
        }
        // A typed key lands after the merge, so clearing wins over the
        // carried-over one.
        if let Some(key) = api_keys.get(&id) {
            if key.is_empty() {
                merged.remove(serde_yaml::Value::String("apiKey".into()));
            } else {
                merged.insert(
                    serde_yaml::Value::String("apiKey".into()),
                    serde_yaml::Value::String(key.clone()),
                );
            }
        }
        out.insert(
            serde_yaml::Value::String(id),
            serde_yaml::Value::Mapping(merged),
        );
    }
    doc.insert(
        serde_yaml::Value::String("providers".into()),
        serde_yaml::Value::Mapping(out),
    );
    validate(&doc)?;

    let text = serde_yaml::to_string(&serde_yaml::Value::Mapping(doc))
        .map_err(|e| format!("could not serialise models.yml: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    // Write-then-rename: a crash mid-write must not leave models.yml
    // truncated, which would disable every custom model.
    let temp = dir.join(format!(".{MODELS_YML}.omp-desktop.tmp"));
    fs::write(&temp, &text).map_err(|e| format!("could not write {}: {e}", temp.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&temp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(temp, dir.join(MODELS_YML))
        .map_err(|e| format!("could not move the new models.yml into place: {e}"))?;
    Ok(snapshot(&dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_yaml::Value::String as YStr;

    fn key(s: &str) -> serde_yaml::Value {
        YStr(s.into())
    }

    fn write_models(dir: &Path, text: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::create_dir_all(dir.join(".omp/agent")).unwrap();
        fs::write(dir.join(".omp/agent").join(MODELS_YML), text).unwrap();
    }

    fn entry(id: &str, fields: &[(&str, Json)]) -> Json {
        let mut map = Map::new();
        map.insert("id".into(), json!(id));
        for (k, v) in fields {
            map.insert((*k).into(), v.clone());
        }
        Json::Object(map)
    }

    #[test]
    fn path_prefers_canonical_and_falls_back() {
        let dir = std::env::temp_dir().join(format!("omp-models-path-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(
            models_path(&dir.join(".omp/agent")).file_name().unwrap(),
            MODELS_YML
        );
        write_models(&dir, "providers: {}");
        fs::rename(
            dir.join(".omp/agent").join(MODELS_YML),
            dir.join(".omp/agent").join(MODELS_YAML),
        )
        .unwrap();
        assert_eq!(
            models_path(&dir.join(".omp/agent")).file_name().unwrap(),
            MODELS_YAML
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn get_reports_absence_and_masks_the_key() {
        let dir = std::env::temp_dir().join(format!("omp-models-get-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let snap = snapshot(&dir.join(".omp/agent"));
        assert_eq!(snap["exists"], false);
        write_models(
            &dir,
            "providers:\n  acme:\n    baseUrl: https://acme.example\n    apiKey: sk-secret-1234\n    models:\n      - id: m1\n        api: openai-completions\n",
        );
        let snap = snapshot(&dir.join(".omp/agent"));
        assert_eq!(snap["parseError"], Json::Null);
        let p = &snap["providers"][0];
        assert_eq!(p["id"], "acme");
        assert_eq!(p["hasApiKey"], true);
        assert_eq!(p["apiKeyHint"], "…1234");
        assert!(
            p.get("apiKey").is_none(),
            "the key never reaches the frontend"
        );
        assert_eq!(p["models"][0]["id"], "m1");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn get_reports_parse_errors_instead_of_swallowing() {
        let dir = std::env::temp_dir().join(format!("omp-models-bad-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_models(&dir, "providers: [unclosed");
        let snap = snapshot(&dir.join(".omp/agent"));
        assert_eq!(snap["exists"], true);
        assert!(snap["parseError"].as_str().is_some());
        assert_eq!(snap["providers"].as_array().unwrap().len(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_carries_untouched_keys_applies_and_clears_new_ones() {
        let dir = std::env::temp_dir().join(format!("omp-models-set-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_models(
            &dir,
            "providers:\n  acme:\n    baseUrl: https://acme.example\n    apiKey: sk-old-9999\n    compat:\n      stream: true\n    models:\n      - id: m1\n        api: openai-completions\n",
        );
        let mut keys = BTreeMap::new();
        keys.insert("acme".to_string(), "sk-new-7777".to_string());
        let snap = set(
            &dir,
            None,
            None,
            &[entry(
                "acme",
                &[
                    ("baseUrl", json!("https://acme.example")),
                    (
                        "models",
                        json!([{ "id": "m1", "api": "openai-completions" }]),
                    ),
                ],
            )],
            &keys,
        )
        .unwrap();
        assert_eq!(snap["providers"][0]["apiKeyHint"], "…7777");
        let text = fs::read_to_string(dir.join(".omp/agent").join(MODELS_YML)).unwrap();
        assert!(text.contains("sk-new-7777"));
        assert!(
            text.contains("stream: true"),
            "unknown provider fields survive"
        );

        // Untouched provider (no api_keys entry): the old key is carried over.
        keys.clear();
        let snap = set(
            &dir,
            None,
            None,
            &[entry(
                "acme",
                &[
                    ("baseUrl", json!("https://acme.example")),
                    (
                        "models",
                        json!([{ "id": "m1", "api": "openai-completions" }]),
                    ),
                ],
            )],
            &keys,
        )
        .unwrap();
        assert_eq!(snap["providers"][0]["apiKeyHint"], "…7777");

        // Clearing: empty string removes the key; auth none then validates.
        let mut none = BTreeMap::new();
        none.insert("acme".to_string(), String::new());
        let fields = [
            ("baseUrl", json!("https://acme.example")),
            ("auth", json!("none")),
            (
                "models",
                json!([{ "id": "m1", "api": "openai-completions" }]),
            ),
        ];
        let snap = set(&dir, None, None, &[entry("acme", &fields)], &none).unwrap();
        assert_eq!(snap["providers"][0]["hasApiKey"], false);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_removes_absent_providers_and_keeps_unknown_document_keys() {
        let dir = std::env::temp_dir().join(format!("omp-models-doc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_models(
            &dir,
            "customTop: 7\nproviders:\n  a:\n    auth: none\n  b:\n    auth: none\n",
        );
        set(
            &dir,
            None,
            None,
            &[entry("a", &[("auth", json!("none"))])],
            &BTreeMap::new(),
        )
        .unwrap();
        let text = fs::read_to_string(dir.join(".omp/agent").join(MODELS_YML)).unwrap();
        assert!(text.contains("customTop"), "unknown document keys survive");
        assert!(
            text.contains("a:") && !text.contains("  b:"),
            "removed providers are gone"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_refuses_when_the_file_does_not_parse() {
        let dir = std::env::temp_dir().join(format!("omp-models-refuse-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_models(&dir, "providers: [broken");
        assert!(set(&dir, None, None, &[], &BTreeMap::new())
            .unwrap_err()
            .contains("does not parse"));
        assert_eq!(
            fs::read_to_string(dir.join(".omp/agent").join(MODELS_YML)).unwrap(),
            "providers: [broken"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn validate_rejects_configs_omp_refuses() {
        let model_no_api =
            serde_yaml::Mapping::from_iter([(key("id"), json!("m1").to_value_yaml())]);
        let err = validate(&serde_yaml::Mapping::from_iter([(
            key("providers"),
            serde_yaml::Value::Mapping(serde_yaml::Mapping::from_iter([(
                key("acme"),
                serde_yaml::Value::Mapping(serde_yaml::Mapping::from_iter([
                    (key("baseUrl"), YStr("https://x".into())),
                    (key("apiKey"), YStr("k".into())),
                    (
                        key("models"),
                        serde_yaml::Value::Sequence(vec![serde_yaml::Value::Mapping(model_no_api)]),
                    ),
                ])),
            )])),
        )]))
        .unwrap_err();
        assert!(err.contains("no \"api\" specified"), "{err}");
    }

    #[test]
    fn validate_rejects_missing_base_url_and_key() {
        let provider = serde_yaml::Mapping::from_iter([(
            key("models"),
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::Mapping(
                serde_yaml::Mapping::from_iter([
                    (key("id"), YStr("m1".into())),
                    (key("api"), YStr("openai-completions".into())),
                ]),
            )]),
        )]);
        let err = validate(&serde_yaml::Mapping::from_iter([(
            key("providers"),
            serde_yaml::Value::Mapping(serde_yaml::Mapping::from_iter([(
                key("acme"),
                serde_yaml::Value::Mapping(provider),
            )])),
        )]))
        .unwrap_err();
        assert!(err.contains("baseUrl"), "{err}");
    }

    #[test]
    fn validate_rejects_partial_cost_and_bad_windows() {
        let provider = serde_yaml::Mapping::from_iter([
            (key("baseUrl"), YStr("https://x".into())),
            (key("apiKey"), YStr("k".into())),
            (
                key("models"),
                serde_yaml::Value::Sequence(vec![serde_yaml::Value::Mapping(
                    serde_yaml::Mapping::from_iter([
                        (key("id"), YStr("m1".into())),
                        (key("api"), YStr("openai-completions".into())),
                        (key("contextWindow"), serde_yaml::Value::Number(0.into())),
                        (
                            key("cost"),
                            serde_yaml::Value::Mapping(serde_yaml::Mapping::from_iter([(
                                key("input"),
                                serde_yaml::Value::Number(1.into()),
                            )])),
                        ),
                    ]),
                )]),
            ),
        ]);
        let err = validate(&serde_yaml::Mapping::from_iter([(
            key("providers"),
            serde_yaml::Value::Mapping(serde_yaml::Mapping::from_iter([(
                key("acme"),
                serde_yaml::Value::Mapping(provider),
            )])),
        )]))
        .unwrap_err();
        assert!(err.contains("invalid contextWindow"), "{err}");
    }

    /// Helper used by the tests above to bridge `serde_json::Value` into a
    /// `serde_yaml::Value` without repeating the conversion.
    trait ToYamlValue {
        fn to_value_yaml(&self) -> serde_yaml::Value;
    }
    impl ToYamlValue for Json {
        fn to_value_yaml(&self) -> serde_yaml::Value {
            json_to_yaml(self).unwrap()
        }
    }
}
