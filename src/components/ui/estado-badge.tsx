export type EstadoTone = "neutral" | "positive" | "danger";

const toneClass: Record<EstadoTone, string> = {
  neutral: "bg-muted/15 text-muted",
  positive: "bg-primary/10 text-primary",
  danger: "bg-danger/10 text-danger",
};

// Forma distinta por tono además del color — mismo estado se distingue sin
// depender de percibir el color (daltonismo, sol directo sobre la pantalla).
const toneIcon: Record<EstadoTone, React.ReactNode> = {
  neutral: <circle cx="6" cy="6" r="4" />,
  positive: <path d="M2 6.5 5 9l5-6" fill="none" strokeWidth="1.6" />,
  danger: <path d="M6 1.5 11 10H1z" />,
};

export function EstadoBadge({ label, tone }: { label: string; tone: EstadoTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[tone]}`}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" stroke="currentColor" aria-hidden="true">
        {toneIcon[tone]}
      </svg>
      {label}
    </span>
  );
}
