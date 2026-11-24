import type { ReactNode } from "react";
import type { IdApp } from "./janelas";

// Ícones do Vynx: traço fino arredondado (1.8), sem preenchimento, cor = currentColor.
const D: Record<IdApp, ReactNode> = {
  inicio: <path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6H9v6H6a2 2 0 0 1-2-2z" />,
  laboratorio: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  terminal: <><rect x="3" y="4.5" width="18" height="15" rx="2.4" /><path d="M7 10l3 2.5L7 15M12.5 15h4.5" /></>,
  android: <><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M11 18.5h2" /></>,
  painel: <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10M18 11c0 4-6 4-12 6" /></>,
  documentos: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  ajustes: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
};

export function IconeApp({ id, tam = 24 }: { id: IdApp; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{D[id]}</svg>
  );
}
