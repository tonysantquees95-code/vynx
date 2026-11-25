// Faixa de uso do computador (CPU, memória, GPU) e "Liberar memória". Sem programas de fora: CPU e memória vêm direto do Windows
// (kernel32) e a GPU vem do contador do próprio Windows lido por `typeperf` (um processo só, fica ligado enquanto o app está aberto).
use serde::Serialize;
use std::sync::Mutex;

#[derive(Serialize, Default, Clone, Debug)]
pub struct Metricas {
    /// 0..100; None = ainda medindo
    pub cpu: Option<u32>,
    pub ram_usada_mb: u64,
    pub ram_total_mb: u64,
    /// 0..100; None = o Windows desta máquina não informa
    pub gpu: Option<u32>,
}

static ULTIMA_GPU: Mutex<Option<u32>> = Mutex::new(None);
static GPU_LIGADA: Mutex<bool> = Mutex::new(false);

/// Maior valor entre as linhas CSV do typeperf (uma coluna por motor da GPU): `"hora","12.5","0.0"` -> 12.
pub fn gpu_da_linha(linha: &str) -> Option<u32> {
    let campos: Vec<&str> = linha.split(',').map(|c| c.trim().trim_matches('"')).collect();
    if campos.len() < 2 { return None; }
    let mut maior: Option<f64> = None;
    for c in &campos[1..] {
        if let Ok(v) = c.replace(',', ".").parse::<f64>() { maior = Some(maior.map_or(v, |m: f64| m.max(v))); }
    }
    maior.map(|v| v.round().clamp(0.0, 100.0) as u32)
}

/// Porcentagem de uso a partir de duas leituras de GetSystemTimes (ocioso, núcleo, usuário); o "núcleo" já inclui o ocioso.
pub fn cpu_entre(antes: (u64, u64, u64), depois: (u64, u64, u64)) -> Option<u32> {
    let ocioso = depois.0.saturating_sub(antes.0);
    let total = depois.1.saturating_sub(antes.1) + depois.2.saturating_sub(antes.2);
    if total == 0 { return None; }
    Some((((total.saturating_sub(ocioso)) as f64 / total as f64) * 100.0).round().clamp(0.0, 100.0) as u32)
}

#[cfg(windows)]
mod sys {
    #[repr(C)] struct Ft { baixo: u32, alto: u32 }
    #[repr(C)] struct MemStatus { tam: u32, carga: u32, total_fis: u64, livre_fis: u64, total_pag: u64, livre_pag: u64, total_virt: u64, livre_virt: u64, livre_ext: u64 }
    extern "system" {
        fn GetSystemTimes(ocioso: *mut Ft, nucleo: *mut Ft, usuario: *mut Ft) -> i32;
        fn GlobalMemoryStatusEx(m: *mut MemStatus) -> i32;
        fn GetCurrentProcess() -> isize;
        fn K32EmptyWorkingSet(p: isize) -> i32;
    }
    fn u(f: &Ft) -> u64 { ((f.alto as u64) << 32) | f.baixo as u64 }
    pub fn tempos() -> Option<(u64, u64, u64)> {
        let mut a = Ft { baixo: 0, alto: 0 }; let mut b = Ft { baixo: 0, alto: 0 }; let mut c = Ft { baixo: 0, alto: 0 };
        if unsafe { GetSystemTimes(&mut a, &mut b, &mut c) } == 0 { None } else { Some((u(&a), u(&b), u(&c))) }
    }
    pub fn memoria() -> (u64, u64) {
        let mut m = MemStatus { tam: std::mem::size_of::<MemStatus>() as u32, carga: 0, total_fis: 0, livre_fis: 0, total_pag: 0, livre_pag: 0, total_virt: 0, livre_virt: 0, livre_ext: 0 };
        if unsafe { GlobalMemoryStatusEx(&mut m) } == 0 { return (0, 0); }
        ((m.total_fis - m.livre_fis) / 1_048_576, m.total_fis / 1_048_576)
    }
    pub fn encolher_este_programa() { unsafe { K32EmptyWorkingSet(GetCurrentProcess()); } }
}
#[cfg(not(windows))]
mod sys {
    pub fn tempos() -> Option<(u64, u64, u64)> { None }
    pub fn memoria() -> (u64, u64) { (0, 0) }
    pub fn encolher_este_programa() {}
}

static ANTES: Mutex<Option<(u64, u64, u64)>> = Mutex::new(None);

fn ligar_gpu() {
    #[cfg(windows)]
    {
        let mut ligada = match GPU_LIGADA.lock() { Ok(g) => g, Err(_) => return };
        if *ligada { return; }
        *ligada = true;
        std::thread::spawn(|| {
            use std::io::{BufRead, BufReader};
            use std::os::windows::process::CommandExt;
            use std::process::{Command, Stdio};
            let filho = Command::new("typeperf.exe").args(["\\GPU Engine(*engtype_3D)\\Utilization Percentage", "-si", "2"])
                .creation_flags(0x0800_0000).stdout(Stdio::piped()).stderr(Stdio::null()).stdin(Stdio::null()).spawn();
            if let Ok(mut f) = filho {
                if let Some(out) = f.stdout.take() {
                    for l in BufReader::new(out).lines().map_while(Result::ok) {
                        if let Some(v) = gpu_da_linha(&l) { if let Ok(mut g) = ULTIMA_GPU.lock() { *g = Some(v); } }
                    }
                }
                let _ = f.wait();
            }
            if let Ok(mut l) = GPU_LIGADA.lock() { *l = false; }
        });
    }
}

pub fn ler() -> Metricas {
    ligar_gpu();
    let agora = sys::tempos();
    let cpu = match (agora, ANTES.lock().ok().and_then(|mut g| { let p = *g; *g = agora; p })) { (Some(d), Some(a)) => cpu_entre(a, d), _ => None };
    let (usada, total) = sys::memoria();
    Metricas { cpu, ram_usada_mb: usada, ram_total_mb: total, gpu: ULTIMA_GPU.lock().ok().and_then(|g| *g) }
}

/// Encolhe a memória do próprio Vynx. (Os laboratórios e o emulador são encerrados pelo `main.rs`, só se a pessoa pedir.)
pub fn encolher() { sys::encolher_este_programa(); }

#[cfg(test)]
mod testes {
    use super::*;
    #[test]
    fn gpu_pega_o_maior_motor() {
        assert_eq!(gpu_da_linha("\"11/25/2026 10:00:00.123\",\"12.4\",\"0.000000\",\"61.6\""), Some(62));
        assert_eq!(gpu_da_linha("\"x\",\"250\""), Some(100));
        assert_eq!(gpu_da_linha("(PDH-CSV 4.0)"), None);
        assert_eq!(gpu_da_linha("\"x\",\"abc\""), None);
    }
    #[test]
    fn cpu_entre_duas_leituras() {
        assert_eq!(cpu_entre((0, 0, 0), (50, 100, 100)), Some(75));
        assert_eq!(cpu_entre((0, 0, 0), (200, 100, 100)), Some(0));
        assert_eq!(cpu_entre((5, 5, 5), (5, 5, 5)), None);
    }
}
