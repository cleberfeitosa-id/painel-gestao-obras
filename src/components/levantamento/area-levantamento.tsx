"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";
import type { ObraRow, PlantaCalibracaoRow, PlantaRow, LevantamentoRow } from "@/lib/supabase/database.types";

const VisualizadorLevantamento = dynamic(
  () =>
    import("./visualizador-levantamento").then(
      (m) => m.VisualizadorLevantamento,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-3 rounded-2xl border border-superficie-200 bg-white p-8">
        <Spinner tamanho="lg" />
        <p className="text-sm text-superficie-500 font-medium">
          Carregando módulo de levantamento de quantidades e motor 3D...
        </p>
      </div>
    ),
  },
);

interface AreaLevantamentoProps {
  obras: ObraRow[];
  plantas: PlantaRow[];
  obraInicialId?: string;
  plantaInicialId?: string;
  paginaInicial?: number;
  levantamentoInicial?: LevantamentoRow | null;
  calibracoesIniciais: PlantaCalibracaoRow[];
  urlPdfInicial: string | null;
  podeEditar: boolean;
}

export function AreaLevantamento(props: AreaLevantamentoProps) {
  return <VisualizadorLevantamento {...props} />;
}
