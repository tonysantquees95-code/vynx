import { useState } from "react";
import { BUILD, enderecoDoDownload, haNovaVersao, procurarVersao } from "../atualizacao";
import { ponte } from "../ponte";
import { guardarToken } from "./PainelDev";
import { FeedbackDoApp } from "./FeedbackDoApp";
import { Novidades } from "./Novidades";
import { Termos, Tour } from "./Apresentacao";
import { NOVIDADES } from "../novidades";

type Janela = null | "tour" | "termos" | "novidades" | "feedback";

/** Ajustes › Sobre o Vynx OS. */
export function Ajustes({ aoDesconectarGithub }: { aoDesconectarGithub: () => void }) {
  const [janela, setJanela] = useState<Janela>(null);
  const [msg, setMsg] = useState("");
  const [nova, setNova] = useState(false);
  const procurar = async () => {
    setMsg("Procurando…");
    try {
      const v = await procurarVersao();
      if (!v) { setMsg("Não consegui verificar agora."); return; }
      if (haNovaVersao(BUILD, v.numero)) { setNova(true); setMsg(`Versão 1.${v.numero} disponível.`); } else { setNova(false); setMsg("Você já está na versão mais nova."); }
    } catch { setMsg("Sem conexão para verificar."); }
  };
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
          {nova && <button onClick={() => void ponte.abrirLink(enderecoDoDownload())} className="min-h-11 rounded-xl bg-neon px-4 text-sm font-bold text-fundo">Baixar e instalar</button>}
          {msg && <span role="status" className="text-sm text-suave">{msg}</span>}
        </div>
      </section>
      <section className="space-y-2 rounded-2xl border border-borda bg-painel p-4" aria-label="Privacidade">
        <h2 className="font-bold">Privacidade</h2>
        <p className="text-sm text-suave">O token do GitHub fica só neste computador.</p>
        <button onClick={() => { guardarToken(""); aoDesconectarGithub(); }} className="min-h-11 rounded-xl border border-erro/60 px-4 text-sm text-erro">Apagar o token do GitHub</button>
      </section>
      {janela === "tour" && <div className="fixed inset-0 z-50 bg-fundo p-5"><div className="mx-auto flex h-full max-w-lg flex-col"><Tour aoTerminar={() => setJanela(null)} aoFechar={() => setJanela(null)} rotuloFinal="Fechar" /></div></div>}
      {janela === "termos" && <Termos aoFechar={() => setJanela(null)} />}
      {janela === "novidades" && <Novidades itens={[...NOVIDADES].reverse()} aoFechar={() => setJanela(null)} />}
      {janela === "feedback" && <FeedbackDoApp aoFechar={() => setJanela(null)} />}
    </div>
  );
}
