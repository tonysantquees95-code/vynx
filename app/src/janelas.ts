// Janelas do Vynx OS (lógica pura, testada em teste/janelas.test.mjs): abrir, focar, mover, minimizar, maximizar, fechar.
// As janelas ficam sempre dentro da área de trabalho; a ordem de empilhamento é a posição em `z` (1..n).
export type IdApp = "inicio" | "laboratorio" | "android" | "painel" | "documentos" | "ajustes";
export interface Janela { id: IdApp; x: number; y: number; w: number; h: number; z: number; min: boolean; max: boolean }
export interface Area { w: number; h: number }

/** Tamanho preferido de cada janela (encolhe se a área for menor). */
export const TAMANHO: Record<IdApp, { w: number; h: number }> = {
  inicio: { w: 760, h: 520 },
  laboratorio: { w: 820, h: 560 },
  android: { w: 820, h: 580 },
  painel: { w: 860, h: 580 },
  documentos: { w: 900, h: 600 },
  ajustes: { w: 640, h: 560 },
};
/** Largura (px) abaixo da qual as janelas viram tela cheia, uma por vez. */
export const LARGURA_MINIMA_PARA_JANELAS = 900;
export const ALTURA_DA_BARRA_DA_JANELA = 40;

const limitar = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, Math.max(min, max)));

function renumerar(lista: Janela[]): Janela[] {
  const ordem = [...lista].sort((a, b) => a.z - b.z).map((j) => j.id);
  return lista.map((j) => ({ ...j, z: ordem.indexOf(j.id) + 1 }));
}

/** A janela que está na frente (a mais alta que não está minimizada). */
export function ativa(lista: Janela[]): IdApp | null {
  const v = lista.filter((j) => !j.min).sort((a, b) => b.z - a.z)[0];
  return v ? v.id : null;
}

export function focar(lista: Janela[], id: IdApp): Janela[] {
  if (!lista.some((j) => j.id === id)) return lista;
  const topo = Math.max(0, ...lista.map((j) => j.z)) + 1;
  return renumerar(lista.map((j) => (j.id === id ? { ...j, z: topo, min: false } : j)));
}

/** Abre a janela (em cascata) ou, se já existe, traz para a frente. */
export function abrir(lista: Janela[], id: IdApp, area: Area): Janela[] {
  if (lista.some((j) => j.id === id)) return focar(lista, id);
  const t = TAMANHO[id];
  const w = Math.min(t.w, area.w), h = Math.min(t.h, area.h);
  const n = lista.length % 6;
  const x = limitar(40 + n * 32, 0, area.w - w), y = limitar(24 + n * 28, 0, area.h - h);
  return focar([...lista, { id, x, y, w, h, z: 0, min: false, max: false }], id);
}

export function fechar(lista: Janela[], id: IdApp): Janela[] {
  return renumerar(lista.filter((j) => j.id !== id));
}

export function minimizar(lista: Janela[], id: IdApp): Janela[] {
  return lista.map((j) => (j.id === id ? { ...j, min: true } : j));
}

export function alternarMaximizada(lista: Janela[], id: IdApp): Janela[] {
  return focar(lista.map((j) => (j.id === id ? { ...j, max: !j.max } : j)), id);
}

/** Move a janela, mantendo a barra de título sempre dentro da área (dá para pegar de novo). */
export function mover(lista: Janela[], id: IdApp, x: number, y: number, area: Area): Janela[] {
  return lista.map((j) => (j.id === id ? { ...j, x: limitar(x, 0, area.w - j.w), y: limitar(y, 0, area.h - ALTURA_DA_BARRA_DA_JANELA) } : j));
}

/** A área mudou (a janela do Windows foi redimensionada): encolhe e reposiciona o que não cabe mais. */
export function ajustarA(lista: Janela[], area: Area): Janela[] {
  return lista.map((j) => {
    const w = Math.min(j.w, area.w), h = Math.min(j.h, area.h);
    return { ...j, w, h, x: limitar(j.x, 0, area.w - w), y: limitar(j.y, 0, area.h - h) };
  });
}

export const abertas = (lista: Janela[], id: IdApp): boolean => lista.some((j) => j.id === id);
