import { useCallback, useEffect, useState } from "react";
import { API_GITHUB, APPS_DO_PAINEL, avisosDeBuild, lerRodadas, lerVersoes, tamanhoLegivel, tempoRelativo, tokenValido, type AppDoPainel, type Arquivo, type Rodada, type Versao } from "../github";
import { atividade, estadoDoApp, tiraDeBuilds, totais, ultimaPublicacao, type EstadoApp, type ResumoApp } from "../painel";
import { testarNoAndroid } from "../testar";
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

const COR_BUILD: Record<Rodada["estado"], string> = { ok: "bg-ok", falhou: "bg-erro", rodando: "bg-aviso", cancelado: "bg-suave" };
const NOME_BUILD: Record<Rodada["estado"], string> = { ok: "ok", falhou: "falhou", rodando: "rodando", cancelado: "cancelado" };
const ESTADO: Record<EstadoApp, { texto: string; ponto: string; texto_cor: string }> = {
  ok: { texto: "Tudo certo", ponto: "bg-ok", texto_cor: "text-ok" }, falhou: { texto: "Build quebrado", ponto: "bg-erro", texto_cor: "text-erro" },
  rodando: { texto: "Compilando", ponto: "bg-aviso", texto_cor: "text-aviso" }, nd: { texto: "Sem dados", ponto: "bg-suave", texto_cor: "text-suave" },
};

