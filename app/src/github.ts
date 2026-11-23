// Painel Dev: leitura do GitHub com o token do próprio desenvolvedor. Lógica pura (testada em teste/github.test.mjs).
export const API_GITHUB = "https://api.github.com";

export interface Repo { nome: string; completo: string; privado: boolean; atualizado: string; abertas: number; descricao: string }
export interface Rodada { id: number; nome: string; ramo: string; estado: "ok" | "falhou" | "rodando" | "cancelado"; quando: string; link: string }

/** Token do GitHub: só letras, números, _ e - (tokens clássicos e "fine-grained"). Nada de espaço nem aspas. */
export const tokenValido = (t: string): boolean => /^[A-Za-z0-9_\-]{20,255}$/.test(t.trim());

export function lerRepos(dados: unknown): Repo[] {
  if (!Array.isArray(dados)) return [];
  const saida: Repo[] = [];
  for (const r of dados) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.full_name !== "string") continue;
    saida.push({
      nome: o.name, completo: o.full_name, privado: o.private === true,
      atualizado: typeof o.pushed_at === "string" ? o.pushed_at : "", abertas: typeof o.open_issues_count === "number" ? o.open_issues_count : 0,
      descricao: typeof o.description === "string" ? o.description.slice(0, 140) : "",
    });
  }
  return saida;
}

export function estadoDaRodada(status: unknown, conclusao: unknown): Rodada["estado"] {
  if (status !== "completed") return "rodando";
  if (conclusao === "success") return "ok";
  if (conclusao === "cancelled" || conclusao === "skipped") return "cancelado";
  return "falhou";
}

export function lerRodadas(dados: unknown): Rodada[] {
  const lista = dados && typeof dados === "object" ? (dados as { workflow_runs?: unknown }).workflow_runs : null;
  if (!Array.isArray(lista)) return [];
  const saida: Rodada[] = [];
  for (const r of lista) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "number") continue;
    const link = typeof o.html_url === "string" && o.html_url.startsWith("https://github.com/") ? o.html_url : "";
    saida.push({ id: o.id, nome: String(o.name ?? o.display_title ?? "Fluxo").slice(0, 80), ramo: String(o.head_branch ?? ""), estado: estadoDaRodada(o.status, o.conclusion), quando: String(o.created_at ?? ""), link });
  }
  return saida;
}

/** O que o painel destaca: a última rodada de cada fluxo que quebrou e ainda não foi seguida por uma verde. */
export function avisosDeBuild(rodadas: Rodada[]): Rodada[] {
  const vistos = new Set<string>(), avisos: Rodada[] = [];
  for (const r of rodadas) { // da mais nova para a mais antiga
    if (vistos.has(r.nome)) continue;
    vistos.add(r.nome);
    if (r.estado === "falhou") avisos.push(r);
  }
  return avisos;
}

export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((agora - t) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}
