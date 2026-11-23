// Laboratório: ambientes descartáveis (uma distribuição Linux isolada por teste, via WSL2). Lógica pura (testada).
export const PREFIXO = "vynx-lab-";

export interface Distro { nome: string; estado: string; versao: number }
export interface EstadoWsl { instalado: boolean; virtualizacao: boolean | null; distros: Distro[] }
export interface Laboratorio { nome: string; completo: string; estado: string }

/** Nome do laboratório: minúsculas, números e hífen (vira parte do nome da distribuição, então nada de espaço ou símbolo). */
export const nomeValido = (n: string): boolean => /^[a-z0-9][a-z0-9-]{0,23}$/.test(n);
export const limparNome = (n: string): string => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

export const laboratorios = (ds: Distro[]): Laboratorio[] => ds.filter((d) => d.nome.startsWith(PREFIXO)).map((d) => ({ nome: d.nome.slice(PREFIXO.length), completo: d.nome, estado: d.estado }));
/** Distribuições que servem de base para criar um laboratório (as que o próprio Vynx não criou). */
export const bases = (ds: Distro[]): Distro[] => ds.filter((d) => !d.nome.startsWith(PREFIXO) && !/^docker-desktop/i.test(d.nome));

/** Lê a saída de `wsl --list --verbose` (já sem os caracteres nulos do UTF-16). */
export function lerListaWsl(texto: string): Distro[] {
  const saida: Distro[] = [];
  for (const linha of texto.replace(/\u0000/g, "").split(/\r?\n/).slice(1)) {
    const m = /^\s*\*?\s*(\S+)\s+(\S+)\s+(\d)\s*$/.exec(linha);
    if (m) saida.push({ nome: m[1]!, estado: m[2]!, versao: Number(m[3]) });
  }
  return saida;
}

/** Conteúdo do /etc/wsl.conf do laboratório: sem acesso aos arquivos do Windows e sem rodar programas dele. */
export const WSL_CONF_ISOLADO = "[automount]\nenabled=false\n[interop]\nenabled=false\nappendWindowsPath=false\n";
