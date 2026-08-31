"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Eye, EyeOff } from "lucide-react";
import { Botao, Spinner } from "@/components/ui";
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
  const [exibir, setExibir] = useState(false);

  if (!exibir) {
    return (
      <div className="rounded-xl border border-borda bg-superficie-50 p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-superficie-700 min-w-0">
            <MapPin className="h-4 w-4 text-azul-600 shrink-0" />
            <span className="truncate">
              <strong>{props.plantaNome}</strong> · Página {props.pagina}
            </span>
          </div>
          <Botao
            type="button"
            tamanho="sm"
            variante="contorno"
            onClick={() => setExibir(true)}
            className="w-full sm:w-auto shrink-0"
          >
            <Eye className="h-3.5 w-3.5" />
            Visualizar planta interativa
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-superficie-500">
          Mapa interativo carregado
        </span>
        <button
          type="button"
          onClick={() => setExibir(false)}
          className="inline-flex items-center gap-1 text-xs font-medium text-superficie-600 hover:text-superficie-900 cursor-pointer"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Ocultar mapa
        </button>
      </div>
      <MiniVisualizador {...props} />
    </div>
  );
}
