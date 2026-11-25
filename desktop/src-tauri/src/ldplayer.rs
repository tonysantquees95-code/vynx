// LDPlayer: emulador de Android leve (feito para PC fraco), controlado pelo `ldconsole.exe` que vem com ele.
// O Vynx NÃO instala o LDPlayer (programa de terceiros, com licença própria): só acha, liga, instala APKs e abre apps.
// Sempre com argumentos separados (nunca por shell). Só mexe na instância "Vynx", que ele mesmo cria; as suas instâncias ficam intactas.
use crate::android::{atualizar, baixar_apk, etapa, sem_janela, total_de_passos};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

pub const INSTANCIA: &str = "Vynx";

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Instancia { pub indice: u32, pub nome: String, pub ligada: bool, pub pronta: bool }
#[derive(Serialize, Default, Clone, Debug)]
pub struct EstadoLd { pub instalado: bool, pub caminho: Option<String>, pub instancia: bool, pub ligada: bool, pub pronta: bool }

/// Saída do `ldconsole list2`: `indice,nome,janela,janela2,android_iniciado,pid,pid_vbox` (uma instância por linha).
pub fn ler_lista(txt: &str) -> Vec<Instancia> {
    txt.lines().filter_map(|l| {
        let c: Vec<&str> = l.trim().split(',').collect();
        if c.len() < 7 { return None; }
        let indice = c[0].trim().parse().ok()?;
        let pid: i64 = c[5].trim().parse().unwrap_or(-1);
        Some(Instancia { indice, nome: c[1].trim().to_string(), ligada: pid > 0, pronta: c[4].trim() == "1" })
    }).collect()
}
pub fn minha<'a>(l: &'a [Instancia]) -> Option<&'a Instancia> { l.iter().find(|i| i.nome == INSTANCIA) }

/// Pastas onde o instalador do LDPlayer costuma colocar o programa (versões 9 e 4), em cada disco.
pub fn candidatos(discos: &[char], arquivos_de_programas: &[String]) -> Vec<PathBuf> {
    let mut v = vec![];
    for d in discos { for sub in ["LDPlayer\\LDPlayer9", "LDPlayer\\LDPlayer4.0", "LDPlayer\\LDPlayer"] { v.push(PathBuf::from(format!("{d}:\\{sub}\\ldconsole.exe"))); } }
    for base in arquivos_de_programas { for sub in ["LDPlayer\\LDPlayer9", "LDPlayer\\LDPlayer4.0"] { v.push(PathBuf::from(base).join(sub).join("ldconsole.exe")); } }
    v
}
pub fn achar() -> Option<PathBuf> {
    let pf: Vec<String> = ["ProgramFiles", "ProgramFiles(x86)"].iter().filter_map(|k| std::env::var(k).ok()).collect();
    candidatos(&['C', 'D', 'E', 'F'], &pf).into_iter().find(|p| p.exists())
}

fn console(exe: &PathBuf, args: &[&str]) -> Command { let mut c = Command::new(exe); sem_janela(&mut c); c.args(args); c }
fn saida(exe: &PathBuf, args: &[&str]) -> Result<String, String> {
    let o = console(exe, args).output().map_err(|e| format!("Não consegui falar com o LDPlayer: {e}"))?;
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}
fn lista(exe: &PathBuf) -> Result<Vec<Instancia>, String> { Ok(ler_lista(&saida(exe, &["list2"])?)) }

pub fn estado() -> EstadoLd {
    let Some(exe) = achar() else { return EstadoLd::default() };
    let l = lista(&exe).unwrap_or_default();
    let m = minha(&l);
    EstadoLd { instalado: true, caminho: Some(exe.to_string_lossy().into()), instancia: m.is_some(), ligada: m.map(|i| i.ligada).unwrap_or(false), pronta: m.map(|i| i.pronta).unwrap_or(false) }
}

/// Cria a instância "Vynx" já com configuração leve (2 núcleos, 2 GB, tela 540x960). Se já existe, não mexe.
fn garantir_instancia(exe: &PathBuf) -> Result<u32, String> {
    if let Some(i) = minha(&lista(exe)?) { return Ok(i.indice); }
    etapa("Criando o celular virtual do Vynx no LDPlayer…");
    saida(exe, &["add", "--name", INSTANCIA])?;
    let i = minha(&lista(exe)?).map(|i| i.indice).ok_or("O LDPlayer não criou a instância. Abra o LDPlayer uma vez e tente de novo.")?;
    let _ = saida(exe, &["modify", "--index", &i.to_string(), "--resolution", "540,960,240", "--cpu", "2", "--memory", "2048"]);
    Ok(i)
}

