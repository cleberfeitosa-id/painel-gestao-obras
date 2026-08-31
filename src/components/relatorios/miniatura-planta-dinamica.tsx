"use client";

import dynamic from "next/dynamic";

// Envoltorio client-side para renderizar a miniatura da planta sem SSR.
// O modulo do react-pdf (pdf.js) chama `new DOMMatrix()` no carregamento,
// inexistente no Node.js; por isso o carregamento precisa ser adiado p/ o
// navegador via `ssr:false`.
export const MiniaturaPlanta = dynamic(
  () =>
    import("./miniatura-planta").then((modulo) => modulo.MiniaturaPlanta),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-lg border border-borda bg-superficie-50 p-6 text-sm text-superficie-500">
        Carregando planta...
      </div>
    ),
  },
);
