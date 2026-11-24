// Vynx OS (Windows): laboratórios Linux descartáveis em cima do WSL2.
// Tudo passa por `wsl.exe` com argumentos separados (nunca por shell) e nomes validados.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod android;
mod atualizar;

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

/// Instala o Claude Code dentro do laboratório (numa janela de terminal, para a pessoa ver o andamento).
/// O texto é fixo e sem caracteres especiais do cmd (nada de & | < > ^ aspas), só o nome do laboratório vem de fora e é validado.
const INSTALAR_CLAUDE: &str = "set -e; apt-get update -y; apt-get install -y curl ca-certificates nodejs npm git; npm install -g @anthropic-ai/claude-code; echo; echo Pronto. Agora digite claude e entre com a sua conta; exec bash -l";

#[tauri::command]
fn instalar_claude(nome: String) -> Result<(), String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let completo = format!("{PREFIXO}{nome}");
    Command::new("cmd").args(["/C", "start", "", "wsl.exe", "-d", &completo, "-u", "root", "--", "bash", "-lc", INSTALAR_CLAUDE]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Clona os repositórios do GitHub dentro do laboratório e monta o arquivo de contexto para o Claude.
/// O token vai pela entrada padrão (nunca na linha de comando) e não fica guardado no .git.
const IMPORTAR_PROJETOS: &str = include_str!("importar.sh");

#[tauri::command]
async fn importar_projetos(nome: String, token: String) -> Result<String, String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let t = token.trim().to_string();
    if t.len() < 20 || t.len() > 255 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') { return Err("Token do GitHub inválido. Conecte o GitHub no Painel Dev.".into()); }
    let completo = format!("{PREFIXO}{nome}");
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let mut c = Command::new("wsl.exe");
        c.args(["-d", &completo, "-u", "root", "--", "bash", "-c", "read -r GH_TOKEN; export GH_TOKEN; cat > /tmp/vynx-importar.sh; bash /tmp/vynx-importar.sh < /dev/null; R=$?; rm -f /tmp/vynx-importar.sh; exit $R"]);
        c.stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
        let mut filho = c.spawn().map_err(|e| format!("Não consegui falar com o laboratório: {e}"))?;
        if let Some(mut e) = filho.stdin.take() { let _ = e.write_all(format!("{t}\n{IMPORTAR_PROJETOS}\n").as_bytes()); }
        let s = filho.wait_with_output().map_err(|e| e.to_string())?;
        let fim = |b: &[u8]| { let x = String::from_utf8_lossy(b).replace('\0', ""); let l: Vec<&str> = x.lines().filter(|l| !l.trim().is_empty()).collect(); l[l.len().saturating_sub(3)..].join(" ") };
        if s.status.success() { Ok(fim(&s.stdout)) } else { Err(format!("Não consegui importar. {}", fim(&s.stderr).chars().take(300).collect::<String>())) }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn abrir_link(url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '^' | '&' | '|' | '<' | '>')) { return Err("Só abro links https".into()); }
    Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// ---------- Emulador de Android ----------
#[tauri::command]
async fn android_estado() -> Result<android::EstadoAndroid, String> {
    tauri::async_runtime::spawn_blocking(android::estado).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn android_progresso() -> android::Progresso { android::progresso() }
#[tauri::command]
fn android_preparar(aceitou_licenca: bool) -> Result<(), String> {
    if !aceitou_licenca { return Err("Aceite a licença do Android SDK para continuar".into()); }
    android::tarefa("preparar", android::preparar)
}
#[tauri::command]
async fn android_criar(perfil: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || android::criar_celular(&perfil)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn android_ligar(nome: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || android::ligar(&nome)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn android_desligar() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(android::desligar).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn android_instalar(url: String, pacote: String, token: Option<String>) -> Result<(), String> {
    android::tarefa("instalar", move || android::instalar(&url, &pacote, token.as_deref()))
}
#[tauri::command]
async fn android_captura() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(android::capturar).await.map_err(|e| e.to_string())?
}

// ---------- Atualização por dentro ----------
#[tauri::command]
fn atualizar_baixar(url: String, tamanho: u64, sha256: String) -> Result<(), String> { atualizar::baixar(url, tamanho, sha256) }
#[tauri::command]
fn atualizar_progresso() -> atualizar::EstadoAtualizacao { atualizar::estado() }
#[tauri::command]
fn atualizar_instalar(app: tauri::AppHandle) -> Result<(), String> {
    atualizar::abrir_instalador()?;
    std::thread::spawn(move || { std::thread::sleep(std::time::Duration::from_millis(900)); app.exit(0); });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![estado_wsl, criar_laboratorio, descartar_laboratorio, abrir_terminal, instalar_claude, importar_projetos, abrir_link, android_estado, android_progresso, android_preparar, android_criar, android_ligar, android_desligar, android_instalar, android_captura, atualizar_baixar, atualizar_progresso, atualizar_instalar])
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Vynx OS");
}

#[cfg(test)]
mod testes {
    #[test]
    fn importador_nao_guarda_token_no_repositorio() {
        assert!(super::IMPORTAR_PROJETOS.contains("http.extraheader"));
        assert!(super::IMPORTAR_PROJETOS.contains("remote set-url origin"));
        assert!(!super::IMPORTAR_PROJETOS.contains("x-access-token:@"));
    }

    #[test]
    fn texto_do_claude_nao_tem_caractere_especial_do_cmd() {
        assert!(!super::INSTALAR_CLAUDE.chars().any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"' | '%')));
        assert!(super::INSTALAR_CLAUDE.contains("@anthropic-ai/claude-code"));
    }

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
