// Emulador de Android do Vynx: baixa um JDK e as ferramentas oficiais do Android (SDK), cria celulares virtuais,
// liga o emulador e instala os APKs das releases. Tudo fica em %LOCALAPPDATA%\VynxOS\android (nada é instalado no sistema).
// Só usa programas já presentes no Windows (curl.exe e tar.exe) e sempre com argumentos separados (nunca por shell).
use serde::Serialize;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

pub const URL_JDK: &str = "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip";
pub const URL_FERRAMENTAS: &str = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip";
pub const IMAGEM: &str = "system-images;android-35;google_apis;x86_64";
const PASTA_DA_IMAGEM: [&str; 4] = ["system-images", "android-35", "google_apis", "x86_64"];

#[derive(Serialize, Clone, Default, Debug)]
pub struct Progresso { pub ativo: bool, pub tarefa: String, pub etapa: String, pub detalhe: String, pub erro: Option<String>, pub concluida: bool }
static PROGRESSO: Mutex<Option<Progresso>> = Mutex::new(None);

fn atualizar(f: impl FnOnce(&mut Progresso)) {
    if let Ok(mut g) = PROGRESSO.lock() { f(g.get_or_insert_with(Progresso::default)); }
}
pub fn progresso() -> Progresso { PROGRESSO.lock().ok().and_then(|g| g.clone()).unwrap_or_default() }

/// Roda `f` numa linha de execução própria, mostrando etapas em `progresso()`. Só uma tarefa por vez.
pub fn tarefa(nome: &str, f: impl FnOnce() -> Result<(), String> + Send + 'static) -> Result<(), String> {
    {
        let mut g = PROGRESSO.lock().map_err(|_| "Estado interno bloqueado".to_string())?;
        if g.as_ref().map(|p| p.ativo).unwrap_or(false) { return Err("Já tem uma tarefa em andamento. Espere terminar.".into()); }
        *g = Some(Progresso { ativo: true, tarefa: nome.into(), etapa: "Começando…".into(), ..Default::default() });
    }
    std::thread::spawn(move || {
        let r = f();
        atualizar(|p| { p.ativo = false; match r { Ok(()) => { p.concluida = true; p.etapa = "Pronto".into(); p.detalhe.clear(); } Err(e) => p.erro = Some(e) } });
    });
    Ok(())
}
fn etapa(t: &str) { atualizar(|p| { p.etapa = t.into(); p.detalhe.clear(); }); }

// ---------- validações (puras) ----------
pub fn nome_avd_valido(n: &str) -> bool { !n.is_empty() && n.len() <= 40 && n.starts_with("vynx-") && n.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') }
pub fn pacote_valido(p: &str) -> bool { p.len() <= 60 && p.strip_prefix("tech.vetorial.").map(|r| !r.is_empty() && r.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())).unwrap_or(false) }
/// Só aceita APK de releases dos repositórios da conta (o download segue o redirecionamento do GitHub).
pub fn url_apk_valida(u: &str) -> bool {
    u.starts_with("https://github.com/tonysantquees95-code/") && u.contains("/releases/download/") && u.ends_with(".apk")
        && !u.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '^' | '&' | '|' | '<' | '>' | '%'))
}
pub fn perfil_para_aparelhos(perfil: &str) -> Option<&'static [&'static str]> {
    match perfil { "celular" => Some(&["pixel_6", "pixel_5"]), "pequeno" => Some(&["pixel_3a", "pixel_2"]), "tablet" => Some(&["pixel_tablet", "pixel_c"]), _ => None }
}
/// Linhas "serial<TAB>device" do `adb devices` que são emuladores prontos para o adb.
pub fn parse_devices(txt: &str) -> Vec<String> {
    txt.lines().skip(1).filter_map(|l| { let mut c = l.split_whitespace(); let s = c.next()?; (c.next()? == "device" && s.starts_with("emulator-")).then(|| s.to_string()) }).collect()
}
/// A última linha com texto de um pedaço de saída (o sdkmanager reescreve a mesma linha com \r).
pub fn ultima_linha(s: &str) -> String { s.split(|c| c == '\r' || c == '\n').map(str::trim).filter(|l| !l.is_empty()).last().unwrap_or("").chars().take(120).collect() }

