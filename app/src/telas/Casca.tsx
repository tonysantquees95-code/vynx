import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "../logo";
import { IconeApp } from "../icones";
import { abertas, abrir, ajustarA, alternarMaximizada, ativa, fechar, focar, LARGURA_MINIMA_PARA_JANELAS, minimizar, mover, type Area, type IdApp, type Janela } from "../janelas";

export const APPS: { id: IdApp; rotulo: string }[] = [
  { id: "inicio", rotulo: "Início" },
  { id: "laboratorio", rotulo: "Laboratório" },
  { id: "android", rotulo: "Android" },
  { id: "painel", rotulo: "Painel Dev" },
  { id: "documentos", rotulo: "Documentos" },
  { id: "ajustes", rotulo: "Ajustes" },
];
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
  const areaRef = useRef<HTMLDivElement>(null);
  const [tela, setTela] = useState<Area>({ w: 1280, h: 720 });
  const [area, setArea] = useState<Area>({ w: 1100, h: 600 });
  const [lista, setLista] = useState<Janela[]>([]);
  const [agora, setAgora] = useState(() => new Date());
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
  // a primeira janela: o Início
  useEffect(() => { setLista((l) => (l.length ? l : abrir(l, "inicio", area))); }, [area]);

  const abrirApp = useCallback((id: IdApp) => setLista((l) => abrir(l, id, area)), [area]);
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

  const dock = (
    <nav aria-label="Seções" className={`flex shrink-0 bg-painel ${estreita ? "order-3 justify-around border-t border-borda" : "w-[92px] flex-col items-center gap-1.5 border-r border-borda py-3"}`}>
      {APPS.map((a) => {
        const foco = naFrente === a.id, aberta = abertas(lista, a.id);
        return (
          <button key={a.id} aria-label={a.rotulo} aria-current={foco ? "page" : undefined} title={a.rotulo}
            onClick={() => { if (foco && !estreita) setLista((l) => minimizar(l, a.id)); else setLista((l) => abrir(l, a.id, area)); }}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] ${estreita ? "min-h-14 flex-1 rounded-none border-transparent" : "h-[62px] w-[80px]"} ${foco ? "border-neon bg-neon text-fundo font-bold" : aberta ? "border-neon/50 bg-fundo text-texto" : "border-transparent text-suave hover:bg-fundo"}`}>
            <IconeApp id={a.id} tam={estreita ? 22 : 24} />
            <span className="max-w-full truncate px-0.5">{a.rotulo}</span>
            {aberta && !foco && <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full bg-neon" />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div ref={raiz} className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-borda bg-painel px-3">
        <div className="flex min-w-0 items-center gap-2"><Logo tam={22} /><b className="text-sm">Vynx OS</b></div>
        <div className="flex min-w-0 items-center gap-3 text-xs text-suave">
          <time dateTime={agora.toISOString()} className="mono shrink-0">{dataEHora(agora, estreita)}</time>
          <span className="max-w-[40vw] truncate text-texto" title={usuario}>{usuario}{admin ? " · admin" : ""}</span>
        </div>
      </header>
      <div className={`flex min-h-0 flex-1 ${estreita ? "flex-col" : "flex-row"}`}>
        {!estreita && dock}
        <div ref={areaRef} className={`relative order-1 min-h-0 min-w-0 flex-1 overflow-hidden ${estreita ? "" : "bg-fundo"}`}>
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
          {!lista.some((j) => !j.min) && !estreita && (
            <div className="grid h-full place-items-center text-center text-suave"><div><Logo tam={64} /><p className="mt-3 text-sm">Toque num app do dock para abrir.</p></div></div>
          )}
        </div>
        {estreita && dock}
      </div>
    </div>
  );
}
