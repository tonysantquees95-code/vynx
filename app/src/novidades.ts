// "O que há de novo": a tela que aparece depois de uma atualização.
// REGRA: toda mudança que altere o que o app faz ou como se usa (função nova, melhoria de fluxo, correção) ganha uma linha AQUI,
// com id = o maior id + 1. A tela mostra só o que a pessoa ainda não viu, então não depende do número da versão.
export type TipoNovidade = "novo" | "melhoria" | "correcao";
export interface Novidade { id: number; data: string; tipo: TipoNovidade; titulo: string; texto: string }

export const NOVIDADES: Novidade[] = [
  { id: 1, data: "2026-11-23", tipo: "novo", titulo: "Vynx OS chegou", texto: "A primeira versão tem Laboratório (Linux isolado e descartável para testar programas) e Painel Dev (seus repositórios e builds do GitHub)." },
  { id: 2, data: "2026-11-23", tipo: "novo", titulo: "Emulador de Android", texto: "Nova aba Android: o Vynx prepara o emulador oficial, cria um celular virtual e instala os apps da suíte direto das versões do GitHub, para você testar sem instalar no telefone." },
  { id: 3, data: "2026-11-23", tipo: "novo", titulo: "Entrar com o Vetorial ID", texto: "O Vynx OS agora abre pedindo o seu Vetorial ID, o mesmo dos outros apps da Vetorial Tech. Na conta de administração, o Painel Dev já abre conectado ao GitHub, sem você colar nenhum token. Em Ajustes você vê a conta e pode sair." },
  { id: 4, data: "2026-11-23", tipo: "melhoria", titulo: "Logo novo", texto: "O Vynx OS ganhou um logo só dele: um laboratório em forma de hexágono com um Y de ramificação dentro. Ele não se parece mais com o de nenhum outro app da suíte." },
  { id: 5, data: "2026-11-23", tipo: "melhoria", titulo: "Painel Dev só com as versões", texto: "Agora o Painel Dev mostra só os seus apps. Escolha um e veja a última versão e a anterior, com botão para baixar e, nos apps de Android, para testar direto no celular virtual." },
  { id: 6, data: "2026-11-23", tipo: "correcao", titulo: "Celular virtual abre a janela", texto: "O celular virtual do Android agora liga com a tela de vídeo por software, para a janela aparecer em qualquer computador. Se ele fechar sozinho, o Vynx mostra o motivo em vez de ficar esperando." },
  { id: 7, data: "2026-11-23", tipo: "novo", titulo: "Documentos dentro do Vynx", texto: "Nova área Documentos: o Vindex abre numa janela do Vynx para juntar, dividir, converter e editar PDF e arquivos de escritório. Os arquivos ficam no seu computador." },
  { id: 8, data: "2026-11-23", tipo: "novo", titulo: "Claude dentro do laboratório", texto: "Em Laboratório, o botão Instalar Claude prepara o Claude no seu Linux isolado. Depois é só abrir o terminal, digitar claude e entrar com a sua conta para programar de lá." },
  { id: 9, data: "2026-11-23", tipo: "novo", titulo: "Importar projetos", texto: "Em Laboratório, o botão Importar projetos traz todos os seus repositórios do GitHub para dentro do Linux e prepara um resumo de cada um. No Claude, digite /projetos para ele saber onde cada projeto parou." },
  { id: 10, data: "2026-11-23", tipo: "novo", titulo: "Laboratório principal", texto: "Em Laboratório, o botão Criar laboratório principal monta o seu lugar de trabalho: um Linux com os projetos do GitHub já importados e o Claude instalado. Ele avisa antes de ser descartado." },
  { id: 11, data: "2026-11-23", tipo: "correcao", titulo: "Painel Dev não abre mais APK no navegador", texto: "Arquivos APK (de celular) não têm mais o botão Baixar, que abria o navegador e o Windows não sabia o que fazer. Nos apps de Android use Testar no celular virtual." },
  { id: 12, data: "2026-11-23", tipo: "novo", titulo: "Testar a Vênus no celular virtual", texto: "A Vênus agora aparece na aba Android e no Painel Dev. O Vynx baixa o APK dela com a sua conta do GitHub e instala no celular virtual para você testar." },
  { id: 13, data: "2026-11-24", tipo: "correcao", titulo: "Atualizar o Vynx por dentro", texto: "Agora a atualização é feita dentro do próprio Vynx: toque em Baixar atualização, acompanhe a barra e toque em Instalar. Antes o botão não abria nada." },
  { id: 14, data: "2026-11-24", tipo: "melhoria", titulo: "Instalar Claude bem mais rápido", texto: "O botão Instalar Claude do laboratório agora usa o instalador oficial e termina em poucos minutos, em vez de baixar centenas de pacotes." },
  { id: 15, data: "2026-11-24", tipo: "novo", titulo: "Novo visual de sistema", texto: "O Vynx agora parece um sistema: barra no topo com hora e seu usuário, dock de apps ao lado e janelas que você arrasta, minimiza e maximiza (o app do dock aberto fica marcado). Em tela pequena cada app ocupa a tela toda. O ícone do app também é o logo novo." },
  { id: 16, data: "2026-11-24", tipo: "melhoria", titulo: "Celular virtual liga mais rápido", texto: "O celular virtual agora guarda o estado ao fechar: só a primeira vez demora; nas próximas ele volta em segundos. A tela avisa quanto tempo a primeira vez leva." },
  { id: 17, data: "2026-11-24", tipo: "novo", titulo: "Mesa de trabalho", texto: "Ao abrir o Vynx você vê a mesa de trabalho com atalhos para todos os apps. Toque num atalho para abrir a janela; toque no app do dock que está na frente para minimizar e voltar à mesa." },
  { id: 18, data: "2026-11-24", tipo: "novo", titulo: "Terminal dentro do Vynx", texto: "Novo app Terminal: escolha o laboratório, toque em Conectar e use o Linux numa janela do Vynx, com o visual do app. Tem botão para abrir o Claude direto. Ele não enxerga os arquivos do Windows." },
  { id: 19, data: "2026-11-24", tipo: "melhoria", titulo: "Você vê a importação andando", texto: "Ao importar os projetos para o laboratório, a janela agora mostra uma barra de andamento (projeto 3 de 12) e o registro do que está sendo baixado, em vez de ficar parada." },
  { id: 20, data: "2026-11-25", tipo: "novo", titulo: "Visual novo, parecido com o Linux", texto: "Barra lateral mais fina só com ícones, Ajustes lá embaixo e um botão de aplicativos. Em tela cheia a barra do Windows some (F11 ou o botão no topo volta ao normal)." },
  { id: 21, data: "2026-11-25", tipo: "novo", titulo: "Uso do computador no topo", texto: "Faixa com processador, placa de vídeo e memória, em verde, amarelo ou vermelho. Toque nela para ver detalhes e use o botão Liberar para soltar memória." },
  { id: 22, data: "2026-11-25", tipo: "novo", titulo: "Arquivos, Vindex e Velox Pro", texto: "Novo app Arquivos: mostra os projetos importados e abre a pasta no Windows. Vindex e Velox Pro agora têm atalho aqui dentro: abrem numa janela própria, ao lado do Vynx." },
  { id: 23, data: "2026-11-25", tipo: "melhoria", titulo: "Andamento claro na importação e no Android", texto: "Agora aparecem a etapa, o tempo decorrido e um aviso quando passa muito tempo sem novidade. Dá para cancelar a importação. No Android mostra quanto já foi baixado." },
  { id: 24, data: "2026-11-25", tipo: "novo", titulo: "LDPlayer, o emulador leve", texto: "Na aba Android agora dá para escolher o LDPlayer, um emulador feito para computador fraco. O Vynx cria um celular virtual leve, liga e instala os apps. Você só precisa instalar o LDPlayer uma vez (o botão leva ao site oficial)." },
  { id: 25, data: "2026-11-25", tipo: "melhoria", titulo: "Testar já liga o celular sozinho", texto: "Ao tocar em Testar (no Painel Dev ou na aba Android) com o emulador fechado, o Vynx liga o celular virtual, instala o app e abre, sem pedir para voltar e ligar antes." },
  { id: 26, data: "2026-11-25", tipo: "melhoria", titulo: "Painel Dev mais completo", texto: "Agora mostra todos os apps de uma vez: situação do build (verde, amarelo ou vermelho), última versão, os últimos builds e a atividade recente. Builds quebrados aparecem em destaque no topo." },
];

export const ROTULO: Record<TipoNovidade, string> = { novo: "Novo", melhoria: "Melhorou", correcao: "Corrigido" };
export const ultimoId = (lista: Novidade[] = NOVIDADES): number => lista.reduce((m, n) => Math.max(m, n.id), 0);
/** O que a pessoa ainda não viu, da mais nova para a mais antiga. */
export const novasDesde = (visto: number, lista: Novidade[] = NOVIDADES): Novidade[] => lista.filter((n) => n.id > visto).sort((a, b) => b.id - a.id);

const CHAVE = "vynx.novidades.vistas";
/** null = nunca guardou (primeira instalação: a apresentação já explica tudo, então não mostra o histórico). */
export function lerVisto(): number | null {
  try { const v = localStorage.getItem(CHAVE); if (v === null) return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : null; } catch { return null; }
}
export function marcarVisto(id: number = ultimoId()): void {
  try { localStorage.setItem(CHAVE, String(id)); } catch { /* sem armazenamento: mostra de novo na próxima vez */ }
}
