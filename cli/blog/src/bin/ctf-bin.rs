use std::fs;
use std::io::Write;
use std::process::{exit, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

const REQUESTS: &str = "/dev/browser/ctf";
const TIMEOUT: Duration = Duration::from_secs(30);
const USAGE: &str = "usage: ctf CHALLENGE KEY
  loads CHALLENGE from ctf.kendlbat.dev into ~/ctf/CHALLENGE and shows its description";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [name, key] = &args[..] else {
        fail(USAGE)
    };
    if !valid(name) || !valid(key) {
        fail(&format!("ctf: CHALLENGE and KEY may only contain letters, digits, - and _\n{USAGE}"));
    }

    let bundle = format!("{REQUESTS}/{name}.tgz");
    let _ = fs::remove_file(&bundle);
    let part = format!("{REQUESTS}/.{name}.part");
    fs::write(&part, key)
        .and_then(|_| fs::rename(&part, format!("{REQUESTS}/{name}.key")))
        .unwrap_or_else(|e| fail(&format!("{REQUESTS}: {e}")));
    let started = Instant::now();
    let data = loop {
        if let Ok(data) = fs::read(&bundle) {
            break data;
        }
        if started.elapsed() > TIMEOUT {
            fail("ctf: no answer from the browser, is browserd running?");
        }
        sleep(Duration::from_millis(100));
    };
    let _ = fs::remove_file(&bundle);
    if data.is_empty() {
        fail(&format!("ctf: no challenge {name:?} with this key (or ctf.kendlbat.dev is unreachable)"));
    }

    let dir = format!("{}/ctf/{name}", std::env::var("HOME").unwrap_or_else(|_| "/root".into()));
    fs::create_dir_all(&dir).unwrap_or_else(|e| fail(&format!("{dir}: {e}")));
    extract(&data, &dir).unwrap_or_else(|e| fail(&format!("ctf: unpacking {name}: {e}")));
    if let Ok(info) = fs::read_to_string(format!("{dir}/info.txt")) {
        print!("{info}");
    }
    println!("\x1b[2mloaded into {dir}\x1b[0m");
}

fn extract(data: &[u8], dir: &str) -> std::io::Result<()> {
    let mut tar = Command::new("tar").args(["-xzf", "-", "-C", dir]).stdin(Stdio::piped()).spawn()?;
    tar.stdin.take().unwrap().write_all(data)?;
    match tar.wait()?.success() {
        true => Ok(()),
        false => Err(std::io::Error::other("tar failed")),
    }
}

fn valid(arg: &str) -> bool {
    !arg.is_empty() && arg.len() <= 64 && arg.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn fail(message: &str) -> ! {
    eprintln!("{message}");
    exit(1)
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_plain_names_and_keys_are_valid() {
        assert!(super::valid("vault"));
        assert!(super::valid("a1-b_C"));
        for rejected in ["", ".", "..", "a/b", "a b", "a.key", "-\n", &"x".repeat(65)] {
            assert!(!super::valid(rejected), "{rejected:?}");
        }
    }
}
