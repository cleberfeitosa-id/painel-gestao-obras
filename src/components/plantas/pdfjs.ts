"use client";

// Importar do pacote direto (e nao via react-pdf) para que a biblioteca e o
// worker sejam da MESMA versao. O react-pdf@10.5.0 embute pdfjs-dist@5.4.296
// e o pdfjs-dist de topo esta PINADO em 5.4.296 (package.json) para casarem;
// se um dia atualizar o react-pdf, sincronize o pin do pdfjs-dist com a versao
// que ele embute, senao o worker e o getDocument quebram por versao divergente.
import * as pdfjs from "pdfjs-dist";

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