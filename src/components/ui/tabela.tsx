import { type HTMLAttributes, type TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TabelaWrapperProps extends HTMLAttributes<HTMLDivElement> {}

export function Tabela({ className, children, ...resto }: TabelaWrapperProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)} {...resto}>
      {children}
    </div>
  );
}

export function Cabecalho({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-borda", className)} {...resto}>
      {children}
    </thead>
  );
}

export function LinhaCabecalho({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...resto}>
      {children}
    </tr>
  );
}

export function CelulaCabecalho({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-superficie-500",
        className,
      )}
      {...resto}
    >
      {children}
    </th>
  );
}

export function Corpo({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-superficie-100", className)}
      {...resto}
    >
      {children}
    </tbody>
  );
}

export function Linha({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "hover:bg-superficie-50 transition-colors",
        className,
      )}
      {...resto}
    >
      {children}
    </tr>
  );
}

export function Celula({
  className,
  children,
  ...resto
}: TableHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 text-sm text-superficie-700", className)}
      {...resto}
    >
      {children}
    </td>
  );
}