function Indicador({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: "ok" | "erro" | "aviso" }) {
  const cor = tom === "erro" ? "text-erro" : tom === "ok" ? "text-ok" : tom === "aviso" ? "text-aviso" : "text-texto";
  return (
    <div className="rounded-2xl border border-borda bg-painel p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-suave">{rotulo}</p>
      <p className={`mono mt-1 truncate text-2xl font-extrabold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 truncate text-xs text-suave">{detalhe}</p>}
    </div>
  );
}

/** Painel Dev: repositórios e builds do GitHub, com o token do próprio desenvolvedor (guardado só neste computador). */
export function PainelDev({ aoMudarConexao }: { aoMudarConexao?: () => void }) {
  const [token, setToken] = useState(lerToken);
  const [campo, setCampo] = useState("");
  const [aberto, setAberto] = useState<AppDoPainel | null>(null);
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [resumos, setResumos] = useState<ResumoApp[] | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState(0);
  const [carregandoTudo, setCarregandoTudo] = useState(false);

  /** Busca versões e builds de todos os apps de uma vez (em paralelo). */
  const carregarTudo = useCallback(async (t: string) => {
    setCarregandoTudo(true);
    const r = await Promise.all(APPS_DO_PAINEL.map(async (app): Promise<ResumoApp> => {
      const [v, b] = await Promise.allSettled([github(`/repos/${app.repo}/releases?per_page=6`, t), github(`/repos/${app.repo}/actions/runs?per_page=8`, t)]);
      return { app, versao: v.status === "fulfilled" ? lerVersoes(v.value, 1)[0] ?? null : null, rodadas: b.status === "fulfilled" ? lerRodadas(b.value) : [], erro: v.status === "rejected" && b.status === "rejected" };
    }));
    setResumos(r); setAtualizadoEm(Date.now()); setCarregandoTudo(false);
    if (r.every((x) => x.erro)) setErro("Não consegui falar com o GitHub. Confira a internet e o token.");
  }, []);
  useEffect(() => { if (token) void carregarTudo(token); }, [token, carregarTudo]);

  const carregar = useCallback(async (app: AppDoPainel, t: string) => {
    setVersoes(null); setErro("");
    try { setVersoes(lerVersoes(await github(`/repos/${app.repo}/releases?per_page=12`, t))); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui falar com o GitHub."); setVersoes([]); }
  }, []);
  useEffect(() => { if (token && aberto) void carregar(aberto, token); }, [token, aberto, carregar]);

  const testarNoCelular = async (app: AppDoPainel, f: Arquivo) => {
    const a = APPS_ANDROID.find((x) => x.id === app.id);
    if (!a) return;
    setErro(""); setAviso(""); setOcupado(f.url);
    try {
      if (a.privado && !f.api) throw new Error("Não achei o endereço seguro desse arquivo.");
      const motor = await testarNoAndroid({ url: a.privado ? f.api : f.url, pacote: a.pacote, token: a.privado ? token : undefined });
      setAviso(`Testando o ${app.nome} no ${motor === "ldplayer" ? "LDPlayer" : "emulador do Google"}: ele liga sozinho se estiver fechado e instala. Acompanhe na aba Android.`);
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

  const t = resumos ? totais(resumos) : null;
  const ultima = resumos ? ultimaPublicacao(resumos) : null;
  const quebrados = resumos ? resumos.filter((r) => estadoDoApp(r) === "falhou") : [];
  const recente = resumos ? atividade(resumos, 8) : [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Painel Dev</h1><p className="text-sm text-suave">Os seus apps numa olhada: builds, versões e o que acabou de acontecer.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {atualizadoEm > 0 && <span className="text-xs text-suave">atualizado {tempoRelativo(new Date(atualizadoEm).toISOString())}</span>}
          <button onClick={() => void carregarTudo(token)} disabled={carregandoTudo} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-50">{carregandoTudo ? "Atualizando…" : "Atualizar"}</button>
          <button onClick={sair} className="min-h-11 rounded-xl border border-erro/60 px-4 text-erro">Desconectar</button>
        </div>
      </div>
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-neon/40 bg-painel p-3 text-sm text-neon">{aviso}</p>}
      {!resumos && <p role="status" className="text-sm text-suave">Buscando os {APPS_DO_PAINEL.length} apps no GitHub…</p>}
      {t && (
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Apps" valor={String(t.apps)} detalhe={`${t.ok} com build ok`} />
          <Indicador rotulo="Builds quebrados" valor={String(t.quebrados)} tom={t.quebrados > 0 ? "erro" : "ok"} detalhe={t.quebrados > 0 ? "precisam de atenção" : "nenhum, tudo verde"} />
          <Indicador rotulo="Compilando agora" valor={String(t.rodando)} tom={t.rodando > 0 ? "aviso" : undefined} detalhe={t.rodando > 0 ? "aguarde terminar" : "nada em andamento"} />
          <Indicador rotulo="Última publicação" valor={ultima ? ultima.app.nome : "—"} detalhe={ultima ? `${ultima.versao.tag} · ${tempoRelativo(ultima.versao.quando)}` : "sem versões"} />
        </section>
      )}
      {quebrados.length > 0 && (
        <section aria-label="Builds quebrados" className="space-y-2 rounded-2xl border border-erro/50 bg-painel p-4">
          <h2 className="font-bold text-erro">Atenção: {quebrados.length === 1 ? "1 build quebrado" : `${quebrados.length} builds quebrados`}</h2>
          <ul className="space-y-1.5">
            {quebrados.map((r) => { const b = avisosDeBuild(r.rodadas)[0]!; return (
              <li key={r.app.id} className="flex flex-wrap items-center gap-2 text-sm"><b>{r.app.nome}</b><span className="text-suave">{b.nome} · {tempoRelativo(b.quando)}</span>
                {b.link && <button onClick={() => void ponte.abrirLink(b.link)} className="min-h-9 rounded-lg border border-borda px-3 text-xs">Ver no GitHub</button>}</li>
            ); })}
          </ul>
        </section>
      )}
      {resumos && (
        <section aria-label="Apps">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resumos.map((r) => {
              const e = estadoDoApp(r), est = ESTADO[e], sel = aberto?.id === r.app.id;
              return (
                <li key={r.app.id}>
                  <button onClick={() => { setAberto(r.app); setAviso(""); }} aria-pressed={sel} className={`w-full space-y-2 rounded-2xl border-2 p-4 text-left ${sel ? "border-neon bg-neon/10" : "border-borda bg-painel"}`}>
                    <span className="flex items-center justify-between gap-2"><b className="truncate">{r.app.nome}</b><span className={`flex shrink-0 items-center gap-1.5 text-xs ${est.texto_cor}`}><span className={`size-2.5 rounded-full ${est.ponto}`} aria-hidden />{est.texto}</span></span>
                    <span className="block text-xs text-suave">{r.app.plataforma}</span>
                    <span className="flex items-center justify-between gap-2 text-sm"><span className="mono text-neon">{r.versao ? r.versao.tag : "sem versão"}</span><span className="text-xs text-suave">{r.versao ? tempoRelativo(r.versao.quando) : ""}</span></span>
                    <span className="flex items-center gap-1" role="img" aria-label={tiraDeBuilds(r).length ? `Últimos builds: ${tiraDeBuilds(r).map((x) => NOME_BUILD[x]).join(", ")}` : "Sem builds"}>
                      {tiraDeBuilds(r).length === 0 ? <span className="text-xs text-suave">sem builds</span> : tiraDeBuilds(r).map((x, i) => <span key={i} className={`h-2 flex-1 rounded-full ${COR_BUILD[x]}`} />)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {aberto && (
        <section aria-label="Versões" className="rounded-2xl border border-borda bg-painel p-4">
          {versoes === null ? <p className="text-suave">Carregando versões…</p> : versoes.length === 0 ? <p className="text-suave">{erro ? "Toque em outro app e volte para tentar de novo." : `O ${aberto.nome} ainda não tem versões publicadas.`}</p> : (
            <>
              <h2 className="font-bold">{aberto.nome}: última e anterior</h2>
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
                            {apk && <button onClick={() => void testarNoCelular(aberto, f)} disabled={!!ocupado} className="min-h-10 rounded-lg border border-neon px-3 text-xs font-bold text-neon disabled:opacity-40">Testar no Android</button>}
                            {/\.apk$/i.test(f.nome)
                              ? (!apk && <span className="text-xs text-suave">APK é para celular Android</span>)
                              : <button onClick={() => void ponte.abrirLink(f.url)} className="min-h-10 rounded-lg border border-borda px-3 text-xs">Baixar</button>}
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
      )}
      {recente.length > 0 && (
        <section aria-label="Atividade recente" className="rounded-2xl border border-borda bg-painel p-4">
          <h2 className="font-bold">Atividade recente</h2>
          <ul className="mt-3 divide-y divide-borda">
            {recente.map(({ app, rodada }) => (
              <li key={rodada.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={`size-2.5 shrink-0 rounded-full ${COR_BUILD[rodada.estado]}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate"><b>{app.nome}</b> <span className="text-suave">{rodada.nome}{rodada.ramo ? ` · ${rodada.ramo}` : ""}</span></span>
                <span className="shrink-0 text-xs text-suave">{NOME_BUILD[rodada.estado]} · {tempoRelativo(rodada.quando)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
