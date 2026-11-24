// Ponte com o Windows (Tauri). No navegador e no teste visual vale o modo de demonstração, que só mexe na memória.
import { invoke } from "@tauri-apps/api/core";
import { PREFIXO, type EstadoWsl } from "./laboratorio";
import type { EstadoAndroid, ProgressoAndroid, PerfilId } from "./android";

export const ehTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface EstadoAtualizacao { ativo: boolean; baixado: number; total: number; pronto: boolean; erro: string | null }

export interface Ponte {
  estadoWsl(): Promise<EstadoWsl>;
  criarLaboratorio(base: string, nome: string): Promise<void>;
  descartarLaboratorio(nome: string): Promise<void>;
  abrirTerminal(nome: string): Promise<void>;
  instalarClaude(nome: string): Promise<void>;
  importarProjetos(nome: string, token: string): Promise<string>;
  abrirLink(url: string): Promise<void>;
  // Atualização por dentro
  atualizarBaixar(url: string, tamanho: number, sha256: string): Promise<void>;
  atualizarProgresso(): Promise<EstadoAtualizacao>;
  atualizarInstalar(): Promise<void>;
  // Emulador de Android
  androidEstado(): Promise<EstadoAndroid>;
  androidProgresso(): Promise<ProgressoAndroid>;
  androidPreparar(): Promise<void>;
  androidCriar(perfil: PerfilId): Promise<string>;
  androidLigar(nome: string): Promise<void>;
  androidDesligar(): Promise<void>;
  androidInstalar(url: string, pacote: string, token?: string): Promise<void>;
  androidCaptura(): Promise<string>;
}

const real: Ponte = {
  estadoWsl: () => invoke<EstadoWsl>("estado_wsl"),
  criarLaboratorio: (base, nome) => invoke("criar_laboratorio", { base, nome }),
  descartarLaboratorio: (nome) => invoke("descartar_laboratorio", { nome }),
  abrirTerminal: (nome) => invoke("abrir_terminal", { nome }),
  instalarClaude: (nome) => invoke("instalar_claude", { nome }),
  importarProjetos: (nome, token) => invoke("importar_projetos", { nome, token }),
  abrirLink: (url) => invoke("abrir_link", { url }),
  atualizarBaixar: (url, tamanho, sha256) => invoke("atualizar_baixar", { url, tamanho, sha256 }),
  atualizarProgresso: () => invoke<EstadoAtualizacao>("atualizar_progresso"),
  atualizarInstalar: () => invoke("atualizar_instalar"),
  androidEstado: () => invoke<EstadoAndroid>("android_estado"),
  androidProgresso: () => invoke<ProgressoAndroid>("android_progresso"),
  androidPreparar: () => invoke("android_preparar", { aceitouLicenca: true }),
  androidCriar: (perfil) => invoke<string>("android_criar", { perfil }),
  androidLigar: (nome) => invoke("android_ligar", { nome }),
  androidDesligar: () => invoke("android_desligar"),
  androidInstalar: (url, pacote, token) => invoke("android_instalar", { url, pacote, token: token ?? null }),
  androidCaptura: () => invoke<string>("android_captura"),
};

/** Demonstração: o estado do WSL vem de localStorage "vynx.demo.wsl" (o teste visual usa isso). */
function demo(): Ponte {
  let distros: { nome: string; estado: string; versao: number }[] = [{ nome: "Ubuntu", estado: "Running", versao: 2 }];
  let instalado = true;
  try { const d = JSON.parse(localStorage.getItem("vynx.demo.wsl") ?? "null"); if (d) { instalado = d.instalado !== false; distros = d.distros ?? distros; } } catch { /* usa o padrão */ }
  const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  // Android simulado: localStorage "vynx.demo.android" = {preparado, celulares, ligado, pronto}
  let a: EstadoAndroid = { jdk: false, ferramentas: false, emulador: false, imagem: false, preparado: false, celulares: [], ligado: null, pronto: false, aceleracao: true };
  try { const d = JSON.parse(localStorage.getItem("vynx.demo.android") ?? "null"); if (d) { const p = d.preparado === true; a = { ...a, jdk: p, ferramentas: p, emulador: p, imagem: p, preparado: p, celulares: d.celulares ?? [], ligado: d.ligado ? "emulator-5554" : null, pronto: d.pronto === true }; } } catch { /* usa o padrão */ }
  let au: EstadoAtualizacao = { ativo: false, baixado: 0, total: 0, pronto: false, erro: null };
  let prog: ProgressoAndroid = { ativo: false, tarefa: "", etapa: "", detalhe: "", erro: null, concluida: false };
  const tarefaDemo = async (tarefa: string, etapas: string[], fim: () => void) => {
    prog = { ativo: true, tarefa, etapa: etapas[0], detalhe: "", erro: null, concluida: false };
    for (const e of etapas) { prog = { ...prog, etapa: e, detalhe: "[=====     ] 40% Downloading" }; await espera(500); }
    fim(); prog = { ativo: false, tarefa, etapa: "Pronto", detalhe: "", erro: null, concluida: true };
  };
  return {
    androidEstado: async () => ({ ...a, celulares: [...a.celulares] }),
    androidProgresso: async () => prog,
    androidPreparar: async () => { void tarefaDemo("preparar", ["Baixando o Java…", "Baixando o emulador e a imagem do Android…"], () => { a = { ...a, jdk: true, ferramentas: true, emulador: true, imagem: true, preparado: true }; }); },
    androidCriar: async (perfil) => { await espera(300); const n = `vynx-${perfil}`; a = { ...a, celulares: [...new Set([...a.celulares, n])] }; return n; },
    androidLigar: async () => { a = { ...a, ligado: "emulator-5554", pronto: false }; setTimeout(() => { a = { ...a, pronto: true }; }, 800); },
    androidDesligar: async () => { a = { ...a, ligado: null, pronto: false }; },
    androidInstalar: async () => { void tarefaDemo("instalar", ["Baixando o APK…", "Instalando no celular virtual…"], () => {}); },
    androidCaptura: async () => "C:\\Users\\você\\Pictures\\Vynx\\captura-demo.png",
    estadoWsl: async () => ({ instalado, virtualizacao: instalado ? true : null, distros: [...distros] }),
    criarLaboratorio: async (_b, nome) => { await espera(600); distros = [...distros, { nome: PREFIXO + nome, estado: "Stopped", versao: 2 }]; },
    descartarLaboratorio: async (nome) => { await espera(300); distros = distros.filter((d) => d.nome !== PREFIXO + nome); },
    abrirTerminal: async () => { /* só no Windows */ },
    instalarClaude: async () => { /* só no Windows */ },
    importarProjetos: async () => "Pronto: 10 projetos em /root/projetos. Abra o Claude e digite /projetos.",
    abrirLink: async (url) => { window.open(url, "_blank", "noopener"); },
    atualizarBaixar: async (_u, tamanho) => {
      const total = tamanho || 50_000_000; au = { ativo: true, baixado: 0, total, pronto: false, erro: null };
      const passo = () => { if (au.baixado >= total) { au = { ...au, ativo: false, pronto: true }; return; } au = { ...au, baixado: Math.min(total, au.baixado + total / 5) }; setTimeout(passo, 300); };
      setTimeout(passo, 300);
    },
    atualizarProgresso: async () => au,
    atualizarInstalar: async () => { /* só no Windows */ },
  };
}

export const ponte: Ponte = ehTauri() ? real : demo();
