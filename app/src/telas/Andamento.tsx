import { useEffect, useState, type ReactNode } from "react";
import { formatarTempo, mensagemDeSaude, saude } from "../andamento";

/** Cartão de andamento: etapa, barra, tempo decorrido e aviso quando fica muito tempo sem novidade. Os tempos são em milissegundos (Date.now). */
export function Andamento({ titulo, etapa, detalhe, inicio, noticia, vivo = null, porcentagem, aoCancelar, rotuloCancelar = "Cancelar", filhos }: {
  titulo: string; etapa?: string; detalhe?: string; inicio: number; noticia: number; vivo?: number | null; porcentagem?: number | null; aoCancelar?: () => void; rotuloCancelar?: string; filhos?: ReactNode;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const decorrido = (agora - inicio) / 1000, sem = (agora - noticia) / 1000, vivoHa = vivo === null ? null : (agora - vivo) / 1000;
  const s = saude(sem, vivoHa), aviso = mensagemDeSaude(s, sem, vivo !== null);
  const cor = s === "andando" ? "border-neon/40" : s === "lento" ? "border-aviso/60" : "border-erro/60";
  return (
    <div role="status" aria-live="polite" className={`space-y-2 rounded-xl border ${cor} bg-painel p-4 text-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{titulo}</b>
        <span className="mono text-xs text-suave" aria-label="Tempo decorrido">{formatarTempo(decorrido)}</span>
      </div>
      {etapa && <p className="text-texto">{etapa}</p>}
      {typeof porcentagem === "number" && (
        <div className="space-y-1"><div className="h-2.5 w-full overflow-hidden rounded-full bg-fundo" role="progressbar" aria-valuenow={porcentagem} aria-valuemin={0} aria-valuemax={100} aria-label={`Andamento de ${titulo}`}><div className="h-full rounded-full bg-neon transition-all" style={{ width: `${porcentagem}%` }} /></div><p className="text-xs text-suave">{porcentagem}%</p></div>
      )}
      {detalhe && <p className="mono truncate text-xs text-suave" title={detalhe}>{detalhe}</p>}
      {aviso && <p role="alert" className={`rounded-lg border p-2 text-xs ${s === "lento" ? "border-aviso/40 text-aviso" : "border-erro/40 text-erro"}`}>{aviso}</p>}
      {filhos}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-suave">Última novidade há {formatarTempo(sem)}. Deixe o Vynx aberto.</span>
        {aoCancelar && <button onClick={aoCancelar} className="min-h-9 rounded-xl border border-erro/60 px-3 text-xs font-bold text-erro">{rotuloCancelar}</button>}
      </div>
    </div>
  );
}
