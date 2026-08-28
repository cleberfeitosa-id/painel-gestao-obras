import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Cartao({
  className,
  children,
  ...resto
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-borda bg-fundo-card shadow-sm",
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

export function CartaoCabecalho({
  className,
  children,
  ...resto
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 border-b border-borda", className)}
      {...resto}
    >
      {children}
    </div>
  );
}

export function CartaoTitulo({
  className,
  children,
  ...resto
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold text-superficie-900", className)}
      {...resto}
    >
      {children}
    </h3>
  );
}

export function CartaoConteudo({
  className,
  children,
  ...resto
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4", className)} {...resto}>
      {children}
    </div>
  );
}

export function CartaoRodape({
  className,
  children,
  ...resto
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-6 py-3 border-t border-borda bg-superficie-50 rounded-b-xl",
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}
