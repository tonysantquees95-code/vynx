import { useCallback, useEffect, useRef, useState } from "react";
import { APPS_ANDROID, PERFIS, RAM_E_DISCO, nomeDoCelular, passoAtual, rotuloDoCelular, urlDaApi, urlDoApk, type AppAndroid, type AssetDaRelease, type EstadoAndroid, type PerfilId, type ProgressoAndroid } from "../android";
import { API_GITHUB } from "../github";
import { ponte } from "../ponte";

const LICENCA = "https://developer.android.com/studio/terms";
const cartao = "rounded-2xl border border-borda bg-painel p-5";

/** Android: emulador oficial gerenciado pelo Vynx, para testar os apps sem instalar no telefone. */
export function Android() {
  const [e, setE] = useState<EstadoAndroid | null>(null);
  const [prog, setProg] = useState<ProgressoAndroid | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [aceitou, setAceitou] = useState(false);
  const [perfil, setPerfil] = useState<PerfilId>("celular");
  const [aviso, setAviso] = useState("");
  const vivo = useRef(true);
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
  useEffect(() => { if (!ligando) return; const t = setInterval(() => void ler(), 3000); return () => clearInterval(t); }, [ligando, ler]);

  const iniciarTarefa = async (f: () => Promise<void>) => {
    setErro(""); setAviso("");
    try { await f(); setProg({ ativo: true, tarefa: "", etapa: "Começando…", detalhe: "", erro: null, concluida: false }); } catch (x) { setErro(String(x)); }
  };
  const agir = async (rotulo: string, f: () => Promise<void>) => {
    setOcupado(rotulo); setErro(""); setAviso("");
    try { await f(); await ler(); } catch (x) { setErro(String(x)); } finally { setOcupado(""); }
  };

  const instalar = async (a: AppAndroid) => {
    setErro(""); setAviso("");
    try {
      const token = (() => { try { return localStorage.getItem("vynx.github.token") ?? ""; } catch { return ""; } })();
      const r = await fetch(`${API_GITHUB}/repos/${a.repo}/releases?per_page=20`, { headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!r.ok) throw new Error(a.privado && !token ? `Conecte o GitHub no Painel Dev para testar a ${a.nome}.` : `Não achei a versão mais nova do ${a.nome} no GitHub (erro ${r.status}).`);
      const lista = (await r.json()) as { draft?: boolean; assets?: AssetDaRelease[] }[];
      const rel = lista.find((x) => !x.draft && (x.assets ?? []).some((y) => y.name.toLowerCase() === a.apk.toLowerCase()));
      const url = rel ? (a.privado ? urlDaApi(rel.assets, a.apk) : urlDoApk(rel.assets, a.apk)) : null;
      if (!url) throw new Error(`A versão mais nova do ${a.nome} não tem o arquivo ${a.apk}.`);
      await iniciarTarefa(() => ponte.androidInstalar(url, a.pacote, a.privado ? token : undefined));
    } catch (x) { setErro(x instanceof Error ? x.message : String(x)); }
  };

  if (!e) return <p className="text-suave">{erro || "Procurando o emulador…"}</p>;
  const passo = passoAtual(e);
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold">Android</h1><p className="text-sm text-suave">Teste os seus apps num celular virtual, sem instalar no telefone.</p></div>
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-ok/40 bg-painel p-3 text-sm text-ok">{aviso}</p>}
      {(trabalhando || ocupado) && (
        <div role="status" className="rounded-xl border border-neon/40 bg-painel p-4 text-sm">
          <b className="block">{ocupado || prog?.etapa}</b>
          {prog?.detalhe && <span className="mono mt-1 block truncate text-xs text-suave">{prog.detalhe}</span>}
          <span className="mt-1 block text-xs text-suave">Pode levar vários minutos. Deixe o Vynx aberto.</span>
        </div>
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

      {passo === "usar" && (
        <section className={cartao} aria-label="Instalar apps">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold">Instalar um app</h2><p className="text-xs text-suave">Pega a versão mais nova das releases do GitHub, instala e abre.</p></div>
            <button disabled={!e.pronto || !!ocupado} onClick={() => void agir("Tirando a foto da tela", async () => { const c = await ponte.androidCaptura(); setAviso(`Foto salva em ${c}`); })} className="min-h-11 rounded-xl border border-borda px-4 font-bold disabled:opacity-40">Foto da tela</button>
          </div>
          {!e.pronto && <p className="mt-3 text-sm text-aviso">O celular virtual ainda está ligando. Quando a tela do Android aparecer, é só instalar.</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {APPS_ANDROID.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo p-3">
                <b className="min-w-0 flex-1 truncate">{a.nome}</b>
                <button disabled={!e.pronto || trabalhando || !!ocupado} onClick={() => void instalar(a)} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Instalar e abrir</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
