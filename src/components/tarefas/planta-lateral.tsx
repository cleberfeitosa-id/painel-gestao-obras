"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Botao, Spinner } from "@/components/ui";
import { pdfParaPercentual, limitesDaRegiao } from "@/lib/pdf/coordenadas";
import { SITUACAO_TAREFA, situacaoDaTarefa } from "@/lib/domain/rotulos";
import { cn } from "@/lib/utils";
import type { TarefaPlanta } from "@/components/plantas/tipos";
import type { PlantaRow, PlantaCalibracaoRow } from "@/lib/supabase/database.types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PlantaLateralProps {
  planta: PlantaRow;
  calibracoes: PlantaCalibracaoRow[];
  urlPdf: string;
  tarefas: TarefaPlanta[];
  paginaInicial: number;
  selecionadas: Set<string>;
  aoAlternarSelecao: (id: string) => void;
  tarefaDestaque: string | null;
  aoDestaque: (id: string | null) => void;
}

export function PlantaLateral({
  planta,
  calibracoes,
  urlPdf,
  tarefas,
  paginaInicial,
  selecionadas,
  aoAlternarSelecao,
  tarefaDestaque,
  aoDestaque,
}: PlantaLateralProps) {
  const [escala, setEscala] = useState(1);
  const [pagina, setPagina] = useState(paginaInicial || 1);
  const [dimensoes, setDimensoes] = useState<{ largura: number; altura: number } | null>(null);

  const tarefasDaPagina = tarefas.filter((t) => t.pagina === pagina);

  return (
    <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-lg border border-borda bg-superficie-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-borda bg-white px-3 py-2">
        <span className="text-sm font-medium text-superficie-700 truncate max-w-[200px]" title={planta.nome}>
          {planta.nome}
        </span>
        <div className="flex items-center gap-1">
           <Botao type="button" variante="fantasma" className="h-8 w-8 p-0" onClick={() => setEscala((e) => Math.max(0.2, e - 0.2))}>
             <ZoomOut className="h-4 w-4" />
           </Botao>
           <span className="text-xs text-superficie-500 min-w-[3ch] text-center">{Math.round(escala * 100)}%</span>
           <Botao type="button" variante="fantasma" className="h-8 w-8 p-0" onClick={() => setEscala((e) => Math.min(5, e + 0.2))}>
             <ZoomIn className="h-4 w-4" />
           </Botao>
           <Botao type="button" variante="fantasma" className="h-8 w-8 p-0" onClick={() => setEscala(1)}>
             <RotateCcw className="h-4 w-4" />
           </Botao>
        </div>
      </div>
      
      <div className="relative flex-1 overflow-auto bg-superficie-200 p-4 select-none touch-none">
        <div className="relative m-auto shadow-md shrink-0 bg-white w-fit">
          <Document
            file={urlPdf}
            loading={
              <div className="flex items-center justify-center p-8">
                <Spinner className="h-6 w-6 text-azul-600" />
              </div>
            }
          >
            <Page
              pageNumber={pagina}
              scale={escala}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(paginaPdf) => {
                setDimensoes({
                  largura: paginaPdf.originalWidth,
                  altura: paginaPdf.originalHeight,
                });
              }}
            />
          </Document>

          {dimensoes && (
            <div className="absolute inset-0 pointer-events-none">
              {tarefasDaPagina.map((tarefa) => {
                const sit = situacaoDaTarefa({ status: tarefa.status, aprovacao: tarefa.aprovacao });
                const isSelecionada = selecionadas.has(tarefa.id);
                const isDestaque = tarefaDestaque === tarefa.id;

                if (tarefa.localizacao_tipo === "ponto" && tarefa.ponto_x != null && tarefa.ponto_y != null) {
                  const pos = pdfParaPercentual({ x: tarefa.ponto_x, y: tarefa.ponto_y }, dimensoes.largura, dimensoes.altura);
                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute cursor-pointer pointer-events-auto transition-all",
                        isDestaque ? "z-40" : "z-30"
                      )}
                      style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                      onMouseEnter={() => aoDestaque(tarefa.id)}
                      onMouseLeave={() => aoDestaque(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAlternarSelecao(tarefa.id);
                      }}
                    >
                      <div
                        className={cn(
                          "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all shadow-sm",
                          SITUACAO_TAREFA[sit].pino,
                          isSelecionada ? "ring-4 ring-azul-500 scale-125" : "",
                          isDestaque && !isSelecionada ? "ring-2 ring-azul-300 scale-110" : "",
                          "w-4 h-4"
                        )}
                      />
                    </div>
                  );
                }

                if (tarefa.localizacao_tipo === "regiao" && tarefa.regiao) {
                  const ret = limitesDaRegiao(tarefa.regiao);
                  if (!ret) return null;
                  const min = { x: ret.x, y: ret.y };
                  const max = { x: ret.x + ret.largura, y: ret.y + ret.altura };
                  
                  const infEsq = pdfParaPercentual(min, dimensoes.largura, dimensoes.altura);
                  const supDir = pdfParaPercentual(max, dimensoes.largura, dimensoes.altura);
                  const left = infEsq.esquerda;
                  const top = supDir.topo;
                  const width = supDir.esquerda - infEsq.esquerda;
                  const height = infEsq.topo - supDir.topo;
                  
                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute cursor-pointer pointer-events-auto border-2 transition-all",
                        SITUACAO_TAREFA[sit].regiao,
                        isDestaque ? "z-20" : "z-10",
                        isSelecionada ? "border-azul-500 bg-azul-500/30" : "",
                        isDestaque && !isSelecionada ? "border-azul-300 bg-azul-300/20" : ""
                      )}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                      onMouseEnter={() => aoDestaque(tarefa.id)}
                      onMouseLeave={() => aoDestaque(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAlternarSelecao(tarefa.id);
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
      
      {planta.total_paginas > 1 && (
        <div className="flex items-center justify-between border-t border-borda bg-white px-3 py-2">
           <Botao 
             type="button"
             variante="secundario" 
             tamanho="sm" 
             disabled={pagina <= 1}
             onClick={() => setPagina(p => p - 1)}
           >
             Anterior
           </Botao>
           <span className="text-sm font-medium text-superficie-700">
             {pagina} / {planta.total_paginas}
           </span>
           <Botao 
             type="button"
             variante="secundario" 
             tamanho="sm" 
             disabled={pagina >= planta.total_paginas}
             onClick={() => setPagina(p => p + 1)}
           >
             Próxima
           </Botao>
        </div>
      )}
    </div>
  );
}
