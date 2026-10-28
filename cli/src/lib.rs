use js_sys::{Object, Reflect, Uint8Array};
use wasm_bindgen::prelude::*;

include!(concat!(env!("OUT_DIR"), "/files.rs"));

mod nowplaying;

const V86_CDN: &str = "https://cdn.jsdelivr.net/npm/v86@0.5.472/build/";
const BIOS_CDN: &str =
    "https://cdn.jsdelivr.net/gh/copy/v86@cc37f35c43bf14865d74ad76879ecf9410f69eb1/bios/";

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
    #[wasm_bindgen(method, getter)]
    fn options(this: &Terminal) -> Object;
    #[wasm_bindgen(method, js_name = onData)]
    fn on_data(this: &Terminal, f: &Closure<dyn FnMut(String)>);
    #[wasm_bindgen(method, getter)]
    fn parser(this: &Terminal) -> Parser;

    type Parser;
    #[wasm_bindgen(method, js_name = registerOscHandler)]
    fn register_osc_handler(this: &Parser, ident: u32, f: &Closure<dyn FnMut(String) -> bool>);
    #[wasm_bindgen(method, js_name = loadAddon)]
    fn load_addon(this: &Terminal, addon: &JsValue);
    #[wasm_bindgen(method, getter)]
    fn cols(this: &Terminal) -> u32;
    #[wasm_bindgen(method, getter)]
    fn rows(this: &Terminal) -> u32;

    #[wasm_bindgen(js_namespace = console)]
    fn log(line: &str);

    #[wasm_bindgen(js_name = setTimeout)]
    fn set_timeout(f: &JsValue, ms: u32);

    #[wasm_bindgen(js_namespace = document, js_name = getElementById)]
    fn element(id: &str) -> JsValue;

    #[wasm_bindgen(js_namespace = history, js_name = replaceState)]
    fn replace_state(data: &JsValue, unused: &str, url: &str);

    #[wasm_bindgen(js_name = open)]
    fn open_window(url: &str, target: &str, features: &str);

    #[wasm_bindgen(js_name = addEventListener)]
    fn add_window_listener(event: &str, f: &Closure<dyn FnMut()>);
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

fn new_emulator(
    wasm_path: String,
    bios_dir: &str,
    site_dir: &str,
    build_dir: &str,
    extra: &[(&str, JsValue)],
) -> &'static V86 {
    let opts = obj(&[
        ("wasm_path", wasm_path.into()),
        ("bios", url(format!("{bios_dir}seabios.bin"))),
        ("vga_bios", url(format!("{bios_dir}vgabios.bin"))),
        (
            "filesystem",
            obj(&[
                ("baseurl", format!("{site_dir}alpine-rootfs-flat/").into()),
                ("basefs", format!("{build_dir}alpine-fs.json").into()),
            ])
            .into(),
        ),
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
        let mut parent = 0;
        for (i, _) in path.match_indices('/') {
            let id = fs.search_path(&path[..i]).id();
            let name = path[..i].rsplit('/').next().unwrap();
            parent = if id == -1 {
                fs.create_directory(name, parent)
            } else {
                id
            };
        }
        let _ = emulator.create_file(&path, &Uint8Array::from(data));
    }
}

#[wasm_bindgen]
pub fn boot(build_dir: &str) {
    let term: &'static Terminal = Box::leak(Box::new(Terminal::new(&obj(&[
        ("fontFamily", "'JetBrains Mono', monospace".into()),
        ("fontSize", 15.into()),
        (
            "theme",
            obj(&[
                ("background", "#0b0f14".into()),
                ("foreground", "#d6deeb".into()),
                ("cursor", "#22d3ee".into()),
            ])
            .into(),
        ),
    ]))));
    term.open(&element("terminal"));
    let fit: &'static Fit = Box::leak(Box::new(Fit::new()));
    term.load_addon(fit.as_ref());
    fit.fit();
    let refit = Closure::<dyn FnMut()>::new(move || fit.fit());
    add_window_listener("resize", &refit);
    refit.forget();
    term.load_addon(WebLinks::new().as_ref());
    term.load_addon(Image::new().as_ref());

    let emulator = new_emulator(
        format!("{V86_CDN}v86.wasm"),
        BIOS_CDN,
        "/",
        build_dir,
        &[(
            "initial_state",
            url(format!("{build_dir}alpine-state.bin.zst")),
        )],
    );

    let mut pending = Vec::new();
    on(emulator, "serial0-output-byte", move |byte| {
        pending.push(byte.as_f64().unwrap() as u8);
        match std::str::from_utf8(&pending) {
            Ok(s) => term.write(s),
            Err(e) if e.error_len().is_none() => return,
            Err(_) => term.write(&String::from_utf8_lossy(&pending)),
        }
        pending.clear();
    });
    let input = Closure::<dyn FnMut(String)>::new(move |data: String| {
        emulator.serial0_send(&data.bytes().map(char::from).collect::<String>());
    });
    term.on_data(&input);
    input.forget();

    let on_osc = Closure::<dyn FnMut(String) -> bool>::new(move |_| {
        wasm_bindgen_futures::spawn_local(nowplaying::answer(term, emulator));
        true
    });
    term.parser().register_osc_handler(nowplaying::OSC, &on_osc);
    on_osc.forget();

    let on_link = Closure::<dyn FnMut(JsValue, String)>::new(move |_, uri: String| {
        if let Some(command) = path_command(&uri) {
            emulator.serial0_send(&format!("{command}\n"));
        } else if uri.starts_with("https://") || uri.starts_with("http://") {
            open_window(&uri, "_blank", "noopener");
        }
    });
    let link_handler = obj(&[("activate", on_link.into_js_value()), ("allowNonHttpProtocols", true.into())]);
    Object::assign(&term.options(), &obj(&[("linkHandler", link_handler.into())]));

    on(emulator, "emulator-loaded", move |_| {
        write_files(emulator, FILES.iter().map(|(p, d)| (p.to_string(), *d)));

        let link_command = take_path_command()
            .map(|c| format!("; {c}"))
            .unwrap_or_default();
        let now = (js_sys::Date::now() / 1000.0) as u64;
        let tz = posix_tz(-js_sys::Date::new_0().get_timezone_offset() as i64);
        emulator.serial0_send(&format!(
            "date -s @{now} >/dev/null; export TZ={tz}; stty rows {} cols {}; . ~/.zlogin{link_command}\n",
            term.rows(),
            term.cols()
        ));
    });
}

