use js_sys::{Object, Reflect, Uint8Array};
use wasm_bindgen::prelude::*;

include!(concat!(env!("OUT_DIR"), "/files.rs"));

const V86_CDN: &str = "https://cdn.jsdelivr.net/npm/v86@0.5.472/build/";
const MOBILE_SITE: &str = "https://m.kendlbat.dev";
const BIOS_CDN: &str = "https://cdn.jsdelivr.net/gh/copy/v86@cc37f35c43bf14865d74ad76879ecf9410f69eb1/bios/";

#[wasm_bindgen]
extern "C" {
    type V86;
    #[wasm_bindgen(constructor)]
    fn new(opts: &Object) -> V86;
    #[wasm_bindgen(method)]
    fn add_listener(this: &V86, event: &str, f: &Closure<dyn FnMut(JsValue)>);
    #[wasm_bindgen(method)]
    fn serial0_send(this: &V86, text: &str);
    #[wasm_bindgen(method)]
    fn save_state(this: &V86) -> js_sys::Promise;
    #[wasm_bindgen(method)]
    fn create_file(this: &V86, path: &str, data: &Uint8Array) -> js_sys::Promise;
    #[wasm_bindgen(method, getter)]
    fn fs9p(this: &V86) -> Fs9p;

    type Fs9p;
    #[wasm_bindgen(method, js_name = CreateDirectory)]
    fn create_directory(this: &Fs9p, name: &str, parent: i32) -> i32;
    #[wasm_bindgen(method, js_name = SearchPath)]
    fn search_path(this: &Fs9p, path: &str) -> SearchResult;

    type SearchResult;
    #[wasm_bindgen(method, getter)]
    fn id(this: &SearchResult) -> i32;

    type Terminal;
    #[wasm_bindgen(constructor)]
    fn new(opts: &Object) -> Terminal;
    #[wasm_bindgen(method)]
    fn open(this: &Terminal, element: &JsValue);
    #[wasm_bindgen(method)]
    fn write(this: &Terminal, data: &str);
    #[wasm_bindgen(method, js_name = onData)]
    fn on_data(this: &Terminal, f: &Closure<dyn FnMut(String)>);
    #[wasm_bindgen(method, js_name = loadAddon)]
    fn load_addon(this: &Terminal, addon: &JsValue);
    #[wasm_bindgen(method, getter)]
    fn cols(this: &Terminal) -> u32;
    #[wasm_bindgen(method, getter)]
    fn rows(this: &Terminal) -> u32;

    #[wasm_bindgen(js_name = setTimeout)]
    fn set_timeout(f: &JsValue, ms: u32);

    #[wasm_bindgen(js_name = matchMedia)]
    fn match_media(query: &str) -> MediaQueryList;
    type MediaQueryList;
    #[wasm_bindgen(method, getter)]
    fn matches(this: &MediaQueryList) -> bool;
    #[wasm_bindgen(js_namespace = location)]
    fn replace(url: &str);

    #[wasm_bindgen(js_namespace = document, js_name = getElementById)]
    fn element(id: &str) -> JsValue;
}

#[wasm_bindgen(js_namespace = FitAddon)]
extern "C" {
    #[wasm_bindgen(js_name = FitAddon)]
    type Fit;
    #[wasm_bindgen(constructor, js_class = "FitAddon")]
    fn new() -> Fit;
    #[wasm_bindgen(method, js_class = "FitAddon")]
    fn fit(this: &Fit);
}

#[wasm_bindgen(js_namespace = WebLinksAddon)]
extern "C" {
    #[wasm_bindgen(js_name = WebLinksAddon)]
    type WebLinks;
    #[wasm_bindgen(constructor, js_class = "WebLinksAddon")]
    fn new() -> WebLinks;
}

#[wasm_bindgen(js_namespace = ImageAddon)]
extern "C" {
    #[wasm_bindgen(js_name = ImageAddon)]
    type Image;
    #[wasm_bindgen(constructor, js_class = "ImageAddon")]
    fn new() -> Image;
}

fn obj(props: &[(&str, JsValue)]) -> Object {
    let o = Object::new();
    for (k, v) in props {
        Reflect::set(&o, &(*k).into(), v).unwrap();
    }
    o
}

fn url(u: String) -> JsValue {
    obj(&[("url", u.into())]).into()
}

fn new_emulator(wasm_path: String, bios_dir: &str, extra: &[(&str, JsValue)]) -> &'static V86 {
    let opts = obj(&[
        ("wasm_path", wasm_path.into()),
        ("bios", url(format!("{bios_dir}seabios.bin"))),
        ("vga_bios", url(format!("{bios_dir}vgabios.bin"))),
        ("filesystem", obj(&[("baseurl", "alpine-rootfs-flat/".into()), ("basefs", "alpine-fs.json".into())]).into()),
        ("memory_size", (128 * 1024 * 1024).into()),
        ("autostart", true.into()),
    ]);
    Object::assign(&opts, &obj(extra));
    Box::leak(Box::new(V86::new(&opts)))
}

