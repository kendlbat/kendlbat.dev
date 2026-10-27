//! Builds public/ for Cloudflare Pages (x86_64 Linux, no root, no Docker): the blog viewer, the WASM glue,
//! an Alpine root filesystem in v86's 9p format and a snapshot of it booted to the zsh prompt.
//! Shells out to curl, tar, sha256sum, python3 and node, which the Pages build image provides.
use std::os::unix::fs::{symlink, PermissionsExt};
use std::{env, fs, path::Path, process::Command};

const ALPINE: &str = "https://dl-cdn.alpinelinux.org/alpine/v3.21";
const APK_STATIC: &str = "https://gitlab.alpinelinux.org/api/v4/projects/5/packages/generic/v2.14.6/x86_64/apk.static";
// listed instead of alpine-base, which also pulls in apk-tools with its TLS and networking stack,
// useless in a VM without a network
const PACKAGES: &[&str] = &[
    "alpine-baselayout", "alpine-release", "busybox", "busybox-binsh", "openrc", "agetty",
    "zsh", "zsh-autosuggestions", "fastfetch", "less", "htop",
];
const OH_MY_ZSH: &str = "https://github.com/ohmyzsh/ohmyzsh/archive/d2b7f557cceaddb16ba89bbf8200d8a8df35c4d8.tar.gz";
const V86_NPM: &str = "https://registry.npmjs.org/v86/-/v86-0.5.472.tgz";
const V86_REPO: &str = "https://raw.githubusercontent.com/copy/v86/cc37f35c43bf14865d74ad76879ecf9410f69eb1";
const WASM_BINDGEN: &str = "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.129/wasm-bindgen-0.2.129-x86_64-unknown-linux-musl.tar.gz";
// v86's Buildroot kernel has 9p built in, so it boots the Alpine root without an initramfs.
// Only used to build the snapshot, visitors never download it.
const KERNEL: &str = "https://i.copy.sh/buildroot-bzImage68.bin";
const KERNEL_SHA256: &str = "507a759c70ab7a490a233be454d0b5b88bc667956a410b531cb4edc091e2eb1c";

fn main() {
    env::set_current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("..")).unwrap();
    let work = Path::new("target/build");
    let _ = fs::remove_dir_all(work);
    fs::create_dir_all(work).unwrap();
    for generated in ["public/pkg", "public/alpine-rootfs-flat", "public/alpine-fs.json", "public/alpine-state.bin.zst"] {
        let _ = fs::remove_dir_all(generated).or_else(|_| fs::remove_file(generated));
    }

    step("blog viewer");
    // blog/.cargo/config.toml picks the 32-bit musl target, and cargo only reads it from inside blog/
    run(Command::new("cargo").args(["build", "--release"]).current_dir("blog"));

    step("wasm glue");
    run(Command::new("cargo").args(["build", "--release", "--target", "wasm32-unknown-unknown"]));
    fetch_tar(WASM_BINDGEN, &work.join("wasm-bindgen"));
    let wasm_bindgen = work.join("wasm-bindgen/wasm-bindgen-0.2.129-x86_64-unknown-linux-musl/wasm-bindgen");
    for (target, out) in [("web", "public/pkg"), ("nodejs", "target/build/pkg-node")] {
        run(Command::new(&wasm_bindgen).args(["--target", target, "--no-typescript", "--out-dir", out, "target/wasm32-unknown-unknown/release/cli.wasm"]));
    }

    step("root filesystem");
    let rootfs = work.join("rootfs");
    build_rootfs(work, &rootfs);
    // apk ran without root: files only root could read (e.g. setuid helpers installed as 4111) get
    // owner read so this user can pack them, and tar records everything as owned by root
    make_owner_readable(&rootfs);
    let tar = work.join("rootfs.tar");
    // top-level names rather than ".", whose "./" prefix v86's fs2json would keep as a directory
    let top: Vec<_> = fs::read_dir(&rootfs).unwrap().map(|e| e.unwrap().file_name()).collect();
    run(Command::new("tar").args(["--owner=0", "--group=0", "--numeric-owner", "-C"]).arg(&rootfs).arg("-cf").arg(&tar).args(&top));
    for tool in ["fs2json.py", "copy-to-sha256.py"] {
        fetch(&format!("{V86_REPO}/tools/{tool}"), &work.join(tool));
    }
    run(Command::new("python3").arg(work.join("fs2json.py")).args(["--out", "public/alpine-fs.json"]).arg(&tar));
    fs::create_dir_all("public/alpine-rootfs-flat").unwrap();
    run(Command::new("python3").arg(work.join("copy-to-sha256.py")).arg(&tar).arg("public/alpine-rootfs-flat"));

    step("snapshot");
    fetch_tar(V86_NPM, &work.join("v86"));
    for bios in ["seabios.bin", "vgabios.bin"] {
        fetch(&format!("{V86_REPO}/bios/{bios}"), &work.join(bios));
    }
    let kernel = work.join("kernel.bin");
    fetch(KERNEL, &kernel);
    let sum = output(Command::new("sha256sum").arg(&kernel));
    assert!(sum.starts_with(KERNEL_SHA256), "kernel checksum mismatch: {sum}");
    // node runs from public/ so the 9p paths in the glue resolve like they do in the browser
    let script = "import { V86 } from '../target/build/v86/package/build/libv86.mjs';
        import zlib from 'node:zlib'; import fs from 'node:fs';
        globalThis.V86 = V86;
        const { build_state } = (await import('../target/build/pkg-node/cli.js')).default;
        const state = new Uint8Array(await build_state('../target/build/v86/package/build/v86.wasm', '../target/build/', '../target/build/kernel.bin'));
        fs.writeFileSync('alpine-state.bin.zst', zlib.zstdCompressSync(state, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }));
        process.exit();";
    run(Command::new("node").args(["--input-type=module", "-e", script]).current_dir("public"));
    step("done");
}

