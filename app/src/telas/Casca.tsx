import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "../logo";
import { IconeApp, IconeGrade, IconeTelaCheia } from "../icones";
import { ponte } from "../ponte";
import { Faixa } from "./Faixa";
import { abertas, abrir, ajustarA, alternarMaximizada, ativa, fechar, focar, LARGURA_MINIMA_PARA_JANELAS, minimizar, mover, type Area, type IdApp, type Janela } from "../janelas";

export const APPS: { id: IdApp; rotulo: string }[] = [
  { id: "inicio", rotulo: "Início" },
  { id: "laboratorio", rotulo: "Laboratório" },
  { id: "terminal", rotulo: "Terminal" },
  { id: "android", rotulo: "Android" },
  { id: "arquivos", rotulo: "Arquivos" },
  { id: "painel", rotulo: "Painel Dev" },
  { id: "documentos", rotulo: "Documentos" },
  { id: "vindex", rotulo: "Vindex" },
  { id: "velox", rotulo: "Velox Pro" },
  { id: "ajustes", rotulo: "Ajustes" },
];
const NO_FUNDO: IdApp = "ajustes";
const rotuloDe = (id: IdApp): string => APPS.find((a) => a.id === id)!.rotulo;

function dataEHora(d: Date, curta: boolean): string {
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (curta) return hora;
  const dia = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "");
  return `${dia} ${hora}`;
}

