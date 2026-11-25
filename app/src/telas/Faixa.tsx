import { useEffect, useRef, useState } from "react";
import { ponte } from "../ponte";
import { diagnostico, gb, nivel, ramPct, texto, type Metricas, type Nivel } from "../metricas";

const COR: Record<Nivel, string> = { ok: "text-ok border-ok/40", aviso: "text-aviso border-aviso/50", erro: "text-erro border-erro/60", nd: "text-suave border-borda" };
const BARRA: Record<Nivel, string> = { ok: "bg-ok", aviso: "bg-aviso", erro: "bg-erro", nd: "bg-borda" };

function Pilula({ rotulo, pct, aoToque, aberto }: { rotulo: string; pct: number | null; aoToque: () => void; aberto: boolean }) {
  const n = nivel(pct);
  return (
    <button onClick={aoToque} aria-expanded={aberto} aria-label={`${rotulo} ${texto(pct)}. Toque para ver detalhes`} className={`mono flex min-h-8 items-center gap-1 rounded-full border px-2 text-[11px] ${COR[n]}`}>
      <span className="text-suave">{rotulo}</span><b>{texto(pct)}</b>
    </button>
  );
}
function Linha({ rotulo, pct, extra }: { rotulo: string; pct: number | null; extra?: string }) {
  const n = nivel(pct);
  return (
    <div className="space-y-1"><div className="flex justify-between text-xs"><span>{rotulo}{extra ? <span className="text-suave"> · {extra}</span> : null}</span><b className={COR[n].split(" ")[0]}>{texto(pct)}</b></div>
      <div className="h-2 overflow-hidden rounded-full bg-fundo"><div className={`h-full rounded-full transition-all ${BARRA[n]}`} style={{ width: `${pct ?? 0}%` }} /></div></div>
  );
}

/** Faixa fina no topo: CPU, GPU e memória sempre à vista; tocar abre o detalhe e o botão "Liberar". */
export function Faixa() {
  const [m, setM] = useState<Metricas | null>(null);
  const [aberto, setAberto] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const [msg, setMsg] = useState("");
  const [liberando, setLiberando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => { ponte.metricas().then((x) => { if (vivo) setM(x); }).catch(() => {}); };
    ler(); const t = setInterval(ler, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  const liberar = async () => {
    setLiberando(true); setMsg("");
    try { setMsg(await ponte.liberarRam(encerrar)); } catch (e) { setMsg(String(e)); }
    setLiberando(false);
  };
  const r = m ? ramPct(m) : null;
  const alterna = () => setAberto((a) => !a);
  return (
    <div ref={caixa} className="relative flex items-center gap-1.5" role="group" aria-label="Uso do computador">
      <Pilula rotulo="CPU" pct={m?.cpu ?? null} aoToque={alterna} aberto={aberto} />
      <Pilula rotulo="GPU" pct={m?.gpu ?? null} aoToque={alterna} aberto={aberto} />
      <Pilula rotulo="RAM" pct={r} aoToque={alterna} aberto={aberto} />
      <button onClick={() => { setAberto(true); void liberar(); }} disabled={liberando} className="min-h-8 rounded-full border border-neon/60 px-2.5 text-[11px] font-bold text-neon disabled:opacity-50">{liberando ? "Liberando…" : "Liberar"}</button>
      {aberto && m && (
        <div role="dialog" aria-label="Uso do computador" className="fixed inset-x-2 top-11 z-50 space-y-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[320px] rounded-2xl border border-borda bg-painel p-4 shadow-2xl shadow-black/50">
          <Linha rotulo="Processador (CPU)" pct={m.cpu} />
          <Linha rotulo="Placa de vídeo (GPU)" pct={m.gpu} extra={m.gpu === null ? "este Windows não informa" : undefined} />
          <Linha rotulo="Memória (RAM)" pct={r} extra={`${gb(m.ram_usada_mb)} de ${gb(m.ram_total_mb)}`} />
          <p className="text-xs text-suave">{diagnostico(m)}</p>
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={encerrar} onChange={(e) => setEncerrar(e.target.checked)} className="mt-0.5 h-4 w-4 accent-neon" /><span>Também encerrar os laboratórios ligados (o que estiver aberto neles será fechado).</span></label>
          <button onClick={() => void liberar()} disabled={liberando} className="min-h-10 w-full rounded-xl bg-neon px-3 text-sm font-bold text-fundo disabled:opacity-50">{liberando ? "Liberando…" : "Liberar memória agora"}</button>
          {msg && <p role="status" className="text-xs text-texto">{msg}</p>}
          <p className="text-[11px] text-suave">Nunca fecha programas seus fora do Vynx (como o Velox ou o Vindex).</p>
        </div>
      )}
    </div>
  );
}
