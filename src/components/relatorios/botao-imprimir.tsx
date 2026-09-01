"use client";

import { useState, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Printer, Loader2, FileDown } from "lucide-react";
import { Botao } from "@/components/ui";
import type { DadosExportacaoRelatorio } from "./modal-exportar-relatorio";

const ModalExportarRelatorio = dynamic(
  () =>
    import("./modal-exportar-relatorio").then(
      (m) => m.ModalExportarRelatorio,
    ),
  { ssr: false },
);

async function aguardarImagens(container: HTMLElement | null): Promise<void> {
  if (!container) return;
  const imagens = Array.from(container.querySelectorAll("img"));
  if (imagens.length === 0) return;

  const promises = imagens.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const concluir = () => resolve();
      img.addEventListener("load", concluir, { once: true });
      img.addEventListener("error", concluir, { once: true });
      setTimeout(concluir, 1500);
    });
  });

  await Promise.race([
    Promise.all(promises),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
}

interface BotaoImprimirProps {
  children: ReactNode;
  dadosRelatorio?: DadosExportacaoRelatorio;
}

export function BotaoImprimir({ children, dadosRelatorio }: BotaoImprimirProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [imprimindo, setImprimindo] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);

  async function handlePrint() {
    setImprimindo(true);
    try {
      await aguardarImagens(ref.current);
      await new Promise((r) => setTimeout(r, 100));
      window.print();
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <div ref={ref} className="space-y-6">
      <div className="nao-imprimir flex flex-wrap items-center justify-end gap-3">
        {dadosRelatorio && (
          <Botao
            type="button"
            onClick={() => setModalExportarAberto(true)}
            variante="primario"
            className="shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            Exportar Relatório PDF (A0/A1 com Links)
          </Botao>
        )}

        <Botao
          type="button"
          onClick={handlePrint}
          disabled={imprimindo}
          variante="secundario"
        >
          {imprimindo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparando impressão...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Imprimir RDO (Navegador)
            </>
          )}
        </Botao>
      </div>

      {dadosRelatorio && (
        <ModalExportarRelatorio
          aberto={modalExportarAberto}
          aoFechar={() => setModalExportarAberto(false)}
          dados={dadosRelatorio}
        />
      )}

      {children}
    </div>
  );
}
