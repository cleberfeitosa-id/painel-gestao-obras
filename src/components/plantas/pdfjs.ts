"use client";

import { pdfjs } from "react-pdf";

// O worker do pdfjs nao pode rodar no servidor (depende de Web Worker e do
// DOM). O `new URL(..., import.meta.url)` faz o bundler emitir o arquivo como
// asset estatico, servido pelo CDN da Vercel junto com o resto do bundle.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjs };

export async function contarPaginasPdf(arquivo: File): Promise<number> {
  const dados = await arquivo.arrayBuffer();
  const documento = await pdfjs.getDocument({ data: dados }).promise;
  const total = documento.numPages;
  await documento.destroy();
  return total;
}