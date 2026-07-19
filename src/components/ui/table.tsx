export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted";
export const tdClass = "px-4 py-3";
export const trClass = "border-t border-border hover:bg-background/60";
