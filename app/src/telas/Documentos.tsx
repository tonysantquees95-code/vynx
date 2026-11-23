import { SERVIDOR } from "../conta";

/** Documentos: o Vindex PDF (juntar, dividir, converter, assinar…) e as ferramentas de escritório aberto numa janela do Vynx. Tudo roda no próprio computador. */
export function Documentos() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-3">
      <div><h1 className="text-2xl font-extrabold">Documentos</h1><p className="text-sm text-suave">Vindex e o pacote de escritório da Vetorial. Os arquivos ficam no seu computador, nada é enviado.</p></div>
      <section aria-label="Janela do Vindex" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-borda bg-painel">
        <div className="flex items-center gap-2 border-b border-borda px-3 py-2 text-xs">
          <span aria-hidden className="size-2.5 rounded-full bg-erro" /><span aria-hidden className="size-2.5 rounded-full bg-aviso" /><span aria-hidden className="size-2.5 rounded-full bg-ok" />
          <span className="mono ml-2 text-suave">vindex — documentos</span>
        </div>
        <iframe title="Vindex Documentos" src={`${SERVIDOR}/pdf/`} className="min-h-0 w-full flex-1 border-0 bg-[#070a1c]" />
      </section>
    </div>
  );
}