fn location() -> JsValue {
    Reflect::get(&js_sys::global(), &"location".into()).unwrap_or_default()
}

fn location_part(part: &str) -> String {
    Reflect::get(&location(), &part.into()).ok().and_then(|v| v.as_string()).unwrap_or_default()
}

fn take_path_command() -> Option<String> {
    let path = location_part("pathname");
    if path != "/" {
        replace_state(&JsValue::NULL, "", &format!("/{}", location_part("search")));
    }
    path_command(&path)
}

fn posix_tz(utc_offset_minutes: i64) -> String {
    let sign = if utc_offset_minutes >= 0 { '-' } else { '+' };
    let minutes = utc_offset_minutes.abs();
    format!("LOCAL{sign}{:02}:{:02}", minutes / 60, minutes % 60)
}

fn path_command(path: &str) -> Option<String> {
    match path.strip_prefix('/')?.trim_end_matches('/') {
        "about" => Some("cat about.txt".into()),
        "blog" => Some("blog".into()),
        "nowplaying" => Some("nowplaying".into()),
        "putzplan" => Some("putzplan".into()),
        "util" => Some("ls util".into()),
        other => {
            let n = other.strip_prefix("blog/")?;
            (!n.is_empty() && n.len() <= 4 && n.bytes().all(|b| b.is_ascii_digit()))
                .then(|| format!("blog {n}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{path_command, posix_tz};

    #[test]
    fn posix_tz_inverts_the_sign() {
        assert_eq!(posix_tz(60), "LOCAL-01:00");
        assert_eq!(posix_tz(120), "LOCAL-02:00");
        assert_eq!(posix_tz(0), "LOCAL-00:00");
        assert_eq!(posix_tz(-330), "LOCAL+05:30");
    }

    #[test]
    fn paths_map_to_fixed_commands_only() {
        assert_eq!(path_command("/about").as_deref(), Some("cat about.txt"));
        assert_eq!(path_command("/about/").as_deref(), Some("cat about.txt"));
        assert_eq!(path_command("/blog").as_deref(), Some("blog"));
        assert_eq!(path_command("/blog/2").as_deref(), Some("blog 2"));
        assert_eq!(path_command("/nowplaying").as_deref(), Some("nowplaying"));
        assert_eq!(path_command("/putzplan").as_deref(), Some("putzplan"));
        assert_eq!(path_command("/util").as_deref(), Some("ls util"));
        for rejected in [
            "",
            "/",
            "about",
            "/blog/x",
            "/blog/2;rm",
            "/blog/-1",
            "/blog/12345",
            "/rm -rf /",
            "/ABOUT",
            "/#about",
        ] {
            assert_eq!(path_command(rejected), None, "{rejected:?}");
        }
    }
}

#[wasm_bindgen]
pub fn build_state(wasm_path: String, bios_dir: &str, kernel: String) -> js_sys::Promise {
    let emulator = new_emulator(wasm_path, bios_dir, "", "", &[
        ("bzimage", url(kernel)),
        ("cmdline", "rdinit=/none root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose rw tsc=reliable mitigations=off console=ttyS0".into()),
    ]);
    js_sys::Promise::new(&mut |resolve, reject| {
        let give_up = Closure::once_into_js(move || {
            reject.call1(&JsValue::NULL, &"no zsh prompt after 10 minutes".into())
        });
        set_timeout(&give_up, 10 * 60 * 1000);

        let (mut output, mut line, mut prompts) = (Vec::new(), Vec::new(), 0);
        on(emulator, "serial0-output-byte", move |byte| {
            let byte = byte.as_f64().unwrap() as u8;
            if byte == b'\n' {
                log(&String::from_utf8_lossy(&line));
                line.clear();
            } else if byte != b'\r' {
                line.push(byte);
            }
            output.push(byte);
            if output.ends_with("╰─".as_bytes()) {
                prompts += 1;
                if prompts == 1 {
                    emulator.serial0_send("sync; echo 3 > /proc/sys/vm/drop_caches; dd if=/dev/zero of=/dev/null bs=72M count=1\n");
                } else if prompts == 2 {
                    let resolve = resolve.clone();
                    let save = Closure::once_into_js(move || {
                        resolve.call1(&JsValue::NULL, &emulator.save_state())
                    });
                    set_timeout(&save, 1000);
                }
            }
        });
    })
}
