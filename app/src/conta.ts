export const SERVIDOR = "https://venus-servidor.tonysantquees95.workers.dev";
export const plataforma = (): "windows" | "web" => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "windows" : "web");

// Vetorial ID: a mesma conta dos outros apps da suíte. A sessão fica só neste computador.
export const CHAVE_SESSAO = "vynx.sessao";
const CHAVE_APARELHO = "vynx.aparelho";
const CHAVE_TOKEN_GITHUB = "vynx.github.token";
export const SITE_DA_CONTA = `${SERVIDOR}/conta.html`;

export interface Sessao { token: string; email: string; nome: string; admin: boolean }
export class ErroConta extends Error { constructor(mensagem: string, public codigo = "") { super(mensagem); } }

export function sessaoGuardada(): Sessao | null {
  try { const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? "null") as Sessao | null; return s && typeof s.token === "string" && s.token ? s : null; } catch { return null; }
}
export function guardarSessao(s: Sessao | null): void {
  try { if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO); } catch { /* sem armazenamento: pede o login de novo */ }
}

function aparelho(): { id: string; nome: string; plataforma: "windows" | "web" } {
  const p = plataforma();
  try { const a = JSON.parse(localStorage.getItem(CHAVE_APARELHO) ?? "null") as { id: string; nome: string; plataforma: "windows" | "web" } | null; if (a?.id) return a; } catch { /* cria um novo */ }
  const id = `vynx-${p}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const a = { id, nome: "Computador (Vynx OS)", plataforma: p };
  try { localStorage.setItem(CHAVE_APARELHO, JSON.stringify(a)); } catch { /* ok */ }
  return a;
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, token?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${SERVIDOR}${caminho}`, { method: metodo, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: AbortSignal.timeout(20000) });
  } catch { throw new ErroConta("Sem conexão com o servidor. Confira a internet."); }
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new ErroConta(typeof d.error === "string" && d.error ? d.error : `Erro ${r.status}`, typeof d.codigo === "string" ? d.codigo : "");
  return d as T;
}

/** Entra com o Vetorial ID. Se for o administrador, já traz o token de leitura do GitHub (só se ainda não houver um neste computador). */
export async function entrar(email: string, senha: string): Promise<Sessao> {
  const r = await chamar<{ token: string; usuario: { email: string; nome?: string } }>("POST", "/id/entrar", { email: email.trim(), senha, dispositivo: aparelho(), app: "vynx" });
  const conta = await chamar<{ admin?: boolean }>("GET", "/id/conta", undefined, r.token).catch(() => ({ admin: false }));
  const s: Sessao = { token: r.token, email: r.usuario.email, nome: r.usuario.nome ?? "", admin: conta.admin === true };
  guardarSessao(s);
  if (s.admin) await puxarGithub(s).catch(() => { /* o painel mostra o aviso e deixa colar um token */ });
  return s;
}

/** Administrador: pede ao servidor o token de leitura do GitHub e guarda neste computador. */
export async function puxarGithub(s: Sessao): Promise<boolean> {
  if (!s.admin) return false;
  try { if (localStorage.getItem(CHAVE_TOKEN_GITHUB)) return true; } catch { /* segue */ }
  const r = await chamar<{ token: string }>("GET", "/id/github", undefined, s.token);
  try { localStorage.setItem(CHAVE_TOKEN_GITHUB, r.token); } catch { return false; }
  return true;
}

export async function sair(): Promise<void> {
  const s = sessaoGuardada();
  guardarSessao(null);
  try { localStorage.removeItem(CHAVE_TOKEN_GITHUB); } catch { /* ok */ }
  if (s) await chamar("POST", "/id/sair", {}, s.token).catch(() => { /* a sessão some no servidor sozinha */ });
}
