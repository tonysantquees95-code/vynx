import { useCallback, useEffect, useRef, useState } from "react";
import { APPS_ANDROID, LD_SITE, PERFIS, guardarMotor, motorGuardado, type EstadoLd, type Motor, RAM_E_DISCO, nomeDoCelular, passoAtual, rotuloDoCelular, urlDaApi, urlDoApk, type AppAndroid, type AssetDaRelease, type EstadoAndroid, type PerfilId, type ProgressoAndroid } from "../android";
import { API_GITHUB } from "../github";
import { ponte } from "../ponte";
import { porcentagem } from "../andamento";
import { Andamento } from "./Andamento";

const LICENCA = "https://developer.android.com/studio/terms";
const cartao = "rounded-2xl border border-borda bg-painel p-5";

/** Acha o endereço do APK mais novo de um app (releases do GitHub). */
async function resolverApk(a: AppAndroid): Promise<{ url: string; token?: string }> {
  const token = (() => { try { return localStorage.getItem("vynx.github.token") ?? ""; } catch { return ""; } })();
  const r = await fetch(`${API_GITHUB}/repos/${a.repo}/releases?per_page=20`, { headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!r.ok) throw new Error(a.privado && !token ? `Conecte o GitHub no Painel Dev para testar a ${a.nome}.` : `Não achei a versão mais nova do ${a.nome} no GitHub (erro ${r.status}).`);
  const lista = (await r.json()) as { draft?: boolean; assets?: AssetDaRelease[] }[];
  const rel = lista.find((x) => !x.draft && (x.assets ?? []).some((y) => y.name.toLowerCase() === a.apk.toLowerCase()));
  const url = rel ? (a.privado ? urlDaApi(rel.assets, a.apk) : urlDoApk(rel.assets, a.apk)) : null;
  if (!url) throw new Error(`A versão mais nova do ${a.nome} não tem o arquivo ${a.apk}.`);
  return { url, token: a.privado ? token : undefined };
}


/** Emulador oficial do Google (mais pesado), gerenciado pelo Vynx. */
function AndroidOficial() {
  const [e, setE] = useState<EstadoAndroid | null>(null);
  const [prog, setProg] = useState<ProgressoAndroid | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [aceitou, setAceitou] = useState(false);
  const [perfil, setPerfil] = useState<PerfilId>("celular");
  const [aviso, setAviso] = useState("");
  const vivo = useRef(true);
  const [tOcupado, setTOcupado] = useState(0);
  const [tLigando, setTLigando] = useState(0);
  useEffect(() => () => { vivo.current = false; }, []);

  const ler = useCallback(async () => {
    try { const s = await ponte.androidEstado(); if (vivo.current) { setE(s); setErro(""); } }
    catch (x) { if (vivo.current) setErro(String(x)); }
  }, []);
  useEffect(() => { void ler(); }, [ler]);

  // enquanto uma tarefa roda, acompanha o progresso; ao terminar, relê o estado
  const trabalhando = prog?.ativo === true;
  useEffect(() => {
    if (!trabalhando) return;
    const t = setInterval(async () => {
      try { const p = await ponte.androidProgresso(); if (!vivo.current) return; setProg(p); if (!p.ativo) { void ler(); if (p.erro) setErro(p.erro); } } catch { /* tenta de novo */ }
    }, 1000);
    return () => clearInterval(t);
  }, [trabalhando, ler]);
  // enquanto o celular liga, confere até ficar pronto
  const ligando = !!e?.ligado && !e.pronto;
  useEffect(() => { if (ligando) setTLigando((t) => t || Date.now()); else setTLigando(0); }, [ligando]);
  useEffect(() => { if (!ligando) return; const t = setInterval(() => void ler(), 3000); return () => clearInterval(t); }, [ligando, ler]);

  const iniciarTarefa = async (f: () => Promise<void>) => {
    setErro(""); setAviso("");
    try { await f(); setProg({ ativo: true, tarefa: "", etapa: "Começando…", detalhe: "", erro: null, concluida: false }); } catch (x) { setErro(String(x)); }
  };
  const agir = async (rotulo: string, f: () => Promise<void>) => {
    setOcupado(rotulo); setTOcupado(Date.now()); setErro(""); setAviso("");
    try { await f(); await ler(); } catch (x) { setErro(String(x)); } finally { setOcupado(""); }
  };

  const instalar = async (a: AppAndroid) => {
    setErro(""); setAviso("");
    try {
      const { url, token } = await resolverApk(a);
      if (e && !e.ligado && e.celulares[0]) await ponte.androidLigar(e.celulares[0]); // se estiver desligado, liga sozinho; a instalação espera o Android ficar pronto
      await iniciarTarefa(() => ponte.androidInstalar(url, a.pacote, token));
    } catch (x) { setErro(x instanceof Error ? x.message : String(x)); }
  };

  if (!e) return <p className="text-suave">{erro || "Procurando o emulador…"}</p>;
  const passo = passoAtual(e);
  return (
    <div className="space-y-5">
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-ok/40 bg-painel p-3 text-sm text-ok">{aviso}</p>}
      {(trabalhando || ocupado) && (
        <Andamento titulo={ocupado || (prog?.tarefa === "instalar" ? "Instalando o app no celular virtual" : "Preparando o emulador do Android")} etapa={ocupado ? undefined : prog?.etapa} detalhe={ocupado ? undefined : prog?.detalhe}
          inicio={ocupado ? tOcupado : (prog?.inicio ?? 0) * 1000 || Date.now()} noticia={ocupado ? tOcupado : (prog?.noticia ?? 0) * 1000 || Date.now()}
          porcentagem={!ocupado && prog?.passos ? porcentagem(Math.max(1, prog.passo ?? 1), prog.passos) : null}
          filhos={ocupado ? <p className="text-xs text-suave">Isso pode levar alguns minutos.</p> : prog?.tarefa === "preparar" ? <p className="text-xs text-suave">São uns 3 GB: no seu computador a parte do emulador é a mais demorada. O tamanho baixado aparece acima.</p> : undefined} />
      )}
      {e.ligado && !e.pronto && !trabalhando && !ocupado && (
        <Andamento titulo="Ligando o celular virtual" etapa="O Android está ligando. Na primeira vez demora bastante em computador mais fraco; depois volta do instantâneo em segundos." inicio={tLigando} noticia={tLigando}
          aoCancelar={() => void agir("Desligando", () => ponte.androidDesligar())} rotuloCancelar="Desligar" />
      )}

      {passo === "preparar" && (
        <section className={cartao} aria-label="Preparar o emulador">
          <h2 className="text-lg font-extrabold">1. Preparar o emulador</h2>
          <p className="mt-1 text-sm text-suave">O Vynx baixa o emulador oficial do Android e o Java que ele precisa, só para o seu usuário (nada é instalado no sistema). Precisa de {RAM_E_DISCO}.</p>
          {e.aceleracao === false && <p className="mt-3 rounded-xl border border-aviso/40 p-3 text-sm text-aviso">A virtualização parece desligada. Ative “Intel VT-x” ou “AMD-V” na BIOS e, no Windows, a “Plataforma de Hipervisor do Windows”. Sem isso o emulador fica muito lento.</p>}
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={aceitou} onChange={(x) => setAceitou(x.target.checked)} className="mt-0.5 size-5 accent-neon" />
            <span>Li e aceito a licença do Android SDK. <button type="button" onClick={() => void ponte.abrirLink(LICENCA)} className="text-neon underline">Ler a licença</button></span>
          </label>
          <button disabled={!aceitou || trabalhando} onClick={() => void iniciarTarefa(() => ponte.androidPreparar())} className="mt-4 min-h-11 w-full rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40 sm:w-auto">Preparar emulador</button>
        </section>
      )}

      {e.preparado && (
        <section className={cartao} aria-label="Celulares virtuais">
          <h2 className="text-lg font-extrabold">{passo === "celular" ? "2. Criar um celular virtual" : "Celulares virtuais"}</h2>
          {e.celulares.length > 0 && (
            <ul className="mt-3 space-y-3">
              {e.celulares.map((n) => {
                const esteLigado = !!e.ligado;
                return (
                  <li key={n} className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-fundo p-3">
                    <span className={`size-2.5 rounded-full ${e.ligado ? (e.pronto ? "bg-ok" : "bg-aviso") : "bg-suave"}`} aria-hidden />
                    <div className="min-w-0 flex-1"><b className="block truncate">{rotuloDoCelular(n)}</b><span className="text-xs text-suave">{!esteLigado ? "desligado" : e.pronto ? "ligado" : "ligando…"}</span></div>
                    {!esteLigado
                      ? <button onClick={() => void agir("Ligando o celular virtual", () => ponte.androidLigar(n))} disabled={!!ocupado || trabalhando} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Ligar</button>
                      : <button onClick={() => void agir("Desligando", () => ponte.androidDesligar())} disabled={!!ocupado} className="min-h-11 rounded-xl border border-erro/60 px-4 font-bold text-erro disabled:opacity-40">Desligar</button>}
                  </li>
                );
              })}
            </ul>
          )}
          <fieldset className="mt-4">
            <legend className="text-sm text-suave">Novo celular virtual</legend>
            <div role="radiogroup" aria-label="Tipo de aparelho" className="mt-2 grid gap-3 sm:grid-cols-3">
              {PERFIS.map((p) => {
                const sel = perfil === p.id;
                return (
                  <button key={p.id} role="radio" aria-checked={sel} onClick={() => setPerfil(p.id)}
                    className={`min-h-16 rounded-xl border-2 p-3 text-left ${sel ? "border-neon bg-neon/10" : "border-borda"}`}>
                    <b className="flex items-center justify-between gap-2">{p.rotulo}{sel && <span aria-hidden className="text-neon">✓</span>}</b>
                    <span className="block text-xs text-suave">{p.texto}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button onClick={() => void agir("Criando o celular virtual", async () => { await ponte.androidCriar(perfil); })} disabled={!!ocupado || trabalhando || e.celulares.includes(nomeDoCelular(perfil))}
            className="mt-4 min-h-11 w-full rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40 sm:w-auto">
            {e.celulares.includes(nomeDoCelular(perfil)) ? "Esse já existe" : "Criar celular virtual"}
          </button>
        </section>
      )}

      {(passo === "usar" || passo === "ligar") && (
        <section className={cartao} aria-label="Instalar apps">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Instalar um app</h2><p className="text-xs text-suave">Pega a versão mais nova das releases do GitHub, liga o celular virtual se estiver desligado, instala e abre.</p></div>
            <button disabled={!e.pronto || !!ocupado} onClick={() => void agir("Tirando a foto da tela", async () => { const c = await ponte.androidCaptura(); setAviso(`Foto salva em ${c}`); })} className="min-h-11 rounded-xl border border-borda px-4 font-bold disabled:opacity-40">Foto da tela</button>
          </div>
          {e.ligado && !e.pronto && <p className="mt-3 text-sm text-aviso">O celular virtual ainda está ligando. A primeira vez demora uns 5 a 10 minutos (o Windows monta o Android do zero); depois fica bem mais rápido. Quando a tela do Android aparecer, é só instalar.</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {APPS_ANDROID.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo p-3">
                <b className="min-w-0 flex-1 truncate">{a.nome}</b>
                <button disabled={trabalhando || !!ocupado} onClick={() => void instalar(a)} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Instalar e abrir</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** LDPlayer: emulador de Android leve, feito para computador fraco. O Vynx controla; a instalação do LDPlayer é sua. */
function AndroidLd() {
  const [ld, setLd] = useState<EstadoLd | null>(null);
  const [prog, setProg] = useState<ProgressoAndroid | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  const ler = useCallback(async () => { try { const s = await ponte.ldEstado(); if (vivo.current) setLd(s); } catch (x) { if (vivo.current) setErro(String(x)); } }, []);
  useEffect(() => { void ler(); }, [ler]);
  const trabalhando = prog?.ativo === true;
  useEffect(() => {
    if (!trabalhando) return;
    const t = setInterval(async () => {
      try { const p = await ponte.androidProgresso(); if (!vivo.current) return; setProg(p); if (!p.ativo) { void ler(); if (p.erro) setErro(p.erro); else if (p.concluida) setAviso("Pronto! O app está aberto no LDPlayer."); } } catch { /* tenta de novo */ }
    }, 1000);
    return () => clearInterval(t);
  }, [trabalhando, ler]);
  const comecar = async (f: () => Promise<void>) => {
    setErro(""); setAviso("");
    try { await f(); setProg({ ativo: true, tarefa: "", etapa: "Começando…", detalhe: "", erro: null, concluida: false }); } catch (x) { setErro(String(x)); }
  };
  const testar = async (a: AppAndroid) => {
    setErro(""); setAviso("");
    try { const { url, token } = await resolverApk(a); await comecar(() => ponte.ldTestar(url, a.pacote, token)); } catch (x) { setErro(x instanceof Error ? x.message : String(x)); }
  };
  if (!ld) return <p className="text-suave">{erro || "Procurando o LDPlayer…"}</p>;
  const estado = !ld.instancia ? "ainda não criado" : ld.pronta ? "ligado" : ld.ligada ? "ligando…" : "desligado";
  return (
    <div className="space-y-5">
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-ok/40 bg-painel p-3 text-sm text-ok">{aviso}</p>}
      {trabalhando && (
        <Andamento titulo={prog?.tarefa === "ld-ligar" ? "Ligando o LDPlayer" : "Testando no LDPlayer"} etapa={prog?.etapa} detalhe={prog?.detalhe}
          inicio={(prog?.inicio ?? 0) * 1000 || Date.now()} noticia={(prog?.noticia ?? 0) * 1000 || Date.now()}
          porcentagem={prog?.passos ? porcentagem(Math.max(1, prog.passo ?? 1), prog.passos) : null}
          filhos={<p className="text-xs text-suave">A primeira vez demora mais (o LDPlayer monta o Android). Depois liga em poucos segundos.</p>} />
      )}
      {!ld.instalado ? (
        <section className={cartao} aria-label="Instalar o LDPlayer">
          <h2 className="text-lg font-extrabold">1. Instalar o LDPlayer</h2>
          <p className="mt-1 text-sm text-suave">O LDPlayer é um emulador de Android grátis e leve, bom para computador mais fraco. O Vynx não instala programas de terceiros: baixe no site oficial e instale como qualquer programa (pode deixar a pasta padrão, C:\LDPlayer). Depois volte aqui.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => void ponte.abrirLink(LD_SITE)} className="min-h-11 rounded-xl bg-neon px-5 font-extrabold text-fundo">Abrir o site do LDPlayer</button>
            <button onClick={() => void ler()} className="min-h-11 rounded-xl border border-borda px-5">Já instalei, conferir de novo</button>
          </div>
        </section>
      ) : (
        <>
          <section className={cartao} aria-label="Celular virtual do LDPlayer">
            <h2 className="text-lg font-extrabold">Celular virtual do Vynx</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-fundo p-3">
              <span className={`size-2.5 rounded-full ${ld.pronta ? "bg-ok" : ld.ligada ? "bg-aviso" : "bg-suave"}`} aria-hidden />
              <div className="min-w-0 flex-1"><b className="block">LDPlayer · Vynx</b><span className="text-xs text-suave">{estado} · configurado leve: 2 núcleos e 2 GB de memória</span></div>
              {ld.ligada
                ? <button onClick={() => void ponte.ldDesligar().then(ler).catch((x) => setErro(String(x)))} disabled={trabalhando} className="min-h-11 rounded-xl border border-erro/60 px-4 font-bold text-erro disabled:opacity-40">Desligar</button>
                : <button onClick={() => void comecar(() => ponte.ldLigar())} disabled={trabalhando} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Ligar</button>}
            </div>
            <p className="mt-2 text-xs text-suave">Dica: deixe só este celular aberto e feche outros programas pesados. A faixa no topo mostra o uso do computador.</p>
          </section>
          <section className={cartao} aria-label="Testar apps">
            <h2 className="text-lg font-extrabold">Testar um app</h2>
            <p className="text-xs text-suave">Um toque faz tudo: baixa a versão mais nova, liga o celular virtual se estiver fechado, instala e abre.</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {APPS_ANDROID.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo p-3">
                  <b className="min-w-0 flex-1 truncate">{a.nome}</b>
                  <button disabled={trabalhando} onClick={() => void testar(a)} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Testar</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/** Android: escolha do emulador (LDPlayer leve ou o oficial do Google) e testes dos apps sem instalar no telefone. */
export function Android() {
  const [motor, setMotor] = useState<Motor>(motorGuardado);
  const escolher = (m: Motor) => { setMotor(m); guardarMotor(m); };
  const opcoes: { id: Motor; nome: string; texto: string }[] = [
    { id: "ldplayer", nome: "LDPlayer", texto: "Leve e rápido. Recomendado para o seu computador." },
    { id: "oficial", nome: "Emulador do Google", texto: "Mais pesado. Use se o LDPlayer não servir." },
  ];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold">Android</h1><p className="text-sm text-suave">Teste os seus apps num celular virtual, sem instalar no telefone.</p></div>
      <div role="radiogroup" aria-label="Emulador" className="grid gap-3 sm:grid-cols-2">
        {opcoes.map((o) => {
          const sel = motor === o.id;
          return (
            <button key={o.id} role="radio" aria-checked={sel} onClick={() => escolher(o.id)} className={`min-h-16 rounded-xl border-2 p-3 text-left ${sel ? "border-neon bg-neon/10" : "border-borda"}`}>
              <b className="flex items-center justify-between gap-2">{o.nome}{sel && <span aria-hidden className="text-neon">✓</span>}</b>
              <span className="block text-xs text-suave">{o.texto}</span>
            </button>
          );
        })}
      </div>
      {motor === "ldplayer" ? <AndroidLd /> : <AndroidOficial />}
    </div>
  );
}
