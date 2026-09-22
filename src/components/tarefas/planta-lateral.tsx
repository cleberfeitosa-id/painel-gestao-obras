"use client";

import { useEffect, useRef, useState } from "react";
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
import { extrairSegmentosCircuito } from "@/components/plantas/tipos";
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

const PDF_DPR_MAX = 1.2;
const PDF_MAX_RENDER_PIXELS = 12_000_000;
const PDF_MAX_RENDER_DIMENSION = 4096;
const PDF_RENDER_DEBOUNCE_MS = 150;
const PDF_INITIAL_RENDER_SCALE = 0.1;

function escalaRenderizacaoSegura(
  escalaSolicitada: number,
  dimensoes: { largura: number; altura: number },
  dpr: number,
) : number {
  if (
    !Number.isFinite(escalaSolicitada) ||
    !Number.isFinite(dpr) ||
    dpr <= 0 ||
    !Number.isFinite(dimensoes.largura) ||
    !Number.isFinite(dimensoes.altura) ||
    dimensoes.largura <= 0 ||
    dimensoes.altura <= 0
  ) {
    return PDF_INITIAL_RENDER_SCALE;
  }

  const area = dimensoes.largura * dimensoes.altura * dpr * dpr;
  if (!Number.isFinite(area) || area <= 0) return PDF_INITIAL_RENDER_SCALE;

  const escalaPorArea = Math.sqrt(PDF_MAX_RENDER_PIXELS / area);
  const escalaPorLargura = PDF_MAX_RENDER_DIMENSION / (dimensoes.largura * dpr);
  const escalaPorAltura = PDF_MAX_RENDER_DIMENSION / (dimensoes.altura * dpr);
  const escalaSegura = Math.min(
    escalaPorArea,
    escalaPorLargura,
    escalaPorAltura,
  );

  if (!Number.isFinite(escalaSegura) || escalaSegura <= 0) {
    return PDF_INITIAL_RENDER_SCALE;
  }

  return Math.min(
    Math.max(PDF_INITIAL_RENDER_SCALE, escalaSolicitada),
    escalaSegura,
  );
}

