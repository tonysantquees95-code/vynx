import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { laboratorios, type Laboratorio } from "../laboratorio";
import { ponte } from "../ponte";

/** Terminal do laboratório: o Linux isolado numa janela do Vynx, com o visual do app. */
export function Terminal() {
  const [labs, setLabs] = useState<Laboratorio[] | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const tela = useRef<HTMLDivElement>(null);
  const term = useRef<Xterm | null>(null);
  const parar = useRef<(() => void) | null>(null);

  useEffect(() => {
    ponte.estadoWsl().then((e) => {
      const l = laboratorios(e.distros);
      setLabs(l); setEscolhido((x) => x || (l.find((a) => a.nome === "principal") ?? l[0])?.nome || "");
    }).catch(() => setLabs([]));
  }, []);

  const fechar = useCallback(async () => {
    parar.current?.(); parar.current = null;
    term.current?.dispose(); term.current = null;
    setAberto(false);
    try { await ponte.terminalFechar(); } catch { /* já estava fechado */ }
  }, []);
  useEffect(() => () => { parar.current?.(); term.current?.dispose(); void ponte.terminalFechar().catch(() => {}); }, []);

  const conectar = async () => {
    if (!escolhido || !tela.current) return;
    setErro(""); setAberto(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const t = new Xterm({
      fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace', fontSize: 14, cursorBlink: true, scrollback: 3000,
      theme: { background: "#070b12", foreground: "#e8f0fb", cursor: "#2dd4bf", selectionBackground: "#1c2a3d", black: "#070b12", brightBlack: "#8ea3bd", cyan: "#2dd4bf", brightCyan: "#22d3ee", blue: "#6366f1", brightBlue: "#7c8cff", green: "#34d399", yellow: "#fbbf24", red: "#fb7185" },
    });
    const ajuste = new FitAddon();
    t.loadAddon(ajuste);
    t.open(tela.current);
    try { ajuste.fit(); } catch { /* sem tamanho ainda */ }
    term.current = t;
    t.onData((d) => { void ponte.terminalEscrever(d).catch(() => {}); });
    parar.current = await ponte.terminalOuvir((b) => t.write(b), () => { t.write("\r\n\x1b[90m[terminal encerrado]\x1b[0m\r\n"); });
    try { await ponte.terminalAbrir(escolhido, Math.max(20, t.cols), Math.max(5, t.rows)); t.focus(); }
    catch (e) { setErro(String(e)); await fechar(); }
  };

  const botao = "min-h-11 rounded-xl border border-borda px-4 text-sm";
  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      <div><h1 className="text-2xl font-extrabold">Terminal</h1><p className="text-sm text-suave">O Linux do laboratório numa janela do Vynx. Não enxerga os arquivos do Windows.</p></div>
      {labs && labs.length === 0 && <p className="rounded-xl border border-borda bg-painel p-4 text-sm text-suave">Você ainda não tem um laboratório. Crie o laboratório principal na janela Laboratório.</p>}
      {labs && labs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Laboratório" className="flex flex-wrap gap-2">
            {labs.map((l) => (
              <button key={l.nome} role="radio" aria-checked={escolhido === l.nome} disabled={aberto} onClick={() => setEscolhido(l.nome)}
                className={`min-h-11 rounded-xl border px-4 text-sm disabled:opacity-60 ${escolhido === l.nome ? "border-neon bg-neon font-bold text-fundo" : "border-borda text-texto"}`}>{l.nome}</button>
            ))}
          </div>
          {!aberto
            ? <button onClick={() => void conectar()} className="min-h-11 rounded-xl bg-neon px-4 text-sm font-bold text-fundo">Conectar</button>
            : <>
              <button onClick={() => void ponte.terminalEscrever("claude\r")} className={botao}>Abrir o Claude</button>
              <button onClick={() => void fechar()} className={`${botao} border-erro/60 text-erro`}>Fechar terminal</button>
            </>}
        </div>
      )}
      {erro && <p role="alert" className="text-sm text-erro">{erro}</p>}
      <div ref={tela} aria-label="Tela do terminal" className={`min-h-0 flex-1 overflow-auto rounded-xl border border-borda bg-fundo p-2 ${aberto ? "" : "hidden"}`} style={{ minHeight: aberto ? 300 : 0 }} />
    </div>
  );
}
