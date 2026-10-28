use blog::{read_frame, write_frame, DOWNLOAD, NOWPLAYING, RESIZE};
use std::ffi::{c_char, c_ulong, CString};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::os::fd::AsRawFd;
use std::os::unix::fs::OpenOptionsExt;
use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

const DOWNLOADS: &str = "/dev/browser/downloads";
const NOWPLAYING_PIPE: &str = "/dev/browser/nowplaying";
const CONSOLE: &str = "/dev/hvc0";
const TERMINAL: &str = "/dev/ttyS0";
const REPLY_TIMEOUT: Duration = Duration::from_secs(30);
const POLL: Duration = Duration::from_millis(200);
const TIOCSWINSZ: c_ulong = 0x5414;
const O_NOCTTY: i32 = 0o400;

extern "C" {
    fn mkfifo(path: *const c_char, mode: u32) -> i32;
    fn ioctl(fd: i32, request: c_ulong, ...) -> i32;
    fn tcgetattr(fd: i32, termios: *mut u8) -> i32;
    fn tcsetattr(fd: i32, when: i32, termios: *const u8) -> i32;
    fn cfmakeraw(termios: *mut u8);
}

fn main() {
    fs::create_dir_all(DOWNLOADS).expect(DOWNLOADS);
    let pipe = CString::new(NOWPLAYING_PIPE).unwrap();
    unsafe { mkfifo(pipe.as_ptr(), 0o666) };
    let console = OpenOptions::new().read(true).write(true).custom_flags(O_NOCTTY).open(CONSOLE).expect(CONSOLE);
    make_raw(&console);
    let to_page = Arc::new(Mutex::new(console.try_clone().unwrap()));

    let (replies, reply) = mpsc::channel();
    thread::spawn(move || {
        let mut console = console;
        while let Ok((kind, _, data)) = read_frame(&mut console) {
            match kind {
                NOWPLAYING => {
                    let _ = replies.send(data);
                }
                RESIZE if data.len() == 4 => {
                    set_size(u16::from_le_bytes([data[0], data[1]]), u16::from_le_bytes([data[2], data[3]]))
                }
                _ => {}
            }
        }
    });

    let page = to_page.clone();
    thread::spawn(move || loop {
        let Ok(mut reader) = OpenOptions::new().write(true).open(NOWPLAYING_PIPE) else {
            thread::sleep(Duration::from_secs(1));
            continue;
        };
        while reply.try_recv().is_ok() {}
        let _ = write_frame(&mut *page.lock().unwrap(), NOWPLAYING, "", &[]);
        let answer = reply.recv_timeout(REPLY_TIMEOUT).unwrap_or_else(|_| b"no answer from the browser\n".to_vec());
        let _ = reader.write_all(&answer);
        drop(reader);
        while open_anywhere(Path::new(NOWPLAYING_PIPE)) {
            thread::sleep(POLL);
        }
    });

    watch_downloads(&to_page);
}

fn watch_downloads(page: &Mutex<File>) {
    loop {
        for file in fs::read_dir(DOWNLOADS).into_iter().flatten().flatten() {
            let name = file.file_name().to_string_lossy().into_owned();
            if !name.starts_with('.') && !open_anywhere(&file.path()) {
                send_download(page, &name);
            }
        }
        thread::sleep(POLL);
    }
}

fn open_anywhere(path: &Path) -> bool {
    let processes = fs::read_dir("/proc").into_iter().flatten().flatten();
    processes.filter(|p| p.file_name().to_string_lossy().bytes().all(|b| b.is_ascii_digit())).any(|process| {
        let fds = fs::read_dir(process.path().join("fd")).into_iter().flatten().flatten();
        fds.filter_map(|fd| fs::read_link(fd.path()).ok()).any(|target| target == path)
    })
}

fn send_download(page: &Mutex<File>, name: &str) {
    let path = format!("{DOWNLOADS}/{name}");
    if let Ok(data) = fs::read(&path) {
        let _ = write_frame(&mut *page.lock().unwrap(), DOWNLOAD, name, &data);
        let _ = fs::remove_file(&path);
    }
}

fn make_raw(tty: &File) {
    let mut termios = [0u8; 256];
    unsafe {
        assert_eq!(tcgetattr(tty.as_raw_fd(), termios.as_mut_ptr()), 0, "tcgetattr {CONSOLE}");
        cfmakeraw(termios.as_mut_ptr());
        assert_eq!(tcsetattr(tty.as_raw_fd(), 0, termios.as_ptr()), 0, "tcsetattr {CONSOLE}");
    }
}

fn set_size(rows: u16, cols: u16) {
    let Ok(tty) = OpenOptions::new().read(true).write(true).custom_flags(O_NOCTTY).open(TERMINAL) else { return };
    let size = [rows, cols, 0, 0];
    unsafe { ioctl(tty.as_raw_fd(), TIOCSWINSZ, size.as_ptr()) };
}
