import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variante = "primario" | "secundario" | "contorno" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
}

const estilosVariante: Record<Variante, string> = {
  primario:
    "bg-azul-600 text-white hover:bg-azul-700 active:bg-azul-800 shadow-sm",
  secundario:
    "bg-superficie-100 text-superficie-800 hover:bg-superficie-200 active:bg-superficie-300 shadow-sm",
  contorno:
    "border border-borda bg-transparent text-superficie-700 hover:bg-superficie-50 active:bg-superficie-100",
  fantasma:
    "bg-transparent text-superficie-600 hover:bg-superficie-100 active:bg-superficie-200",
  perigo:
    "bg-perigo text-white hover:opacity-90 active:opacity-80 shadow-sm",
};

const estilosTamanho: Record<Tamanho, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(
  function Botao(
    {
      variante = "primario",
      tamanho = "md",
      carregando = false,
      disabled,
      className,
      children,
      ...resto
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || carregando}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          estilosVariante[variante],
          estilosTamanho[tamanho],
          className,
        )}
        {...resto}
      >
        {carregando && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  },
);
