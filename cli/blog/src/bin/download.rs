use std::fs;
use std::io::{IsTerminal, Read};
use std::path::Path;
use std::process::exit;
use std::thread::sleep;
use std::time::{Duration, Instant};

const DOWNLOADS: &str = "/dev/browser/downloads";
const DEFAULT_NAME: &str = "download.txt";
const USAGE: &str = "usage: download [-f FILE] [-o NAME]
  saves FILE, or what is piped in, as NAME in your browser's downloads
  examples: cat notes.txt | download
            echo test | download -o test.txt
            download -f test.txt -o copy.txt
  same as writing the file into /dev/browser/downloads/";

#[derive(Debug, PartialEq)]
struct Options {
    file: Option<String>,
    name: Option<String>,
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let options = match parse(&args) {
        Ok(Some(options)) => options,
        Ok(None) => {
            println!("{USAGE}");
            return;
        }
        Err(message) => fail(&format!("{message}\n{USAGE}")),
    };

    let data = match &options.file {
        Some(path) => fs::read(path).unwrap_or_else(|e| fail(&format!("{path}: {e}"))),
        None if std::io::stdin().is_terminal() => fail(&format!("nothing to download, pass -f FILE or pipe data in\n{USAGE}")),
        None => {
            let mut data = Vec::new();
            std::io::stdin().read_to_end(&mut data).unwrap_or_else(|e| fail(&format!("stdin: {e}")));
            data
        }
    };
    let name = download_name(&options);

    let part = format!("{DOWNLOADS}/.{name}.part");
    let path = format!("{DOWNLOADS}/{name}");
    fs::write(&part, &data).and_then(|_| fs::rename(&part, &path)).unwrap_or_else(|e| fail(&format!("{DOWNLOADS}: {e}")));
    let started = Instant::now();
    while Path::new(&path).exists() {
        if started.elapsed() > Duration::from_secs(10) {
            fail(&format!("download: {path} was not picked up, is browserd running?"));
        }
        sleep(Duration::from_millis(50));
    }
    eprintln!("download: {name} ({} bytes)", data.len());
}

fn parse(args: &[String]) -> Result<Option<Options>, String> {
    let mut options = Options { file: None, name: None };
    let mut args = args.iter();
    while let Some(arg) = args.next() {
        let slot = match arg.as_str() {
            "-h" | "--help" => return Ok(None),
            "-f" => &mut options.file,
            "-o" => &mut options.name,
            other => return Err(format!("download: unknown argument {other:?}")),
        };
        let value = args.next().ok_or_else(|| format!("download: {arg} needs a value"))?;
        *slot = Some(value.clone());
    }
    Ok(Some(options))
}

fn download_name(options: &Options) -> String {
    let from_file = options.file.as_deref().and_then(|f| Path::new(f).file_name()).map(|n| n.to_string_lossy().into_owned());
    let name = options.name.clone().or(from_file).unwrap_or_else(|| DEFAULT_NAME.into());
    let name: String = name.chars().filter(|c| !c.is_control() && *c != '/').collect();
    let name = name.trim_start_matches('.');
    if name.trim().is_empty() { DEFAULT_NAME.into() } else { name.into() }
}

fn fail(message: &str) -> ! {
    eprintln!("{message}");
    exit(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    fn opts(file: Option<&str>, name: Option<&str>) -> Options {
        Options { file: file.map(Into::into), name: name.map(Into::into) }
    }

    #[test]
    fn parses_the_documented_usages() {
        assert_eq!(parse(&args(&[])), Ok(Some(opts(None, None))));
        assert_eq!(parse(&args(&["-o", "test.txt"])), Ok(Some(opts(None, Some("test.txt")))));
        assert_eq!(parse(&args(&["-f", "test.txt"])), Ok(Some(opts(Some("test.txt"), None))));
        assert_eq!(parse(&args(&["-f", "test.txt", "-o", "test1.txt"])), Ok(Some(opts(Some("test.txt"), Some("test1.txt")))));
        assert_eq!(parse(&args(&["-o", "b", "-f", "a"])), Ok(Some(opts(Some("a"), Some("b")))));
        assert_eq!(parse(&args(&["--help"])), Ok(None));
        assert!(parse(&args(&["-f"])).is_err());
        assert!(parse(&args(&["test.txt"])).is_err());
    }

    #[test]
    fn names_come_from_o_then_the_file_then_a_default() {
        assert_eq!(download_name(&opts(Some("/root/util/nvim.sh"), None)), "nvim.sh");
        assert_eq!(download_name(&opts(Some("a.txt"), Some("b.txt"))), "b.txt");
        assert_eq!(download_name(&opts(None, None)), "download.txt");
        assert_eq!(download_name(&opts(None, Some("../x/\x1b[31my.txt"))), "x[31my.txt");
        assert_eq!(download_name(&opts(None, Some(".bashrc"))), "bashrc");
        assert_eq!(download_name(&opts(None, Some("//"))), "download.txt");
        assert_eq!(download_name(&opts(None, Some(".."))), "download.txt");
    }
}
