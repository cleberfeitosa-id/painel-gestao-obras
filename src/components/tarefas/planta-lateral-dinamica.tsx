"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

export const PlantaLateralDinamica = dynamic(
  () => import("./planta-lateral").then((mod) => mod.PlantaLateral),
  {
    ssr: false,
    loading: () => (
      <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col items-center justify-center rounded-lg border border-borda bg-superficie-100 shadow-sm">
        <Spinner className="h-8 w-8 text-azul-600" />
        <p className="mt-4 text-sm font-medium text-superficie-600">
          Carregando planta...
        </p>
      </div>
    ),
  },
);