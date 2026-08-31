"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";
import type { TarefaPlanta } from "@/components/plantas/tipos";

interface PropsMiniVisualizadorPlanta {
  obraId: string;
  plantaId: string;
  plantaNome: string;
  urlPdf: string;
  pagina: number;
  tarefaAtualId: string;
  tarefas: TarefaPlanta[];
  podeEditar: boolean;
}

const MiniVisualizador = dynamic(
  () =>
    import("./mini-visualizador-planta").then((m) => m.MiniVisualizadorPlanta),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 w-full max-w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-borda bg-superficie-50 p-6 text-xs text-superficie-500">
        <Spinner tamanho="md" />
        Carregando visualizador da planta...
      </div>
    ),
  },
);

export function MiniVisualizadorPlantaDinamico(props: PropsMiniVisualizadorPlanta) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <MiniVisualizador {...props} />
    </div>
  );
}
