import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface EtiquetaProps extends HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function Etiqueta({ className, children, ...resto }: EtiquetaProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
      {...resto}
    >
      {children}
    </span>
  );
}
