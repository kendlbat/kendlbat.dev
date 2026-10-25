# cli

Linux in the browser: [v86](https://github.com/copy/v86) resumes a snapshot of a booted Alpine Linux (root filesystem over 9p, zsh, oh-my-zsh, xterm.js). A Rust/WASM crate puts `content/` (Markdown blog posts and their images, util scripts, pubkey, links, homepage text) into the VM; `content/` mirrors the VM filesystem, so `content/root/about.txt` becomes `/root/about.txt`, and `blog/` is a Rust Markdown viewer inside the VM that shows images through xterm.js.

## Build

Needs Docker, Node, `zstd`, `rustup target add wasm32-unknown-unknown i686-unknown-linux-musl` and `cargo install wasm-bindgen-cli --version 0.2.129`.

Blog viewer, a static 32-bit binary for the VM (target and linker are set in `blog/.cargo/config.toml`):

```bash
cargo build --release --manifest-path blog/Cargo.toml
```

Root filesystem (`image/` holds the Dockerfile, zshrc and zlogin). The two converters come from the v86 repository:

```bash
curl -fLO https://raw.githubusercontent.com/copy/v86/cc37f35c43bf14865d74ad76879ecf9410f69eb1/tools/fs2json.py
```

```bash
curl -fLO https://raw.githubusercontent.com/copy/v86/cc37f35c43bf14865d74ad76879ecf9410f69eb1/tools/copy-to-sha256.py
```

```bash
docker build . -f image/Dockerfile --platform linux/386 --load --tag kendlbat-cli-alpine
```

```bash
docker create --platform linux/386 --name kendlbat-cli-alpine kendlbat-cli-alpine && docker export kendlbat-cli-alpine -o rootfs.tar && docker rm kendlbat-cli-alpine
```

```bash
python3 fs2json.py --out alpine-fs.json rootfs.tar && mkdir -p alpine-rootfs-flat && python3 copy-to-sha256.py rootfs.tar alpine-rootfs-flat
```

WASM glue, for the browser (`pkg`) and for building the snapshot in Node (`pkg-node`):

```bash
cargo build --release --target wasm32-unknown-unknown && wasm-bindgen --target web --no-typescript --out-dir pkg target/wasm32-unknown-unknown/release/cli.wasm && wasm-bindgen --target nodejs --no-typescript --out-dir pkg-node target/wasm32-unknown-unknown/release/cli.wasm
```

Snapshot: v86 and its BIOS locally, then a cold boot that saves the state once zsh is up (about 90 seconds):

```bash
curl -fL https://registry.npmjs.org/v86/-/v86-0.5.472.tgz | tar xz && mv package v86 && mkdir -p bios && curl -fLo bios/seabios.bin https://raw.githubusercontent.com/copy/v86/cc37f35c43bf14865d74ad76879ecf9410f69eb1/bios/seabios.bin && curl -fLo bios/vgabios.bin https://raw.githubusercontent.com/copy/v86/cc37f35c43bf14865d74ad76879ecf9410f69eb1/bios/vgabios.bin
```

```bash
node --input-type=module -e "import { V86 } from './v86/build/libv86.mjs'; globalThis.V86 = V86; const { build_state } = (await import('./pkg-node/cli.js')).default; const fs = await import('node:fs'); fs.writeFileSync('alpine-state.bin', new Uint8Array(await build_state('v86/build/v86.wasm', 'bios/'))); process.exit();" && zstd -19 -f --rm alpine-state.bin
```

Rebuild the image and snapshot whenever `image/` or `blog/` changes. Content changes in `content/` only need the WASM step.

Then serve this folder statically (`index.html`, `pkg/`, `alpine-fs.json`, `alpine-rootfs-flat/`, `alpine-state.bin.zst`).
