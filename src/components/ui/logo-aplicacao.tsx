"use client";

import { cn } from "@/lib/utils";
import { CONFIGURACAO_APLICACAO } from "@/lib/configuracao-aplicacao";
import { LogoVasconcelos } from "./logo-vasconcelos";
import type {
  LogoVariante,
  LogoTema,
} from "./logo-vasconcelos";

export interface LogoAplicacaoProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  variante?: LogoVariante;
  tema?: LogoTema;
  altura?: number | string;
}

export function LogoAplicacao({
  variante = "completa",
  tema = "padrao",
  altura,
  className,
  alt,
  ...props
}: LogoAplicacaoProps) {
  const { logoUrl, isDefaultCompany, nomeEmpresa } =
    CONFIGURACAO_APLICACAO;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt ?? nomeEmpresa}
        className={cn("h-auto w-auto shrink-0 object-contain", className)}
        style={altura ? { height: altura } : undefined}
        {...props}
      />
    );
  }

  if (isDefaultCompany) {
    return (
      <LogoVasconcelos
        variante={variante}
        tema={tema}
        altura={altura}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 leading-tight",
        className,
      )}
      style={altura ? { height: altura } : undefined}
      role="img"
      aria-label={nomeEmpresa}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: CONFIGURACAO_APLICACAO.corDestaque }}
      >
        {nomeEmpresa.charAt(0).toUpperCase()}
      </div>
      <span className="text-base font-semibold text-superficie-900">
        {nomeEmpresa}
      </span>
    </div>
  );
}
