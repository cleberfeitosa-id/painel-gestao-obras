"use client";

import { useRef, type ReactNode } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import { Botao } from "@/components/ui";

// A impressao so abre o dialogo depois que todas as fotos terminam de
// carregar; caso contrario o PDF sai com as imagens em branco.
function aguardarImagens(container: HTMLElement | null): Promise<void> {
  if (!container) return Promise.resolve();
  const imagens = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    imagens.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const concluir = () => resolve();
        img.addEventListener("load", concluir, { once: true });
        img.addEventListener("error", concluir, { once: true });
        if (img.complete) resolve();
      });
    }),
  ).then(() => undefined);
}

export function BotaoImprimir({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: ref,
    documentTitle: "RDO - Relatório Diário de Obra",
    onBeforePrint: () => aguardarImagens(ref.current),
  });

  return (
    <div ref={ref} className="space-y-6">
      <div className="nao-imprimir flex justify-end">
        <Botao
          type="button"
          onClick={() => handlePrint()}
          variante="secundario"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimir / Salvar PDF
        </Botao>
      </div>
      {children}
    </div>
  );
}