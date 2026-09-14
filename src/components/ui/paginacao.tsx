"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Botao } from "@/components/ui";

interface PaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  totalItens: number;
  rotuloItens?: string;
}

export function Paginacao({
  paginaAtual,
  totalPaginas,
  totalItens,
  rotuloItens = "itens",
}: PaginacaoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function irParaPagina(novaPagina: number) {
    if (novaPagina < 1 || novaPagina > totalPaginas) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("pagina", String(novaPagina));
    const query = params.toString();
    router.push(query ? `?${query}` : ".");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-superficie-500">
        Página {paginaAtual} de {totalPaginas} · {totalItens} {rotuloItens}
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <Botao
            variante="contorno"
            tamanho="sm"
            onClick={() => irParaPagina(paginaAtual - 1)}
            disabled={paginaAtual <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Botao>
          <Botao
            variante="contorno"
            tamanho="sm"
            onClick={() => irParaPagina(paginaAtual + 1)}
            disabled={paginaAtual >= totalPaginas}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Botao>
        </div>
      )}
    </div>
  );
}