/// Liga a instância e espera o Android terminar de ligar (até 8 minutos), mostrando o tempo.
fn ligar_e_esperar(exe: &PathBuf, indice: u32) -> Result<(), String> {
    let l = lista(exe)?;
    if minha(&l).map(|i| i.pronta).unwrap_or(false) { return Ok(()); }
    if !minha(&l).map(|i| i.ligada).unwrap_or(false) {
        etapa("Ligando o LDPlayer…");
        saida(exe, &["launch", "--index", &indice.to_string()])?;
    }
    etapa("Esperando o Android do LDPlayer ficar pronto…");
    for s in 0..240u32 {
        if minha(&lista(exe)?).map(|i| i.pronta).unwrap_or(false) { std::thread::sleep(std::time::Duration::from_secs(3)); return Ok(()); }
        atualizar(|p| p.detalhe = format!("Ligando… {} s (a primeira vez demora mais)", s * 2));
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
    Err("O LDPlayer não terminou de ligar. Feche o LDPlayer, confira se a virtualização está ligada e tente de novo.".into())
}

pub fn ligar() -> Result<(), String> {
    let exe = achar().ok_or("O LDPlayer não está instalado")?;
    total_de_passos(3);
    let i = garantir_instancia(&exe)?;
    ligar_e_esperar(&exe, i)
}
pub fn desligar() -> Result<(), String> {
    let exe = achar().ok_or("O LDPlayer não está instalado")?;
    if let Some(i) = minha(&lista(&exe)?) { saida(&exe, &["quit", "--index", &i.indice.to_string()])?; }
    Ok(())
}

/// Tudo de uma vez: baixa o APK, cria e liga o celular virtual se precisar, instala e abre o app.
pub fn testar(url: &str, pacote: &str, token: Option<&str>) -> Result<(), String> {
    let exe = achar().ok_or("O LDPlayer não está instalado")?;
    total_de_passos(5);
    etapa("Baixando o APK…");
    let apk = baixar_apk(url, pacote, token)?;
    let i = garantir_instancia(&exe)?;
    ligar_e_esperar(&exe, i)?;
    etapa("Instalando no LDPlayer…");
    let arquivo = apk.to_string_lossy().to_string();
    let r = saida(&exe, &["installapp", "--index", &i.to_string(), "--filename", &arquivo])?;
    if r.to_lowercase().contains("fail") { return Err("O LDPlayer recusou o APK".into()); }
    etapa("Abrindo o app…");
    let _ = saida(&exe, &["runapp", "--index", &i.to_string(), "--packagename", pacote]);
    let _ = std::fs::remove_file(&apk);
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    #[test]
    fn le_a_lista_do_ldconsole() {
        let t = "0,LDPlayer,0,0,0,-1,-1\r\n1,Vynx,5243222,3212644,1,8120,9004\r\n2,Outro,0,0,0,-1,-1\r\nlixo\r\n";
        let l = ler_lista(t);
        assert_eq!(l.len(), 3);
        assert_eq!(minha(&l), Some(&Instancia { indice: 1, nome: "Vynx".into(), ligada: true, pronta: true }));
        assert!(!l[0].ligada && !l[0].pronta);
        assert!(minha(&[]).is_none());
    }
    #[test]
    fn instancia_ligando_ainda_nao_esta_pronta() {
        let l = ler_lista("1,Vynx,10,20,0,555,666");
        assert!(l[0].ligada && !l[0].pronta);
    }
    #[test]
    fn caminhos_do_programa() {
        let c = candidatos(&['C', 'D'], &["C:\\Program Files".into()]);
        assert!(c.iter().any(|p| p.to_string_lossy() == "C:\\LDPlayer\\LDPlayer9\\ldconsole.exe"));
        assert!(c.iter().any(|p| p.to_string_lossy().ends_with("LDPlayer9\\ldconsole.exe") && p.to_string_lossy().starts_with("D:")));
        assert!(c.iter().all(|p| p.to_string_lossy().ends_with("ldconsole.exe")));
    }
}