fn on(emulator: &V86, event: &str, f: impl FnMut(JsValue) + 'static) {
    let f = Closure::<dyn FnMut(JsValue)>::new(f);
    emulator.add_listener(event, &f);
    f.forget();
}

fn write_files<'a>(emulator: &V86, files: impl Iterator<Item = (String, &'a [u8])>) {
    let fs = emulator.fs9p();
    for (path, data) in files {
        let mut parent = 0; // root inode
        for (i, _) in path.match_indices('/') {
            let id = fs.search_path(&path[..i]).id();
            let name = path[..i].rsplit('/').next().unwrap();
            parent = if id == -1 { fs.create_directory(name, parent) } else { id };
        }
        let _ = emulator.create_file(&path, &Uint8Array::from(data));
    }
}

/// Browser entry: resumes the booted snapshot, adds content/ and shows the welcome screen.
#[wasm_bindgen]
pub fn boot() {
    // touch-first devices without hover (phones, tablets) usually have no keyboard to type with
    if match_media("(hover: none) and (pointer: coarse)").matches() {
        return replace(MOBILE_SITE);
    }
    let term: &'static Terminal = Box::leak(Box::new(Terminal::new(&obj(&[
        ("fontFamily", "'JetBrains Mono', monospace".into()),
        ("fontSize", 15.into()),
        ("theme", obj(&[("background", "#0b0f14".into()), ("foreground", "#d6deeb".into()), ("cursor", "#22d3ee".into())]).into()),
    ]))));
    term.open(&element("terminal"));
    let fit = Fit::new();
    term.load_addon(fit.as_ref());
    // ponytail: sized once on load, a resize listener + stty over serial if people resize a lot
    fit.fit();
    // makes URLs clickable, and renders the inline images the in-VM blog viewer prints
    term.load_addon(WebLinks::new().as_ref());
    term.load_addon(Image::new().as_ref());

    let emulator = new_emulator(format!("{V86_CDN}v86.wasm"), BIOS_CDN, &[("initial_state", url("alpine-state.bin.zst".into()))]);

    // xterm.js drops characters whose UTF-8 bytes arrive one write at a time (e.g. "•", "–", "„"),
    // which is how v86's own adapter feeds it, so bytes are collected into whole characters here
    let mut pending = Vec::new();
    on(emulator, "serial0-output-byte", move |byte| {
        pending.push(byte.as_f64().unwrap() as u8);
        match std::str::from_utf8(&pending) {
            Ok(s) => term.write(s),
            Err(e) if e.error_len().is_none() => return, // incomplete character, wait for more
            Err(_) => term.write(&String::from_utf8_lossy(&pending)),
        }
        pending.clear();
    });
    // serial0_send sends one byte per UTF-16 unit, so typed text goes out as its UTF-8 bytes
    let input = Closure::<dyn FnMut(String)>::new(move |data: String| {
        emulator.serial0_send(&data.bytes().map(char::from).collect::<String>());
    });
    term.on_data(&input);
    input.forget();

    on(emulator, "emulator-loaded", move |_| {
        write_files(emulator, FILES.iter().map(|(p, d)| (p.to_string(), *d)));
        // the snapshot waits at a zsh prompt, so size the tty and run the login greeting again
        emulator.serial0_send(&format!("stty rows {} cols {}; . ~/.zlogin\n", term.rows(), term.cols()));
    });
}

/// Node entry: cold boots the image with `kernel` and resolves with the saved state once zsh shows its prompt.
/// The kernel has 9p built in, so it mounts the root filesystem directly; `rdinit` points nowhere to skip
/// its bundled initramfs.
#[wasm_bindgen]
pub fn build_state(wasm_path: String, bios_dir: &str, kernel: String) -> js_sys::Promise {
    let emulator = new_emulator(wasm_path, bios_dir, &[
        ("bzimage", url(kernel)),
        ("cmdline", "rdinit=/none root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose rw tsc=reliable mitigations=off console=ttyS0".into()),
    ]);
    js_sys::Promise::new(&mut |resolve, _| {
        let (mut output, mut saving) = (Vec::new(), false);
        on(emulator, "serial0-output-byte", move |byte| {
            output.push(byte.as_f64().unwrap() as u8);
            // "╰─" starts the second line of the bira prompt
            if !saving && output.ends_with("╰─".as_bytes()) {
                saving = true;
                // dropping caches and filling free memory with zeros once keeps the snapshot small
                emulator.serial0_send("sync; echo 3 > /proc/sys/vm/drop_caches; dd if=/dev/zero of=/dev/null bs=72M count=1\n");
                let resolve = resolve.clone();
                let save = Closure::once_into_js(move || resolve.call1(&JsValue::NULL, &emulator.save_state()));
                set_timeout(&save, 5000);
            }
        });
    })
}