/// Alpine packages plus the setup their install scripts and the old Dockerfile did.
fn build_rootfs(work: &Path, rootfs: &Path) {
    let apk = work.join("apk.static");
    fetch(APK_STATIC, &apk);
    fs::set_permissions(&apk, fs::Permissions::from_mode(0o755)).unwrap();
    // --no-scripts: package scripts would need to run x86 binaries inside the root
    run(Command::new(&apk)
        .args(["--arch", "x86", "-X", &format!("{ALPINE}/main"), "-X", &format!("{ALPINE}/community")])
        .args(["--allow-untrusted", "--initdb", "--no-scripts", "--no-chown", "--no-cache", "--root"])
        .arg(rootfs)
        .arg("add")
        .args(PACKAGES));
    let r = |p: &str| rootfs.join(p);

    // what busybox's install script does: a link per applet
    for applet in fs::read_to_string(r("etc/busybox-paths.d/busybox")).unwrap().lines() {
        let _ = symlink("/bin/busybox", r(applet));
    }

    // autologin as root on the serial console, which xterm.js is attached to
    let inittab = fs::read_to_string(r("etc/inittab")).unwrap();
    let inittab: String = inittab.lines().filter(|l| !l.contains("getty")).map(|l| format!("{l}\n")).collect();
    fs::write(r("etc/inittab"), inittab + "ttyS0::respawn:/sbin/agetty --autologin root --noissue -s ttyS0 115200 xterm-256color\n").unwrap();
    replace(&r("etc/passwd"), "root:x:0:0:root:/root:/bin/sh", "root:x:0:0:root:/root:/bin/zsh");
    append(&r("etc/shells"), "/bin/zsh\n");
    fs::write(r("etc/hostname"), "kendlbat.dev\n").unwrap();
    for (level, services) in [("sysinit", &["devfs", "dmesg"][..]), ("boot", &["sysctl", "hostname", "bootmisc"]), ("shutdown", &["killprocs"])] {
        for service in services {
            symlink(format!("/etc/init.d/{service}"), r(&format!("etc/runlevels/{level}/{service}"))).unwrap();
        }
    }

    // oh-my-zsh trimmed to its core and the bira theme
    fetch_tar(OH_MY_ZSH, &work.join("omz"));
    let omz = fs::read_dir(work.join("omz")).unwrap().next().unwrap().unwrap().path();
    run(Command::new("cp").arg("-r").arg(&omz).arg(r("root/.oh-my-zsh")));
    for unused in ["plugins", "templates", "cache", ".github"] {
        let _ = fs::remove_dir_all(r(&format!("root/.oh-my-zsh/{unused}")));
    }
    for theme in fs::read_dir(r("root/.oh-my-zsh/themes")).unwrap() {
        let theme = theme.unwrap().path();
        if !theme.ends_with("bira.zsh-theme") {
            fs::remove_file(theme).unwrap();
        }
    }

    for (src, dst) in [("image/zshrc", "root/.zshrc"), ("image/zlogin", "root/.zlogin"), ("image/motd", "etc/motd")] {
        fs::copy(src, r(dst)).unwrap();
    }
    fs::write(r("root/.hushlogin"), "").unwrap();
    fs::copy("blog/target/i686-unknown-linux-musl/release/blog", r("usr/local/bin/blog")).unwrap();
    for docs in ["usr/share/doc", "usr/share/man"] {
        let _ = fs::remove_dir_all(r(docs));
    }
}

fn make_owner_readable(dir: &Path) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        let meta = fs::symlink_metadata(&path).unwrap();
        if meta.file_type().is_symlink() {
            continue;
        }
        let extra = if meta.is_dir() { 0o700 } else { 0o400 };
        let mode = meta.permissions().mode();
        if mode & extra != extra {
            fs::set_permissions(&path, fs::Permissions::from_mode(mode | extra)).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        }
        if meta.is_dir() {
            make_owner_readable(&path);
        }
    }
}

fn step(name: &str) {
    println!("\n==> {name}");
}

fn run(cmd: &mut Command) {
    let status = cmd.status().unwrap_or_else(|e| panic!("{cmd:?}: {e}"));
    assert!(status.success(), "{cmd:?} failed: {status}");
}

fn output(cmd: &mut Command) -> String {
    let out = cmd.output().unwrap_or_else(|e| panic!("{cmd:?}: {e}"));
    assert!(out.status.success(), "{cmd:?} failed");
    String::from_utf8(out.stdout).unwrap()
}

fn fetch(url: &str, dest: &Path) {
    run(Command::new("curl").args(["-fsSL", "--retry", "3", "--retry-all-errors", "-o"]).arg(dest).arg(url));
}

fn fetch_tar(url: &str, dir: &Path) {
    fs::create_dir_all(dir).unwrap();
    let archive = dir.with_extension("tar.gz");
    fetch(url, &archive);
    run(Command::new("tar").arg("-xzf").arg(&archive).arg("-C").arg(dir));
}

fn replace(path: &Path, from: &str, to: &str) {
    let text = fs::read_to_string(path).unwrap();
    assert!(text.contains(from), "{} has no {from:?}", path.display());
    fs::write(path, text.replace(from, to)).unwrap();
}

fn append(path: &Path, text: &str) {
    fs::write(path, fs::read_to_string(path).unwrap() + text).unwrap();
}
