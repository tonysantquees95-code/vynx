import { useEffect, useRef, useState } from "react";
import { BUILD, haNovaVersao, procurarVersao, type InfoVersao } from "../atualizacao";
import { ponte } from "../ponte";
import { guardarToken } from "./PainelDev";
import type { Sessao } from "../conta";
import { FeedbackDoApp } from "./FeedbackDoApp";
import { Novidades } from "./Novidades";
import { Termos, Tour } from "./Apresentacao";
import { NOVIDADES } from "../novidades";

type Janela = null | "tour" | "termos" | "novidades" | "feedback";

/** Ajustes › Sobre o Vynx OS. */
export function Ajustes({ aoDesconectarGithub, sessao, aoSair }: { aoDesconectarGithub: () => void; sessao: Sessao; aoSair: () => void }) {
  const [janela, setJanela] = useState<Janela>(null);
  const [msg, setMsg] = useState("");
  const [nova, setNova] = useState<InfoVersao | null>(null);
  const [baixando, setBaixando] = useState<{ baixado: number; total: number } | null>(null);
  const [pronta, setPronta] = useState(false);
  const relogio = useRef<number | null>(null);
  useEffect(() => () => { if (relogio.current) window.clearInterval(relogio.current); }, []);
  const procurar = async () => {
    setMsg("Procurando…");
    try {
      const v = await procurarVersao();
      if (!v) { setMsg("Não consegui verificar agora."); return; }
      if (haNovaVersao(BUILD, v.numero)) { setNova(v); setPronta(false); setMsg(`Versão 1.${v.numero} disponível.`); } else { setNova(null); setMsg("Você já está na versão mais nova."); }
    } catch { setMsg("Sem conexão para verificar."); }
  };
  const baixar = async () => {
    if (!nova || !nova.url) { setMsg("Não consegui o endereço da atualização. Tente procurar de novo."); return; }
    setMsg(""); setPronta(false); setBaixando({ baixado: 0, total: nova.tamanho });
    try { await ponte.atualizarBaixar(nova.url, nova.tamanho, nova.sha256); } catch (e) { setBaixando(null); setMsg(String(e)); return; }
    if (relogio.current) window.clearInterval(relogio.current);
    relogio.current = window.setInterval(async () => {
      try {
        const p = await ponte.atualizarProgresso();
        setBaixando({ baixado: p.baixado, total: p.total || nova.tamanho });
        if (p.erro) { window.clearInterval(relogio.current!); setBaixando(null); setMsg(p.erro); }
        else if (p.pronto) { window.clearInterval(relogio.current!); setBaixando(null); setPronta(true); setMsg("Pronto para instalar."); }
      } catch { /* tenta de novo no próximo tique */ }
    }, 400);
  };
  const instalar = async () => { try { await ponte.atualizarInstalar(); setMsg("Abrindo o instalador…"); } catch (e) { setMsg(String(e)); } };
  const pct = baixando && baixando.total > 0 ? Math.min(100, Math.round((baixando.baixado / baixando.total) * 100)) : 0;
  const linha = "flex min-h-12 w-full items-center justify-between rounded-xl border border-borda bg-painel px-4 py-3 text-left";
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold">Ajustes</h1><p className="text-sm text-suave">Sobre o Vynx OS{BUILD > 0 ? ` · versão 1.${BUILD}` : ""}</p></div>
      <div className="space-y-2">
        <button className={linha} onClick={() => setJanela("tour")}>Como o Vynx funciona<span aria-hidden>›</span></button>
        <button className={linha} onClick={() => setJanela("termos")}>Termos de uso<span aria-hidden>›</span></button>
        <button className={linha} onClick={() => setJanela("novidades")}>O que há de novo<span aria-hidden>›</span></button>
        <button className={linha} onClick={() => setJanela("feedback")}>Enviar feedback<span aria-hidden>›</span></button>
        <button className={linha} onClick={() => setJanela("feedback")}>Reportar um erro<span aria-hidden>›</span></button>
      </div>
      <section className="space-y-2 rounded-2xl border border-borda bg-painel p-4" aria-label="Atualização">
        <h2 className="font-bold">Atualização</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => void procurar()} className="min-h-11 rounded-xl border border-borda px-4 text-sm">Procurar atualizações</button>
          {nova && !baixando && !pronta && <button onClick={() => void baixar()} className="min-h-11 rounded-xl bg-neon px-4 text-sm font-bold text-fundo">Baixar atualização</button>}
          {pronta && <button onClick={() => void instalar()} className="min-h-11 rounded-xl bg-neon px-4 text-sm font-bold text-fundo">Instalar</button>}
          {msg && <span role="status" className="text-sm text-suave">{msg}</span>}
        </div>
        {baixando && (
          <div className="space-y-1" role="status" aria-label="Baixando a atualização">
            <div className="h-3 w-full overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full bg-neon transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-suave">Baixando… {pct}%</p>
          </div>
        )}
      </section>
      <section className="space-y-2 rounded-2xl border border-borda bg-painel p-4" aria-label="Conta">
        <h2 className="font-bold">Conta</h2>
        <p className="text-sm text-suave">Vetorial ID: <b className="text-texto">{sessao.email}</b>{sessao.admin ? " · administrador" : ""}</p>
        <button onClick={aoSair} className="min-h-11 rounded-xl border border-borda px-4 text-sm">Sair do Vetorial ID</button>
      </section>
      <section className="space-y-2 rounded-2xl border border-borda bg-painel p-4" aria-label="Privacidade">
        <h2 className="font-bold">Privacidade</h2>
        <p className="text-sm text-suave">O token do GitHub fica só neste computador. Ao sair do Vetorial ID ele é apagado daqui.</p>
        <button onClick={() => { guardarToken(""); aoDesconectarGithub(); }} className="min-h-11 rounded-xl border border-erro/60 px-4 text-sm text-erro">Apagar o token do GitHub</button>
      </section>
      {janela === "tour" && <div className="fixed inset-0 z-50 bg-fundo p-5"><div className="mx-auto flex h-full max-w-lg flex-col"><Tour aoTerminar={() => setJanela(null)} aoFechar={() => setJanela(null)} rotuloFinal="Fechar" /></div></div>}
      {janela === "termos" && <Termos aoFechar={() => setJanela(null)} />}
      {janela === "novidades" && <Novidades itens={[...NOVIDADES].reverse()} aoFechar={() => setJanela(null)} />}
      {janela === "feedback" && <FeedbackDoApp aoFechar={() => setJanela(null)} />}
    </div>
  );
}
