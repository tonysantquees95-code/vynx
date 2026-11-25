import { useCallback, useEffect, useState } from "react";
import { laboratorios } from "../laboratorio";
import { ponte } from "../ponte";
import { IconeApp } from "../icones";

/** Arquivos: mostra os projetos que já estão dentro do laboratório (é aqui que se confere se a importação funcionou) e abre a pasta no Windows. */
export function Arquivos({ ir }: { ir: (a: "laboratorio" | "terminal") => void }) {
  const [labs, setLabs] = useState<string[] | null>(null);
  const [lab, setLab] = useState("");
  const [projetos, setProjetos] = useState<string[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    ponte.estadoWsl().then((e) => { const l = laboratorios(e.distros).map((x) => x.nome); setLabs(l); setLab((a) => a || (l.includes("principal") ? "principal" : l[0] ?? "")); }).catch(() => setLabs([]));
  }, []);
  const ler = useCallback(async () => {
    if (!lab) return;
    setCarregando(true); setErro("");
    try { setProjetos(await ponte.projetosListar(lab)); } catch (e) { setErro(String(e)); setProjetos(null); }
    setCarregando(false);
  }, [lab]);
  useEffect(() => { void ler(); }, [ler]);

  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><span className="text-neon"><IconeApp id="arquivos" tam={26} /></span>Arquivos</h1><p className="text-sm text-suave">Os seus projetos dentro do laboratório, em /root/projetos.</p></div>
      {labs === null && <p role="status" className="text-sm text-suave">Procurando os laboratórios…</p>}
      {labs !== null && labs.length === 0 && (
        <div className="space-y-2 rounded-2xl border border-dashed border-borda p-5 text-sm"><p>Ainda não existe nenhum laboratório, então não há projetos aqui.</p><button onClick={() => ir("laboratorio")} className="min-h-10 rounded-xl bg-neon px-4 font-bold text-fundo">Ir para o Laboratório</button></div>
      )}
      {labs !== null && labs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {labs.length > 1 && (
              <label className="flex items-center gap-2 text-sm">Laboratório
                <select value={lab} onChange={(e) => setLab(e.target.value)} className="min-h-10 rounded-xl border border-borda bg-fundo px-2">{labs.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
            )}
            <button onClick={() => void ler()} disabled={carregando} className="min-h-10 rounded-xl border border-borda px-3 text-sm disabled:opacity-50">{carregando ? "Lendo…" : "Atualizar lista"}</button>
            <button onClick={() => void ponte.pastaAbrir(lab).catch((e) => setErro(String(e)))} className="min-h-10 rounded-xl border border-neon/60 px-3 text-sm font-bold text-neon">Abrir a pasta no Windows</button>
          </div>
          {erro && <p role="alert" className="rounded-lg border border-erro/40 p-2 text-sm text-erro">{erro}</p>}
          {projetos !== null && projetos.length === 0 && !carregando && (
            <div className="space-y-2 rounded-2xl border border-dashed border-borda p-5 text-sm"><p><b>Nenhum projeto importado ainda.</b> Vá em Laboratório e toque em "Importar projetos".</p><button onClick={() => ir("laboratorio")} className="min-h-10 rounded-xl bg-neon px-4 font-bold text-fundo">Ir para o Laboratório</button></div>
          )}
          {projetos !== null && projetos.length > 0 && (
            <section aria-label="Projetos importados" className="space-y-2">
              <p role="status" className="text-sm text-ok">✓ {projetos.length} {projetos.length === 1 ? "projeto importado" : "projetos importados"}.</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {projetos.map((p) => (
                  <li key={p} className="flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3 py-2 text-sm"><span className="text-neon"><IconeApp id="arquivos" tam={18} /></span><span className="mono truncate" title={p}>{p}</span></li>
                ))}
              </ul>
              <p className="text-xs text-suave">Para mexer neles: abra o Terminal, digite <span className="mono">cd /root/projetos/nome</span> e depois <span className="mono">claude</span>. <button onClick={() => ir("terminal")} className="min-h-10 rounded-lg px-2 underline">Abrir o Terminal</button></p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
