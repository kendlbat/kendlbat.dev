use super::{obj, Terminal, V86};
use js_sys::{Reflect, Uint8Array};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

pub const OSC: u32 = 5380;
const PROFILE: &str = "https://listenbrainz.org/user/kendlbat/";
const PLAYING_NOW: &str = "https://api.listenbrainz.org/1/user/kendlbat/playing-now";
const COVERART: &str = "https://coverartarchive.org/release/";
const REQUEST_TIMEOUT_MS: u32 = 6000;
const COVER_ROWS: u32 = 10;

#[wasm_bindgen]
extern "C" {
    fn fetch(url: &str, init: &JsValue) -> js_sys::Promise;
    #[wasm_bindgen(js_namespace = AbortSignal, js_name = timeout)]
    fn abort_after(ms: u32) -> JsValue;

    type Response;
    #[wasm_bindgen(method, getter)]
    fn ok(this: &Response) -> bool;
    #[wasm_bindgen(method)]
    fn json(this: &Response) -> js_sys::Promise;
    #[wasm_bindgen(method, js_name = arrayBuffer)]
    fn array_buffer(this: &Response) -> js_sys::Promise;
}

pub async fn answer(term: &Terminal, emulator: &V86) {
    term.write(&card().await.replace('\n', "\r\n"));
    emulator.serial0_send("\n");
}

async fn card() -> String {
    let Some(data) = get_json(PLAYING_NOW).await else {
        return "Couldn't reach ListenBrainz.\n".into();
    };
    let meta = path(&data, &["payload", "listens", "0", "track_metadata"]);
    let Some(track) = string(&meta, &["track_name"]) else {
        return format!("\x1b[2mNot listening to anything right now.\x1b[0m\n{PROFILE}\n");
    };
    let artist = string(&meta, &["artist_name"]).unwrap_or_default();

    let mut out = String::new();
    if let Some(url) = cover_url(&meta, &artist, &track).await {
        if let Some(image) = get_bytes(&url).await {
            out += &format!("\x1b]1337;File=inline=1;size={};height={COVER_ROWS}:{}\x07\n", image.len(), base64(&image));
        }
    }
    out += "\x1b[1;32m● NOW PLAYING\x1b[0m\n\x1b[2mCurrently listening to\x1b[0m\n";
    out += &format!("\x1b[1m{track}\x1b[0m\n{artist}\n");
    if let Some(release) = string(&meta, &["release_name"]) {
        out += &format!("\x1b[2m{release}\x1b[0m\n");
    }
    out + PROFILE + "\n"
}

async fn cover_url(meta: &JsValue, artist: &str, track: &str) -> Option<String> {
    let info = path(meta, &["additional_info"]);
    if let Some(url) = string(&info, &["cover_art_url"]) {
        return Some(url);
    }
    if let Some(id) = string(&info, &["origin_url"]).as_deref().and_then(youtube_id) {
        return Some(format!("https://img.youtube.com/vi/{id}/mqdefault.jpg"));
    }
    let release = string(meta, &["release_mbid"])
        .or_else(|| string(&info, &["release_mbid"]))
        .or_else(|| string(&info, &["release_group_mbid"]));
    if let Some(id) = release {
        return Some(format!("{COVERART}{id}/front-250"));
    }
    if artist.is_empty() {
        return None;
    }
    let encode = |s: &str| String::from(js_sys::encode_uri_component(s));
    let query = format!("artist:\"{}\" AND recording:\"{}\"", encode(artist), encode(track));
    let data = get_json(&format!("https://musicbrainz.org/ws/2/recording?query={query}&fmt=json&inc=releases&limit=1")).await?;
    string(&data, &["recordings", "0", "releases", "0", "id"]).map(|id| format!("{COVERART}{id}/front-250"))
}

fn youtube_id(url: &str) -> Option<&str> {
    let rest = ["youtube.com/watch?v=", "youtu.be/"].iter().find_map(|p| url.split_once(p).map(|(_, r)| r))?;
    let id = rest.get(..11)?;
    id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-').then_some(id)
}

fn path(value: &JsValue, keys: &[&str]) -> JsValue {
    keys.iter().fold(value.clone(), |v, key| {
        if v.is_object() { Reflect::get(&v, &(*key).into()).unwrap_or(JsValue::UNDEFINED) } else { JsValue::UNDEFINED }
    })
}

fn string(value: &JsValue, keys: &[&str]) -> Option<String> {
    let s: String = path(value, keys).as_string()?.chars().filter(|c| !c.is_control()).collect();
    (!s.trim().is_empty()).then_some(s)
}

async fn get(url: &str) -> Option<Response> {
    let init = obj(&[
        ("credentials", "omit".into()),
        ("headers", obj(&[("Accept", "application/json".into())]).into()),
        ("signal", abort_after(REQUEST_TIMEOUT_MS)),
    ]);
    let response: Response = JsFuture::from(fetch(url, &init)).await.ok()?.unchecked_into();
    response.ok().then_some(response)
}

async fn get_json(url: &str) -> Option<JsValue> {
    JsFuture::from(get(url).await?.json()).await.ok()
}

async fn get_bytes(url: &str) -> Option<Vec<u8>> {
    let buffer = JsFuture::from(get(url).await?.array_buffer()).await.ok()?;
    Some(Uint8Array::new(&buffer).to_vec())
}

fn base64(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, b)| n | (*b as u32) << (16 - 8 * i));
        for i in 0..4 {
            out.push(if i <= chunk.len() { ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char } else { '=' });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_ids_like_the_website_regex() {
        assert_eq!(youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), Some("dQw4w9WgXcQ"));
        assert_eq!(youtube_id("https://youtu.be/dQw4w9WgXcQ"), Some("dQw4w9WgXcQ"));
        assert_eq!(youtube_id("https://youtu.be/short"), None);
        assert_eq!(youtube_id("https://example.com/watch?v=dQw4w9WgXcQ"), None);
    }

    #[test]
    fn base64_matches_rfc4648() {
        for (input, expected) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foobar", "Zm9vYmFy")] {
            assert_eq!(base64(input.as_bytes()), expected);
        }
    }
}
