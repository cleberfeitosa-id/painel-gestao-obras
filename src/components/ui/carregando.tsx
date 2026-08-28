import { cn } from "@/lib/utils";

interface SpinnerProps {
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}

const estilosSpinner: Record<NonNullable<SpinnerProps["tamanho"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ tamanho = "md", className }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-azul-600", estilosSpinner[tamanho], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Carregando"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface EsqueletoLinhaProps {
  className?: string;
}

export function EsqueletoLinha({ className }: EsqueletoLinhaProps) {
  return (
    <div
      className={cn(
        "h-4 rounded bg-superficie-200 animate-pulse",
        className,
      )}
    />
  );
}
