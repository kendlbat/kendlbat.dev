# cli

Linux in the browser: [v86](https://github.com/copy/v86) resumes a snapshot of a booted Alpine Linux (root filesystem over 9p, zsh, oh-my-zsh, xterm.js).

- `src/` (+ `build.rs`): the Rust/WASM glue. It runs the terminal and the emulator in the browser and writes `content/` into the VM; `content/` mirrors the VM filesystem, so `content/root/about.txt` becomes `/root/about.txt`.
- `blog/`: a Rust Markdown viewer inside the VM that shows images through xterm.js.
- `image/`: zsh config and the login banner for the VM.
- `builder/`: a Rust program that builds everything into `public/`: the viewer, the WASM glue, the Alpine root filesystem (with `apk.static`, no root or Docker needed) converted to v86's 9p format, and the booted snapshot (Node).
- `public/`: the static site. `index.html` and `_headers` are sources, everything else in it is generated and gitignored.

## Build

On x86_64 Linux with `curl`, `tar`, `python3` and Node 22.15 or newer (for zstd):

```bash
curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --target wasm32-unknown-unknown --target i686-unknown-linux-musl && . "$HOME/.cargo/env" && cargo run --release --manifest-path builder/Cargo.toml
```

Then serve `public/` with any static server.

## Cloudflare Pages

Workers & Pages, Create, Pages, Connect to Git, `kendlbat/kendlbat.dev`, then:

- Production branch: `main`
- Framework preset: None
- Build command: the command from Build above
- Build output directory: `public`
- Root directory (advanced): `cli`
- Environment variable: `NODE_VERSION` = `22`

Afterwards, under Settings, Build: build system version 3, and Build watch paths include `cli/*` so changes to the website don't rebuild this. Static assets only, there is no `functions/` folder or `_worker.js`.
