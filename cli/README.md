# cli

Linux in the browser: [v86](https://github.com/copy/v86) resumes a snapshot of a booted Alpine Linux (root filesystem over 9p, zsh, oh-my-zsh, xterm.js).

- `src/` (+ `build.rs`): the Rust/WASM glue. It runs the terminal and the emulator in the browser and writes `content/` into the VM; `content/` mirrors the VM filesystem, so `content/root/about.txt` becomes `/root/about.txt`.
- `blog/`: the VM's own tools, in Rust: `blog`, a Markdown viewer that shows images through xterm.js, `putzplan`, the cleaning rota by calendar week, `download`, `nowplaying`, and `browserd`, which provides `/dev/browser` (below).
- `image/`: zsh config and the login banner for the VM.
- `builder/`: a Rust program that builds everything into `public/`: the viewer, the WASM glue, the Alpine root filesystem (with `apk.static`, no root or Docker needed) converted to v86's 9p format, and the booted snapshot (Node).
- `web/`: `index.html` (template) and `_headers` for the site.
- `public/`: the generated static site, gitignored. The wasm glue, filesystem index and snapshot go into `build-<content hash>/`, which `index.html` points at, so a deploy never pairs new files with old ones that Cloudflare still has cached under the same URL.

## Links

A path runs a command after the greeting, for example `kendlbat.dev/blog/2`. The URL is reset to `/` once read:

- `/about`: `cat about.txt`
- `/blog`: `blog`
- `/blog/<n>`: `blog <n>`
- `/nowplaying`: `nowplaying`
- `/putzplan`: `putzplan`
- `/util`: `ls util`

Only these are allowed (see `path_command` in `src/lib.rs`), so a link can't type arbitrary input into a visitor's shell. The greeting's commands and the `blog` list are OSC 8 terminal links to these paths; clicking one runs its command in place. Cloudflare Pages serves `index.html` for any path that isn't a file, because the site has no `404.html`, so the paths need no redirect rules; `index.html` and the glue therefore load everything from absolute paths.

## /dev/browser

The VM has no network. `browserd`, started by init, connects it to the page over a virtio console (`/dev/hvc0`, raw mode, frames of kind byte, length-prefixed name and data):

- `/dev/browser/downloads/` is a spool directory: a file written there is downloaded by the browser under its name once no process has it open anymore, then removed. `download [-f FILE] [-o NAME]` writes into it (as `.NAME.part`, renamed when complete).
- `/dev/browser/nowplaying` is a named pipe: reading it asks the page, which looks up ListenBrainz and the cover art like the website's NowPlayingCard (`src/nowplaying.rs`, cached for 10 s). `nowplaying` reads it.
- Window size changes arrive as resize frames; `browserd` sets them on `/dev/ttyS0` with `TIOCSWINSZ`, so programs get `SIGWINCH` and redraw while running.

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
