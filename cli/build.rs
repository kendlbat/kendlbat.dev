use std::{env, fs, path::Path, path::PathBuf};

fn main() {
    let content = Path::new(env!("CARGO_MANIFEST_DIR")).join("content");
    println!("cargo:rerun-if-changed={}", content.display());

    let mut out = String::from("pub static FILES: &[(&str, &[u8])] = &[\n");
    for file in walk(&content) {
        let vm_path = file.strip_prefix(&content).unwrap().to_str().unwrap();
        out += &format!("({vm_path:?}, include_bytes!({:?})),\n", file.to_str().unwrap());
    }
    out += "];\n";
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("files.rs"), out).unwrap();
}

fn walk(dir: &Path) -> Vec<PathBuf> {
    let mut entries: Vec<_> = fs::read_dir(dir).unwrap().map(|e| e.unwrap().path()).collect();
    entries.sort();
    entries.into_iter().flat_map(|p| if p.is_dir() { walk(&p) } else { vec![p] }).collect()
}
