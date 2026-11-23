/** Logo do Vynx: laboratório (hexágono) com um Y de ramificação dentro, na luz ciano→violeta. */
export function Logo({ tam = 32 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 64 64" fill="none" role="img" aria-label="Vynx OS">
      <defs><linearGradient id="vynx-g" gradientUnits="userSpaceOnUse" x1="10" y1="7" x2="54" y2="57"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs>
      <path d="M32 7.5L53 19.5V44.5L32 56.5L11 44.5V19.5Z" stroke="url(#vynx-g)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M22.5 22L32 33L41.5 22M32 33V46" stroke="url(#vynx-g)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#070914" stroke="#22d3ee" strokeWidth="1.7"><circle cx="22.5" cy="22" r="2.6" /><circle cx="41.5" cy="22" r="2.6" /><circle cx="32" cy="47" r="2.6" /></g>
    </svg>
  );
}
