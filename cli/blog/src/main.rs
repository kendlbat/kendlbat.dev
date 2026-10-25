//! `blog` lists the posts in ~/blog, `blog <n|file>` renders one with colours and inline images
//! (iTerm2 image protocol, decoded by xterm.js in the browser), one screen at a time from the top.
use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::io::{IsTerminal, Read, Write};
use std::{env, fs, path::Path, path::PathBuf, process::exit, process::Command};

const BLOG_DIR: &str = "/root/blog";
// xterm.js cell size in pixels at the 15px font index.html sets, used to size images in rows
const CELL_W: u32 = 9;
const CELL_H: u32 = 18;

fn main() {
    extern "C" {
        fn signal(signum: i32, handler: usize) -> usize;
    }
    // SAFETY: SIGPIPE (13) back to its default (0), so `blog 2 | head` exits quietly instead of panicking
    unsafe { signal(13, 0) };

    let mut posts: Vec<PathBuf> = fs::read_dir(BLOG_DIR).into_iter().flatten().flatten().map(|e| e.path()).collect();
    posts.retain(|p| p.extension().is_some_and(|e| e == "md"));
    posts.sort();

    let Some(arg) = env::args().nth(1) else {
        for (i, p) in posts.iter().enumerate() {
            let src = fs::read_to_string(p).unwrap();
            let (meta, _) = split_frontmatter(&src);
            println!("\x1b[1;36m{:>2}\x1b[0m  \x1b[2m{}\x1b[0m  {}", i + 1, field(meta, "date"), field(meta, "title"));
        }
        println!("\n\x1b[2mread one with\x1b[0m blog <number>");
        return;
    };
    let path = match arg.parse::<usize>() {
        Ok(n) if (1..=posts.len()).contains(&n) => posts[n - 1].clone(),
        Ok(_) => fail(&format!("no post {arg}, run blog to list them")),
        Err(_) => PathBuf::from(&arg),
    };
    let src = fs::read_to_string(&path).unwrap_or_else(|e| fail(&format!("{arg}: {e}")));
    let (meta, body) = split_frontmatter(&src);
    let (rows, cols) = term_size();
    let header = format!("\x1b[1;36m{}\x1b[0m\n\x1b[2m{}\x1b[0m\n\n", field(meta, "title"), field(meta, "date"));
    let text = header + &render(body, path.parent().unwrap(), rows, cols);
    if std::io::stdout().is_terminal() {
        page(&text, rows, cols);
    } else {
        print!("{text}");
    }
}

fn term_size() -> (u32, u32) {
    #[repr(C)]
    struct Winsize([u16; 4]);
    extern "C" {
        fn ioctl(fd: i32, request: std::ffi::c_ulong, ...) -> i32;
    }
    const TIOCGWINSZ: std::ffi::c_ulong = 0x5413;
    let mut ws = Winsize([0; 4]);
    // SAFETY: TIOCGWINSZ writes a struct winsize (rows, cols, xpixel, ypixel) into ws
    let ok = unsafe { ioctl(1, TIOCGWINSZ, &mut ws) } == 0 && ws.0[0] > 0;
    if ok { (ws.0[0] as u32, ws.0[1] as u32) } else { (24, 80) }
}

/// Prints a screen, waits for a key (q quits), prints the next one. Output only ever appends,
/// so inline images stay intact, unlike in a pager that redraws.
fn page(text: &str, rows: u32, cols: u32) {
    let _ = Command::new("stty").args(["-icanon", "-echo"]).status();
    let mut used = 0;
    let mut out = std::io::stdout();
    for line in text.split_inclusive('\n') {
        let height = line_rows(line, cols);
        if used > 0 && used + height > rows - 1 {
            print!("\x1b[7m -- more: any key, q to quit -- \x1b[0m");
            out.flush().unwrap();
            let mut key = [0];
            if std::io::stdin().read(&mut key).unwrap_or(0) == 0 || key[0] == b'q' {
                println!();
                break;
            }
            print!("\r\x1b[K");
            used = 0;
        }
        print!("{line}");
        used += height;
    }
    out.flush().unwrap();
    let _ = Command::new("stty").args(["icanon", "echo"]).status();
}

/// Terminal rows a line takes: the image height it asks for, or its visible width wrapped at cols.
fn line_rows(line: &str, cols: u32) -> u32 {
    if let Some(h) = line.split(";height=").nth(1).and_then(|s| s.split(|c: char| !c.is_ascii_digit()).next()) {
        return h.parse().unwrap_or(1);
    }
    let mut width = 0;
    let mut chars = line.trim_end_matches('\n').chars();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            chars.by_ref().find(|c| c.is_ascii_alphabetic());
        } else {
            width += 1;
        }
    }
    (width as u32).div_ceil(cols).max(1)
}

/// Rows to show a PNG in: its natural size, shrunk to fit the terminal.
fn image_rows(png: &[u8], rows: u32, cols: u32) -> u32 {
    let dim = |i: usize| png.get(i..i + 4).map_or(0, |b| u32::from_be_bytes(b.try_into().unwrap()));
    let (w, h) = (dim(16).max(1), dim(20));
    let natural = if h == 0 { rows / 2 } else { h.div_ceil(CELL_H) };
    let fit_width = (cols * CELL_W * h / (w * CELL_H)).max(1);
    natural.min(fit_width).min(rows - 2).max(1)
}

