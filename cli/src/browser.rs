use super::{download, nowplaying, V86};
use js_sys::Uint8Array;

const DOWNLOAD: u8 = 1;
const NOWPLAYING: u8 = 2;
const RESIZE: u8 = 3;

pub fn send_size(emulator: &V86, rows: u32, cols: u32) {
    let size = [(rows as u16).to_le_bytes(), (cols as u16).to_le_bytes()].concat();
    send(emulator, &frame(RESIZE, "", &size));
}

fn send(emulator: &V86, frame: &[u8]) {
    emulator.bus().send("virtio-console0-input-bytes", &Uint8Array::from(frame));
}

pub fn on_bytes(emulator: &'static V86, inbox: &mut Vec<u8>, chunk: &[u8]) {
    inbox.extend_from_slice(chunk);
    while let Some((kind, name, data, used)) = parse_frame(inbox) {
        inbox.drain(..used);
        match kind {
            DOWNLOAD => download::save(&name, &data),
            NOWPLAYING => wasm_bindgen_futures::spawn_local(async move {
                let card = nowplaying::card().await;
                send(emulator, &frame(NOWPLAYING, "", card.as_bytes()));
            }),
            _ => {}
        }
    }
}

fn frame(kind: u8, name: &str, data: &[u8]) -> Vec<u8> {
    let mut out = vec![kind];
    out.extend((name.len() as u32).to_le_bytes());
    out.extend(name.as_bytes());
    out.extend((data.len() as u32).to_le_bytes());
    out.extend(data);
    out
}

fn parse_frame(buffer: &[u8]) -> Option<(u8, String, Vec<u8>, usize)> {
    let field = |at: usize| -> Option<(&[u8], usize)> {
        let len = u32::from_le_bytes(buffer.get(at..at + 4)?.try_into().ok()?) as usize;
        Some((buffer.get(at + 4..at + 4 + len)?, at + 4 + len))
    };
    let kind = *buffer.first()?;
    let (name, next) = field(1)?;
    let (data, end) = field(next)?;
    Some((kind, String::from_utf8_lossy(name).into_owned(), data.to_vec(), end))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip_and_wait_for_the_rest() {
        let mut stream = frame(DOWNLOAD, "notes.txt", b"hi\n");
        stream.extend(frame(NOWPLAYING, "", &[]));
        let (kind, name, data, used) = parse_frame(&stream).unwrap();
        assert_eq!((kind, name.as_str(), &data[..]), (DOWNLOAD, "notes.txt", &b"hi\n"[..]));
        assert_eq!(parse_frame(&stream[used..]).map(|f| (f.0, f.3)), Some((NOWPLAYING, 9)));
        for cut in 0..used {
            assert!(parse_frame(&stream[..cut]).is_none(), "{cut}");
        }
    }
}
