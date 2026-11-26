import { useCallback, useEffect, useState } from "react";
import { ponte } from "../ponte";
import { SERVIDOR } from "../conta";
import { IconeApp } from "../icones";

const APPS = {
  vindex: { nome: "Vindex", texto: "Leitor e editor de PDF, Word e Excel, com as ferramentas de PDF.", pagina: "/vindex.html" },
  velox: { nome: "Velox Pro", texto: "O navegador da Vetorial, na edição Pro (sem brilho, mais sóbrio). Escolha a edição Pro na primeira abertura ou em Ajustes › Tema.", pagina: "/velox.html" },
} as const;

/** Vindex e Velox Pro: abrem como janelas do Windows ao lado do Vynx (não ficam "dentro" da janela do Vynx). */
export function Externo({ id }: { id: "vindex" | "velox" }) {
  const a = APPS[id];
  const [instalado, setInstalado] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const ler = useCallback(() => { ponte.externoInstalado(id).then(setInstalado).catch(() => setInstalado(false)); }, [id]);
  const conferir = () => {
    setConferindo(true); setAviso(""); setErro("");
    ponte.externoInstalado(id).then((ok) => {
      setInstalado(ok);
      setAviso(ok ? "" : `Ainda não achei o ${a.nome}. Se ele for a versão portátil (um .exe solto), instale pelo instalador: o Vynx só enxerga o que foi instalado.`);
    }).catch(() => { setInstalado(false); setAviso("Não consegui procurar agora. Tente de novo."); }).finally(() => setConferindo(false));
  };
  useEffect(() => { ler(); }, [ler]);
  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><span className="text-neon"><IconeApp id={id} tam={26} /></span>{a.nome}</h1><p className="text-sm text-suave">{a.texto}</p></div>
      {instalado === null && <p role="status" className="text-sm text-suave">Procurando o app no computador…</p>}
      {instalado === true && (
        <div className="space-y-2 rounded-2xl border border-borda bg-fundo p-5"><p className="text-sm text-ok">✓ {a.nome} está instalado.</p>
          <button onClick={() => { setErro(""); void ponte.externoAbrir(id).catch((e) => setErro(String(e))); }} className="min-h-11 rounded-xl bg-neon px-5 font-bold text-fundo">Abrir {a.nome}</button>
          <p className="text-xs text-suave">Ele abre numa janela própria, ao lado do Vynx.</p></div>
      )}
      {instalado === false && (
        <div className="space-y-2 rounded-2xl border border-dashed border-borda p-5"><p className="text-sm">{a.nome} ainda não está instalado neste computador.</p>
          <button onClick={() => void ponte.abrirLink(`${SERVIDOR}${a.pagina}`).catch((e) => setErro(String(e)))} className="min-h-11 rounded-xl bg-neon px-5 font-bold text-fundo">Baixar o {a.nome}</button>
          <button onClick={conferir} disabled={conferindo} className="ml-2 min-h-11 rounded-xl border border-borda px-4 text-sm disabled:opacity-50">{conferindo ? "Procurando…" : "Já instalei, conferir de novo"}</button>
          {aviso && <p role="status" className="text-sm text-suave">{aviso}</p>}</div>
      )}
      {erro && <p role="alert" className="rounded-lg border border-erro/40 p-2 text-sm text-erro">{erro}</p>}
    </div>
  );
}
