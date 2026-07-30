export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-border p-3 sm:p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
