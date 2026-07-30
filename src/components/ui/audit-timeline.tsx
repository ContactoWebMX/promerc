export type AuditEntry = {
  id: number;
  createdAt: Date;
  accion: string;
  motivo: string | null;
  usuario: { nombre: string };
};

export function AuditTimeline({ entradas }: { entradas: AuditEntry[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {entradas.map((a) => (
        <li key={a.id} className="relative flex gap-3 pl-1">
          <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />
          <div className="flex flex-col gap-0.5 border-l border-border pb-1 pl-3 -ml-[5px]">
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
              <span>{a.createdAt.toLocaleString("es-MX")}</span>
              <span>·</span>
              <span>{a.usuario.nombre}</span>
              <span>·</span>
              <span className="font-medium text-foreground">{a.accion}</span>
            </div>
            {a.motivo && <p className="text-sm">{a.motivo}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
