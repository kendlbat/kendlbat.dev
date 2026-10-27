//! `nowplaying` shows what kendlbat is listening to. The VM has no network, so it asks the browser terminal
//! with OSC 5380; the page looks it up, writes the result into the terminal and answers with a newline.
use std::io::{IsTerminal, Read, Write};
use std::process::{exit, Command};

fn main() {
    if !std::io::stdout().is_terminal() {
        eprintln!("nowplaying: needs the browser terminal");
        exit(1);
    }
    // no echo, byte-wise reads, and give up after 25 s (VTIME is in tenths, 255 at most)
    let _ = Command::new("stty").args(["-icanon", "-echo", "min", "0", "time", "250"]).status();
    print!("\x1b]5380;nowplaying\x07");
    std::io::stdout().flush().unwrap();
    let mut byte = [0];
    let answered = loop {
        match std::io::stdin().read(&mut byte) {
            Ok(1) if byte[0] == b'\n' => break true,
            Ok(1) => continue,
            _ => break false,
        }
    };
    let _ = Command::new("stty").args(["icanon", "echo"]).status();
    if !answered {
        eprintln!("nowplaying: no answer from the browser terminal");
        exit(1);
    }
}