export function PlantaLateral({
  planta,
  urlPdf,
  tarefas,
  paginaInicial,
  selecionadas,
  aoAlternarSelecao,
  tarefaDestaque,
  aoDestaque,
}: PlantaLateralProps) {
  const [escala, setEscala] = useState(1);
  const [escalaRenderizada, setEscalaRenderizada] = useState({
    chave: "",
    valor: PDF_INITIAL_RENDER_SCALE,
  });
  const [pagina, setPagina] = useState(paginaInicial || 1);
  const [dimensoes, setDimensoes] = useState<{
    chave: string;
    largura: number;
    altura: number;
  } | null>(null);
  const [erroPdf, setErroPdf] = useState(false);
  const [erroRenderizacao, setErroRenderizacao] = useState<{
    chave: string;
    ocorreu: boolean;
  } | null>(null);
  const [circuitosSelecionados, setCircuitosSelecionados] = useState<string[]>([]);
  const [filtroCircuitosAberto, setFiltroCircuitosAberto] = useState(false);
  const filtroCircuitosRef = useRef<HTMLDivElement>(null);
  const chaveRenderizacaoRef = useRef("");
  const [dpr] = useState(() =>
    typeof window === "undefined" ? 1 : Math.min(PDF_DPR_MAX, window.devicePixelRatio || 1),
  );
  const paginaAtual = Math.min(Math.max(1, pagina), Math.max(1, planta.total_paginas));
  const chavePagina = `${urlPdf}:${paginaAtual}`;
  const dimensoesAtuais = dimensoes?.chave === chavePagina ? dimensoes : null;
  const escalaRenderizadaAtual =
    escalaRenderizada.chave === chavePagina
      ? escalaRenderizada.valor
      : PDF_INITIAL_RENDER_SCALE;

  useEffect(() => {
    chaveRenderizacaoRef.current = chavePagina;
  }, [chavePagina]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEscalaRenderizada({ chave: chavePagina, valor: escala });
      setErroRenderizacao(null);
    }, PDF_RENDER_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [chavePagina, escala]);

  const tarefasDaPagina = tarefas.filter((t) => t.pagina === paginaAtual);
  const circuitosDisponiveis = Array.from(
    new Set(
      tarefasDaPagina
        .filter((tarefa) => tarefa.localizacao_tipo === "circuito")
        .map((tarefa) => tarefa.localizacao_detalhe?.circuito?.trim())
        .filter((circuito): circuito is string => Boolean(circuito)),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const circuitosSelecionadosAtivos = circuitosSelecionados.filter((circuito) =>
    circuitosDisponiveis.includes(circuito),
  );
  const tarefasVisiveis = tarefasDaPagina.filter((tarefa) =>
    tarefa.localizacao_tipo !== "circuito" ||
    circuitosSelecionadosAtivos.length === 0 ||
    circuitosSelecionadosAtivos.includes(tarefa.localizacao_detalhe?.circuito?.trim() ?? ""),
  );

  useEffect(() => {
    if (!filtroCircuitosAberto) return;
    function fecharAoClicarFora(evento: MouseEvent) {
      if (!filtroCircuitosRef.current?.contains(evento.target as Node)) {
        setFiltroCircuitosAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, [filtroCircuitosAberto]);

  return (
    <div className="sticky top-6 flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-lg border border-borda bg-superficie-100 shadow-sm lg:h-[calc(100dvh-3rem)]">
       <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda bg-white px-3 py-2">
         <span className="min-w-0 max-w-[200px] truncate text-sm font-medium text-superficie-700" title={planta.nome}>
           {planta.nome}
         </span>
         <div className="flex flex-wrap items-center justify-end gap-1">
           {circuitosDisponiveis.length > 0 && (
             <div ref={filtroCircuitosRef} className="relative mr-1">
               <button
                 type="button"
                 aria-expanded={filtroCircuitosAberto}
                 onClick={() => setFiltroCircuitosAberto((aberto) => !aberto)}
                 className="inline-flex h-8 items-center rounded-md border border-borda bg-white px-2 text-[11px] font-medium text-superficie-700 shadow-2xs hover:bg-superficie-100"
               >
                 Circuitos ({circuitosSelecionadosAtivos.length === 0 ? "todos" : `${circuitosSelecionadosAtivos.length}/${circuitosDisponiveis.length}`})
               </button>
               {filtroCircuitosAberto && (
                 <div className="absolute right-0 z-50 mt-1 max-h-56 min-w-56 overflow-y-auto rounded-lg border border-borda bg-white p-2 text-left shadow-lg">
                 <div className="mb-1 flex items-center justify-between gap-2 border-b border-superficie-100 pb-1">
                   <span className="text-[10px] font-semibold uppercase tracking-wide text-superficie-500">Exibir circuitos</span>
                   <button
                     type="button"
                     className="text-[10px] font-medium text-azul-700 hover:underline"
                     onClick={() => setCircuitosSelecionados([])}
                   >
                     Todos
                   </button>
                 </div>
                 {circuitosDisponiveis.map((circuito) => (
                   <label key={circuito} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-superficie-700 hover:bg-superficie-50">
                     <input
                       type="checkbox"
                       checked={circuitosSelecionadosAtivos.includes(circuito)}
                       onChange={(evento) => setCircuitosSelecionados((atuais) => evento.target.checked
                         ? [...atuais, circuito]
                         : atuais.filter((item) => item !== circuito))}
                       className="h-3.5 w-3.5 rounded border-borda text-azul-600"
                     />
                     <span className="truncate">{circuito}</span>
                   </label>
                 ))}
                 </div>
               )}
             </div>
           )}
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
      
       <div className="relative flex-1 overflow-auto bg-superficie-200 select-none touch-pan-x touch-pan-y">
         <div className="flex min-h-full min-w-full p-4">
          <div
           className="relative m-auto shadow-md shrink-0 bg-white w-fit"
           style={
             dimensoesAtuais
               ? {
                   width: dimensoesAtuais.largura * escala,
                   height: dimensoesAtuais.altura * escala,
                 }
               : undefined
           }
         >
          <div
            className="relative"
            style={
              dimensoesAtuais
                ? {
                    transform: `scale(${escala / escalaRenderizacaoSegura(escalaRenderizadaAtual, dimensoesAtuais, dpr)})`,
                    transformOrigin: "top left",
                    willChange: "transform",
                  }
                : undefined
            }
          >
            <Document
              file={urlPdf}
               onLoadSuccess={() => {
                 if (chaveRenderizacaoRef.current !== chavePagina) return;
                 setErroPdf(false);
                 setErroRenderizacao(null);
               }}
               onLoadError={() => {
                 if (chaveRenderizacaoRef.current === chavePagina) setErroPdf(true);
               }}
              loading={
                <div className="flex items-center justify-center p-8">
                  <Spinner className="h-6 w-6 text-azul-600" />
                </div>
              }
              error={
                <div className="flex min-h-64 min-w-[280px] items-center justify-center p-8 text-center text-xs text-perigo">
                  {erroPdf
                    ? "Não foi possível carregar a planta. Tente recarregar a página."
                    : "Não foi possível carregar a planta."}
                </div>
              }
            >
              <Page
                 pageNumber={paginaAtual}
                scale={
                  dimensoesAtuais
                    ? escalaRenderizacaoSegura(escalaRenderizadaAtual, dimensoesAtuais, dpr)
                    : PDF_INITIAL_RENDER_SCALE
                }
                devicePixelRatio={dpr}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                 onRenderError={() => {
                   if (chaveRenderizacaoRef.current === chavePagina) {
                     setErroRenderizacao({ chave: chavePagina, ocorreu: true });
                   }
                 }}
                error={
                  <div className="flex min-h-64 min-w-[280px] items-center justify-center p-8 text-center text-xs text-perigo">
                    {erroRenderizacao?.chave === chavePagina && erroRenderizacao.ocorreu
                      ? "Não foi possível renderizar esta página. Reduza o zoom e tente novamente."
                      : "Não foi possível renderizar esta página."}
                  </div>
                }
                 onLoadSuccess={(paginaPdf) => {
                   if (chaveRenderizacaoRef.current !== chavePagina) return;
                   const viewport = paginaPdf.getViewport({ scale: 1 });
                  setDimensoes({
                    chave: chavePagina,
                    largura: viewport.width,
                    altura: viewport.height,
                  });
                }}
              />
            </Document>
            {dimensoesAtuais && (
            <div className="absolute inset-0 pointer-events-none">
               {tarefasVisiveis.map((tarefa) => {
                const sit = situacaoDaTarefa({ status: tarefa.status, aprovacao: tarefa.aprovacao });
                const isSelecionada = selecionadas.has(tarefa.id);
                const isDestaque = tarefaDestaque === tarefa.id;

                if (tarefa.localizacao_tipo === "ponto" && tarefa.ponto_x != null && tarefa.ponto_y != null) {
                   const pos = pdfParaPercentual({ x: tarefa.ponto_x, y: tarefa.ponto_y }, dimensoesAtuais.largura, dimensoesAtuais.altura);
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
                  
                   const infEsq = pdfParaPercentual(min, dimensoesAtuais.largura, dimensoesAtuais.altura);
                   const supDir = pdfParaPercentual(max, dimensoesAtuais.largura, dimensoesAtuais.altura);
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
                     dimensoesAtuais.largura,
                     dimensoesAtuais.altura,
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
                       const pct = pdfParaPercentual(p, dimensoesAtuais.largura, dimensoesAtuais.altura);
                      return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`;
                    })
                    .join(" ");

                  const polylineSvg = pontos
                    .map((p) => {
                       const pct = pdfParaPercentual(p, dimensoesAtuais.largura, dimensoesAtuais.altura);
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
                  tarefa.localizacao_detalhe
                ) {
                  const segmentos = extrairSegmentosCircuito(tarefa.localizacao_detalhe);
                  if (segmentos.length === 0) return null;
                  const linhas = obterLinhasCondutoresCircuito(tarefa.localizacao_detalhe);
                  const K = linhas.length;
                  const gap = 2.4;
                  const larguraCorredor = Math.max(14, K * gap + 10);
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
                         {segmentos.map((segmento, segmentoIdx) => {
                           const pontos = segmento.pontos;
                           const corredor = corredorDaPolilinha(pontos, larguraCorredor);
                           if (corredor.length < 3) return null;
                            const corredorSvg = corredor.map((p) => { const pct = pdfParaPercentual(p, dimensoesAtuais.largura, dimensoesAtuais.altura); return `${pct.esquerda.toFixed(3)},${pct.topo.toFixed(3)}`; }).join(" ");
                           return <g key={segmento.segmentoId ?? segmentoIdx}>
                           <polygon points={corredorSvg} fill={CORES_CORREDOR[sit]} fillOpacity={isSelecionada ? 0.8 : isDestaque ? 0.7 : 0.55} stroke={isSelecionada ? "#2563EB" : isDestaque ? "#3B82F6" : CORES_CORREDOR[sit]} strokeWidth={isSelecionada ? 2.5 : 0.5} vectorEffect="non-scaling-stroke" pointerEvents="auto" className="cursor-pointer" onMouseEnter={() => aoDestaque(tarefa.id)} onMouseLeave={() => aoDestaque(null)} onClick={(e) => { e.stopPropagation(); aoAlternarSelecao(tarefa.id); }} />
                         {linhas.map((linha, idx) => {
                          const offset = (idx - (K - 1) / 2) * gap;
                          const ptsDeslocados = deslocarPolilinha(pontos, offset);
                          const pathData = ptsDeslocados
                            .map((p, pIdx) => {
                               const pct = pdfParaPercentual(p, dimensoesAtuais.largura, dimensoesAtuais.altura);
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
                         })}</g>;
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
                       const pct = pdfParaPercentual(p, dimensoesAtuais.largura, dimensoesAtuais.altura);
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
          </div>
       </div>
      
      {planta.total_paginas > 1 && (
        <div className="flex items-center justify-between border-t border-borda bg-white px-3 py-2">
           <Botao 
             type="button"
             variante="secundario" 
             tamanho="sm" 
              disabled={paginaAtual <= 1}
             onClick={() => setPagina(p => p - 1)}
           >
             Anterior
           </Botao>
           <span className="text-sm font-medium text-superficie-700">
              {paginaAtual} / {planta.total_paginas}
           </span>
           <Botao 
             type="button"
             variante="secundario" 
             tamanho="sm" 
              disabled={paginaAtual >= planta.total_paginas}
             onClick={() => setPagina(p => p + 1)}
           >
             Próxima
           </Botao>
        </div>
      )}
    </div>
  );
}
