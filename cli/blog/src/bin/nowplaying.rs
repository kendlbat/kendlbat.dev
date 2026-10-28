use std::fs::File;
use std::io;
use std::process::exit;

const PIPE: &str = "/dev/browser/nowplaying";

fn main() {
    let mut status = File::open(PIPE).unwrap_or_else(|e| {
        eprintln!("nowplaying: {PIPE}: {e}");
        exit(1)
    });
    io::copy(&mut status, &mut io::stdout()).unwrap_or_else(|e| {
        eprintln!("nowplaying: {e}");
        exit(1)
    });
}
