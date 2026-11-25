// Painel Dev: resumo de todos os apps numa olhada (lógica pura, testada em teste/painel.test.mjs).
import { avisosDeBuild, type AppDoPainel, type Rodada, type Versao } from "./github.ts";

export interface ResumoApp { app: AppDoPainel; versao: Versao | null; rodadas: Rodada[]; erro: boolean }
export type EstadoApp = "ok" | "falhou" | "rodando" | "nd";

/** Quebrado = algum fluxo cuja última rodada falhou; rodando = a rodada mais nova ainda não terminou; ok = tem rodadas e nenhuma quebrada. */
export function estadoDoApp(r: ResumoApp): EstadoApp {
  if (r.erro || r.rodadas.length === 0) return "nd";
  if (avisosDeBuild(r.rodadas).length > 0) return "falhou";
  return r.rodadas[0]!.estado === "rodando" ? "rodando" : "ok";
}

export interface Totais { apps: number; quebrados: number; rodando: number; ok: number; semDados: number }
export function totais(rs: ResumoApp[]): Totais {
  const t: Totais = { apps: rs.length, quebrados: 0, rodando: 0, ok: 0, semDados: 0 };
  for (const r of rs) { const e = estadoDoApp(r); if (e === "falhou") t.quebrados++; else if (e === "rodando") t.rodando++; else if (e === "ok") t.ok++; else t.semDados++; }
  return t;
}

/** A publicação mais recente entre todos os apps. */
export function ultimaPublicacao(rs: ResumoApp[]): { app: AppDoPainel; versao: Versao } | null {
  let melhor: { app: AppDoPainel; versao: Versao } | null = null;
  for (const r of rs) {
    if (!r.versao) continue;
    const t = Date.parse(r.versao.quando);
    if (!Number.isFinite(t)) continue;
    if (!melhor || t > Date.parse(melhor.versao.quando)) melhor = { app: r.app, versao: r.versao };
  }
  return melhor;
}

/** Linha do tempo: as rodadas mais novas de todos os apps, misturadas. */
export function atividade(rs: ResumoApp[], quantas = 8): { app: AppDoPainel; rodada: Rodada }[] {
  const todas = rs.flatMap((r) => r.rodadas.map((rodada) => ({ app: r.app, rodada })));
  return todas.filter((x) => Number.isFinite(Date.parse(x.rodada.quando))).sort((a, b) => Date.parse(b.rodada.quando) - Date.parse(a.rodada.quando)).slice(0, quantas);
}

/** Os últimos resultados de build, da esquerda (mais velho) para a direita (mais novo), para o risquinho do cartão. */
export const tiraDeBuilds = (r: ResumoApp, n = 6): Rodada["estado"][] => r.rodadas.slice(0, n).map((x) => x.estado).reverse();
