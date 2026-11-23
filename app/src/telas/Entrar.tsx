import { useState } from "react";
import { entrar, ErroConta, SITE_DA_CONTA, type Sessao } from "../conta";
import { Logo } from "../logo";
import { ponte } from "../ponte";

/** Entrada do Vynx OS: o mesmo Vetorial ID dos outros apps. O administrador já abre com o GitHub conectado. */
export function Entrar({ aoEntrar }: { aoEntrar: (s: Sessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { aoEntrar(await entrar(email, senha)); }
    catch (x) { setErro(x instanceof ErroConta ? x.message : "Não consegui entrar agora. Tente de novo."); setOcupado(false); }
  };

  return (
    <div className="rolagem h-full overflow-y-auto p-5">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-5">
        <div className="flex items-center gap-3"><Logo tam={44} /><div><h1 className="text-2xl font-extrabold">Vynx OS</h1><p className="text-sm text-suave">Entre com o seu Vetorial ID</p></div></div>
        <form onSubmit={(e) => void enviar(e)} className="space-y-3 rounded-2xl border border-borda bg-painel p-5">
          <label className="block text-sm text-suave">E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" spellCheck={false} className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-texto outline-none focus:border-neon" />
          </label>
          <label className="block text-sm text-suave">Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-texto outline-none focus:border-neon" />
          </label>
          {erro && <p role="alert" className="text-sm text-erro">{erro}</p>}
          <button type="submit" disabled={ocupado || !email.trim() || !senha} className="min-h-12 w-full rounded-xl bg-neon px-5 font-extrabold text-fundo disabled:opacity-40">{ocupado ? "Entrando…" : "Entrar"}</button>
        </form>
        <button type="button" onClick={() => void ponte.abrirLink(SITE_DA_CONTA)} className="min-h-11 rounded-xl border border-borda px-4 text-sm text-suave">Ainda não tenho Vetorial ID · criar no site</button>
      </div>
    </div>
  );
}
