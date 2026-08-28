"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";
import type { PropsAreaPlanta } from "./tipos";

// O visualizador depende do pdfjs, que usa Web Worker e APIs de DOM; por isso
// so e carregado no navegador, evitando erros de SSR e inchaco do bundle.
const VisualizadorPlanta = dynamic(
  () => import("./visualizador-planta").then((m) => m.VisualizadorPlanta),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center gap-3">
        <Spinner tamanho="lg" />
        <p className="text-sm text-superficie-500">
          Carregando visualizador da planta...
        </p>
      </div>
    ),
  },
);

export function AreaPlanta(props: PropsAreaPlanta) {
  return <VisualizadorPlanta {...props} />;
}