import { useCallback, useEffect, useState } from "react";
import { API_GITHUB, avisosDeBuild, lerRepos, lerRodadas, tempoRelativo, tokenValido, type Repo, type Rodada } from "../github";
import { ponte } from "../ponte";

const CHAVE = "vynx.github.token";
const lerToken = (): string => { try { return localStorage.getItem(CHAVE) ?? ""; } catch { return ""; } };
export const guardarToken = (t: string): void => { try { if (t) localStorage.setItem(CHAVE, t); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } };

async function github(caminho: string, token: string): Promise<unknown> {
  const r = await fetch(`${API_GITHUB}${caminho}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } });
  if (r.status === 401) throw new Error("O GitHub não aceitou esse token. Confira se ele está certo e não expirou.");
  if (!r.ok) throw new Error(`O GitHub respondeu com erro (${r.status}).`);
  return r.json();
}

const ROTULO = { ok: ["ok", "bg-ok"], falhou: ["falhou", "bg-erro"], rodando: ["rodando", "bg-aviso"], cancelado: ["cancelado", "bg-suave"] } as const;

/** Painel Dev: repositórios e builds do GitHub, com o token do próprio desenvolvedor (guardado só neste computador). */
export function PainelDev({ aoMudarConexao }: { aoMudarConexao?: () => void }) {
  const [token, setToken] = useState(lerToken);
  const [campo, setCampo] = useState("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (t: string) => {
    try { setRepos(lerRepos(await github("/user/repos?sort=pushed&per_page=30", t))); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui falar com o GitHub."); setRepos([]); }
  }, []);
  useEffect(() => { if (token) void carregar(token); }, [token, carregar]);
  useEffect(() => {
    if (!token || !aberto) { setRodadas(null); return; }
    setRodadas(null);
    github(`/repos/${aberto}/actions/runs?per_page=10`, token).then((d) => setRodadas(lerRodadas(d))).catch((e) => { setErro(e instanceof Error ? e.message : "Erro."); setRodadas([]); });
  }, [aberto, token]);

  const conectar = () => { const t = campo.trim(); if (!tokenValido(t)) { setErro("Esse token não parece certo: ele tem só letras, números, _ e -, sem espaços."); return; } guardarToken(t); setToken(t); setCampo(""); aoMudarConexao?.(); };
  const sair = () => { guardarToken(""); setToken(""); setRepos(null); setAberto(null); setErro(""); aoMudarConexao?.(); };

  if (!token) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Painel Dev</h1>
      <div className="space-y-3 rounded-2xl border border-borda bg-painel p-5">
        <h2 className="font-bold">Conectar ao GitHub</h2>
        <p className="text-sm text-suave">Cole um token do GitHub com permissão <b className="text-texto">somente leitura</b> (repositórios e Actions). Ele fica só neste computador e nunca vai para os servidores da Vetorial.</p>
        <label className="block text-sm text-suave">Token
          <input type="password" value={campo} onChange={(e) => setCampo(e.target.value)} autoComplete="off" spellCheck={false} placeholder="ghp_…" className="mono mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-texto outline-none focus:border-neon" />
        </label>
        {erro && <p role="alert" className="text-sm text-erro">{erro}</p>}
        <div className="flex flex-wrap gap-3">
          <button onClick={conectar} disabled={!campo.trim()} className="min-h-11 rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40">Conectar</button>
          <button onClick={() => void ponte.abrirLink("https://github.com/settings/personal-access-tokens/new")} className="min-h-11 rounded-xl border border-borda px-5">Criar um token no GitHub</button>
        </div>
      </div>
    </div>
  );

  const avisos = rodadas ? avisosDeBuild(rodadas) : [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Painel Dev</h1><p className="text-sm text-suave">Seus repositórios no GitHub, do mais recente para o mais antigo.</p></div>
        <div className="flex gap-2"><button onClick={() => void carregar(token)} className="min-h-11 rounded-xl border border-borda px-4">Atualizar</button><button onClick={sair} className="min-h-11 rounded-xl border border-erro/60 px-4 text-erro">Desconectar</button></div>
      </div>
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {repos === null ? <p className="text-suave">Carregando…</p> : repos.length === 0 && !erro ? <p className="text-suave">Nenhum repositório encontrado para esse token.</p> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="space-y-2">
            {repos.map((r) => (
              <li key={r.completo}>
                <button onClick={() => setAberto(r.completo)} aria-pressed={aberto === r.completo} className={`w-full rounded-2xl border p-4 text-left ${aberto === r.completo ? "border-neon bg-neon/10" : "border-borda bg-painel"}`}>
                  <div className="flex items-center gap-2"><b className="truncate">{r.nome}</b>{r.privado && <span className="rounded-full bg-magenta/20 px-2 py-0.5 text-[10px] font-bold uppercase text-magenta">privado</span>}</div>
                  {r.descricao && <p className="mt-0.5 truncate text-xs text-suave">{r.descricao}</p>}
                  <p className="mt-1 text-xs text-suave">{tempoRelativo(r.atualizado)}{r.abertas > 0 ? ` · ${r.abertas} abertas` : ""}</p>
                </button>
              </li>
            ))}
          </ul>
          <section aria-label="Builds" className="rounded-2xl border border-borda bg-painel p-4">
            {!aberto ? <p className="text-suave">Escolha um repositório para ver as últimas builds.</p> : rodadas === null ? <p className="text-suave">Carregando builds…</p> : (
              <>
                <h2 className="font-bold">{aberto}</h2>
                {avisos.length > 0 && <p role="alert" className="mt-2 rounded-xl bg-erro/15 p-3 text-sm text-erro">⚠ Build quebrada: {avisos.map((a) => a.nome).join(", ")}</p>}
                {rodadas.length === 0 ? <p className="mt-2 text-sm text-suave">Esse repositório ainda não tem builds (GitHub Actions).</p> : (
                  <ul className="mt-3 space-y-2">
                    {rodadas.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl border border-borda p-3">
                        <span className={`size-2.5 shrink-0 rounded-full ${ROTULO[r.estado][1]}`} aria-hidden />
                        <div className="min-w-0 flex-1"><b className="block truncate text-sm">{r.nome}</b><span className="text-xs text-suave">{ROTULO[r.estado][0]} · {r.ramo} · {tempoRelativo(r.quando)}</span></div>
                        {r.link && <button onClick={() => void ponte.abrirLink(r.link)} className="min-h-10 rounded-lg border border-borda px-3 text-xs">Abrir</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