// ---------- pastas ----------
pub struct Pastas { pub raiz: PathBuf, pub jdk: PathBuf, pub sdk: PathBuf, pub avd: PathBuf, pub baixados: PathBuf }
pub fn pastas() -> Result<Pastas, String> {
    let base = std::env::var("LOCALAPPDATA").map_err(|_| "Não achei a pasta de dados do Windows".to_string())?;
    let raiz = PathBuf::from(base).join("VynxOS").join("android");
    Ok(Pastas { jdk: raiz.join("jdk"), sdk: raiz.join("sdk"), avd: raiz.join("avd"), baixados: raiz.join("baixados"), raiz })
}
impl Pastas {
    fn java_home(&self) -> Option<PathBuf> {
        std::fs::read_dir(&self.jdk).ok()?.flatten().map(|e| e.path()).find(|p| p.join("bin").join("java.exe").exists())
    }
    fn sdkmanager(&self) -> PathBuf { self.sdk.join("cmdline-tools").join("latest").join("bin").join("sdkmanager.bat") }
    fn avdmanager(&self) -> PathBuf { self.sdk.join("cmdline-tools").join("latest").join("bin").join("avdmanager.bat") }
    fn adb(&self) -> PathBuf { self.sdk.join("platform-tools").join("adb.exe") }
    fn emulador(&self) -> PathBuf { self.sdk.join("emulator").join("emulator.exe") }
    fn imagem(&self) -> PathBuf { PASTA_DA_IMAGEM.iter().fold(self.sdk.clone(), |p, s| p.join(s)) }
    fn ambiente(&self, c: &mut Command) -> &Self {
        c.env("ANDROID_SDK_ROOT", &self.sdk).env("ANDROID_HOME", &self.sdk).env("ANDROID_AVD_HOME", &self.avd);
        if let Some(j) = self.java_home() { c.env("JAVA_HOME", j); }
        self
    }
}
fn sem_janela(c: &mut Command) -> &mut Command {
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    c
}

// ---------- estado ----------
#[derive(Serialize, Default, Debug)]
pub struct EstadoAndroid {
    pub jdk: bool, pub ferramentas: bool, pub emulador: bool, pub imagem: bool, pub preparado: bool,
    pub celulares: Vec<String>, pub ligado: Option<String>, pub pronto: bool, pub aceleracao: Option<bool>,
}
pub fn estado() -> Result<EstadoAndroid, String> {
    let p = pastas()?;
    let mut e = EstadoAndroid { jdk: p.java_home().is_some(), ferramentas: p.sdkmanager().exists() && p.adb().exists(), emulador: p.emulador().exists(), imagem: p.imagem().join("system.img").exists() || p.imagem().join("source.properties").exists(), ..Default::default() };
    e.preparado = e.jdk && e.ferramentas && e.emulador && e.imagem;
    if let Ok(d) = std::fs::read_dir(&p.avd) {
        let mut v: Vec<String> = d.flatten().filter_map(|f| f.file_name().to_str().and_then(|n| n.strip_suffix(".ini")).map(String::from)).filter(|n| nome_avd_valido(n)).collect();
        v.sort(); e.celulares = v;
    }
    if e.ferramentas {
        let mut c = Command::new(p.adb()); sem_janela(&mut c);
        if let Ok(o) = c.arg("devices").output() {
            e.ligado = parse_devices(&String::from_utf8_lossy(&o.stdout)).into_iter().next();
        }
        if let Some(s) = &e.ligado {
            let mut c = Command::new(p.adb()); sem_janela(&mut c);
            if let Ok(o) = c.args(["-s", s, "shell", "getprop", "sys.boot_completed"]).output() { e.pronto = String::from_utf8_lossy(&o.stdout).trim() == "1"; }
        }
    }
    if e.emulador {
        let mut c = Command::new(p.emulador()); sem_janela(&mut c);
        e.aceleracao = c.arg("-accel-check").output().ok().map(|o| o.status.success());
    }
    Ok(e)
}

// ---------- execução ----------
/// Roda um programa mostrando a última linha da saída em `detalhe`. `entrada` é escrita na entrada padrão.
fn rodar(c: &mut Command, entrada: Option<&str>, erro: &str) -> Result<(), String> {
    sem_janela(c);
    c.stdin(if entrada.is_some() { Stdio::piped() } else { Stdio::null() }).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut f = c.spawn().map_err(|e| format!("{erro}: {e}"))?;
    if let (Some(txt), Some(mut si)) = (entrada, f.stdin.take()) { let _ = si.write_all(txt.as_bytes()); }
    let mut err = f.stderr.take();
    let leitor = std::thread::spawn(move || { let mut s = String::new(); if let Some(e) = err.as_mut() { let _ = e.read_to_string(&mut s); } s });
    if let Some(mut out) = f.stdout.take() {
        let mut buf = [0u8; 2048];
        while let Ok(n) = out.read(&mut buf) {
            if n == 0 { break; }
            let l = ultima_linha(&String::from_utf8_lossy(&buf[..n]));
            if !l.is_empty() { atualizar(|p| p.detalhe = l); }
        }
    }
    let s = f.wait().map_err(|e| format!("{erro}: {e}"))?;
    let msg = leitor.join().unwrap_or_default();
    if s.success() { Ok(()) } else { Err(format!("{erro} ({})", ultima_linha(&msg))) }
}

