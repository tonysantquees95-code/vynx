// Vynx OS (Windows): laboratórios Linux descartáveis em cima do WSL2.
// Tudo passa por `wsl.exe` com argumentos separados (nunca por shell) e nomes validados.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

const PREFIXO: &str = "vynx-lab-";
const WSL_CONF_ISOLADO: &str = "[automount]\nenabled=false\n[interop]\nenabled=false\nappendWindowsPath=false\n";

#[derive(Serialize, Debug, PartialEq)]
struct Distro { nome: String, estado: String, versao: u32 }

#[derive(Serialize)]
struct EstadoWsl { instalado: bool, virtualizacao: Option<bool>, distros: Vec<Distro> }

/// Nome do laboratório: minúsculas, números e hífen (até 24).
fn nome_valido(n: &str) -> bool {
    let b = n.as_bytes();
    !b.is_empty() && b.len() <= 24
        && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit())
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

/// Nome de uma distribuição já instalada (a base): letras, números, ponto, hífen, sublinhado.
fn base_valida(n: &str) -> bool {
    !n.is_empty() && n.len() <= 64 && n.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

/// O `wsl.exe` escreve em UTF-16 little-endian.
fn decodificar(bytes: &[u8]) -> String {
    let u: Vec<u16> = bytes.chunks_exact(2).map(|p| u16::from_le_bytes([p[0], p[1]])).collect();
    String::from_utf16_lossy(&u).replace('\u{feff}', "")
}

fn ler_lista(txt: &str) -> Vec<Distro> {
    txt.lines().skip(1).filter_map(|l| {
        let l = l.trim_start_matches('*').trim();
        let mut c = l.split_whitespace();
        let (nome, estado, versao) = (c.next()?, c.next()?, c.next()?.parse().ok()?);
        Some(Distro { nome: nome.to_string(), estado: estado.to_string(), versao })
    }).collect()
}

fn wsl() -> Command {
    let mut c = Command::new("wsl.exe");
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); } // sem janela preta
    c
}

fn lista() -> Option<Vec<Distro>> {
    let s = wsl().args(["--list", "--verbose"]).output().ok()?;
    if !s.status.success() { return None; }
    Some(ler_lista(&decodificar(&s.stdout)))
}

fn rodar(c: &mut Command, erro: &str) -> Result<(), String> {
    let s = c.output().map_err(|e| format!("{erro}: {e}"))?;
    if s.status.success() { Ok(()) } else { Err(format!("{erro} ({})", decodificar(&s.stderr).trim())) }
}

#[tauri::command]
async fn estado_wsl() -> EstadoWsl {
    tauri::async_runtime::spawn_blocking(|| match lista() {
        Some(distros) => EstadoWsl { instalado: true, virtualizacao: Some(true), distros },
        None => EstadoWsl { instalado: false, virtualizacao: None, distros: vec![] },
    }).await.unwrap_or(EstadoWsl { instalado: false, virtualizacao: None, distros: vec![] })
}

fn pasta_dos_labs() -> Result<PathBuf, String> {
    let base = std::env::var("LOCALAPPDATA").map_err(|_| "Não achei a pasta de dados do Windows".to_string())?;
    Ok(PathBuf::from(base).join("VynxOS").join("labs"))
}

fn criar(base: &str, nome: &str) -> Result<(), String> {
    if !base_valida(base) { return Err("Base inválida".into()); }
    if !nome_valido(nome) { return Err("Nome inválido: use minúsculas, números e hífen".into()); }
    let completo = format!("{PREFIXO}{nome}");
    let existentes = lista().ok_or("O WSL2 não está disponível")?;
    if existentes.iter().any(|d| d.nome == completo) { return Err("Já existe um laboratório com esse nome".into()); }
    if !existentes.iter().any(|d| d.nome == base) { return Err("A base escolhida não existe mais".into()); }
    let pasta = pasta_dos_labs()?;
    let destino = pasta.join(nome);
    std::fs::create_dir_all(&destino).map_err(|e| format!("Não consegui criar a pasta do laboratório: {e}"))?;
    let tar = pasta.join(format!("{nome}.tar"));
    let feito = (|| {
        rodar(wsl().arg("--export").arg(base).arg(&tar), "Não consegui copiar a base")?;
        rodar(wsl().arg("--import").arg(&completo).arg(&destino).arg(&tar).args(["--version", "2"]), "Não consegui criar o laboratório")?;
        // isolamento: sem os discos do Windows e sem rodar programas do Windows
        let mut f = wsl().args(["-d", &completo, "-u", "root", "--", "sh", "-c", "cat > /etc/wsl.conf"])
            .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
            .map_err(|e| format!("Não consegui isolar o laboratório: {e}"))?;
        f.stdin.take().ok_or("Sem entrada")?.write_all(WSL_CONF_ISOLADO.as_bytes()).map_err(|e| e.to_string())?;
        if !f.wait().map_err(|e| e.to_string())?.success() { return Err("Não consegui gravar o isolamento".to_string()); }
        rodar(wsl().args(["--terminate", &completo]), "Não consegui reiniciar o laboratório")
    })();
    let _ = std::fs::remove_file(&tar);
    if feito.is_err() { // não deixa um laboratório pela metade
        let _ = wsl().args(["--unregister", &completo]).output();
        let _ = std::fs::remove_dir_all(&destino);
    }
    feito
}

#[tauri::command]
async fn criar_laboratorio(base: String, nome: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || criar(&base, &nome)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn descartar_laboratorio(nome: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !nome_valido(&nome) { return Err("Nome inválido".to_string()); }
        let completo = format!("{PREFIXO}{nome}");
        // só descarta o que o Vynx criou
        if !lista().ok_or("O WSL2 não está disponível")?.iter().any(|d| d.nome == completo) { return Err("Esse laboratório não existe".into()); }
        rodar(wsl().args(["--unregister", &completo]), "Não consegui descartar")?;
        let _ = pasta_dos_labs().map(|p| std::fs::remove_dir_all(p.join(&nome)));
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn abrir_terminal(nome: String) -> Result<(), String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let completo = format!("{PREFIXO}{nome}");
    Command::new("cmd").args(["/C", "start", "", "wsl.exe", "-d", &completo]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn abrir_link(url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '^' | '&' | '|' | '<' | '>')) { return Err("Só abro links https".into()); }
    Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![estado_wsl, criar_laboratorio, descartar_laboratorio, abrir_terminal, abrir_link])
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Vynx OS");
}

#[cfg(test)]
mod testes {
    use super::*;
    #[test] fn nomes() {
        assert!(nome_valido("teste-1") && !nome_valido("Teste") && !nome_valido("a b") && !nome_valido("-x") && !nome_valido(""));
        assert!(!nome_valido(&"a".repeat(25)));
        assert!(base_valida("Ubuntu-22.04") && !base_valida("a;b") && !base_valida("a b"));
    }
    #[test] fn lista_do_wsl() {
        let t = "  NAME            STATE           VERSION\r\n* Ubuntu          Running         2\r\n  vynx-lab-um     Stopped         2\r\n";
        let d = ler_lista(t);
        assert_eq!(d.len(), 2);
        assert_eq!(d[1], Distro { nome: "vynx-lab-um".into(), estado: "Stopped".into(), versao: 2 });
    }
    #[test] fn utf16() {
        let b: Vec<u8> = "oi".encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        assert_eq!(decodificar(&b), "oi");
    }
}
