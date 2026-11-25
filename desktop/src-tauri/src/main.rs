// Vynx OS (Windows): laboratórios Linux descartáveis em cima do WSL2.
// Tudo passa por `wsl.exe` com argumentos separados (nunca por shell) e nomes validados.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod android;
mod atualizar;
mod ldplayer;
mod metricas;
mod terminal;

use serde::Serialize;
use tauri::{Emitter, Manager};
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

/// Instala o Claude Code dentro do laboratório com o instalador oficial (sem Node nem npm: o npm do Ubuntu puxava 200+ pacotes) (numa janela de terminal, para a pessoa ver o andamento).
/// O texto é fixo e sem caracteres especiais do cmd (nada de & | < > ^ aspas), só o nome do laboratório vem de fora e é validado.
const INSTALAR_CLAUDE: &str = "set -e; apt-get update -y; apt-get install -y curl ca-certificates git; curl -fsSL https://claude.ai/install.sh -o /tmp/claude-instalar.sh; bash /tmp/claude-instalar.sh; ln -sf $HOME/.local/bin/claude /usr/local/bin/claude; echo; echo Pronto. Agora digite claude e entre com a sua conta; exec bash -l";

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
async fn importar_projetos(app: tauri::AppHandle, nome: String, token: String) -> Result<String, String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let t = token.trim().to_string();
    if t.len() < 20 || t.len() > 255 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') { return Err("Token do GitHub inválido. Conecte o GitHub no Painel Dev.".into()); }
    let completo = format!("{PREFIXO}{nome}");
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let _ = app.emit("importar-linha", "Ligando o laboratório (na primeira vez, num computador lento, pode levar um minuto)…");
        let mut c = Command::new("wsl.exe");
        c.args(["-d", &completo, "-u", "root", "--", "bash", "-c", "read -r GH_TOKEN; export GH_TOKEN; cat > /tmp/vynx-importar.sh; bash /tmp/vynx-importar.sh < /dev/null; R=$?; rm -f /tmp/vynx-importar.sh; exit $R"]);
        c.stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
        let mut filho = c.spawn().map_err(|e| format!("Não consegui falar com o laboratório: {e}"))?;
        if let Some(mut e) = filho.stdin.take() { let _ = e.write_all(format!("{t}\n{IMPORTAR_PROJETOS}\n").as_bytes()); }
        // cada linha do script vai para a tela na hora (evento "importar-linha"), para a pessoa ver o andamento
        let saida = filho.stdout.take();
        let erro = filho.stderr.take();
        let lidas = std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let mut v: Vec<String> = Vec::new();
            if let Some(o) = saida { for l in BufReader::new(o).lines().map_while(Result::ok) { let l = l.replace('\0', ""); if !l.trim().is_empty() { let _ = app.emit("importar-linha", l.clone()); v.push(l); } } }
            v
        });
        let erros = std::thread::spawn(move || { let mut t = String::new(); if let Some(mut e) = erro { let _ = std::io::Read::read_to_string(&mut e, &mut t); } t.replace('\0', "") });
        let s = filho.wait().map_err(|e| e.to_string())?;
        let linhas = lidas.join().unwrap_or_default();
        let texto_erro = erros.join().unwrap_or_default();
        if s.success() { Ok(linhas.last().cloned().unwrap_or_default()) } else {
            let l: Vec<&str> = texto_erro.lines().filter(|l| !l.trim().is_empty()).collect();
            Err(format!("Não consegui importar. {}", l[l.len().saturating_sub(3)..].join(" ").chars().take(300).collect::<String>()))
        }
    }).await.map_err(|e| e.to_string())?
}

/// Cancela a importação: desliga o laboratório, o que encerra o script que está rodando lá dentro.
#[tauri::command]
async fn importar_cancelar(nome: String) -> Result<(), String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let completo = format!("{PREFIXO}{nome}");
    tauri::async_runtime::spawn_blocking(move || rodar(wsl().args(["--terminate", &completo]), "Não consegui parar a importação")).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn abrir_link(url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '^' | '&' | '|' | '<' | '>')) { return Err("Só abro links https".into()); }
    Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// ---------- Arquivos: ver os projetos importados e abrir a pasta no Windows ----------
/// Nomes de pasta que o `ls` devolveu: só nomes simples (sem barra, sem ponto no começo).
fn nomes_de_projetos(saida: &str) -> Vec<String> {
    saida.lines().map(|l| l.trim()).filter(|l| !l.is_empty() && !l.starts_with('.') && l.len() <= 100 && l.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))).map(String::from).collect()
}
#[tauri::command]
async fn projetos_listar(nome: String) -> Result<Vec<String>, String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let completo = format!("{PREFIXO}{nome}");
        let s = wsl().args(["-d", &completo, "-u", "root", "--", "ls", "-1", "/root/projetos"]).output().map_err(|e| e.to_string())?;
        if !s.status.success() { return Ok(vec![]); }
        Ok(nomes_de_projetos(&String::from_utf8_lossy(&s.stdout)))
    }).await.map_err(|e| e.to_string())?
}
/// Abre `/root/projetos` do laboratório no Explorador do Windows (o WSL mostra os arquivos em \\wsl.localhost\<distro>).
#[tauri::command]
fn pasta_abrir(nome: String) -> Result<(), String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    let caminho = format!("\\\\wsl.localhost\\{PREFIXO}{nome}\\root\\projetos");
    Command::new("explorer.exe").arg(caminho).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// ---------- LDPlayer (emulador leve) ----------
