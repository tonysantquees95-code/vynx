import { useCallback, useEffect, useState } from "react";
import { API_GITHUB, APPS_DO_PAINEL, lerVersoes, tamanhoLegivel, tempoRelativo, tokenValido, type AppDoPainel, type Versao } from "../github";
import { APPS_ANDROID } from "../android";
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
  const [aberto, setAberto] = useState<AppDoPainel | null>(null);
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(async (app: AppDoPainel, t: string) => {
    setVersoes(null); setErro("");
    try { setVersoes(lerVersoes(await github(`/repos/${app.repo}/releases?per_page=12`, t))); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui falar com o GitHub."); setVersoes([]); }
  }, []);
  useEffect(() => { if (token && aberto) void carregar(aberto, token); }, [token, aberto, carregar]);

  const testarNoCelular = async (app: AppDoPainel, url: string) => {
    const a = APPS_ANDROID.find((x) => x.id === app.id);
    if (!a) return;
    setErro(""); setAviso(""); setOcupado(url);
    try {
      const e = await ponte.androidEstado();
      if (!e.pronto) throw new Error("Ligue um celular virtual na aba Android primeiro e espere a tela do Android aparecer.");
      await ponte.androidInstalar(url, a.pacote);
      setAviso(`Instalando o ${app.nome} no celular virtual. Acompanhe na aba Android.`);
    } catch (x) { setErro(x instanceof Error ? x.message : String(x)); } finally { setOcupado(""); }
  };

  const conectar = () => { const t = campo.trim(); if (!tokenValido(t)) { setErro("Esse token não parece certo: ele tem só letras, números, _ e -, sem espaços."); return; } guardarToken(t); setToken(t); setCampo(""); aoMudarConexao?.(); };
  const sair = () => { guardarToken(""); setToken(""); setAberto(null); setVersoes(null); setErro(""); aoMudarConexao?.(); };

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Painel Dev</h1><p className="text-sm text-suave">As versões dos seus apps: teste a última ou volte para a anterior.</p></div>
        <button onClick={sair} className="min-h-11 rounded-xl border border-erro/60 px-4 text-erro">Desconectar</button>
      </div>
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-neon/40 bg-painel p-3 text-sm text-neon">{aviso}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <ul className="space-y-2" aria-label="Apps">
          {APPS_DO_PAINEL.map((a) => (
            <li key={a.id}>
              <button onClick={() => { setAberto(a); setAviso(""); }} aria-pressed={aberto?.id === a.id} className={`w-full rounded-2xl border p-3 text-left ${aberto?.id === a.id ? "border-neon bg-neon/10" : "border-borda bg-painel"}`}>
                <b className="block truncate">{a.nome}</b><span className="text-xs text-suave">{a.plataforma}</span>
              </button>
            </li>
          ))}
        </ul>
        <section aria-label="Versões" className="rounded-2xl border border-borda bg-painel p-4">
          {!aberto ? <p className="text-suave">Escolha um app para ver a última versão e a anterior.</p> : versoes === null ? <p className="text-suave">Carregando versões…</p> : versoes.length === 0 ? <p className="text-suave">{erro ? "Toque em outro app e volte para tentar de novo." : `O ${aberto.nome} ainda não tem versão publicada para baixar.`}</p> : (
            <>
              <h2 className="font-bold">{aberto.nome}</h2>
              <ul className="mt-3 space-y-3">
                {versoes.map((v, i) => (
                  <li key={v.tag} className="rounded-xl border border-borda p-3">
                    <div className="flex flex-wrap items-center gap-2"><b>{i === 0 ? "Última versão" : "Versão anterior"}</b><span className="mono text-sm text-neon">{v.tag}</span><span className="text-xs text-suave">{tempoRelativo(v.quando)}</span></div>
                    <ul className="mt-2 space-y-2">
                      {v.arquivos.map((f) => {
                        const apk = /\.apk$/i.test(f.nome) && APPS_ANDROID.some((x) => x.id === aberto.id && x.apk.toLowerCase() === f.nome.toLowerCase());
                        return (
                          <li key={f.url} className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm">{f.nome} <span className="text-xs text-suave">{tamanhoLegivel(f.tamanho)}</span></span>
                            {apk && <button onClick={() => void testarNoCelular(aberto, f.url)} disabled={!!ocupado} className="min-h-10 rounded-lg border border-neon px-3 text-xs font-bold text-neon disabled:opacity-40">Testar no celular virtual</button>}
                            <button onClick={() => void ponte.abrirLink(f.url)} className="min-h-10 rounded-lg border border-borda px-3 text-xs">Baixar</button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
