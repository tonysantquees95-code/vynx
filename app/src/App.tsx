import { useState } from "react";
import { precisaApresentar } from "./apresentacao";
import { lerVisto, NOVIDADES, novasDesde, ultimoId } from "./novidades";
import { Logo } from "./logo";
import { Apresentacao } from "./telas/Apresentacao";
import { Novidades } from "./telas/Novidades";
import { Inicio, type Aba } from "./telas/Inicio";
import { Laboratorio } from "./telas/Laboratorio";
import { Android } from "./telas/Android";
import { Documentos } from "./telas/Documentos";
import { PainelDev } from "./telas/PainelDev";
import { Ajustes } from "./telas/Ajustes";
import { Entrar } from "./telas/Entrar";
import { sair, sessaoGuardada, type Sessao } from "./conta";

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: "inicio", rotulo: "Início", icone: "🏠" },
  { id: "laboratorio", rotulo: "Laboratório", icone: "🧪" },
  { id: "android", rotulo: "Android", icone: "📱" },
  { id: "painel", rotulo: "Painel Dev", icone: "🛰️" },
  { id: "documentos", rotulo: "Documentos", icone: "📄" },
  { id: "ajustes", rotulo: "Ajustes", icone: "⚙️" },
];

const temToken = (): boolean => { try { return !!localStorage.getItem("vynx.github.token"); } catch { return false; } };

export default function App() {
  // TODOS os hooks ficam aqui em cima, antes de qualquer retorno antecipado (senão o React derruba a tela ao fechar a apresentação).
  const [apresentar, setApresentar] = useState(() => precisaApresentar());
  const [novidades, setNovidades] = useState(() => { const v = lerVisto(); return v !== null && v < ultimoId() ? novasDesde(v, NOVIDADES) : []; });
  const [aba, setAba] = useState<Aba>("inicio");
  const [github, setGithub] = useState(temToken);
  const [sessao, setSessao] = useState<Sessao | null>(sessaoGuardada);

  if (apresentar) return <Apresentacao aoConcluir={() => setApresentar(false)} />;
  if (!sessao) return <Entrar aoEntrar={(s) => { setSessao(s); setGithub(temToken()); }} />;
  if (novidades.length) return <Novidades itens={novidades} aoFechar={() => setNovidades([])} />;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav aria-label="Seções" className="order-2 flex shrink-0 justify-around border-t border-borda bg-painel md:order-1 md:w-56 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-3">
        <div className="hidden items-center gap-2 px-2 pb-3 pt-2 md:flex"><Logo tam={30} /><b className="text-lg">Vynx OS</b></div>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} aria-current={aba === a.id ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] md:min-h-12 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${aba === a.id ? "text-neon md:bg-neon/10" : "text-suave"}`}>
            <span aria-hidden className="text-lg md:text-base">{a.icone}</span><span className="max-w-full truncate">{a.rotulo}</span>
          </button>
        ))}
      </nav>
      <main className="rolagem order-1 min-h-0 flex-1 overflow-y-auto p-4 md:order-2 md:p-8">
        <div className="mx-auto w-full max-w-5xl">
          {aba === "inicio" && <Inicio ir={setAba} githubConectado={github} />}
          {aba === "laboratorio" && <Laboratorio />}
          {aba === "android" && <Android />}
          {aba === "painel" && <PainelDev aoMudarConexao={() => setGithub(temToken())} />}
          {aba === "documentos" && <Documentos />}
          {aba === "ajustes" && <Ajustes aoDesconectarGithub={() => setGithub(false)} sessao={sessao} aoSair={() => { void sair().then(() => { setSessao(null); setGithub(false); setAba("inicio"); }); }} />}
        </div>
      </main>
    </div>
  );
}
