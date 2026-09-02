"use client";

import dynamic from "next/dynamic";

export const EditorQuadroDinamico = dynamic(
  () => import("./editor-quadro").then((m) => m.EditorQuadro),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-superficie-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul-600 border-t-transparent" />
          <p className="text-xs text-superficie-600 font-medium">
            Carregando estúdio de modelagem de quadros...
          </p>
        </div>
      </div>
    ),
  },
);