#[tauri::command]
async fn ld_estado() -> ldplayer::EstadoLd { tauri::async_runtime::spawn_blocking(ldplayer::estado).await.unwrap_or_default() }
#[tauri::command]
fn ld_ligar() -> Result<(), String> { android::tarefa("ld-ligar", ldplayer::ligar) }
#[tauri::command]
async fn ld_desligar() -> Result<(), String> { tauri::async_runtime::spawn_blocking(ldplayer::desligar).await.map_err(|e| e.to_string())? }
#[tauri::command]
fn ld_testar(url: String, pacote: String, token: Option<String>) -> Result<(), String> {
    android::tarefa("ld-testar", move || ldplayer::testar(&url, &pacote, token.as_deref()))
}

// ---------- Apps da suíte (abrem como janelas do Windows, ao lado do Vynx) ----------
/// Onde o instalador de cada app coloca o programa (instalação só para o usuário). Só estes dois nomes são aceitos.
fn caminho_externo(id: &str) -> Option<PathBuf> {
    let sub = match id { "vindex" => "Vindex\\Vindex.exe", "velox" => "Velox\\Velox.exe", _ => return None };
    let base = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(base).join("Programs").join(sub))
}
#[tauri::command]
fn externo_instalado(id: String) -> bool { caminho_externo(&id).map(|p| p.exists()).unwrap_or(false) }
#[tauri::command]
fn externo_abrir(id: String) -> Result<(), String> {
    let p = caminho_externo(&id).ok_or("App desconhecido")?;
    if !p.exists() { return Err("Esse app ainda não está instalado".into()); }
    Command::new(p).spawn().map(|_| ()).map_err(|e| format!("Não consegui abrir: {e}"))
}

// ---------- Tela cheia (some a barra de tarefas do Windows) ----------
#[tauri::command]
fn tela_cheia(app: tauri::AppHandle, ativar: bool) -> Result<bool, String> {
    let j = app.get_webview_window("main").ok_or("Janela não encontrada")?;
    j.set_fullscreen(ativar).map_err(|e| e.to_string())?;
    j.is_fullscreen().map_err(|e| e.to_string())
}
#[tauri::command]
fn tela_cheia_estado(app: tauri::AppHandle) -> bool { app.get_webview_window("main").and_then(|j| j.is_fullscreen().ok()).unwrap_or(false) }

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

// ---------- Terminal do laboratório ----------
#[tauri::command]
fn terminal_abrir(app: tauri::AppHandle, nome: String, colunas: u16, linhas: u16) -> Result<(), String> {
    if !nome_valido(&nome) { return Err("Nome inválido".into()); }
    terminal::abrir(app, format!("{PREFIXO}{nome}"), colunas, linhas)
}
#[tauri::command]
fn terminal_escrever(dados: String) -> Result<(), String> { terminal::escrever(&dados) }
#[tauri::command]
fn terminal_fechar() { terminal::fechar() }

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

#[tauri::command]
fn metricas() -> metricas::Metricas { metricas::ler() }

/// Libera memória: encolhe o próprio Vynx e, só se a pessoa pediu, encerra os laboratórios ligados (`wsl --terminate`, só os `vynx-lab-*`).
#[tauri::command]
async fn liberar_ram(encerrar_labs: bool) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let antes = metricas::ler().ram_usada_mb;
        let mut encerrados = 0;
        if encerrar_labs {
            for d in lista().unwrap_or_default() {
                if d.nome.starts_with(PREFIXO) && d.estado == "Running" && rodar(wsl().arg("--terminate").arg(&d.nome), "Não consegui encerrar").is_ok() { encerrados += 1; }
            }
        }
        metricas::encolher();
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let depois = metricas::ler().ram_usada_mb;
        let livre = antes.saturating_sub(depois);
        Ok(format!("{encerrados} laboratório(s) encerrado(s). Memória liberada: {livre} MB."))
    }).await.map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![estado_wsl, criar_laboratorio, descartar_laboratorio, abrir_terminal, instalar_claude, importar_projetos, importar_cancelar, metricas, liberar_ram, ld_estado, ld_ligar, ld_desligar, ld_testar, projetos_listar, pasta_abrir, externo_instalado, externo_abrir, tela_cheia, tela_cheia_estado, abrir_link, android_estado, android_progresso, android_preparar, android_criar, android_ligar, android_desligar, android_instalar, android_captura, atualizar_baixar, atualizar_progresso, atualizar_instalar, terminal_abrir, terminal_escrever, terminal_fechar])
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Vynx OS");
}

#[cfg(test)]
mod testes {
    #[test]
    fn lista_de_projetos_so_aceita_nomes_simples() {
        assert_eq!(super::nomes_de_projetos("vynx\nvindex\n.git\n../x\nbom nome\n\nvenus-core\n"), vec!["vynx", "vindex", "venus-core"]);
    }
    #[test]
    fn so_dois_apps_externos() {
        assert!(super::caminho_externo("vindex").is_some() || std::env::var("LOCALAPPDATA").is_err());
        assert!(super::caminho_externo("cmd").is_none());
        assert!(super::caminho_externo("../x").is_none());
    }
    #[test]
    fn importador_nao_guarda_token_no_repositorio() {
        assert!(super::IMPORTAR_PROJETOS.contains("http.extraheader"));
        assert!(super::IMPORTAR_PROJETOS.contains("remote set-url origin"));
        assert!(!super::IMPORTAR_PROJETOS.contains("x-access-token:@"));
    }

    #[test]
    fn texto_do_claude_nao_tem_caractere_especial_do_cmd() {
        assert!(!super::INSTALAR_CLAUDE.chars().any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"' | '%')));
        assert!(super::INSTALAR_CLAUDE.contains("claude.ai/install.sh"));
        assert!(!super::INSTALAR_CLAUDE.contains("npm"), "npm do Ubuntu baixa mais de 200 pacotes e demora muito");
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
