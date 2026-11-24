// Terminal do laboratório dentro de uma janela do Vynx.
// Fala só com o Linux do laboratório (wsl.exe -d vynx-lab-<nome>, argumentos separados, nunca shell do Windows).
// O Linux ganha um terminal de verdade por `script` (pty dentro do laboratório); a tela é o xterm.js.
use std::io::{Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

struct Sessao { filho: Child, entrada: ChildStdin }
static SESSAO: Mutex<Option<Sessao>> = Mutex::new(None);

/// Limites do tamanho do terminal (colunas x linhas).
pub fn tamanho_valido(colunas: u16, linhas: u16) -> bool { (20..=400).contains(&colunas) && (5..=200).contains(&linhas) }

/// A primeira linha enviada ao Linux: tamanho, tipo do terminal, pasta dos projetos e limpa a tela. Só números entram do lado de fora.
pub fn linha_de_partida(colunas: u16, linhas: u16) -> String {
    format!("stty cols {colunas} rows {linhas}; export TERM=xterm-256color; cd /root/projetos 2>/dev/null; clear\n")
}

pub fn fechar() {
    if let Ok(mut g) = SESSAO.lock() {
        if let Some(mut s) = g.take() { let _ = s.filho.kill(); let _ = s.filho.wait(); }
    }
}

pub fn abrir(app: AppHandle, completo: String, colunas: u16, linhas: u16) -> Result<(), String> {
    if !tamanho_valido(colunas, linhas) { return Err("Tamanho de terminal inválido".into()); }
    fechar();
    let mut c = Command::new("wsl.exe");
    // `script` dá um terminal de verdade (pty) ao bash do laboratório; nenhum argumento tem espaço, então nada é reinterpretado.
    c.args(["-d", &completo, "-u", "root", "--", "script", "-qf", "/dev/null"]);
    c.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    let mut filho = c.spawn().map_err(|e| format!("Não consegui abrir o terminal: {e}"))?;
    let mut entrada = filho.stdin.take().ok_or("Terminal sem entrada")?;
    let saida = filho.stdout.take().ok_or("Terminal sem saída")?;
    let erro = filho.stderr.take().ok_or("Terminal sem saída de erro")?;
    entrada.write_all(linha_de_partida(colunas, linhas).as_bytes()).map_err(|e| e.to_string())?;
    let _ = entrada.flush();
    if let Ok(mut g) = SESSAO.lock() { *g = Some(Sessao { filho, entrada }); }
    for mut fonte in [Box::new(saida) as Box<dyn Read + Send>, Box::new(erro)] {
        let app = app.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match fonte.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => { let _ = app.emit("terminal-saida", buf[..n].to_vec()); }
                }
            }
            let _ = app.emit("terminal-fim", ());
        });
    }
    Ok(())
}

pub fn escrever(dados: &str) -> Result<(), String> {
    if dados.len() > 65_536 { return Err("Texto grande demais".into()); }
    let mut g = SESSAO.lock().map_err(|_| "Terminal ocupado".to_string())?;
    let s = g.as_mut().ok_or("O terminal não está aberto")?;
    s.entrada.write_all(dados.as_bytes()).map_err(|e| e.to_string())?;
    s.entrada.flush().map_err(|e| e.to_string())
}

#[cfg(test)]
mod testes {
    use super::*;
    #[test]
    fn tamanho_dentro_dos_limites() {
        assert!(tamanho_valido(80, 24)); assert!(tamanho_valido(400, 200));
        assert!(!tamanho_valido(10, 24)); assert!(!tamanho_valido(80, 2)); assert!(!tamanho_valido(500, 24));
    }
    #[test]
    fn linha_de_partida_so_tem_numeros_do_lado_de_fora() {
        let l = linha_de_partida(120, 30);
        assert!(l.starts_with("stty cols 120 rows 30;")); assert!(l.ends_with("clear\n"));
        assert_eq!(l.matches('\n').count(), 1);
    }
}
