// Andamento visível de tarefas longas (importar projetos, preparar o Android, instalar apps). Lógica pura, testada em teste/andamento.test.mjs.
// Ideia: a pessoa precisa ver SE está andando. Mostramos o tempo, a etapa, e avisamos quando fica muito tempo sem nenhuma novidade.

export type Saude = "andando" | "lento" | "parado";

/** "75" -> "1 min 15 s"; "9" -> "9 s"; "3700" -> "1 h 1 min". */
export function formatarTempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  if (s < 60) return `${s} s`;
  if (s < 3600) { const r = s % 60; return r ? `${Math.floor(s / 60)} min ${r} s` : `${Math.floor(s / 60)} min`; }
  const m = Math.floor((s % 3600) / 60);
  return m ? `${Math.floor(s / 3600)} h ${m} min` : `${Math.floor(s / 3600)} h`;
}

/**
 * Quanto tempo sem novidade é normal?  `limiteLento` (padrão 90 s) vira aviso amarelo; `limiteParado` (padrão 5 min) vira
 * "parece travado". Se o programa dá sinal de vida (`vivoHa`), nunca é "parado": só lento (computador fraco, não travou).
 */
export function saude(semNovidade: number, vivoHa: number | null = null, limiteLento = 90, limiteParado = 300): Saude {
  if (semNovidade < limiteLento) return "andando";
  if (vivoHa !== null && vivoHa < 45) return "lento";
  return semNovidade >= limiteParado ? "parado" : "lento";
}

export function mensagemDeSaude(s: Saude, semNovidade: number, temSinalDeVida: boolean): string {
  if (s === "andando") return "";
  const t = formatarTempo(semNovidade);
  if (s === "lento") return temSinalDeVida
    ? `Sem novidade há ${t}, mas o programa está respondendo. O computador está só lento: pode esperar.`
    : `Sem novidade há ${t}. Pode ser o computador lento. Se passar de 5 minutos, cancele e tente de novo.`;
  return temSinalDeVida
    ? `Sem novidade há ${t}. Parece travado. Cancele e tente de novo; se repetir, feche outros programas para liberar memória.`
    : `Sem novidade há ${t} e nenhum sinal de vida. Parece travado: cancele e tente de novo.`;
}

/** Linhas do script de importação: "[3/12] nome", "Etapa 2 de 4: texto" e as batidas "… vivo (45s)" (sinal de vida, não é andamento). */
export type LinhaLida =
  | { tipo: "projeto"; atual: number; total: number }
  | { tipo: "etapa"; atual: number; total: number; texto: string }
  | { tipo: "vivo" }
  | { tipo: "texto" };
export function lerLinha(l: string): LinhaLida {
  const t = l.trim();
  const p = /^\[(\d{1,4})\/(\d{1,4})\]/.exec(t);
  if (p && Number(p[2]) > 0 && Number(p[1]) <= Number(p[2])) return { tipo: "projeto", atual: Number(p[1]), total: Number(p[2]) };
  const e = /^Etapa (\d) de (\d): (.+)$/.exec(t);
  if (e && Number(e[2]) > 0 && Number(e[1]) <= Number(e[2])) return { tipo: "etapa", atual: Number(e[1]), total: Number(e[2]), texto: e[3]! };
  if (t.startsWith("…") || t.startsWith("... vivo")) return { tipo: "vivo" };
  return { tipo: "texto" };
}

/** Porcentagem para a barra: projeto a projeto quando há (etapa 3), senão pela etapa. */
export function porcentagem(passo: number, passos: number, parcial = 0): number {
  if (passos <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((passo - 1 + Math.max(0, Math.min(1, parcial))) / passos) * 100)));
}
