use super::{obj, set_timeout};
use js_sys::{Array, Uint8Array};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    type Blob;
    #[wasm_bindgen(constructor)]
    fn new(parts: &Array, options: &js_sys::Object) -> Blob;
    #[wasm_bindgen(js_namespace = URL, js_name = createObjectURL)]
    fn create_object_url(blob: &Blob) -> String;
    #[wasm_bindgen(js_namespace = URL, js_name = revokeObjectURL)]
    fn revoke_object_url(url: &str);

    type Anchor;
    #[wasm_bindgen(js_namespace = document, js_name = createElement)]
    fn create_anchor(tag: &str) -> Anchor;
    #[wasm_bindgen(method, setter)]
    fn set_href(this: &Anchor, href: &str);
    #[wasm_bindgen(method, setter)]
    fn set_download(this: &Anchor, name: &str);
    #[wasm_bindgen(method)]
    fn click(this: &Anchor);
}

pub fn save(name: &str, data: &[u8]) {
    let blob = Blob::new(&Array::of1(&Uint8Array::from(data)), &obj(&[("type", "application/octet-stream".into())]));
    let url = create_object_url(&blob);
    let anchor = create_anchor("a");
    anchor.set_href(&url);
    anchor.set_download(name);
    anchor.click();
    set_timeout(&Closure::once_into_js(move || revoke_object_url(&url)), 10_000);
}
