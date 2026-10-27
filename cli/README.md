# cli

Linux in the browser: [v86](https://github.com/copy/v86) resumes a snapshot of a booted Alpine Linux (root filesystem over 9p, zsh, oh-my-zsh, xterm.js).

- `src/` (+ `build.rs`): the Rust/WASM glue. It runs the terminal and the emulator in the browser and writes `content/` into the VM; `content/` mirrors the VM filesystem, so `content/root/about.txt` becomes `/root/about.txt`.
- `blog/`: a Rust Markdown viewer inside the VM that shows images through xterm.js.
- `image/`: zsh config and the login banner for the VM.
- `builder/`: a Rust program that builds everything into `public/`: the viewer, the WASM glue, the Alpine root filesystem (with `apk.static`, no root or Docker needed) converted to v86's 9p format, and the booted snapshot (Node).
- `web/`: `index.html` (template) and `_headers` for the site.
- `public/`: the generated static site, gitignored. The wasm glue, filesystem index and snapshot go into `build-<content hash>/`, which `index.html` points at, so a deploy never pairs new files with old ones that Cloudflare still has cached under the same URL.

## Links

A URL fragment runs a command after the greeting, also when it changes while the page is open:

- `#about`: `cat about.txt`
- `#blog`: `blog`
- `#blog/<n>`: `blog <n>`

Only these are allowed (see `hash_command` in `src/lib.rs`), so a link can't type arbitrary input into a visitor's shell.

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
- Environment variables: `NODE_VERSION` = `22`, and `SKIP_DEPENDENCY_INSTALL` = `1` (the repo root's `pnpm-lock.yaml` otherwise makes Pages run `pnpm install` in `cli/`, which has no `package.json`)

Afterwards, under Settings, Build: build system version 3, and Build watch paths include `cli/*` so changes to the website don't rebuild this. Static assets only, there is no `functions/` folder or `_worker.js`.
