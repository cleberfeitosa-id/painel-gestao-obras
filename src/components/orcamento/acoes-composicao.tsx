"use client";

import { Edit2, Eye } from "lucide-react";

interface AcoesComposicaoProps {
  composicaoId: string;
  nome: string;
  obraId: string;
}

type Modo = "ver" | "editar";

function abrirModal(composicaoId: string, obraId: string, modo: Modo) {
  window.dispatchEvent(
    new CustomEvent("abrir-modal-composicao", {
      detail: { composicaoId, obraId, modo },
    }),
  );
}

export function AcoesComposicao({ composicaoId, nome, obraId }: AcoesComposicaoProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => abrirModal(composicaoId, obraId, "ver")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-superficie-100 hover:text-superficie-700"
        aria-label={`Ver composição ${nome}`}
        title="Ver detalhes"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => abrirModal(composicaoId, obraId, "editar")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-superficie-100 hover:text-superficie-700"
        aria-label={`Editar composição ${nome}`}
        title="Editar"
      >
        <Edit2 className="h-4 w-4" />
      </button>
    </>
  );
}
