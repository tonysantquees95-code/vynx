import { useState } from "react";
import { precisaApresentar } from "./apresentacao";
import { lerVisto, NOVIDADES, novasDesde, ultimoId } from "./novidades";
import { Apresentacao } from "./telas/Apresentacao";
import { Novidades } from "./telas/Novidades";
import { Inicio } from "./telas/Inicio";
import { Casca } from "./telas/Casca";
import { Laboratorio } from "./telas/Laboratorio";
import { Terminal } from "./telas/Terminal";
import { Android } from "./telas/Android";
import { Documentos } from "./telas/Documentos";
import { Arquivos } from "./telas/Arquivos";
import { Externo } from "./telas/Externo";
import { PainelDev } from "./telas/PainelDev";
import { Ajustes } from "./telas/Ajustes";
import { Entrar } from "./telas/Entrar";
import { sair, sessaoGuardada, type Sessao } from "./conta";

const temToken = (): boolean => { try { return !!localStorage.getItem("vynx.github.token"); } catch { return false; } };

export default function App() {
  // TODOS os hooks ficam aqui em cima, antes de qualquer retorno antecipado (senão o React derruba a tela ao fechar a apresentação).
  const [apresentar, setApresentar] = useState(() => precisaApresentar());
  const [novidades, setNovidades] = useState(() => { const v = lerVisto(); return v !== null && v < ultimoId() ? novasDesde(v, NOVIDADES) : []; });
  const [github, setGithub] = useState(temToken);
  const [sessao, setSessao] = useState<Sessao | null>(sessaoGuardada);

  if (apresentar) return <Apresentacao aoConcluir={() => setApresentar(false)} />;
  if (!sessao) return <Entrar aoEntrar={(s) => { setSessao(s); setGithub(temToken()); }} />;
  if (novidades.length) return <Novidades itens={novidades} aoFechar={() => setNovidades([])} />;

  return (
    <Casca usuario={sessao.nome || sessao.email} admin={sessao.admin} renderizar={(id, abrirApp) => {
      if (id === "inicio") return <Inicio ir={abrirApp} githubConectado={github} />;
      if (id === "laboratorio") return <Laboratorio />;
      if (id === "terminal") return <Terminal />;
      if (id === "android") return <Android />;
      if (id === "painel") return <PainelDev aoMudarConexao={() => setGithub(temToken())} />;
      if (id === "arquivos") return <Arquivos ir={abrirApp} />;
      if (id === "documentos") return <Documentos />;
      if (id === "vindex" || id === "velox") return <Externo id={id} />;
      return <Ajustes aoDesconectarGithub={() => setGithub(false)} sessao={sessao} aoSair={() => { void sair().then(() => { setSessao(null); setGithub(false); }); }} />;
    }} />
  );
}
