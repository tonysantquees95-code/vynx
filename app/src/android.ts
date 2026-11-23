// Emulador de Android: lógica pura (testada em teste/android.test.mjs). A parte que mexe no Windows fica em ponte.ts e no Rust.
export interface EstadoAndroid {
  jdk: boolean; ferramentas: boolean; emulador: boolean; imagem: boolean; preparado: boolean;
  celulares: string[]; ligado: string | null; pronto: boolean; aceleracao: boolean | null;
}
export interface ProgressoAndroid { ativo: boolean; tarefa: string; etapa: string; detalhe: string; erro: string | null; concluida: boolean }

export const PERFIS = [
  { id: "celular", rotulo: "Celular", texto: "Pixel 6, tela comum de hoje" },
  { id: "pequeno", rotulo: "Celular pequeno", texto: "Tela pequena, para achar o que estoura" },
  { id: "tablet", rotulo: "Tablet", texto: "Tela grande, para ver o layout largo" },
] as const;
export type PerfilId = (typeof PERFIS)[number]["id"];
export const nomeDoCelular = (perfil: PerfilId): string => `vynx-${perfil}`;
export const rotuloDoCelular = (nome: string): string => PERFIS.find((p) => nomeDoCelular(p.id) === nome)?.rotulo ?? nome;

/** Apps da suíte que têm APK nas releases do GitHub (a Vênus é privada: baixa pela API com o token). */
export interface AppAndroid { id: string; nome: string; repo: string; apk: string; pacote: string; privado?: true }
export const APPS_ANDROID: AppAndroid[] = [
  { id: "venus", nome: "Vênus", repo: "tonysantquees95-code/Venus-core", apk: "Venus.apk", pacote: "com.tonimarques.sextafeira", privado: true },
  { id: "vindex", nome: "Vindex", repo: "tonysantquees95-code/Vindex-", apk: "Vindex.apk", pacote: "tech.vetorial.vindex" },
  { id: "vortex", nome: "Vortex", repo: "tonysantquees95-code/Vortex", apk: "Vortex.apk", pacote: "tech.vetorial.vortex" },
  { id: "voxix", nome: "Voxix", repo: "tonysantquees95-code/voxix", apk: "Voxix.apk", pacote: "tech.vetorial.voxix" },
  { id: "velox", nome: "Velox", repo: "tonysantquees95-code/velox-gaming-search", apk: "Velox.apk", pacote: "tech.vetorial.velox" },
  { id: "vyntem", nome: "Vyntem", repo: "tonysantquees95-code/Vyntem", apk: "Vyntem.apk", pacote: "tech.vetorial.vyntem" },
  { id: "vspace", nome: "V-Space", repo: "tonysantquees95-code/v-space", apk: "V-Space.apk", pacote: "tech.vetorial.vspace" },
  { id: "drive", nome: "Vetorial Drive", repo: "tonysantquees95-code/vetorial-drive", apk: "VetorialDrive.apk", pacote: "tech.vetorial.drive" },
  { id: "vetogoshi", nome: "Vetogoshi", repo: "tonysantquees95-code/vetogoshi", apk: "Vetogoshi.apk", pacote: "tech.vetorial.vetogoshi" },
];

export interface AssetDaRelease { name: string; browser_download_url: string; url?: string }
/** Endereço do APK dentro de uma release do GitHub (null se a release não tem o arquivo esperado). */
export function urlDoApk(assets: AssetDaRelease[] | undefined, apk: string): string | null {
  const a = (assets ?? []).find((x) => x.name.toLowerCase() === apk.toLowerCase());
  return a && /^https:\/\/github\.com\/tonysantquees95-code\/.+\/releases\/download\/.+\.apk$/.test(a.browser_download_url) ? a.browser_download_url : null;
}

export type PassoAndroid = "preparar" | "celular" | "ligar" | "usar";
/** Em qual passo a pessoa está, para a tela mostrar só o que falta. */
export function passoAtual(e: EstadoAndroid): PassoAndroid {
  if (!e.preparado) return "preparar";
  if (e.celulares.length === 0) return "celular";
  if (!e.ligado) return "ligar";
  return "usar";
}
export const RAM_E_DISCO = "uns 3 GB de internet e 10 GB livres no disco";
/** Resumo curto do estado, para o cartão do Início. */
export function resumo(e: EstadoAndroid | null): string {
  if (!e) return "Procurando o emulador…";
  switch (passoAtual(e)) {
    case "preparar": return "Ainda não preparado: toque para baixar o emulador.";
    case "celular": return "Emulador pronto. Crie o seu primeiro celular virtual.";
    case "ligar": return `${e.celulares.length} ${e.celulares.length === 1 ? "celular virtual" : "celulares virtuais"}, desligado.`;
    default: return e.pronto ? "Celular virtual ligado. Instale um app para testar." : "Celular virtual ligando…";
  }
}

/** Endereço do APK pela API do GitHub (serve para repositório privado, com o token). */
export function urlDaApi(assets: AssetDaRelease[] | undefined, apk: string): string | null {
  const a = (assets ?? []).find((x) => x.name.toLowerCase() === apk.toLowerCase());
  return a?.url && /^https:\/\/api\.github\.com\/repos\/tonysantquees95-code\/[\w.-]+\/releases\/assets\/\d+$/.test(a.url) ? a.url : null;
}
