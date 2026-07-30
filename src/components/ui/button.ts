type Variant = "primary" | "secondary" | "danger" | "link";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap";

// min-h-11 (44px) para cumplir el objetivo táctil mínimo (WCAG 2.5.5) —
// esta app se opera junto a la báscula, a menudo desde tablet/teléfono.
const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 py-2 text-sm",
  sm: "min-h-11 px-3 py-1.5 text-sm",
};

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-background",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  link: "text-primary hover:underline px-0 py-0",
};

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
): string {
  const sizeClass = variant === "link" ? "" : sizes[size];
  return `${base} ${sizeClass} ${variants[variant]}`.trim();
}
