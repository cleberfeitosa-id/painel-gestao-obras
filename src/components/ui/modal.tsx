"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type TamanhoModal = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  tamanho?: TamanhoModal;
}

const estilosTamanho: Record<TamanhoModal, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  tamanho = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (aberto && !dialog.open) {
      dialog.showModal();
    } else if (!aberto && dialog.open) {
      dialog.close();
    }
  }, [aberto]);

  const fechar = useCallback(() => {
    aoFechar();
  }, [aoFechar]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClose = () => aoFechar();
    dialog.addEventListener("close", onClose);

    return () => {
      dialog.removeEventListener("close", onClose);
    };
  }, [aoFechar]);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      className={cn(
        "backdrop:bg-superficie-900/60 backdrop:backdrop-blur-sm",
        "rounded-xl border border-borda bg-fundo-card shadow-2xl p-0 w-full",
        estilosTamanho[tamanho],
        "[&[open]]:animate-[fadeIn_0.15s_ease-out]",
      )}
    >
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-superficie-900">
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-1 text-sm text-superficie-500">{descricao}</p>
            )}
          </div>
          <button
            type="button"
            onClick={fechar}
            className="flex-shrink-0 rounded-lg p-1.5 text-superficie-400 hover:text-superficie-600 hover:bg-superficie-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
        {children}
      </div>
    </dialog>
  );
}
