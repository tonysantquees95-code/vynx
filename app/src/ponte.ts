// Ponte com o Windows (Tauri). No navegador e no teste visual vale o modo de demonstração, que só mexe na memória.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  /** Recebe as linhas do andamento da importação; devolve a função que para de ouvir. */
  importarOuvir(aoLinha: (linha: string) => void): Promise<() => void>;
  abrirLink(url: string): Promise<void>;
  // Terminal do laboratório (dentro de uma janela do Vynx)
  terminalAbrir(nome: string, colunas: number, linhas: number): Promise<void>;
  terminalEscrever(dados: string): Promise<void>;
  terminalFechar(): Promise<void>;
  /** Recebe a saída do terminal; devolve a função que para de ouvir. */
  terminalOuvir(aoSaida: (bytes: Uint8Array) => void, aoFim: () => void): Promise<() => void>;
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
  importarOuvir: async (aoLinha) => await listen<string>("importar-linha", (e) => aoLinha(String(e.payload))),
  terminalAbrir: (nome, colunas, linhas) => invoke("terminal_abrir", { nome, colunas, linhas }),
  terminalEscrever: (dados) => invoke("terminal_escrever", { dados }),
  terminalFechar: () => invoke("terminal_fechar"),
  terminalOuvir: async (aoSaida, aoFim) => {
    const a = await listen<number[]>("terminal-saida", (e) => aoSaida(new Uint8Array(e.payload)));
    const b = await listen("terminal-fim", () => aoFim());
    return () => { a(); b(); };
  },
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
  const ouvintes: { saida?: (b: Uint8Array) => void; fim?: () => void; importar?: (l: string) => void } = {};
  const txt = (t: string) => new TextEncoder().encode(t);
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
    importarProjetos: async () => {
      const nomes = ["venus-core", "vindex", "vortex", "voxix", "vynx"];
      ouvintes.importar?.("Preparando o laboratório…"); await espera(300);
      ouvintes.importar?.(`Achei ${nomes.length} projetos. Baixando um por um…`);
      for (let i = 0; i < nomes.length; i++) { await espera(350); ouvintes.importar?.(`[${i + 1}/${nomes.length}] ${nomes[i]}`); }
      return "Pronto: 5 projetos em /root/projetos. Abra o Claude e digite /projetos.";
    },
    importarOuvir: async (aoLinha) => { ouvintes.importar = aoLinha; return () => { ouvintes.importar = undefined; }; },
    abrirLink: async (url) => { window.open(url, "_blank", "noopener"); },
    terminalAbrir: async (nome) => { ouvintes.saida = ouvintes.saida ?? (() => {}); setTimeout(() => ouvintes.saida?.(txt(`Terminal de demonstração do laboratório ${nome}.\r\nNo Windows isto é o Linux de verdade.\r\nroot@${nome}:~# `)), 50); },
    terminalEscrever: async (dados) => { ouvintes.saida?.(txt(dados.replace(/\r/g, "\r\n"))); },
    terminalFechar: async () => { ouvintes.fim?.(); },
    terminalOuvir: async (aoSaida, aoFim) => { ouvintes.saida = aoSaida; ouvintes.fim = aoFim; return () => { ouvintes.saida = undefined; ouvintes.fim = undefined; }; },
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
