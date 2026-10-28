use std::io::{self, Read, Write};

pub fn base64(data: &[u8]) -> String {
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

pub const DOWNLOAD: u8 = 1;
pub const NOWPLAYING: u8 = 2;
pub const RESIZE: u8 = 3;

pub fn write_frame(out: &mut impl Write, kind: u8, name: &str, data: &[u8]) -> io::Result<()> {
    let mut frame = Vec::with_capacity(9 + name.len() + data.len());
    frame.push(kind);
    frame.extend((name.len() as u32).to_le_bytes());
    frame.extend(name.as_bytes());
    frame.extend((data.len() as u32).to_le_bytes());
    frame.extend(data);
    out.write_all(&frame)?;
    out.flush()
}

pub fn read_frame(input: &mut impl Read) -> io::Result<(u8, String, Vec<u8>)> {
    let mut kind = [0];
    input.read_exact(&mut kind)?;
    let mut field = || -> io::Result<Vec<u8>> {
        let mut len = [0; 4];
        input.read_exact(&mut len)?;
        let mut bytes = vec![0; u32::from_le_bytes(len) as usize];
        input.read_exact(&mut bytes)?;
        Ok(bytes)
    };
    let name = String::from_utf8_lossy(&field()?).into_owned();
    Ok((kind[0], name, field()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip() {
        let mut stream = Vec::new();
        write_frame(&mut stream, DOWNLOAD, "notes.txt", b"hi\n").unwrap();
        write_frame(&mut stream, NOWPLAYING, "", &[]).unwrap();
        assert_eq!(&stream[..5], &[1, 9, 0, 0, 0]);
        let mut input = &stream[..];
        assert_eq!(read_frame(&mut input).unwrap(), (DOWNLOAD, "notes.txt".into(), b"hi\n".to_vec()));
        assert_eq!(read_frame(&mut input).unwrap(), (NOWPLAYING, String::new(), vec![]));
        assert!(read_frame(&mut input).is_err());
    }

    #[test]
    fn base64_matches_rfc4648() {
        for (input, expected) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foobar", "Zm9vYmFy")] {
            assert_eq!(base64(input.as_bytes()), expected);
        }
    }
}
