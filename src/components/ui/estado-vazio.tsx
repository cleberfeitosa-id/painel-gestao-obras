import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EstadoVazioProps {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  className?: string;
}

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: EstadoVazioProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-superficie-100 text-superficie-400 mb-4">
        {icone}
      </div>
      <h3 className="text-lg font-semibold text-superficie-800">{titulo}</h3>
      <p className="mt-1 max-w-sm text-sm text-superficie-500">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
