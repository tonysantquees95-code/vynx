import { useEffect, useState } from "react";
import { laboratorios, type EstadoWsl } from "../laboratorio";
import { ponte } from "../ponte";
import { resumo, type EstadoAndroid } from "../android";
import type { IdApp } from "../janelas";
import { IconeApp } from "../icones";

export type Aba = IdApp;

/** Início: resumo do ambiente e atalhos. */
export function Inicio({ ir, githubConectado }: { ir: (a: Aba) => void; githubConectado: boolean }) {
  const [wsl, setWsl] = useState<EstadoWsl | null>(null);
  useEffect(() => { ponte.estadoWsl().then(setWsl).catch(() => setWsl({ instalado: false, virtualizacao: null, distros: [] })); }, []);
  const [and, setAnd] = useState<EstadoAndroid | null>(null);
  useEffect(() => { ponte.androidEstado().then(setAnd).catch(() => setAnd(null)); }, []);
  const labs = wsl ? laboratorios(wsl.distros).length : 0;
  const cartao = "rounded-2xl border border-borda bg-painel p-5 text-left";
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold">Vynx OS</h1><p className="text-sm text-suave">O seu espaço seguro para desenvolver e testar.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <button onClick={() => ir("laboratorio")} className={cartao}>
          <span className="text-neon"><IconeApp id="laboratorio" tam={32} /></span>
          <b className="mt-2 block text-lg">Laboratório</b>
          <span className="text-sm text-suave">{!wsl ? "Procurando o WSL…" : !wsl.instalado ? "WSL2 não instalado: toque para ver como ligar." : labs === 0 ? "Nenhum laboratório ainda. Crie o primeiro." : `${labs} ${labs === 1 ? "laboratório" : "laboratórios"} isolado${labs === 1 ? "" : "s"}.`}</span>
        </button>
        <button onClick={() => ir("android")} className={cartao}>
          <span className="text-neon"><IconeApp id="android" tam={32} /></span>
          <b className="mt-2 block text-lg">Android</b>
          <span className="text-sm text-suave">{resumo(and)}</span>
        </button>
        <button onClick={() => ir("painel")} className={cartao}>
          <span className="text-neon"><IconeApp id="painel" tam={32} /></span>
          <b className="mt-2 block text-lg">Painel Dev</b>
          <span className="text-sm text-suave">{githubConectado ? "GitHub conectado: veja repositórios e builds." : "Conecte o GitHub para ver repositórios e builds."}</span>
        </button>
        <button onClick={() => ir("documentos")} className={cartao}>
          <span className="text-neon"><IconeApp id="documentos" tam={32} /></span>
          <b className="mt-2 block text-lg">Documentos</b>
          <span className="text-sm text-suave">Vindex: PDF, Word e Excel numa janela do Vynx.</span>
        </button>
      </div>
      <section className="rounded-2xl border border-dashed border-borda p-5" aria-label="Em breve">
        <h2 className="font-bold">Chegando</h2>
        <ul className="mt-2 grid gap-1 text-sm text-suave sm:grid-cols-2"><li>• Velox (janela de navegador)</li><li>• Claude dentro do laboratório</li><li>• Atualizador de drivers</li><li>• Vetorial Office</li><li>• Vynx OS em ISO (instalar como sistema)</li></ul>
      </section>
    </div>
  );
}