fn baixar(url: &str, destino: &Path, erro: &str) -> Result<(), String> {
    if let Some(d) = destino.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    let mut c = Command::new("curl.exe");
    c.args(["-L", "--fail", "--silent", "--show-error", "--retry", "3", "-o"]).arg(destino).arg(url);
    rodar(&mut c, None, erro)
}
fn extrair(zip: &Path, para: &Path, erro: &str) -> Result<(), String> {
    std::fs::create_dir_all(para).map_err(|e| e.to_string())?;
    let mut c = Command::new("tar.exe"); c.arg("-xf").arg(zip).arg("-C").arg(para);
    rodar(&mut c, None, erro)
}

/// Baixa o que falta: JDK, ferramentas do Android, emulador e imagem do sistema (uns 3 GB no total).
pub fn preparar() -> Result<(), String> {
    let p = pastas()?;
    std::fs::create_dir_all(&p.raiz).map_err(|e| e.to_string())?;
    if p.java_home().is_none() {
        etapa("Baixando o Java (necessário para as ferramentas do Android)…");
        let z = p.baixados.join("jdk.zip");
        baixar(URL_JDK, &z, "Não consegui baixar o Java")?;
        etapa("Instalando o Java…");
        extrair(&z, &p.jdk, "Não consegui abrir o pacote do Java")?;
        let _ = std::fs::remove_file(&z);
        if p.java_home().is_none() { return Err("O pacote do Java veio incompleto".into()); }
    }
    if !p.sdkmanager().exists() {
        etapa("Baixando as ferramentas do Android…");
        let z = p.baixados.join("ferramentas.zip");
        baixar(URL_FERRAMENTAS, &z, "Não consegui baixar as ferramentas do Android")?;
        etapa("Instalando as ferramentas do Android…");
        let tmp = p.sdk.join("_novo");
        let _ = std::fs::remove_dir_all(&tmp);
        extrair(&z, &tmp, "Não consegui abrir o pacote das ferramentas")?;
        let destino = p.sdk.join("cmdline-tools").join("latest");
        std::fs::create_dir_all(destino.parent().ok_or("Pasta inválida")?).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_dir_all(&destino);
        std::fs::rename(tmp.join("cmdline-tools"), &destino).map_err(|e| format!("Não consegui organizar as ferramentas: {e}"))?;
        let _ = std::fs::remove_dir_all(&tmp);
        let _ = std::fs::remove_file(&z);
    }
    let sdk_arg = format!("--sdk_root={}", p.sdk.display());
    etapa("Aceitando a licença do Android SDK…");
    let mut c = Command::new(p.sdkmanager()); p.ambiente(&mut c);
    c.arg(&sdk_arg).arg("--licenses");
    rodar(&mut c, Some(&"y\n".repeat(60)), "Não consegui registrar a licença")?;
    etapa("Baixando o emulador e a imagem do Android (é a parte mais demorada)…");
    let mut c = Command::new(p.sdkmanager()); p.ambiente(&mut c);
    c.arg(&sdk_arg).args(["platform-tools", "emulator", IMAGEM]);
    rodar(&mut c, Some(&"y\n".repeat(20)), "Não consegui baixar o emulador")?;
    Ok(())
}

/// Cria (ou refaz) o celular virtual do perfil: "celular", "pequeno" ou "tablet".
pub fn criar_celular(perfil: &str) -> Result<String, String> {
    let aparelhos = perfil_para_aparelhos(perfil).ok_or("Perfil desconhecido")?;
    let p = pastas()?;
    if !p.avdmanager().exists() { return Err("Prepare o emulador primeiro".into()); }
    std::fs::create_dir_all(&p.avd).map_err(|e| e.to_string())?;
    let nome = format!("vynx-{perfil}");
    let mut ultimo = String::new();
    for a in aparelhos {
        let mut c = Command::new(p.avdmanager()); p.ambiente(&mut c);
        c.args(["create", "avd", "-n", &nome, "-k", IMAGEM, "-d", a, "--force"]);
        match rodar(&mut c, Some("no\n"), "Não consegui criar o celular virtual") { Ok(()) => return Ok(nome), Err(e) => ultimo = e }
    }
    Err(ultimo)
}

pub fn ligar(nome: &str) -> Result<(), String> {
    if !nome_avd_valido(nome) { return Err("Nome inválido".into()); }
    let p = pastas()?;
    if !p.emulador().exists() { return Err("Prepare o emulador primeiro".into()); }
    if !p.avd.join(format!("{nome}.ini")).exists() { return Err("Esse celular virtual não existe".into()); }
    let mut c = Command::new(p.emulador()); p.ambiente(&mut c);
    c.args(["-avd", nome, "-no-boot-anim", "-no-audio"]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0008); } // sem console e desligado deste processo
    c.spawn().map(|_| ()).map_err(|e| format!("Não consegui ligar o emulador: {e}"))
}

