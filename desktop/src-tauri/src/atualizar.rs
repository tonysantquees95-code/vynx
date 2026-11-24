// Atualização do Vynx por dentro: baixa o instalador novo (com progresso), confere o arquivo e abre o instalador.
// Só usa curl.exe e certutil.exe do Windows, sempre com argumentos separados (nunca por shell).
use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

#[derive(Serialize, Default, Clone, Debug)]
pub struct EstadoAtualizacao {
    pub ativo: bool,
    pub baixado: u64,
    pub total: u64,
    pub pronto: bool,
    pub erro: Option<String>,
}

static ESTADO: Mutex<Option<EstadoAtualizacao>> = Mutex::new(None);

pub fn estado() -> EstadoAtualizacao { ESTADO.lock().ok().and_then(|g| g.clone()).unwrap_or_default() }
fn mudar(f: impl FnOnce(&mut EstadoAtualizacao)) { if let Ok(mut g) = ESTADO.lock() { f(g.get_or_insert_with(Default::default)); } }

// ---------- validações e contas (puras, testadas) ----------
/// Só o instalador do Vynx publicado nas releases do repositório da conta (o download segue o redirecionamento do GitHub).
pub fn url_valida(u: &str) -> bool {
    u.starts_with("https://github.com/tonysantquees95-code/vynx/releases/download/") && u.ends_with("/VynxSetup.exe")
        && !u.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '^' | '&' | '|' | '<' | '>' | '%'))
}
pub fn sha_valido(s: &str) -> bool { s.is_empty() || (s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())) }
/// O hash que o `certutil -hashfile` imprime: a segunda linha, sem espaços.
pub fn hash_do_certutil(saida: &str) -> Option<String> {
    let h: String = saida.lines().nth(1)?.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();
    (h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit())).then_some(h)
}
pub fn pasta() -> PathBuf { std::env::temp_dir().join("VynxAtualizacao") }
pub fn arquivo() -> PathBuf { pasta().join("VynxSetup.exe") }

fn sem_janela(c: &mut Command) -> &mut Command {
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    c
}

/// Baixa o instalador, mostrando quanto já veio, e confere o arquivo (tamanho e hash, quando o servidor informou).
pub fn baixar(url: String, tamanho: u64, sha256: String) -> Result<(), String> {
    if !url_valida(&url) { return Err("Endereço de atualização não aceito".into()); }
    if !sha_valido(&sha256) { return Err("Dados da atualização inválidos".into()); }
    {
        let mut g = ESTADO.lock().map_err(|_| "Estado interno bloqueado".to_string())?;
        if g.as_ref().map(|e| e.ativo).unwrap_or(false) { return Err("A atualização já está sendo baixada".into()); }
        *g = Some(EstadoAtualizacao { ativo: true, total: tamanho, ..Default::default() });
    }
    std::thread::spawn(move || {
        let r = baixar_e_conferir(&url, tamanho, &sha256);
        mudar(|e| { e.ativo = false; match r { Ok(()) => e.pronto = true, Err(m) => e.erro = Some(m) } });
    });
    Ok(())
}

fn baixar_e_conferir(url: &str, tamanho: u64, sha256: &str) -> Result<(), String> {
    let dest = arquivo();
    let _ = std::fs::remove_dir_all(pasta());
    std::fs::create_dir_all(pasta()).map_err(|e| e.to_string())?;
    let mut c = Command::new("curl.exe");
    c.args(["-L", "--fail", "--silent", "--show-error", "--retry", "3", "-o"]).arg(&dest).arg(url).stderr(Stdio::piped());
    let mut filho = sem_janela(&mut c).spawn().map_err(|e| format!("Não consegui baixar: {e}"))?;
    loop {
        match filho.try_wait().map_err(|e| e.to_string())? {
            Some(s) => {
                if !s.success() {
                    let _ = std::fs::remove_dir_all(pasta());
                    return Err("O download falhou. Verifique a internet e tente de novo.".into());
                }
                break;
            }
            None => {
                let atual = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
                mudar(|e| e.baixado = atual);
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        }
    }
    let final_ = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    mudar(|e| e.baixado = final_);
    if final_ < 1_000_000 || (tamanho > 0 && final_ != tamanho) {
        let _ = std::fs::remove_dir_all(pasta());
        return Err("O arquivo baixado veio incompleto. Tente de novo.".into());
    }
    if !sha256.is_empty() {
        let mut h = Command::new("certutil.exe");
        h.args(["-hashfile"]).arg(&dest).arg("SHA256");
        let saida = sem_janela(&mut h).output().map_err(|e| format!("Não consegui conferir o arquivo: {e}"))?;
        let obtido = hash_do_certutil(&String::from_utf8_lossy(&saida.stdout)).ok_or("Não consegui conferir o arquivo")?;
        if obtido != sha256.to_lowercase() {
            let _ = std::fs::remove_dir_all(pasta());
            return Err("O arquivo baixado não confere com o publicado. Ele foi apagado; tente de novo.".into());
        }
    }
    Ok(())
}

/// Abre o instalador já baixado (e conferido). O app fecha em seguida para o instalador poder trocar os arquivos.
pub fn abrir_instalador() -> Result<(), String> {
    if !estado().pronto || !arquivo().exists() { return Err("Baixe a atualização primeiro".into()); }
    Command::new(arquivo()).spawn().map(|_| ()).map_err(|e| format!("Não consegui abrir o instalador: {e}"))
}

#[cfg(test)]
mod testes {
    use super::*;
    #[test]
    fn so_aceita_o_instalador_do_vynx_nas_releases_da_conta() {
        assert!(url_valida("https://github.com/tonysantquees95-code/vynx/releases/download/1.12/VynxSetup.exe"));
        assert!(!url_valida("https://github.com/tonysantquees95-code/outro/releases/download/1.12/VynxSetup.exe"));
        assert!(!url_valida("https://exemplo.com/tonysantquees95-code/vynx/releases/download/1.12/VynxSetup.exe"));
        assert!(!url_valida("https://github.com/tonysantquees95-code/vynx/releases/download/1.12/Outro.exe"));
        assert!(!url_valida("https://github.com/tonysantquees95-code/vynx/releases/download/1.12/VynxSetup.exe&calc"));
        assert!(!url_valida("http://github.com/tonysantquees95-code/vynx/releases/download/1.12/VynxSetup.exe"));
    }
    #[test]
    fn hash_do_certutil_pega_a_segunda_linha() {
        let h = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
        let saida = format!("SHA256 hash of C:\\x\\VynxSetup.exe:\r\n{}\r\nCertUtil: -hashfile command completed successfully.\r\n", h.to_uppercase());
        assert_eq!(hash_do_certutil(&saida).as_deref(), Some(h));
        assert!(hash_do_certutil("erro").is_none());
        assert!(hash_do_certutil("x\r\nabc\r\n").is_none());
    }
    #[test]
    fn sha_vazio_ou_de_64_digitos() {
        assert!(sha_valido("")); assert!(sha_valido(&"a".repeat(64)));
        assert!(!sha_valido("xyz")); assert!(!sha_valido(&"g".repeat(64)));
    }
}
