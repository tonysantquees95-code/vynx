/** Logo do Vynx: um V em traço fino com a luz teal→índigo. */
export function Logo({ tam = 32 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 64 64" fill="none" role="img" aria-label="Vynx OS">
      <defs><linearGradient id="vynx-g" x1="0" y1="0" x2="64" y2="64"><stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#6366f1" /></linearGradient></defs>
      <rect x="3" y="3" width="58" height="58" rx="16" stroke="url(#vynx-g)" strokeWidth="3" />
      <path d="M16 19l16 28 16-28" stroke="url(#vynx-g)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
