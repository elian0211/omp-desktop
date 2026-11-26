//! Settings → Models: the model list a provider's gateway serves, fetched
//! from `GET {baseUrl}/models` so the editor's model rows can come from the
//! real endpoint instead of typed-by-hand ids (`models_discover`).
//!
//! Read-only on the provider side: the request carries the provider's own
//! key from models.yml as a bearer header and the key never travels back —
//! the reply is the gateway's model ids only. An OpenAI-compatible list
//! (`{"data":[{"id":…}]}`) is expected; bare arrays and `{models:[…]}` are
//! accepted too. See [`crate::models_config`] for the file-side rules and
//! `provider_endpoint`.

use serde_json::Value as Json;

/// The models endpoint: base URL with one trailing slash trimmed plus
/// `/models`.
pub fn models_url(base_url: &str) -> String {
    format!("{}/models", base_url.trim_end_matches('/'))
}

/// The model ids from an OpenAI-compatible `/models` reply: `data[].id`,
/// falling back to a bare string array or `{models:[…]}`. Duplicate and
/// blank ids are dropped; order is the reply's.
pub fn parse_model_list(body: &Json) -> Vec<String> {
    let items = body
        .get("data")
        .or_else(|| body.get("models"))
        .cloned()
        .unwrap_or_else(|| body.clone());
    let Json::Array(items) = items else {
        return Vec::new();
    };
    let mut ids = Vec::with_capacity(items.len());
    for item in items {
        let id = item.as_str().map(str::to_string).or_else(|| {
            item.get("id")
                .and_then(Json::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        });
        if let Some(id) = id {
            if !ids.contains(&id) {
                ids.push(id);
            }
        }
    }
    ids
}

/// Fetches the model ids a provider's gateway serves at `{baseUrl}/models`
/// (inputs from `models_config::provider_endpoint`; the key stays
/// in-process). The blocking client is fine here: the command runs off the
/// IPC thread and the request is bounded.
pub fn discover(base_url: &str, api_key: Option<&str>) -> Result<Vec<String>, String> {
    let url = models_url(base_url);
    let mut request = reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("could not build the HTTP client: {e}"))?
        .get(&url);
    if let Some(key) = api_key {
        request = request.bearer_auth(key);
    }
    let response = request
        .send()
        .map_err(|e| format!("request to {url} failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("{url} answered HTTP {status}"));
    }
    let body: Json = response
        .json()
        .map_err(|e| format!("{url} did not return JSON: {e}"))?;
    let ids = parse_model_list(&body);
    if ids.is_empty() {
        return Err(format!("{url} returned no model ids"));
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn models_url_trims_one_trailing_slash() {
        assert_eq!(
            models_url("https://x.example/v1"),
            "https://x.example/v1/models"
        );
        assert_eq!(
            models_url("https://x.example/v1/"),
            "https://x.example/v1/models"
        );
    }

    #[test]
    fn parse_model_list_reads_the_openai_shape_and_fallbacks() {
        assert_eq!(
            parse_model_list(&json!({"data": [{"id": "b"}, {"id": "a"}, {"id": "b"}, {"id": ""}]})),
            ["b", "a"]
        );
        assert_eq!(parse_model_list(&json!(["x", "y"])), ["x", "y"]);
        assert_eq!(parse_model_list(&json!({"models": [{"id": "m"}]})), ["m"]);
        assert_eq!(
            parse_model_list(&json!({"data": "nope"})),
            Vec::<String>::new()
        );
        assert_eq!(parse_model_list(&json!(42)), Vec::<String>::new());
    }
}
