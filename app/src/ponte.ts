// Ponte com o Windows (Tauri). No navegador e no teste visual vale o modo de demonstração, que só mexe na memória.
import { invoke } from "@tauri-apps/api/core";
import { PREFIXO, type EstadoWsl } from "./laboratorio";

export const ehTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Ponte {
  estadoWsl(): Promise<EstadoWsl>;
  criarLaboratorio(base: string, nome: string): Promise<void>;
  descartarLaboratorio(nome: string): Promise<void>;
  abrirTerminal(nome: string): Promise<void>;
  abrirLink(url: string): Promise<void>;
}

const real: Ponte = {
  estadoWsl: () => invoke<EstadoWsl>("estado_wsl"),
  criarLaboratorio: (base, nome) => invoke("criar_laboratorio", { base, nome }),
  descartarLaboratorio: (nome) => invoke("descartar_laboratorio", { nome }),
  abrirTerminal: (nome) => invoke("abrir_terminal", { nome }),
  abrirLink: (url) => invoke("abrir_link", { url }),
};

/** Demonstração: o estado do WSL vem de localStorage "vynx.demo.wsl" (o teste visual usa isso). */
function demo(): Ponte {
  let distros: { nome: string; estado: string; versao: number }[] = [{ nome: "Ubuntu", estado: "Running", versao: 2 }];
  let instalado = true;
  try { const d = JSON.parse(localStorage.getItem("vynx.demo.wsl") ?? "null"); if (d) { instalado = d.instalado !== false; distros = d.distros ?? distros; } } catch { /* usa o padrão */ }
  const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    estadoWsl: async () => ({ instalado, virtualizacao: instalado ? true : null, distros: [...distros] }),
    criarLaboratorio: async (_b, nome) => { await espera(600); distros = [...distros, { nome: PREFIXO + nome, estado: "Stopped", versao: 2 }]; },
    descartarLaboratorio: async (nome) => { await espera(300); distros = distros.filter((d) => d.nome !== PREFIXO + nome); },
    abrirTerminal: async () => { /* só no Windows */ },
    abrirLink: async (url) => { window.open(url, "_blank", "noopener"); },
  };
}

export const ponte: Ponte = ehTauri() ? real : demo();
