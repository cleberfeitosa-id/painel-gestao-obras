"use client";

import dynamic from "next/dynamic";
import { EsqueletoLinha } from "@/components/ui/carregando";

const VisualizadorCompatibilizacao = dynamic(
  () => import("./visualizador-compatibilizacao"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="space-y-4 w-full max-w-md">
          <EsqueletoLinha className="h-8 w-3/4" />
          <EsqueletoLinha className="h-64 w-full" />
        </div>
      </div>
    )
  }
);

export function AreaCompatibilizacao(props: {
  obraId: string;
  compatibilizacao: { id: string; nome: string; [key: string]: unknown };
  plantasPreCarregadas: any[];
  plantasDisponiveis: any[];
  tarefas: any[];
  choques: any[];
}) {
  return <VisualizadorCompatibilizacao {...(props as any)} />;
}
