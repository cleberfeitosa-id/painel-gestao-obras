import { type HTMLAttributes, type TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TabelaWrapperProps extends TableHTMLAttributes<HTMLTableElement> {}

export function Tabela({ className, children, ...resto }: TabelaWrapperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...resto}>
        {children}
      </table>
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

interface CelulaProps extends TableHTMLAttributes<HTMLTableCellElement> {
  colSpan?: number;
}

export function Celula({ className, children, ...resto }: CelulaProps) {
  return (
    <td
      className={cn("px-4 py-3 text-sm text-superficie-700", className)}
      {...resto}
    >
      {children}
    </td>
  );
}
