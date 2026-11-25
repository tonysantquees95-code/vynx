// "Testar no Android": escolhe o emulador, liga sozinho se estiver fechado e instala o app. Sem pedir para voltar na aba Android.
import { escolherMotor, motorGuardado, type Motor } from "./android";
import { ponte } from "./ponte";

export interface AlvoDoTeste { url: string; pacote: string; token?: string }

/** Devolve qual emulador foi usado. Dispara a tarefa (o andamento aparece na aba Android). */
export async function testarNoAndroid(a: AlvoDoTeste): Promise<Motor> {
  const [ld, oficial] = await Promise.all([ponte.ldEstado().catch(() => null), ponte.androidEstado().catch(() => null)]);
  const motor = escolherMotor(motorGuardado(), !!ld?.instalado, !!oficial?.preparado);
  if (!motor) throw new Error("Nenhum emulador de Android está pronto. Abra a aba Android: instale o LDPlayer (leve) ou prepare o emulador oficial.");
  if (motor === "ldplayer") { await ponte.ldTestar(a.url, a.pacote, a.token); return motor; }
  if (!oficial || oficial.celulares.length === 0) throw new Error("Crie um celular virtual na aba Android primeiro (é só um toque).");
  if (!oficial.ligado) await ponte.androidLigar(oficial.celulares[0]!); // liga sozinho; o instalador espera o Android terminar de ligar
  await ponte.androidInstalar(a.url, a.pacote, a.token);
  return motor;
}
