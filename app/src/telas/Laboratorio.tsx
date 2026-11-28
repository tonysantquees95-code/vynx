import { IconeTour } from "../icones";
import { useCallback, useEffect, useRef, useState } from "react";
import { bases, laboratorios, limparNome, nomeValido, type EstadoWsl } from "../laboratorio";
import { ponte } from "../ponte";
import { lerLinha, porcentagem } from "../andamento";
import { Andamento } from "./Andamento";

const PRINCIPAL = "principal";

/** Laboratório: ambientes Linux isolados e descartáveis, um por teste. */
export function Laboratorio() {
  const [estado, setEstado] = useState<EstadoWsl | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [base, setBase] = useState("");
  const [descartar, setDescartar] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [linhas, setLinhas] = useState<string[]>([]);
  const [marcas, setMarcas] = useState({ inicio: 0, noticia: 0, vivo: null as number | null });
  const [labAtual, setLabAtual] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let parar: (() => void) | null = null, vivo = true;
    void ponte.importarOuvir((l) => {
      const agora = Date.now(), k = lerLinha(l);
      setMarcas((m) => ({ ...m, vivo: agora, noticia: k.tipo === "vivo" ? m.noticia : agora }));
      if (k.tipo !== "vivo") setLinhas((x) => [...x.slice(-199), l]);
    }).then((p) => { if (vivo) parar = p; else p(); });
    return () => { vivo = false; parar?.(); };
  }, []);
  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest" }); }, [linhas]);

  const ler = useCallback(async () => {
    try { const e = await ponte.estadoWsl(); setEstado(e); setErro(""); setBase((b) => b || bases(e.distros)[0]?.nome || ""); }
    catch (e) { setErro(String(e)); setEstado({ instalado: false, virtualizacao: null, distros: [] }); }
  }, []);
  useEffect(() => { void ler(); }, [ler]);

  const executar = async (rotulo: string, f: () => Promise<void>) => {
    setOcupado(rotulo); setErro(""); setLinhas([]);
    const t0 = Date.now(); setMarcas({ inicio: t0, noticia: t0, vivo: null });
    try { await f(); await ler(); } catch (e) { setErro(String(e)); } finally { setOcupado(""); }
  };

  const importar = async (lab: string) => {
    setAviso("");
    const token = (() => { try { return localStorage.getItem("vynx.github.token") ?? ""; } catch { return ""; } })();
    if (!token) { setErro("Conecte o GitHub no Painel Dev antes de importar os projetos."); return; }
    setLabAtual(lab);
    await executar("Importando os projetos", async () => { setAviso(await ponte.importarProjetos(lab, token)); });
  };

  const criarPrincipal = async () => {
    setAviso("");
    const token = (() => { try { return localStorage.getItem("vynx.github.token") ?? ""; } catch { return ""; } })();
    if (!token) { setErro("Conecte o GitHub no Painel Dev antes de criar o laboratório principal."); return; }
    await executar("Montando o laboratório principal", async () => {
      setAviso("1 de 3: criando o Linux…");
      await ponte.criarLaboratorio(base, PRINCIPAL);
      setAviso("2 de 3: trazendo os seus projetos do GitHub…"); setLabAtual(PRINCIPAL);
      const r = await ponte.importarProjetos(PRINCIPAL, token);
      setAviso(`${r} 3 de 3: abrindo o terminal que instala o Claude. Quando ele terminar, digite claude.`);
      await ponte.instalarClaude(PRINCIPAL);
    });
  };

  if (!estado) return <p className="text-suave">Procurando o WSL…</p>;
  if (!estado.instalado) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Laboratório</h1>
      <div className="rounded-2xl border border-aviso/40 bg-painel p-5">
        <h2 className="font-bold text-aviso">O WSL2 ainda não está instalado</h2>
        <p className="mt-1 text-sm text-suave">O laboratório usa o Linux do Windows (WSL2). Para ligar:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-suave">
          <li>Abra o Terminal do Windows como administrador.</li>
          <li>Digite <code className="mono rounded bg-fundo px-1.5 py-0.5 text-neon">wsl --install</code> e aperte Enter.</li>
          <li>Reinicie o computador quando pedir. Se der erro de virtualização, ligue-a na BIOS.</li>
          <li>Volte aqui e toque em Verificar de novo.</li>
        </ol>
        <button onClick={() => void ler()} className="mt-4 rounded-xl border border-neon px-4 py-2 font-bold text-neon">Verificar de novo</button>
      </div>
    </div>
  );

  const labs = laboratorios(estado.distros), opcoes = bases(estado.distros);
  const podeCriar = nomeValido(nome) && !!base && !labs.some((l) => l.nome === nome) && !ocupado;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Laboratório</h1><p className="text-sm text-suave">Um Linux isolado para cada teste. Sem acesso aos arquivos do Windows.</p></div>
        <button onClick={() => setCriando(true)} disabled={!!ocupado} className="min-h-11 rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40">+ Criar laboratório</button>
      </div>
      {erro && <p role="alert" className="rounded-xl border border-erro/40 bg-painel p-3 text-sm text-erro">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-neon/40 bg-painel p-3 text-sm text-neon">{aviso}</p>}
      {ocupado && (() => {
        let etapa = "", ep = 0, ets = 0, pa = 0, pt = 0;
        for (const l of linhas) { const k = lerLinha(l); if (k.tipo === "etapa") { etapa = k.texto; ep = k.atual; ets = k.total; } else if (k.tipo === "projeto") { pa = k.atual; pt = k.total; } }
        const pct = ets ? porcentagem(ep, ets, ep === 3 && pt ? (pa - 1) / pt : 0) : null;
        const sempre = ocupado.startsWith("Importando") || ocupado.startsWith("Montando");
        return (
          <Andamento titulo={ocupado} etapa={etapa ? `Etapa ${ep} de ${ets}: ${etapa}${ep === 3 && pt ? ` (projeto ${pa} de ${pt})` : ""}` : "Começando…"} detalhe={linhas[linhas.length - 1]}
            inicio={marcas.inicio} noticia={marcas.noticia} vivo={marcas.vivo} porcentagem={pct}
            aoCancelar={sempre && labAtual ? () => { void ponte.importarCancelar(labAtual).catch((e) => setErro(String(e))); } : undefined} rotuloCancelar="Cancelar importação"
            filhos={linhas.length > 0 ? (
              <div role="log" aria-label="Andamento" className="mono rolagem max-h-40 overflow-y-auto rounded-lg bg-fundo p-2 text-xs text-suave">
                {linhas.slice(-40).map((l, i) => <div key={i} className="break-words">{l}</div>)}<div ref={fim} />
              </div>) : undefined} />
        );
      })()}
      {!labs.some((l) => l.nome === PRINCIPAL) && opcoes.length > 0 && (
        <div className="rounded-2xl border border-neon/40 bg-painel p-5">
          <h2 className="font-bold">Laboratório principal</h2>
          <p className="mt-1 text-sm text-suave">O seu lugar de trabalho: já nasce com os projetos do GitHub e o Claude instalado. Os outros laboratórios ficam para testes descartáveis.</p>
          <button onClick={() => void criarPrincipal()} disabled={!!ocupado || !base} className="mt-3 min-h-11 rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40">Criar laboratório principal</button>
        </div>
      )}
      {labs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borda p-8 text-center text-suave"><IconeTour nome="laboratorio" tam={40} className="mx-auto text-neon" /><p className="mt-2">Nenhum laboratório ainda. Crie o primeiro para testar um programa sem risco.</p></div>
      ) : (
        <ul className="space-y-3">
          {labs.map((l) => (
            <li key={l.completo} className="flex flex-wrap items-center gap-3 rounded-2xl border border-borda bg-painel p-4">
              <span className={`size-2.5 rounded-full ${l.estado === "Running" ? "bg-ok" : "bg-suave"}`} aria-hidden />
              <div className="min-w-0 flex-1"><b className="block truncate">{l.nome}{l.nome === PRINCIPAL && <span className="ml-2 rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-bold uppercase text-neon">principal</span>}</b><span className="text-xs text-suave">{l.estado === "Running" ? "ligado" : "desligado"} · isolado</span></div>
              <button onClick={() => void executar("Abrindo o terminal", () => ponte.abrirTerminal(l.nome))} disabled={!!ocupado} className="min-h-11 rounded-xl border border-neon px-4 font-bold text-neon disabled:opacity-40">Abrir terminal</button>
              <button onClick={() => void executar("Instalando o Claude", () => ponte.instalarClaude(l.nome))} disabled={!!ocupado} className="min-h-11 rounded-xl border border-borda px-4 font-bold disabled:opacity-40">Instalar Claude</button>
              <button onClick={() => void importar(l.nome)} disabled={!!ocupado} className="min-h-11 rounded-xl border border-borda px-4 font-bold disabled:opacity-40">Importar projetos</button>
              <button onClick={() => setDescartar(l.nome)} disabled={!!ocupado} className="min-h-11 rounded-xl border border-erro/60 px-4 font-bold text-erro disabled:opacity-40">Descartar</button>
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-label="Criar laboratório">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl border border-borda bg-painel p-5">
            <h2 className="text-xl font-extrabold">Criar laboratório</h2>
            <label className="block text-sm text-suave">Nome
              <input value={nome} onChange={(e) => setNome(limparNome(e.target.value))} maxLength={24} placeholder="meu-teste" className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-texto outline-none focus:border-neon" />
            </label>
            {opcoes.length === 0 ? <p className="rounded-xl border border-aviso/40 p-3 text-sm text-aviso">Não achei nenhuma distribuição Linux para usar de base. Instale uma (por exemplo, Ubuntu pela Microsoft Store) e volte.</p> : (
              <label className="block text-sm text-suave">Criar a partir de
                <select value={base} onChange={(e) => setBase(e.target.value)} className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-texto">{opcoes.map((d) => <option key={d.nome}>{d.nome}</option>)}</select>
              </label>
            )}
            <p className="text-xs text-suave">O laboratório é uma cópia da distribuição escolhida, criada sem acesso aos arquivos nem aos programas do Windows.</p>
            <div className="flex gap-3">
              <button onClick={() => setCriando(false)} className="min-h-11 rounded-xl border border-borda px-5">Cancelar</button>
              <button disabled={!podeCriar} onClick={() => { setCriando(false); void executar("Criando o laboratório", () => ponte.criarLaboratorio(base, nome)); setNome(""); }} className="min-h-11 flex-1 rounded-xl bg-neon font-extrabold text-fundo disabled:opacity-40">Criar</button>
            </div>
          </div>
        </div>
      )}

      {descartar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-label="Descartar laboratório">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-borda bg-painel p-5">
            <h2 className="text-xl font-extrabold">Descartar “{descartar}”?</h2>
            <p className="text-sm text-suave">Tudo o que está dentro desse laboratório será apagado, sem volta.{descartar === PRINCIPAL ? " Este é o laboratório principal: o Claude, a sua entrada na conta e os projetos importados vão junto." : ""}</p>
            <div className="flex gap-3">
              <button onClick={() => setDescartar(null)} className="min-h-11 flex-1 rounded-xl border border-borda">Manter</button>
              <button onClick={() => { const n = descartar; setDescartar(null); void executar("Descartando", () => ponte.descartarLaboratorio(n)); }} className="min-h-11 flex-1 rounded-xl bg-erro font-extrabold text-fundo">Descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