fn fail(msg: &str) -> ! {
    eprintln!("blog: {msg}");
    exit(1)
}

fn split_frontmatter(src: &str) -> (&str, &str) {
    src.strip_prefix("---\n").and_then(|s| s.split_once("\n---\n")).unwrap_or(("", src))
}

fn field<'a>(meta: &'a str, key: &str) -> &'a str {
    meta.lines()
        .find_map(|l| l.strip_prefix(key)?.strip_prefix(':'))
        .map_or("", |v| v.trim().trim_matches('"'))
}

fn render(md: &str, dir: &Path, rows: u32, cols: u32) -> String {
    let mut out = String::new();
    let (mut lists, mut links) = (Vec::<Option<u64>>::new(), Vec::new());
    let (mut in_code, mut in_image) = (false, false);
    for event in Parser::new(md) {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                out += &format!("\x1b[1;35m{} ", "#".repeat(level as usize));
            }
            Event::End(TagEnd::Heading(_)) => out += "\x1b[0m\n\n",
            Event::End(TagEnd::Paragraph) => out += "\n\n",
            Event::Start(Tag::Emphasis) => out += "\x1b[3m",
            Event::End(TagEnd::Emphasis) => out += "\x1b[23m",
            Event::Start(Tag::Strong) => out += "\x1b[1m",
            Event::End(TagEnd::Strong) => out += "\x1b[22m",
            Event::Code(c) => out += &format!("\x1b[33m{c}\x1b[39m"),
            Event::Start(Tag::CodeBlock(_)) => in_code = true,
            Event::End(TagEnd::CodeBlock) => {
                in_code = false;
                out += "\n";
            }
            Event::Start(Tag::Link { dest_url, .. }) => {
                links.push(dest_url);
                out += "\x1b[4;34m";
            }
            Event::End(TagEnd::Link) => out += &format!("\x1b[24;39m \x1b[2m({})\x1b[22m", links.pop().unwrap()),
            Event::Start(Tag::List(start)) => lists.push(start),
            Event::End(TagEnd::List(_)) => {
                lists.pop();
                if lists.is_empty() {
                    out += "\n";
                }
            }
            Event::Start(Tag::Item) => {
                let indent = "  ".repeat(lists.len() - 1);
                match lists.last_mut().unwrap() {
                    Some(n) => {
                        out += &format!("{indent}{n}. ");
                        *n += 1;
                    }
                    None => out += &format!("{indent}• "),
                }
            }
            Event::End(TagEnd::Item) if !out.ends_with('\n') => out += "\n",
            Event::Start(Tag::Image { dest_url, .. }) => {
                in_image = true;
                // a missing image is skipped rather than failing the whole post
                if let Ok(data) = fs::read(dir.join(&*dest_url)) {
                    let height = image_rows(&data, rows, cols);
                    out += &format!("\x1b]1337;File=inline=1;size={};height={height}:{}\x07", data.len(), base64(&data));
                }
            }
            Event::End(TagEnd::Image) => in_image = false,
            Event::Text(t) if in_code => {
                for line in t.lines() {
                    out += &format!("  \x1b[2m│\x1b[22m \x1b[32m{line}\x1b[39m\n");
                }
            }
            Event::Text(_) if in_image => {}
            Event::Text(t) => out += &t,
            Event::SoftBreak => out += " ",
            Event::HardBreak => out += "\n",
            Event::Rule => out += &format!("\x1b[2m{}\x1b[22m\n\n", "─".repeat(40)),
            _ => {}
        }
    }
    out
}

fn base64(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, b)| n | (*b as u32) << (16 - 8 * i));
        for i in 0..4 {
            out.push(if i <= chunk.len() { ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char } else { '=' });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_rfc4648() {
        for (input, expected) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foobar", "Zm9vYmFy")] {
            assert_eq!(base64(input.as_bytes()), expected);
        }
    }

    #[test]
    fn rows_for_text_and_images() {
        assert_eq!(line_rows("\x1b[1mhello\x1b[0m\n", 80), 1);
        assert_eq!(line_rows(&format!("{}\n", "x".repeat(81)), 80), 2);
        assert_eq!(line_rows("\x1b]1337;File=inline=1;size=3;height=7:AAAA\x07\n", 80), 7);
        let mut png = vec![0; 24];
        png[16..20].copy_from_slice(&800u32.to_be_bytes());
        png[20..24].copy_from_slice(&360u32.to_be_bytes());
        assert_eq!(image_rows(&png, 40, 120), 20); // 360px / 18px per row
        assert_eq!(image_rows(&png, 12, 120), 10); // capped by window height
        assert_eq!(image_rows(&png, 40, 40), 9); // capped so 800px fits 40 cols
    }

    #[test]
    fn frontmatter_fields() {
        let (meta, body) = split_frontmatter("---\ntitle: \"Hi\"\ndate: 2024-10-08\n---\n\nbody");
        assert_eq!((field(meta, "title"), field(meta, "date"), body), ("Hi", "2024-10-08", "\nbody"));
    }
}
