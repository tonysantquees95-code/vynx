// Faixa de uso do computador (lógica pura, testada em teste/metricas.test.mjs).
export interface Metricas { cpu: number | null; ram_usada_mb: number; ram_total_mb: number; gpu: number | null }
export type Nivel = "ok" | "aviso" | "erro" | "nd";

/** Verde até 69%, amarelo de 70 a 89%, vermelho a partir de 90%. `null` = sem leitura. */
export function nivel(pct: number | null | undefined): Nivel {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "nd";
  return pct >= 90 ? "erro" : pct >= 70 ? "aviso" : "ok";
}
export function ramPct(m: Metricas): number | null {
  return m.ram_total_mb > 0 ? Math.round((m.ram_usada_mb / m.ram_total_mb) * 100) : null;
}
export const gb = (mb: number): string => `${(mb / 1024).toFixed(1).replace(".", ",")} GB`;
export const texto = (pct: number | null): string => (pct === null ? "—" : `${pct}%`);

/** Uma frase simples dizendo o que está pesando (ajuda a entender o "System UI não responde"). */
export function diagnostico(m: Metricas): string {
  const r = ramPct(m);
  if (r !== null && r >= 90) return "A memória está quase cheia: o computador vai ficar lento. Feche programas ou toque em Liberar.";
  if (m.cpu !== null && m.cpu >= 90) return "O processador está no limite. Deixe só um celular virtual aberto e feche outros programas.";
  if (m.gpu !== null && m.gpu >= 90) return "A placa de vídeo está no limite. Use o celular virtual 'pequeno'.";
  if ((r !== null && r >= 70) || (m.cpu !== null && m.cpu >= 70)) return "Está puxado, mas ainda dá. Evite abrir mais coisas ao mesmo tempo.";
  return "Tudo tranquilo.";
}