/** A casca do Vynx OS: barra no topo, dock de apps e janelas. Em tela estreita cada app ocupa a tela toda. */
export function Casca({ usuario, admin, renderizar }: { usuario: string; admin: boolean; renderizar: (id: IdApp, abrirApp: (id: IdApp) => void) => ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const cheiaRef = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const [tela, setTela] = useState<Area>({ w: 1280, h: 720 });
  const [area, setArea] = useState<Area>({ w: 1100, h: 600 });
  const [lista, setLista] = useState<Janela[]>([]);
  const [agora, setAgora] = useState(() => new Date());
  const [cheia, setCheia] = useState(false);
  const [grade, setGrade] = useState(false);
  const estreita = tela.w < LARGURA_MINIMA_PARA_JANELAS;

  useLayoutEffect(() => {
    const medir = () => {
      if (raiz.current) setTela({ w: raiz.current.clientWidth, h: raiz.current.clientHeight });
      if (areaRef.current) setArea({ w: areaRef.current.clientWidth, h: areaRef.current.clientHeight });
    };
    medir();
    const o = new ResizeObserver(medir);
    if (raiz.current) o.observe(raiz.current);
    if (areaRef.current) o.observe(areaRef.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => { const t = window.setInterval(() => setAgora(new Date()), 30_000); return () => window.clearInterval(t); }, []);
  useEffect(() => { setLista((l) => ajustarA(l, area)); }, [area]);
  // Tela cheia: some a barra de tarefas do Windows. Na primeira vez abre assim; a escolha fica guardada. F11 alterna.
  const alternarCheia = useCallback((ativar?: boolean) => {
    const quero = ativar ?? !cheiaRef.current;
    ponte.telaCheia(quero).then((v) => { cheiaRef.current = v; setCheia(v); try { localStorage.setItem("vynx.telacheia", v ? "1" : "0"); } catch { /* sem guardar */ } }).catch(() => {});
  }, []);
  useEffect(() => {
    let guardado: string | null = null;
    try { guardado = localStorage.getItem("vynx.telacheia"); } catch { /* sem guardar */ }
    if (guardado !== "0") alternarCheia(true);
    const tecla = (e: KeyboardEvent) => { if (e.key === "F11") { e.preventDefault(); alternarCheia(); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alternarCheia]);

  const abrirApp = useCallback((id: IdApp) => { setGrade(false); setLista((l) => abrir(l, id, area)); }, [area]);
  const naFrente = ativa(lista);

  /** Arrastar a janela pela barra de título. */
  const arrastar = (id: IdApp, e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const j = lista.find((x) => x.id === id);
    if (!j || j.max) return;
    const dx = e.clientX - j.x, dy = e.clientY - j.y;
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);
    const mexer = (ev: PointerEvent) => setLista((l) => mover(l, id, ev.clientX - dx, ev.clientY - dy, area));
    const soltar = () => { alvo.removeEventListener("pointermove", mexer); alvo.removeEventListener("pointerup", soltar); alvo.removeEventListener("pointercancel", soltar); };
    alvo.addEventListener("pointermove", mexer); alvo.addEventListener("pointerup", soltar); alvo.addEventListener("pointercancel", soltar);
  };

  const botao = (a: { id: IdApp; rotulo: string }) => {
    const foco = naFrente === a.id, aberta = abertas(lista, a.id);
    return (
      <button key={a.id} aria-label={a.rotulo} aria-current={foco ? "page" : undefined} title={a.rotulo}
        onClick={() => { setGrade(false); if (foco) setLista((l) => minimizar(l, a.id)); else setLista((l) => abrir(l, a.id, area)); }}
        className={`relative flex shrink-0 items-center justify-center rounded-xl border ${estreita ? "min-h-14 min-w-[68px] flex-col gap-0.5 rounded-none border-transparent text-[10px]" : "h-11 w-11"} ${foco ? "border-neon bg-neon font-bold text-fundo" : aberta ? "border-neon/50 bg-fundo text-texto" : "border-transparent text-suave hover:bg-fundo hover:text-texto"}`}>
        <IconeApp id={a.id} tam={estreita ? 22 : 22} />
        {estreita && <span className="max-w-full truncate px-0.5">{a.rotulo}</span>}
        {aberta && !foco && <span aria-hidden className={`absolute h-1 w-1 rounded-full bg-neon ${estreita ? "bottom-1" : "left-0.5 top-1/2 -translate-y-1/2"}`} />}
      </button>
    );
  };
  const botaoGrade = (
    <button aria-label="Aplicativos" aria-expanded={grade} title="Aplicativos" onClick={() => setGrade((g) => !g)}
      className={`flex shrink-0 items-center justify-center rounded-xl border ${estreita ? "min-h-14 min-w-[68px] flex-col gap-0.5 rounded-none border-transparent text-[10px]" : "h-11 w-11"} ${grade ? "border-neon bg-neon text-fundo" : "border-transparent text-suave hover:bg-fundo hover:text-texto"}`}>
      <IconeGrade tam={22} />{estreita && <span>Apps</span>}
    </button>
  );
  const dock = (
    <nav aria-label="Seções" className={`bg-painel ${estreita ? "order-3 flex shrink-0 overflow-x-auto border-t border-borda" : "flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-borda py-2"}`}>
      {estreita ? <>{APPS.map(botao)}{botaoGrade}</> : (
        <>
          {botaoGrade}
          <span aria-hidden className="my-1 h-px w-7 bg-borda" />
          <div className="rolagem flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">{APPS.filter((a) => a.id !== NO_FUNDO).map(botao)}</div>
          <span aria-hidden className="my-1 h-px w-7 bg-borda" />
          {botao(APPS.find((a) => a.id === NO_FUNDO)!)}
        </>
      )}
    </nav>
  );

  return (
    <div ref={raiz} className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-borda bg-painel px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">{tela.w >= 380 && <Logo tam={22} />}{!estreita && <b className="text-sm">Vynx OS</b>}</div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-suave">
          <Faixa />
          <button onClick={() => alternarCheia()} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"} aria-pressed={cheia} title={cheia ? "Sair da tela cheia (F11)" : "Tela cheia (F11): esconde a barra do Windows"} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-borda text-texto"><IconeTelaCheia cheia={cheia} /></button>
          {!estreita && <time dateTime={agora.toISOString()} className="mono shrink-0">{dataEHora(agora, false)}</time>}
          {!estreita && <span className="max-w-[18vw] truncate text-texto" title={usuario}>{usuario}{admin ? " · admin" : ""}</span>}
        </div>
      </header>
      <div className={`flex min-h-0 flex-1 ${estreita ? "flex-col" : "flex-row"}`}>
        {!estreita && dock}
        <div ref={areaRef} className={`relative order-1 min-h-0 min-w-0 flex-1 overflow-hidden ${estreita ? "" : "bg-fundo"}`}>
          <section aria-label="Mesa de trabalho" className="rolagem absolute inset-0 overflow-y-auto p-5" style={{ zIndex: 0 }}>
            <p className="mb-4 text-sm text-suave">Mesa de trabalho · toque num atalho para abrir</p>
            <div className="grid content-start gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
              {APPS.map((a) => (
                <button key={a.id} aria-label={`Abrir ${a.rotulo}`} onClick={() => abrirApp(a.id)}
                  className="relative flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-borda bg-painel/70 px-1 py-3 text-xs text-texto hover:border-neon/60">
                  <span className="text-neon"><IconeApp id={a.id} tam={34} /></span>
                  <span className="max-w-full truncate px-1">{a.rotulo}</span>
                  {abertas(lista, a.id) && <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-neon" />}
                </button>
              ))}
            </div>
          </section>
          {grade && (
            <div role="dialog" aria-label="Aplicativos" className="rolagem absolute inset-0 overflow-y-auto bg-fundo/95 p-5 backdrop-blur" style={{ zIndex: 9000 }}>
              <div className="mb-4 flex items-center justify-between"><b>Aplicativos</b><button onClick={() => setGrade(false)} className="min-h-9 rounded-xl border border-borda px-3 text-sm">Fechar</button></div>
              <div className="grid content-start gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
                {APPS.map((a) => (
                  <button key={a.id} aria-label={`Abrir ${a.rotulo}`} onClick={() => abrirApp(a.id)} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-borda bg-painel px-1 py-3 text-xs hover:border-neon/60">
                    <span className="text-neon"><IconeApp id={a.id} tam={34} /></span><span className="max-w-full truncate px-1">{a.rotulo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {lista.map((j) => {
            const cheia = estreita || j.max;
            const escondida = j.min || (estreita && j.id !== naFrente);
            const foco = naFrente === j.id;
            const pos = cheia ? { left: 0, top: 0, width: "100%", height: "100%" } : { left: j.x, top: j.y, width: j.w, height: j.h };
            return (
              <section key={j.id} aria-label={`Janela ${rotuloDe(j.id)}`} hidden={escondida} onPointerDownCapture={() => { if (!foco) setLista((l) => focar(l, j.id)); }}
                style={{ ...pos, zIndex: j.z }}
                className={`absolute flex flex-col overflow-hidden bg-painel ${cheia ? "" : `rounded-2xl border shadow-2xl shadow-black/50 ${foco ? "border-neon/60" : "border-borda"}`}`}>
                {!estreita && (
                  <div onPointerDown={(e) => arrastar(j.id, e)} onDoubleClick={() => setLista((l) => alternarMaximizada(l, j.id))}
                    className="flex h-10 shrink-0 cursor-grab touch-none select-none items-center gap-3 border-b border-borda bg-fundo px-3 active:cursor-grabbing">
                    <div className="flex items-center gap-1.5">
                      <button aria-label={`Fechar ${rotuloDe(j.id)}`} title="Fechar" onClick={() => setLista((l) => fechar(l, j.id))} className="grid h-6 w-6 place-items-center rounded-full"><span className="h-3.5 w-3.5 rounded-full bg-erro" /></button>
                      <button aria-label={`Minimizar ${rotuloDe(j.id)}`} title="Minimizar" onClick={() => setLista((l) => minimizar(l, j.id))} className="grid h-6 w-6 place-items-center rounded-full"><span className="h-3.5 w-3.5 rounded-full bg-aviso" /></button>
                      <button aria-label={`${j.max ? "Restaurar" : "Maximizar"} ${rotuloDe(j.id)}`} title={j.max ? "Restaurar" : "Maximizar"} onClick={() => setLista((l) => alternarMaximizada(l, j.id))} className="grid h-6 w-6 place-items-center rounded-full"><span className="h-3.5 w-3.5 rounded-full bg-ok" /></button>
                    </div>
                    <span className="mono truncate text-sm text-suave">{rotuloDe(j.id)}</span>
                  </div>
                )}
                <div className="rolagem min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{renderizar(j.id, abrirApp)}</div>
              </section>
            );
          })}
        </div>
        {estreita && dock}
      </div>
    </div>
  );
}
