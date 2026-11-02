use super::nowplaying::get_bytes;
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

const SITE: &str = "https://ctf.kendlbat.dev/";

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(catch, js_namespace = ["crypto", "subtle"])]
    fn digest(algorithm: &str, data: &Uint8Array) -> Result<js_sys::Promise, JsValue>;
}

// Empty means not found; the guest's ctf command reports that.
pub async fn bundle(challenge: &str, key: &[u8]) -> Vec<u8> {
    let Some(id) = bundle_id(challenge, key).await else { return Vec::new() };
    get_bytes(&format!("{SITE}{id}.tgz")).await.unwrap_or_default()
}

async fn bundle_id(challenge: &str, key: &[u8]) -> Option<String> {
    let input = [challenge.as_bytes(), b"\n", key].concat();
    let hash = JsFuture::from(digest("SHA-256", &Uint8Array::from(&input[..])).ok()?).await.ok()?;
    Some(Uint8Array::new(&hash).to_vec().iter().map(|b| format!("{b:02x}")).collect())
}