fn adb(p: &Pastas, args: &[&str]) -> Command { let mut c = Command::new(p.adb()); sem_janela(&mut c); c.args(args); c }

pub fn desligar() -> Result<(), String> {
    let p = pastas()?;
    let e = adb(&p, &["emu", "kill"]).output().map_err(|e| e.to_string())?;
    if e.status.success() { Ok(()) } else { Err("Não consegui desligar o emulador".into()) }
}

/// Baixa o APK da release, instala no emulador ligado e abre o app.
pub fn instalar(url: &str, pacote: &str) -> Result<(), String> {
    if !url_apk_valida(url) { return Err("Endereço de APK não aceito".into()); }
    if !pacote_valido(pacote) { return Err("Pacote inválido".into()); }
    let p = pastas()?;
    if !p.adb().exists() { return Err("Prepare o emulador primeiro".into()); }
    etapa("Baixando o APK…");
    let apk = p.baixados.join(format!("{pacote}.apk"));
    baixar(url, &apk, "Não consegui baixar o APK")?;
    etapa("Esperando o emulador ficar pronto…");
    let mut pronto = false;
    for _ in 0..90 {
        let o = adb(&p, &["shell", "getprop", "sys.boot_completed"]).output().map_err(|e| e.to_string())?;
        if String::from_utf8_lossy(&o.stdout).trim() == "1" { pronto = true; break; }
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
    if !pronto { return Err("O emulador não está ligado. Ligue o celular virtual e tente de novo.".into()); }
    etapa("Instalando no celular virtual…");
    let mut c = adb(&p, &["install", "-r", "-t"]); c.arg(&apk);
    rodar(&mut c, None, "O Android recusou o APK")?;
    etapa("Abrindo o app…");
    let _ = adb(&p, &["shell", "monkey", "-p", pacote, "-c", "android.intent.category.LAUNCHER", "1"]).output();
    let _ = std::fs::remove_file(&apk);
    Ok(())
}

/// Tira uma foto da tela do emulador e salva em Imagens\Vynx. Devolve o caminho.
pub fn capturar() -> Result<String, String> {
    let p = pastas()?;
    let o = adb(&p, &["exec-out", "screencap", "-p"]).output().map_err(|e| e.to_string())?;
    if !o.status.success() || o.stdout.len() < 100 { return Err("Não consegui tirar a foto (o emulador está ligado?)".into()); }
    let casa = std::env::var("USERPROFILE").map_err(|_| "Não achei a pasta do usuário".to_string())?;
    let pasta = PathBuf::from(casa).join("Pictures").join("Vynx");
    std::fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let arq = pasta.join(format!("captura-{t}.png"));
    std::fs::write(&arq, &o.stdout).map_err(|e| e.to_string())?;
    Ok(arq.display().to_string())
}

#[cfg(test)]
mod testes {
    use super::*;
    #[test] fn nomes_e_pacotes() {
        assert!(nome_avd_valido("vynx-celular") && !nome_avd_valido("celular") && !nome_avd_valido("vynx-A") && !nome_avd_valido("vynx-a b"));
        assert!(pacote_valido("tech.vetorial.voxix") && !pacote_valido("com.google.chrome") && !pacote_valido("tech.vetorial.") && !pacote_valido("tech.vetorial.a;b"));
    }
    #[test] fn urls() {
        assert!(url_apk_valida("https://github.com/tonysantquees95-code/voxix/releases/download/1.9/Voxix.apk"));
        assert!(!url_apk_valida("https://evil.com/tonysantquees95-code/x/releases/download/1/a.apk"));
        assert!(!url_apk_valida("https://github.com/outro/voxix/releases/download/1.9/Voxix.apk"));
        assert!(!url_apk_valida("https://github.com/tonysantquees95-code/voxix/releases/download/1.9/Voxix.exe"));
        assert!(!url_apk_valida("https://github.com/tonysantquees95-code/voxix/releases/download/1.9/a b.apk"));
    }
    #[test] fn adb_devices() {
        let t = "List of devices attached\r\nemulator-5554\tdevice\r\nemulator-5556\toffline\r\nABC123\tdevice\r\n\r\n";
        assert_eq!(parse_devices(t), vec!["emulator-5554".to_string()]);
        assert!(parse_devices("List of devices attached\r\n\r\n").is_empty());
    }
    #[test] fn saida_do_sdkmanager() {
        assert_eq!(ultima_linha("[=====     ] 40% Downloading\r[======    ] 41% Downloading\r"), "[======    ] 41% Downloading");
        assert_eq!(ultima_linha(""), "");
    }
    #[test] fn perfis() { assert!(perfil_para_aparelhos("tablet").is_some() && perfil_para_aparelhos("x").is_none()); }
}
