// Primeira abertura: conhecer as funções, entender as permissões e aceitar os termos.
// Mudou o texto dos termos: suba VERSAO_DOS_TERMOS e a pessoa aceita de novo.
import type { NomeTour } from "./icones.tsx";
export const VERSAO_DOS_TERMOS = 3;
const CHAVE_TERMOS = "vynx.termos";
const CHAVE_TOUR = "vynx.tour";

export interface PassoDoTour { icone: NomeTour; titulo: string; texto: string; como?: string[] }

export const TOUR: PassoDoTour[] = [
  { icone: "laboratorio", titulo: "Bem-vindo ao Vynx OS", texto: "O espaço seguro para quem desenvolve: teste programas e projetos sem sujar o seu computador e sem mexer nos seus arquivos.", como: ["Deslize ou toque em Próximo para conhecer.", "Dá para rever esta apresentação em Ajustes › Como o Vynx funciona."] },
  { icone: "caixa", titulo: "Laboratório descartável", texto: "Cada teste roda num Linux isolado, criado em segundos. Quando terminar, é só descartar: não sobra nada.", como: ["Em Laboratório, toque em Criar laboratório e dê um nome.", "O laboratório nasce sem acesso aos arquivos do Windows.", "Terminou? Toque em Descartar e ele some por inteiro."] },
  { icone: "android", titulo: "Emulador de Android", texto: "Teste os apps Android num celular virtual, sem instalar no telefone. O Vynx baixa e prepara tudo para você.", como: ["Abra a aba Android e aceite a licença.", "Toque em Preparar emulador (baixa uns 3 GB, só uma vez).", "Crie um celular virtual, ligue e instale um app."] },
  { icone: "painel", titulo: "Painel Dev", texto: "Veja os seus repositórios do GitHub, as builds que quebraram e os últimos resultados, num lugar só.", como: ["Cole o seu token do GitHub uma vez.", "O token fica só neste computador, nunca vai para os servidores da Vetorial."] },
  { icone: "documentos", titulo: "Ferramentas da suíte", texto: "Vindex (PDF e documentos) e Velox Pro (navegador) já têm atalho aqui, e o app Arquivos mostra os seus projetos. Em cima você vê o uso do processador, da placa de vídeo e da memória.", como: ["Toque na faixa do topo para ver detalhes e liberar memória.", "F11 liga e desliga a tela cheia."] },
  { icone: "foguete", titulo: "Fase de testes", texto: "O Vynx OS está no começo. Estão a caminho: atualizador de drivers, Vetorial Office e a versão em ISO para instalar como sistema.", como: ["Conte o que achou em Ajustes › Enviar feedback."] },
];

export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: "1. O que é o Vynx OS", texto: "O Vynx OS é um conjunto de ferramentas para desenvolvedores da Vetorial Tech: laboratórios isolados para testar programas e um painel de acompanhamento de projetos. Nesta fase ele está em testes (beta): pode ter erros, mudar e ficar fora do ar sem aviso." },
  { titulo: "2. Laboratórios", texto: "Os laboratórios usam o WSL2 do Windows. Eles nascem sem acesso aos arquivos e programas do Windows, mas continuam sendo ambientes de teste, não uma garantia de segurança total: não rode ali código que você não pode arriscar, e mantenha o Windows e o WSL atualizados. Descartar um laboratório apaga tudo o que está dentro dele, sem volta." },
  { titulo: "3. Seu token do GitHub", texto: "Você entra no Vynx OS com o seu Vetorial ID (e-mail e senha, enviados só ao servidor da Vetorial Tech para conferir a conta). O token do GitHub fica somente neste computador e é usado apenas para falar com o GitHub: se você colar um token, ele nunca é enviado a ninguém; se for a conta de administração da Vetorial Tech, o app recebe do servidor um token de somente leitura ao entrar. Ao sair do Vetorial ID, o token é apagado deste computador." },
  { titulo: "4. Emulador de Android", texto: "O emulador baixa, direto das fontes oficiais, um Java (Microsoft) e as ferramentas do Android (Google), que têm as próprias licenças; você aceita a licença do Android SDK antes do download. Tudo fica na sua pasta de usuário, e os apps instalados no celular virtual vêm das versões publicadas no GitHub. O emulador usa bastante memória, processador e disco (uns 10 GB)." },
  { titulo: "5. Uso responsável", texto: "Você é responsável pelo que executa nos seus laboratórios. É proibido usar o Vynx OS para atacar sistemas de terceiros, espalhar código malicioso ou qualquer atividade ilegal." },
  { titulo: "6. Privacidade", texto: "O Vynx OS não envia o conteúdo dos seus laboratórios nem dos seus repositórios para a Vetorial Tech. Só o feedback que você escolher enviar e a verificação de novas versões passam pelo nosso servidor." },
  { titulo: "7. Garantias", texto: "O Vynx OS é oferecido como está, sem garantia de funcionamento contínuo. A Vetorial Tech não se responsabiliza por perdas de dados em laboratórios descartados nem por problemas causados por programas testados dentro deles." },
  { titulo: "8. Mudanças", texto: "Estes termos podem mudar. Quando mudarem, o Vynx pede que você aceite de novo antes de continuar." },
];

export const termosAceitos = (): boolean => { try { return localStorage.getItem(CHAVE_TERMOS) === String(VERSAO_DOS_TERMOS); } catch { return false; } };
export const aceitarTermos = (): void => { try { localStorage.setItem(CHAVE_TERMOS, String(VERSAO_DOS_TERMOS)); } catch { /* sem armazenamento: pede de novo */ } };
export const tourVisto = (): boolean => { try { return localStorage.getItem(CHAVE_TOUR) === "1"; } catch { return false; } };
export const marcarTourVisto = (): void => { try { localStorage.setItem(CHAVE_TOUR, "1"); } catch { /* ok */ } };
/** Precisa mostrar a apresentação (tour + permissões + termos) antes de usar? */
export const precisaApresentar = (): boolean => !termosAceitos() || !tourVisto();
