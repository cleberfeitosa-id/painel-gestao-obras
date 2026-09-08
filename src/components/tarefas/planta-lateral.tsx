"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ArrowDownUp, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Botao, Spinner } from "@/components/ui";
import {
  corredorDaPolilinha,
  deslocarPolilinha,
  limitesDaRegiao,
  pdfParaPercentual,
} from "@/lib/pdf/coordenadas";
import { CORES_CORREDOR, SITUACAO_TAREFA, situacaoDaTarefa } from "@/lib/domain/rotulos";
import { cn } from "@/lib/utils";
import type { TarefaPlanta } from "@/components/plantas/tipos";
import type { PlantaRow, PlantaCalibracaoRow } from "@/lib/supabase/database.types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function obterLinhasCondutoresCircuito(detalhe?: Record<string, unknown> | null): {
  cor: string;
  dash?: string;
  largura: number;
  rotulo: string;
  strokeContrast?: boolean;
}[] {
  const condutores = (detalhe?.condutores as Array<{
    tipo: string;
    quantidade: number;
    cor?: string;
  }>) || [];

  const fases = detalhe?.fases as
    | Array<{ nome: string; cor: string; quantidade: number }>
    | undefined;

  const corFaseR =
    (detalhe?.corFaseR as string) ||
    (detalhe?.corFase as string) ||
    "#FFFFFF";
  const corFaseS = (detalhe?.corFaseS as string) || "#000000";
  const corFaseT = (detalhe?.corFaseT as string) || "#EF4444";

  const linhas: {
    cor: string;
    dash?: string;
    largura: number;
    rotulo: string;
    strokeContrast?: boolean;
  }[] = [];

  if (fases && Array.isArray(fases) && fases.length > 0) {
    for (const f of fases) {
      const qtd = f.quantidade ?? 1;
      for (let i = 0; i < qtd; i++) {
        const cor = f.cor || "#FFFFFF";
        linhas.push({
          cor,
          largura: 2,
          rotulo: qtd > 1 ? `Fase ${f.nome} (${i + 1})` : `Fase ${f.nome}`,
          strokeContrast: cor.toUpperCase() === "#FFFFFF",
        });
      }
    }
  } else {
    const itemFase = condutores.find((c) => c.tipo === "fase");
    const qtdFase =
      itemFase?.quantidade ?? (condutores.length === 0 ? 1 : 0);

    if (qtdFase >= 1) {
      linhas.push({
        cor: corFaseR,
        largura: 2,
        rotulo: "Fase R",
        strokeContrast: corFaseR.toUpperCase() === "#FFFFFF",
      });
    }
    if (qtdFase >= 2) {
      linhas.push({
        cor: corFaseS,
        largura: 2,
        rotulo: "Fase S",
        strokeContrast: corFaseS.toUpperCase() === "#FFFFFF",
      });
    }
    if (qtdFase >= 3) {
      linhas.push({
        cor: corFaseT,
        largura: 2,
        rotulo: "Fase T",
        strokeContrast: corFaseT.toUpperCase() === "#FFFFFF",
      });
    }
  }

  const itemNeutro = condutores.find((c) => c.tipo === "neutro");
  const itemTerra = condutores.find((c) => c.tipo === "terra");
  const itemRetorno = condutores.find((c) => c.tipo === "retorno");

  const qtdNeutro =
    itemNeutro?.quantidade ?? (condutores.length === 0 ? 1 : 0);
  const qtdTerra =
    itemTerra?.quantidade ?? (condutores.length === 0 ? 1 : 0);
  const qtdRetorno = itemRetorno?.quantidade ?? 0;

  for (let i = 0; i < qtdNeutro; i++) {
    linhas.push({
      cor: "#2563EB",
      dash: "8,4",
      largura: 2,
      rotulo: "Neutro",
    });
  }

  for (let i = 0; i < qtdTerra; i++) {
    linhas.push({
      cor: "#16A34A",
      dash: "3,3",
      largura: 2,
      rotulo: "Terra",
    });
  }

  for (let i = 0; i < qtdRetorno; i++) {
    linhas.push({
      cor: "#F59E0B",
      dash: "6,3",
      largura: 1.8,
      rotulo: "Retorno",
    });
  }

  if (linhas.length === 0) {
    linhas.push({
      cor: corFaseR,
      largura: 2,
      rotulo: "Circuito",
      strokeContrast: corFaseR.toUpperCase() === "#FFFFFF",
    });
  }

  return linhas;
}

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

                if (
                  tarefa.localizacao_tipo === "descida" &&
                  tarefa.ponto_x != null &&
                  tarefa.ponto_y != null
                ) {
                  const pos = pdfParaPercentual(
                    { x: tarefa.ponto_x, y: tarefa.ponto_y },
                    dimensoes.largura,
                    dimensoes.altura,
                  );
                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto transition-all",
                        isDestaque ? "z-40 scale-110" : "z-30"
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
                          "flex items-center justify-center rounded-full p-1.5 shadow-md ring-2 ring-white transition-all",
                          isSelecionada ? "ring-4 ring-azul-500 scale-125" : "",
                          isDestaque && !isSelecionada ? "ring-2 ring-azul-300" : "",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center rounded-full",
                            isSelecionada
                              ? "h-5 w-5 bg-azul-600"
                              : cn("h-4 w-4 opacity-85", SITUACAO_TAREFA[sit].pino),
                          )}
                        >
                          <ArrowDownUp className="h-3 w-3 text-white" />
                        </span>
                      </div>
                    </div>
                  );
                }

                if (
                  tarefa.localizacao_tipo === "distancia" &&
                  tarefa.localizacao_detalhe?.pontos &&
                  tarefa.localizacao_detalhe.pontos.length >= 2
                ) {
                  const pontos = tarefa.localizacao_detalhe!.pontos!;
                  const corredor = corredorDaPolilinha(pontos, 8);
                  if (corredor.length < 3) return null;

                  const corredorSvg = corredor
                    .map((p) => {
                      const pct = pdfParaPercentual(p, dimensoes.largura, dimensoes.altura);
                      return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`;
                    })
                    .join(" ");

                  const polylineSvg = pontos
                    .map((p) => {
                      const pct = pdfParaPercentual(p, dimensoes.largura, dimensoes.altura);
                      return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`;
                    })
                    .join(" ");

                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute inset-0 pointer-events-none transition-all",
                        isDestaque ? "z-30" : "z-20",
                      )}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full overflow-visible"
                      >
                        <polygon
                          points={corredorSvg}
                          fill={CORES_CORREDOR[sit]}
                          fillOpacity={isSelecionada ? 0.75 : isDestaque ? 0.6 : 0.45}
                          stroke={isSelecionada ? "#2563EB" : isDestaque ? "#3B82F6" : CORES_CORREDOR[sit]}
                          strokeWidth={isSelecionada ? 2.5 : 0.5}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="auto"
                          className="cursor-pointer"
                          onMouseEnter={() => aoDestaque(tarefa.id)}
                          onMouseLeave={() => aoDestaque(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            aoAlternarSelecao(tarefa.id);
                          }}
                        />
                        {isSelecionada && (
                          <polyline
                            points={polylineSvg}
                            fill="none"
                            stroke="#1D4ED8"
                            strokeWidth={2.5}
                            strokeDasharray="5 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </svg>
                    </div>
                  );
                }

                if (
                  tarefa.localizacao_tipo === "circuito" &&
                  tarefa.localizacao_detalhe?.pontos &&
                  tarefa.localizacao_detalhe.pontos.length >= 2
                ) {
                  const pontos = tarefa.localizacao_detalhe!.pontos!;
                  const linhas = obterLinhasCondutoresCircuito(tarefa.localizacao_detalhe);
                  const K = linhas.length;
                  const gap = 2.4;
                  const larguraCorredor = Math.max(14, K * gap + 10);
                  const corredor = corredorDaPolilinha(pontos, larguraCorredor);
                  if (corredor.length < 3) return null;

                  const corredorSvg = corredor
                    .map((p) => {
                      const pct = pdfParaPercentual(p, dimensoes.largura, dimensoes.altura);
                      return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`;
                    })
                    .join(" ");

                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute inset-0 pointer-events-none transition-all",
                        isDestaque ? "z-30" : "z-20",
                      )}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full overflow-visible"
                      >
                        <polygon
                          points={corredorSvg}
                          fill={CORES_CORREDOR[sit]}
                          fillOpacity={isSelecionada ? 0.8 : isDestaque ? 0.7 : 0.55}
                          stroke={isSelecionada ? "#2563EB" : isDestaque ? "#3B82F6" : CORES_CORREDOR[sit]}
                          strokeWidth={isSelecionada ? 2.5 : 0.5}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="auto"
                          className="cursor-pointer"
                          onMouseEnter={() => aoDestaque(tarefa.id)}
                          onMouseLeave={() => aoDestaque(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            aoAlternarSelecao(tarefa.id);
                          }}
                        />
                        {linhas.map((linha, idx) => {
                          const offset = (idx - (K - 1) / 2) * gap;
                          const ptsDeslocados = deslocarPolilinha(pontos, offset);
                          const pathData = ptsDeslocados
                            .map((p, pIdx) => {
                              const pct = pdfParaPercentual(p, dimensoes.largura, dimensoes.altura);
                              return `${pIdx === 0 ? "M" : "L"} ${pct.esquerda.toFixed(3)} ${pct.topo.toFixed(3)}`;
                            })
                            .join(" ");

                          return (
                            <g key={idx}>
                              {linha.strokeContrast && (
                                <path
                                  d={pathData}
                                  fill="none"
                                  stroke="#0f172a"
                                  strokeWidth={isSelecionada ? 4 : 3}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity={0.7}
                                  vectorEffect="non-scaling-stroke"
                                />
                              )}
                              <path
                                d={pathData}
                                fill="none"
                                stroke={linha.cor}
                                strokeWidth={isSelecionada ? linha.largura + 0.8 : linha.largura}
                                strokeDasharray={linha.dash}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                }

                if (
                  tarefa.localizacao_tipo === "area" &&
                  tarefa.localizacao_detalhe?.pontos &&
                  tarefa.localizacao_detalhe.pontos.length >= 3
                ) {
                  const pontos = tarefa.localizacao_detalhe!.pontos!;
                  const pontosSvg = pontos
                    .map((p) => {
                      const pct = pdfParaPercentual(p, dimensoes.largura, dimensoes.altura);
                      return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`;
                    })
                    .join(" ");

                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "absolute inset-0 pointer-events-none transition-all",
                        isDestaque ? "z-20" : "z-10",
                      )}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full"
                      >
                        <polygon
                          points={pontosSvg}
                          fill={isSelecionada ? "#3B82F6" : CORES_CORREDOR[sit]}
                          fillOpacity={isSelecionada ? 0.5 : isDestaque ? 0.45 : 0.35}
                          stroke={isSelecionada ? "#2563EB" : isDestaque ? "#3B82F6" : CORES_CORREDOR[sit]}
                          strokeWidth={isSelecionada ? 3 : 2}
                          strokeDasharray={isSelecionada ? undefined : "4 2"}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="auto"
                          className="cursor-pointer"
                          onMouseEnter={() => aoDestaque(tarefa.id)}
                          onMouseLeave={() => aoDestaque(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            aoAlternarSelecao(tarefa.id);
                          }}
                        />
                      </svg>
                    </div>
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
