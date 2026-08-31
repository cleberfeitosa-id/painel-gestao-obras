"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  LocateFixed,
  MapPin,
  Pencil,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Calendar,
  User,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { Botao, Etiqueta, Spinner } from "@/components/ui";
import {
  centroDaRegiao,
  limitesDaRegiao,
  pdfParaPercentual,
  pontoEmRegiao,
  telaParaPdf,
} from "@/lib/pdf/coordenadas";
import {
  PRIORIDADE_TAREFA,
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { formatarData, situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { MenuTarefasSobrepostas } from "@/components/plantas/menu-tarefas-sobrepostas";
import type { TarefaPlanta } from "@/components/plantas/tipos";
import type { PontoPdf } from "@/lib/supabase/database.types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface MiniVisualizadorPlantaProps {
  obraId: string;
  plantaId: string;
  plantaNome: string;
  urlPdf: string;
  pagina: number;
  tarefaAtualId: string;
  tarefas: TarefaPlanta[];
  podeEditar: boolean;
}

type DimensoesPagina = { largura: number; altura: number };

function DicaTarefa({
  tarefa,
  eAtual,
}: {
  tarefa: TarefaPlanta;
  eAtual: boolean;
}) {
  const prazoInfo = situacaoPrazo(tarefa.prazo, tarefa.status === "concluido");
  const situacao = situacaoDaTarefa({
    status: tarefa.status,
    aprovacao: tarefa.aprovacao,
  });
  const opcaoSituacao = SITUACAO_TAREFA[situacao];

  return (
    <div className="w-60 rounded-xl border border-borda bg-white p-3 shadow-xl text-left">
      <div className="flex items-center justify-between gap-1 mb-1">
        {eAtual ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-azul-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
            <MapPin className="h-3 w-3" />
            Tarefa atual
          </span>
        ) : (
          <span className="text-[10px] font-medium text-superficie-500">
            Tarefa adjacente
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-xs font-semibold text-superficie-900">
        {tarefa.titulo}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Etiqueta className={cn("text-[10px]", opcaoSituacao.classe)}>
          {opcaoSituacao.rotulo}
        </Etiqueta>
        <Etiqueta className={cn("text-[10px]", PRIORIDADE_TAREFA[tarefa.prioridade].classe)}>
          {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
        </Etiqueta>
      </div>
      <p className="mt-2 text-[11px] text-superficie-500">{prazoInfo.texto}</p>
    </div>
  );
}

export function MiniVisualizadorPlanta({
  obraId,
  plantaId,
  plantaNome,
  urlPdf,
  pagina,
  tarefaAtualId,
  tarefas,
  podeEditar,
}: MiniVisualizadorPlantaProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [escala, setEscala] = useState(1);
  const [renderEscala, setRenderEscala] = useState(1);
  const [dpr] = useState(() =>
    typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio) : 1,
  );
  const [dimensoes, setDimensoes] = useState<DimensoesPagina | null>(null);
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [dicaTarefa, setDicaTarefa] = useState<string | null>(null);
  const [tarefaDestaque, setTarefaDestaque] = useState<string | null>(null);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaPlanta | null>(null);
  const [menuSobreposicao, setMenuSobreposicao] = useState<{
    posicao: { x: number; y: number };
    tarefas: TarefaPlanta[];
  } | null>(null);

  const panRef = useRef<{ x: number; y: number; sl: number; st: number; moveu: boolean } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distancia: number; escala: number } | null>(null);
  const timerDicaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tarefaAtual = useMemo(
    () => tarefas.find((t) => t.id === tarefaAtualId),
    [tarefas, tarefaAtualId],
  );

  const pontoFocoTarefaAtual = useMemo<PontoPdf | null>(() => {
    if (!tarefaAtual) return null;
    if (tarefaAtual.localizacao_tipo === "ponto" && tarefaAtual.ponto_x != null && tarefaAtual.ponto_y != null) {
      return { x: tarefaAtual.ponto_x, y: tarefaAtual.ponto_y };
    }
    if (tarefaAtual.localizacao_tipo === "regiao" && tarefaAtual.regiao) {
      return centroDaRegiao(tarefaAtual.regiao);
    }
    return null;
  }, [tarefaAtual]);

  const centralizarNaTarefa = useCallback(
    (novaEscala?: number) => {
      const el = containerRef.current;
      if (!el || !dimensoes || !pontoFocoTarefaAtual) return;

      const escalaAlvo = novaEscala ?? escala;
      const pos = pdfParaPercentual(pontoFocoTarefaAtual, dimensoes.largura, dimensoes.altura);

      const larguraRenderizada = dimensoes.largura * escalaAlvo;
      const alturaRenderizada = dimensoes.altura * escalaAlvo;

      const pontoAlvoX = (pos.esquerda / 100) * larguraRenderizada;
      const pontoAlvoY = (pos.topo / 100) * alturaRenderizada;

      const sl = pontoAlvoX + 16 - el.clientWidth / 2;
      const st = pontoAlvoY + 16 - el.clientHeight / 2;

      el.scrollTo({
        left: Math.max(0, sl),
        top: Math.max(0, st),
        behavior: "smooth",
      });
    },
    [dimensoes, pontoFocoTarefaAtual, escala],
  );

  const aoCarregarPaginaSucesso = useCallback(
    (page: { getViewport: (options: { scale: number }) => { width: number; height: number } }) => {
      const viewport = page.getViewport({ scale: 1 });
      setDimensoes({ largura: viewport.width, altura: viewport.height });

      const el = containerRef.current;
      const larguraContainer = el ? el.clientWidth - 32 : 600;

      const escalaBase = larguraContainer / viewport.width;
      const escalaCalculada = Math.min(3.5, Math.max(1.2, Number((escalaBase * 2).toFixed(2))));

      setEscala(escalaCalculada);

      setTimeout(() => {
        const elContainer = containerRef.current;
        if (!elContainer || !pontoFocoTarefaAtual) return;
        const pos = pdfParaPercentual(pontoFocoTarefaAtual, viewport.width, viewport.height);
        const larguraRenderizada = viewport.width * escalaCalculada;
        const alturaRenderizada = viewport.height * escalaCalculada;

        const pontoAlvoX = (pos.esquerda / 100) * larguraRenderizada;
        const pontoAlvoY = (pos.topo / 100) * alturaRenderizada;

        elContainer.scrollLeft = Math.max(0, pontoAlvoX + 16 - elContainer.clientWidth / 2);
        elContainer.scrollTop = Math.max(0, pontoAlvoY + 16 - elContainer.clientHeight / 2);
      }, 60);
    },
    [pontoFocoTarefaAtual],
  );

  const aoEntrarPino = useCallback((id: string) => {
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    setDicaTarefa(null);
    timerDicaRef.current = setTimeout(() => setDicaTarefa(id), 300);
  }, []);

  const aoSairPino = useCallback(() => {
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    timerDicaRef.current = null;
    setDicaTarefa(null);
  }, []);

  function registrarPonteiro(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function aoPressionar(e: React.PointerEvent<HTMLDivElement>) {
    registrarPonteiro(e);
    const ponteiros = pointersRef.current;

    if (ponteiros.size >= 2) {
      const [p1, p2] = [...ponteiros.values()];
      pinchRef.current = {
        distancia: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        escala,
      };
      setArrastando(false);
      panRef.current = null;
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
      moveu: false,
    };
    setArrastando(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchRef.current) {
      const ponteiros = pointersRef.current;
      const p = ponteiros.get(e.pointerId);
      if (p) ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ponteiros.size === 2) {
        const [p1, p2] = [...ponteiros.values()];
        const distancia = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (pinchRef.current.distancia > 0) {
          const fator = distancia / pinchRef.current.distancia;
          setEscala(Math.min(5, Math.max(0.2, pinchRef.current.escala * fator)));
        }
      }
      return;
    }

    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        panRef.current.moveu = true;
      }
      const el = containerRef.current;
      if (!el) return;
      el.scrollLeft = panRef.current.sl - dx;
      el.scrollTop = panRef.current.st - dy;
    }
  }

  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const ponteiros = pointersRef.current;
    ponteiros.delete(e.pointerId);

    const eraPinch = pinchRef.current !== null;
    if (ponteiros.size < 2) pinchRef.current = null;

    if (eraPinch || ponteiros.size > 0) {
      panRef.current = null;
      setArrastando(false);
      return;
    }

    setArrastando(false);
  }

  function identificarTarefasNoPonto(
    clienteX: number,
    clienteY: number,
  ): TarefaPlanta[] {
    if (!dimensoes) return [];
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return [];

    const pontoPdf = telaParaPdf(
      clienteX,
      clienteY,
      rect,
      dimensoes.largura,
      dimensoes.altura,
    );

    return tarefas.filter((t) => {
      if (
        t.localizacao_tipo === "ponto" &&
        t.ponto_x != null &&
        t.ponto_y != null
      ) {
        const pos = pdfParaPercentual(
          { x: t.ponto_x, y: t.ponto_y },
          dimensoes.largura,
          dimensoes.altura,
        );
        const pinScreenX = rect.left + (pos.esquerda / 100) * rect.width;
        const pinScreenY = rect.top + (pos.topo / 100) * rect.height;
        const dist = Math.hypot(clienteX - pinScreenX, clienteY - pinScreenY);
        return dist <= 24;
      }
      if (t.localizacao_tipo === "regiao" && t.regiao) {
        return pontoEmRegiao(pontoPdf, t.regiao);
      }
      return false;
    });
  }

  function aoClicar(e: React.MouseEvent<HTMLElement>) {
    if (panRef.current?.moveu) {
      panRef.current = null;
      return;
    }
    panRef.current = null;

    const tarefasNoLocal = identificarTarefasNoPonto(e.clientX, e.clientY);
    if (tarefasNoLocal.length === 1) {
      setMenuSobreposicao(null);
      const tarefa = tarefasNoLocal[0];
      if (tarefa.id === tarefaAtualId) {
        setTarefaSelecionada(tarefa);
      } else {
        setTarefaSelecionada(tarefa);
      }
    } else if (tarefasNoLocal.length > 1) {
      setTarefaSelecionada(null);
      setMenuSobreposicao({
        posicao: { x: e.clientX, y: e.clientY },
        tarefas: tarefasNoLocal,
      });
    } else {
      setMenuSobreposicao(null);
      setTarefaSelecionada(null);
    }
  }

  function aoRolar(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fator = Math.pow(0.9985, e.deltaY);
    setEscala((atual) => Math.min(5, Math.max(0.2, Number((atual * fator).toFixed(4)))));
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  });

  useEffect(() => {
    const timer = setTimeout(() => setRenderEscala(escala), 150);
    return () => clearTimeout(timer);
  }, [escala]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-borda bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda bg-superficie-50/90 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-superficie-800">
            {plantaNome}
          </span>
          <span className="text-superficie-400">·</span>
          <span className="text-superficie-600">Página {pagina}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => centralizarNaTarefa()}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-borda bg-white px-2 text-[11px] font-medium text-azul-700 hover:bg-azul-50 hover:border-azul-300 transition-colors shadow-2xs"
            title="Centralizar na tarefa atual"
          >
            <LocateFixed className="h-3.5 w-3.5 text-azul-600" />
            Centralizar
          </button>

          <div className="mx-1 h-4 w-px bg-borda" />

          <button
            type="button"
            onClick={() => setEscala((e) => Math.max(0.2, Number((e / 1.25).toFixed(3))))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-superficie-600 hover:bg-superficie-200"
            title="Diminuir zoom"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums font-medium text-superficie-700">
            {Math.round(escala * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setEscala((e) => Math.min(5, Number((e * 1.25).toFixed(3))))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-superficie-600 hover:bg-superficie-200"
            title="Aumentar zoom"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEscala(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-superficie-600 hover:bg-superficie-200"
            title="Resetar zoom (100%)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-4 w-px bg-borda" />

          <Link
            href={`/obras/${obraId}/plantas/${plantaId}`}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-superficie-600 hover:bg-superficie-200 hover:text-superficie-900 transition-colors"
            title="Ver na tela completa de plantas"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir completa</span>
          </Link>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-80 sm:h-96 w-full overflow-auto bg-superficie-100/70"
        style={{ touchAction: "none", cursor: arrastando ? "grabbing" : "grab" }}
      >
        <div className="flex min-h-full min-w-full p-4">
          <div
            ref={contentRef}
            className={cn("relative m-auto shadow-md", !dimensoes && "w-fit")}
            style={{
              width: dimensoes ? dimensoes.largura * escala : undefined,
              height: dimensoes ? dimensoes.altura * escala : undefined,
            }}
          >
            <div
              className="relative"
              style={{
                transform:
                  renderEscala !== escala
                    ? `scale(${escala / renderEscala})`
                    : undefined,
                transformOrigin: "top left",
                willChange: "transform",
              }}
            >
            <Document
              file={urlPdf}
              onLoadError={() =>
                setErroDocumento("Não foi possível carregar a planta.")
              }
              loading={
                <div className="flex h-72 w-96 max-w-full items-center justify-center gap-2 text-xs text-superficie-500">
                  <Spinner tamanho="md" />
                  Carregando PDF da planta...
                </div>
              }
              error={
                <div className="flex h-72 w-96 max-w-full items-center justify-center text-xs text-perigo">
                  {erroDocumento ?? "Erro ao carregar a planta."}
                </div>
              }
            >
              <Page
                pageNumber={pagina}
                scale={renderEscala}
                devicePixelRatio={dpr}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={aoCarregarPaginaSucesso}
                loading={
                  <div className="flex h-72 w-96 max-w-full items-center justify-center">
                    <Spinner tamanho="md" />
                  </div>
                }
              />
            </Document>

            {dimensoes && (
              <div
                ref={overlayRef}
                className="absolute inset-0 z-10"
                style={{ touchAction: "none" }}
                onPointerDown={aoPressionar}
                onPointerMove={aoMover}
                onPointerUp={aoSoltar}
                onPointerCancel={aoSoltar}
                onClick={aoClicar}
              >
                {tarefas
                  .filter(
                    (t) =>
                      t.localizacao_tipo === "ponto" &&
                      t.ponto_x != null &&
                      t.ponto_y != null,
                  )
                  .map((tarefa) => {
                    const pos = pdfParaPercentual(
                      { x: tarefa.ponto_x!, y: tarefa.ponto_y! },
                      dimensoes.largura,
                      dimensoes.altura,
                    );
                    const eAtual = tarefa.id === tarefaAtualId;
                    const sit = situacaoDaTarefa({
                      status: tarefa.status,
                      aprovacao: tarefa.aprovacao,
                    });

                    return (
                      <div
                        key={tarefa.id}
                        className={cn(
                          "absolute -translate-x-1/2 -translate-y-1/2 transition-transform",
                          eAtual ? "z-30 scale-110" : "z-20",
                          tarefaDestaque === tarefa.id &&
                            "rounded-full ring-4 ring-azul-400/80 scale-125 z-40",
                        )}
                        style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {eAtual && (
                          <span className="absolute -inset-2 rounded-full bg-azul-500/30 animate-ping pointer-events-none" />
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            aoClicar(e);
                          }}
                          onMouseEnter={() => aoEntrarPino(tarefa.id)}
                          onMouseLeave={aoSairPino}
                          className={cn(
                            "group relative flex items-center justify-center rounded-full p-2 focus:outline-none",
                          )}
                          aria-label={`Tarefa: ${tarefa.titulo}`}
                        >
                          <span
                            className={cn(
                              "block rounded-full shadow-md ring-2",
                              eAtual
                                ? "h-5 w-5 ring-white bg-azul-600 ring-offset-2 ring-offset-azul-600 shadow-lg"
                                : cn("h-4 w-4 opacity-80 ring-white hover:opacity-100", SITUACAO_TAREFA[sit].pino),
                            )}
                          />

                          {eAtual && (
                            <span className="absolute -bottom-5 whitespace-nowrap rounded-md bg-azul-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                              Atual
                            </span>
                          )}
                        </button>

                        {dicaTarefa === tarefa.id && (
                          <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full pb-2">
                            <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {tarefas
                  .filter((t) => t.localizacao_tipo === "regiao" && t.regiao)
                  .map((tarefa) => {
                    const limites = limitesDaRegiao(tarefa.regiao!);
                    if (!limites) return null;
                    const canto1 = pdfParaPercentual(
                      { x: limites.x, y: limites.y },
                      dimensoes.largura,
                      dimensoes.altura,
                    );
                    const canto2 = pdfParaPercentual(
                      {
                        x: limites.x + limites.largura,
                        y: limites.y + limites.altura,
                      },
                      dimensoes.largura,
                      dimensoes.altura,
                    );
                    const eAtual = tarefa.id === tarefaAtualId;
                    const sit = situacaoDaTarefa({
                      status: tarefa.status,
                      aprovacao: tarefa.aprovacao,
                    });

                    return (
                      <div
                        key={tarefa.id}
                        className={cn(
                          "absolute cursor-pointer rounded-sm border-2 transition-colors",
                          eAtual
                            ? "z-30 border-azul-600 bg-azul-500/30 ring-2 ring-azul-400 shadow-md"
                            : cn("z-20 opacity-70 hover:opacity-100", SITUACAO_TAREFA[sit].regiao),
                          tarefaDestaque === tarefa.id &&
                            "!border-dashed !border-azul-600 bg-azul-500/40 ring-4 ring-azul-300",
                        )}
                        style={{
                          left: `${Math.min(canto1.esquerda, canto2.esquerda)}%`,
                          top: `${Math.min(canto1.topo, canto2.topo)}%`,
                          width: `${Math.abs(canto2.esquerda - canto1.esquerda)}%`,
                          height: `${Math.abs(canto2.topo - canto1.topo)}%`,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          aoClicar(e);
                        }}
                        onMouseEnter={() => aoEntrarPino(tarefa.id)}
                        onMouseLeave={aoSairPino}
                      >
                        {eAtual && (
                          <span className="absolute -top-3 left-1 rounded bg-azul-600 px-1 py-0.5 text-[8px] font-bold text-white shadow-xs">
                            Tarefa atual
                          </span>
                        )}

                        {dicaTarefa === tarefa.id && (
                          <div className="pointer-events-none absolute z-40 -translate-y-full pb-2">
                            <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {tarefaSelecionada && (
        <div className="border-t border-borda bg-superficie-50/90 p-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                {tarefaSelecionada.id === tarefaAtualId ? (
                  <span className="inline-flex items-center gap-1 rounded bg-azul-100 px-1.5 py-0.5 text-[10px] font-bold text-azul-800">
                    <MapPin className="h-3 w-3" />
                    Tarefa atual
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-superficie-200 px-1.5 py-0.5 text-[10px] font-medium text-superficie-700">
                    Tarefa adjacente
                  </span>
                )}
                <h4 className="truncate text-xs font-bold text-superficie-900">
                  {tarefaSelecionada.titulo}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-superficie-500">
                <Etiqueta
                  className={cn(
                    "text-[10px]",
                    SITUACAO_TAREFA[
                      situacaoDaTarefa({
                        status: tarefaSelecionada.status,
                        aprovacao: tarefaSelecionada.aprovacao,
                      })
                    ].classe,
                  )}
                >
                  {
                    SITUACAO_TAREFA[
                      situacaoDaTarefa({
                        status: tarefaSelecionada.status,
                        aprovacao: tarefaSelecionada.aprovacao,
                      })
                    ].rotulo
                  }
                </Etiqueta>
                <Etiqueta
                  className={cn(
                    "text-[10px]",
                    PRIORIDADE_TAREFA[tarefaSelecionada.prioridade].classe,
                  )}
                >
                  {PRIORIDADE_TAREFA[tarefaSelecionada.prioridade].rotulo}
                </Etiqueta>

                {tarefaSelecionada.responsavel?.nome && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3 text-superficie-400" />
                    {tarefaSelecionada.responsavel.nome}
                  </span>
                )}
                {tarefaSelecionada.prazo && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-superficie-400" />
                    {formatarData(tarefaSelecionada.prazo)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tarefaSelecionada.id !== tarefaAtualId ? (
                <>
                  <Link href={`/tarefas/${tarefaSelecionada.id}`}>
                    <Botao tamanho="sm" variante="primario">
                      Ver detalhes
                    </Botao>
                  </Link>
                  {podeEditar && (
                    <Link href={`/tarefas/${tarefaSelecionada.id}/editar`}>
                      <Botao tamanho="sm" variante="contorno">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Botao>
                    </Link>
                  )}
                </>
              ) : (
                <span className="text-xs text-superficie-500">
                  Esta é a tarefa aberta no momento.
                </span>
              )}
              <button
                type="button"
                onClick={() => setTarefaSelecionada(null)}
                className="rounded-lg p-1 text-superficie-400 hover:bg-superficie-200 hover:text-superficie-700"
                aria-label="Fechar resumo da tarefa"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {menuSobreposicao && (
        <MenuTarefasSobrepostas
          posicao={menuSobreposicao.posicao}
          tarefas={menuSobreposicao.tarefas}
          aoSelecionar={(t) => {
            setMenuSobreposicao(null);
            setTarefaSelecionada(t);
            if (t.id !== tarefaAtualId) {
              router.push(`/tarefas/${t.id}`);
            }
          }}
          aoFechar={() => setMenuSobreposicao(null)}
          aoDestaque={setTarefaDestaque}
        />
      )}
    </div>
  );
}
