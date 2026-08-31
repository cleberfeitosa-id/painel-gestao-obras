"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Link2,
  MapPin,
  Maximize,
  MousePointer2,
  RotateCcw,
  Ruler,
  Scale,
  Square,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { Botao, Etiqueta, Selecao, Spinner } from "@/components/ui";
import {
  CANTOS,
  cantoParaPonto,
  calcularCalibracao,
  centroDaRegiao,
  distanciaEmPontos,
  formatarMedida,
  limitesDaRegiao,
  medirArea,
  medirDistancia,
  medirPerimetro,
  moverRegiao,
  pdfParaPercentual,
  pontoEmRegiao,
  regiaoComCanto,
  retanguloParaRegiao,
  telaParaPdf,
  type Calibracao,
  type Canto,
} from "@/lib/pdf/coordenadas";
import {
  OPCOES_SITUACAO_TAREFA,
  PRIORIDADE_TAREFA,
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { Calibragem } from "./calibragem";
import { ListaTarefasPlanta } from "./lista-tarefas-planta";
import { MenuTarefasSobrepostas } from "./menu-tarefas-sobrepostas";
import {
  renovarUrlPlanta,
  salvarCalibracao as salvarCalibracaoAcao,
} from "@/app/(protegido)/obras/[id]/plantas/acoes";
import {
  associarLocalizacao,
  salvarRascunhoLote,
} from "@/app/(protegido)/tarefas/acoes";
import type {
  PlantaCalibracaoRow,
  PontoPdf,
  PrioridadeTarefa,
  RegiaoPdf,
} from "@/lib/supabase/database.types";
import type {
  PropsAreaPlanta,
  TarefaPlanta,
} from "./tipos";
import type { SituacaoTarefa } from "@/lib/domain/rotulos";

type Ferramenta = "navegar" | "medir" | "pino" | "regiao" | "calibrar" | "associar";

type DimensoesPagina = { largura: number; altura: number };

type ConfirmacaoLocalizacao =
  | { tipo: "ponto"; ponto: PontoPdf }
  | { tipo: "regiao"; regiao: RegiaoPdf };

type LoteMarcador =
  | { localizacao_tipo: "ponto"; ponto: PontoPdf }
  | { localizacao_tipo: "regiao"; regiao: RegiaoPdf };

// Config do worker do PDF.js no MESMO modulo em que o <Document> e usado
// (recomendacao oficial do react-pdf). O `new URL(..., import.meta.url)` faz o
// bundler emitir o worker como asset estatico; sem isso o viewer falha com
// "No GlobalWorkerOptions.workerSrc specified".
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const FERRAMENTAS: Array<{
  valor: Ferramenta;
  rotulo: string;
  icone: LucideIcon;
}> = [
  { valor: "navegar", rotulo: "Navegar", icone: MousePointer2 },
  { valor: "medir", rotulo: "Medir", icone: Ruler },
  { valor: "pino", rotulo: "Pino", icone: MapPin },
  { valor: "regiao", rotulo: "Regiao", icone: Square },
  { valor: "calibrar", rotulo: "Calibrar", icone: Scale },
  { valor: "associar", rotulo: "Associar", icone: Link2 },
];

const DICA_FERRAMENTA: Record<Ferramenta, string> = {
  navegar:
    "Arraste para mover a planta, use a roda do mouse ou o gesto de pinça para dar zoom. Clique em um pino ou regiao para abrir a tarefa.",
  medir:
    "Clique em dois pontos para medir a distancia; um terceiro clique desenha um retangulo e mede a area.",
  pino: "Clique na planta para criar uma tarefa neste ponto; clique novamente para ajustar a posicao antes de confirmar.",
  regiao: "Arraste sobre a planta para criar uma tarefa em uma regiao; ajuste as bordas antes de confirmar.",
  calibrar: "Clique em dois pontos de distancia conhecida para calibrar a escala.",
  associar:
    "Selecione uma tarefa e clique (pino) ou arraste (regiao) na planta para associa-la a uma localizacao.",
};

const cursorPorFerramenta: Record<Ferramenta, string> = {
  navegar: "grab",
  medir: "crosshair",
  pino: "crosshair",
  regiao: "crosshair",
  calibrar: "crosshair",
  associar: "crosshair",
};

function DicaTarefa({ tarefa }: { tarefa: TarefaPlanta }) {
  const prazoInfo = situacaoPrazo(tarefa.prazo, tarefa.status === "concluido");
  const situacao = situacaoDaTarefa({
    status: tarefa.status,
    aprovacao: tarefa.aprovacao,
  });
  const opcaoSituacao = SITUACAO_TAREFA[situacao];
  return (
    <div className="w-56 rounded-lg border border-borda bg-white p-3 shadow-lg">
      <p className="line-clamp-2 text-sm font-medium text-superficie-900">
        {tarefa.titulo}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Etiqueta className={opcaoSituacao.classe}>
          {opcaoSituacao.rotulo}
        </Etiqueta>
        <Etiqueta className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}>
          {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
        </Etiqueta>
      </div>
      <p className="mt-2 text-xs text-superficie-500">{prazoInfo.texto}</p>
    </div>
  );
}

function Marcador({
  ponto,
  dimensoes,
  cor,
}: {
  ponto: PontoPdf;
  dimensoes: DimensoesPagina;
  cor: string;
}) {
  const pos = pdfParaPercentual(ponto, dimensoes.largura, dimensoes.altura);
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
    >
      <span
        className={cn(
          "block h-3 w-3 rounded-full border-2 border-white shadow",
          cor,
        )}
      />
    </div>
  );
}

function RotuloMedicao({
  ponto,
  texto,
  dimensoes,
}: {
  ponto: PontoPdf;
  texto: string;
  dimensoes: DimensoesPagina;
}) {
  const pos = pdfParaPercentual(ponto, dimensoes.largura, dimensoes.altura);
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-superficie-900/90 px-2 py-1 text-xs font-medium text-white"
      style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
    >
      {texto}
    </div>
  );
}

function textoPonto(ponto: PontoPdf, calibracao: Calibracao | null): string {
  const unidade = calibracao?.unidade ?? "pt";
  const fator = calibracao?.unidadesPorPonto ?? 1;
  return `X ${(ponto.x * fator).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade} · Y ${(ponto.y * fator).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;
}

function textoDimensoes(regiao: RegiaoPdf, calibracao: Calibracao | null): string {
  const limites = limitesDaRegiao(regiao);
  if (!limites) return "";
  const unidade = calibracao?.unidade ?? "pt";
  const escala = { unidadesPorPonto: calibracao?.unidadesPorPonto ?? 1, unidade };
  const largura = medirDistancia(
    { x: limites.x, y: limites.y },
    { x: limites.x + limites.largura, y: limites.y },
    escala,
  );
  const altura = medirDistancia(
    { x: limites.x, y: limites.y },
    { x: limites.x, y: limites.y + limites.altura },
    escala,
  );
  return `${formatarMedida(largura, unidade)} × ${formatarMedida(altura, unidade)}`;
}

function CarregandoPlanta() {
  return (
    <div className="flex min-h-[400px] w-[480px] max-w-full flex-col items-center justify-center gap-3 p-8">
      <Spinner tamanho="lg" />
      <p className="text-sm text-superficie-500">Carregando planta...</p>
    </div>
  );
}

function ErroPlanta({
  erro,
  aoTentar,
  renovando,
}: {
  erro: string;
  aoTentar: () => void;
  renovando: boolean;
}) {
  return (
    <div className="flex min-h-[300px] w-[480px] max-w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-perigo" />
      <p className="text-sm text-superficie-700">{erro}</p>
      <Botao variante="contorno" tamanho="sm" onClick={aoTentar} carregando={renovando}>
        Tentar novamente
      </Botao>
    </div>
  );
}

export function VisualizadorPlanta({
  obraId,
  planta,
  urlPdf,
  calibracoes,
  tarefas,
  tarefasObra,
  executores,
  tags,
  podeEditar,
}: PropsAreaPlanta) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const associarParam = searchParams.get("associar") ?? searchParams.get("editarTarefa");

  const [urlAtual, setUrlAtual] = useState<string | null>(urlPdf);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [numPaginas, setNumPaginas] = useState(planta.total_paginas);
  const [escala, setEscala] = useState(1);
  const [ajusteLargura, setAjusteLargura] = useState(true);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(() =>
    associarParam && podeEditar ? "associar" : "navegar",
  );
  const [dimensoes, setDimensoes] = useState<DimensoesPagina | null>(null);
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [renovando, setRenovando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const [pontosMedicao, setPontosMedicao] = useState<PontoPdf[]>([]);
  const [pontosCalibracao, setPontosCalibracao] = useState<PontoPdf[]>([]);
  const [regiaoAtual, setRegiaoAtual] = useState<RegiaoPdf | null>(null);
  const [posicaoMouse, setPosicaoMouse] = useState<PontoPdf | null>(null);
  const [dicaTarefa, setDicaTarefa] = useState<string | null>(null);
  const [tarefaDestaque, setTarefaDestaque] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoLocalizacao | null>(null);
  const [associacaoTipo, setAssociacaoTipo] = useState<"pino" | "regiao">("pino");
  const [tarefaAssociacao, setTarefaAssociacao] = useState(() =>
    associarParam && podeEditar ? associarParam : "",
  );
  const [associando, setAssociando] = useState(false);
  const [erroAssociacao, setErroAssociacao] = useState<string | null>(null);
  const [criandoLote, setCriandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [modoLote, setModoLote] = useState(false);
  const [loteMarcadores, setLoteMarcadores] = useState<LoteMarcador[]>([]);
  const [menuSobreposicao, setMenuSobreposicao] = useState<{
    posicao: { x: number; y: number };
    tarefas: TarefaPlanta[];
  } | null>(null);

  const [filtroSituacao, setFiltroSituacao] = useState<"todas" | SituacaoTarefa>("todas");
  const [filtroPrioridade, setFiltroPrioridade] = useState<"todas" | PrioridadeTarefa>("todas");
  const [filtroExecutor, setFiltroExecutor] = useState<"todos" | "sem" | string>("todos");
  const [filtroTag, setFiltroTag] = useState<"todas" | "sem" | string>("todas");

  const [calibracoesPorPagina, setCalibracoesPorPagina] = useState<
    Map<number, PlantaCalibracaoRow>
  >(() => new Map(calibracoes.map((c) => [c.pagina, c])));

  const timerDicaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aoEntrarPino = useCallback((id: string) => {
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    setDicaTarefa(null);
    timerDicaRef.current = setTimeout(() => setDicaTarefa(id), 450);
  }, []);

  const aoSairPino = useCallback(() => {
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    timerDicaRef.current = null;
    setDicaTarefa(null);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const regiaoRef = useRef<PontoPdf | null>(null);
  const pinoDragRef = useRef<{ ancora: PontoPdf } | null>(null);
  const cantoDragRef = useRef<{ canto: Canto } | null>(null);
  const regiaoCorpoDragRef = useRef<{ ancora: PontoPdf; regiaoInicial: RegiaoPdf } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distancia: number; escala: number } | null>(null);
  const animacaoZoomRef = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);

  // Cap devicePixelRatio em 2 para evitar canvas gigante no Safari iOS
  // (DPR 3 no iPhone 13 Pro Max + zoom alto estoura o limite de canvas do Safari).
  const [dpr] = useState(() =>
    typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio) : 1,
  );

  // renderEscala e a escala efetivamente passada ao <Page>. Ela e debounced
  // (150ms) em relacao a `escala` para evitar re-renders do pdf.js durante
  // zoom rapido (roda/pinca). A diferenca visual e coberta por CSS transform.
  const [renderEscala, setRenderEscala] = useState(1);

  const calibracaoLinha = calibracoesPorPagina.get(paginaAtual) ?? null;
  const calibracao: Calibracao | null = calibracaoLinha
    ? {
        unidadesPorPonto: calibracaoLinha.unidades_por_ponto,
        unidade: calibracaoLinha.unidade,
      }
    : null;

  const emAssociacao = ferramenta === "associar";
  const modoInterativo = ferramenta === "navegar";
  const modoDesenho: "pino" | "regiao" | null =
    ferramenta === "pino"
      ? "pino"
      : ferramenta === "regiao"
        ? "regiao"
        : ferramenta === "associar"
          ? associacaoTipo
          : null;

  const tarefasPagina = useMemo(
    () => tarefas.filter((t) => t.pagina === paginaAtual),
    [tarefas, paginaAtual],
  );

  const tarefasFiltradas = useMemo(() => {
    return tarefasPagina.filter((t) => {
      if (filtroSituacao !== "todas") {
        const sit = situacaoDaTarefa({ status: t.status, aprovacao: t.aprovacao });
        if (sit !== filtroSituacao) return false;
      }
      if (filtroPrioridade !== "todas" && t.prioridade !== filtroPrioridade) return false;
      if (filtroExecutor === "sem" && t.executor != null) return false;
      if (filtroExecutor !== "todos" && filtroExecutor !== "sem" && t.executor?.id !== filtroExecutor) return false;
      if (filtroTag === "sem" && t.tags_tarefa != null) return false;
      if (filtroTag !== "todas" && filtroTag !== "sem" && t.tags_tarefa?.id !== filtroTag) return false;
      return true;
    });
  }, [tarefasPagina, filtroSituacao, filtroPrioridade, filtroExecutor, filtroTag]);

  const aplicarAjusteLargura = useCallback(() => {
    if (!ajusteLargura || !dimensoes) return;
    const el = containerRef.current;
    if (!el) return;
    const larguraUtil = el.clientWidth - 32;
    setEscala(Math.max(0.1, larguraUtil / dimensoes.largura));
  }, [ajusteLargura, dimensoes]);

  useEffect(() => {
    aplicarAjusteLargura();
    const el = containerRef.current;
    if (!el) return;
    const observador = new ResizeObserver(aplicarAjusteLargura);
    observador.observe(el);
    return () => observador.disconnect();
  }, [aplicarAjusteLargura]);

  useEffect(() => {
    setPontosMedicao([]);
    setPontosCalibracao([]);
    setRegiaoAtual(null);
    setPosicaoMouse(null);
    setConfirmacao(null);
    setLoteMarcadores([]);
    setMenuSobreposicao(null);
    pinoDragRef.current = null;
    cantoDragRef.current = null;
    regiaoRef.current = null;
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [paginaAtual]);

  function pontoDoEvento(e: { clientX: number; clientY: number }): PontoPdf | null {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || !dimensoes) return null;
    return telaParaPdf(e.clientX, e.clientY, rect, dimensoes.largura, dimensoes.altura);
  }

  function distanciaEntrePontos(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function registrarPonteiro(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function aoPressionar(e: React.PointerEvent<HTMLDivElement>) {
    registrarPonteiro(e);
    const ponteiros = pointersRef.current;

    // Gesto de pinça: segundo dedo inicia o zoom por pinch.
    if (ponteiros.size >= 2) {
      const [p1, p2] = [...ponteiros.values()];
      pinchRef.current = {
        distancia: distanciaEntrePontos(p1, p2),
        escala,
      };
      setArrastando(false);
      panRef.current = null;
      return;
    }

    if (ferramenta === "navegar") {
      const el = containerRef.current;
      if (!el) return;
      panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
      setArrastando(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (modoDesenho === "regiao") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      regiaoRef.current = ponto;
      setRegiaoAtual(retanguloParaRegiao(ponto, ponto));
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (modoDesenho === "pino" && confirmacao?.tipo === "ponto") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      pinoDragRef.current = { ancora: ponto };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchRef.current) {
      const ponteiros = pointersRef.current;
      const p = ponteiros.get(e.pointerId);
      if (p) ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ponteiros.size === 2) {
        const [p1, p2] = [...ponteiros.values()];
        const distancia = distanciaEntrePontos(p1, p2);
        if (pinchRef.current.distancia > 0) {
          const fator = distancia / pinchRef.current.distancia;
          setAjusteLargura(false);
          setEscala(
            Math.min(5, Math.max(0.1, pinchRef.current.escala * fator)),
          );
        }
      }
      return;
    }

    if (ferramenta === "navegar" && panRef.current) {
      const el = containerRef.current;
      if (!el) return;
      el.scrollLeft = panRef.current.sl - (e.clientX - panRef.current.x);
      el.scrollTop = panRef.current.st - (e.clientY - panRef.current.y);
    } else if (modoDesenho === "regiao" && regiaoRef.current) {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      setPosicaoMouse(ponto);
      setRegiaoAtual(retanguloParaRegiao(regiaoRef.current, ponto));
    } else if (modoDesenho === "pino" && pinoDragRef.current) {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      setConfirmacao({ tipo: "ponto", ponto });
    } else if (cantoDragRef.current && confirmacao?.tipo === "regiao") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      const nova = regiaoComCanto(
        confirmacao.regiao,
        cantoDragRef.current.canto,
        ponto,
      );
      setConfirmacao({ tipo: "regiao", regiao: nova });
      setRegiaoAtual(nova);
    } else if (regiaoCorpoDragRef.current && confirmacao?.tipo === "regiao") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      const dx = ponto.x - regiaoCorpoDragRef.current.ancora.x;
      const dy = ponto.y - regiaoCorpoDragRef.current.ancora.y;
      const nova = moverRegiao(regiaoCorpoDragRef.current.regiaoInicial, dx, dy);
      setConfirmacao({ tipo: "regiao", regiao: nova });
      setRegiaoAtual(nova);
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
      setPosicaoMouse(null);
      pinoDragRef.current = null;
      cantoDragRef.current = null;
      regiaoCorpoDragRef.current = null;
      return;
    }

    if (ferramenta === "navegar") {
      panRef.current = null;
      setArrastando(false);
    } else if (modoDesenho === "regiao") {
      setPosicaoMouse(null);
      if (regiaoRef.current && regiaoAtual) {
        const limites = limitesDaRegiao(regiaoAtual);
        if (limites && limites.largura > 2 && limites.altura > 2) {
          if (modoLote) {
            setLoteMarcadores((atual) => [
              ...atual,
              { localizacao_tipo: "regiao", regiao: regiaoAtual },
            ]);
            setRegiaoAtual(null);
          } else {
            setConfirmacao({ tipo: "regiao", regiao: regiaoAtual });
          }
        } else {
          setRegiaoAtual(null);
        }
      }
      regiaoRef.current = null;
    } else if (modoDesenho === "pino" && pinoDragRef.current) {
      const ponto = pontoDoEvento(e);
      if (ponto) setConfirmacao({ tipo: "ponto", ponto });
      pinoDragRef.current = null;
    }
    cantoDragRef.current = null;
    regiaoCorpoDragRef.current = null;
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

    return tarefasFiltradas.filter((t) => {
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
    if (pointersRef.current.size > 0) return;
    if (ferramenta === "medir") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      setPontosMedicao((atual) => (atual.length >= 3 ? [ponto] : [...atual, ponto]));
    } else if (modoDesenho === "pino") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      if (modoLote) {
        setLoteMarcadores((atual) => [
          ...atual,
          { localizacao_tipo: "ponto", ponto },
        ]);
      } else {
        setConfirmacao({ tipo: "ponto", ponto });
      }
    } else if (ferramenta === "calibrar") {
      const ponto = pontoDoEvento(e);
      if (!ponto) return;
      setPontosCalibracao((atual) => (atual.length >= 2 ? [ponto] : [...atual, ponto]));
    } else if (ferramenta === "navegar") {
      const tarefasNoLocal = identificarTarefasNoPonto(e.clientX, e.clientY);
      if (tarefasNoLocal.length === 1) {
        setMenuSobreposicao(null);
        router.push(`/tarefas/${tarefasNoLocal[0].id}`);
      } else if (tarefasNoLocal.length > 1) {
        setMenuSobreposicao({
          posicao: { x: e.clientX, y: e.clientY },
          tarefas: tarefasNoLocal,
        });
      } else {
        setMenuSobreposicao(null);
      }
    }
  }

  async function confirmarAssociacao() {
    if (!confirmacao || !tarefaAssociacao) return;
    setAssociando(true);
    setErroAssociacao(null);
    const resultado = await associarLocalizacao(tarefaAssociacao, {
      localizacao_tipo: confirmacao.tipo,
      planta_id: planta.id,
      pagina: paginaAtual,
      ponto_x: confirmacao.tipo === "ponto" ? confirmacao.ponto.x : undefined,
      ponto_y: confirmacao.tipo === "ponto" ? confirmacao.ponto.y : undefined,
      regiao: confirmacao.tipo === "regiao" ? confirmacao.regiao : undefined,
    });
    setAssociando(false);
    if (resultado.erro) {
      setErroAssociacao(resultado.erro);
      return;
    }
    setConfirmacao(null);
    setRegiaoAtual(null);
    setTarefaAssociacao("");
    router.refresh();
  }

  function limparRascunho() {
    setConfirmacao(null);
    setRegiaoAtual(null);
    setPosicaoMouse(null);
    setMenuSobreposicao(null);
    pinoDragRef.current = null;
    cantoDragRef.current = null;
    regiaoCorpoDragRef.current = null;
    regiaoRef.current = null;
  }

  const aoSelecionarTarefaParaAssociar = useCallback(
    (id: string) => {
      setTarefaAssociacao(id);
      setErroAssociacao(null);
      if (!id) {
        limparRascunho();
        return;
      }
      const tarefa =
        tarefasObra.find((t) => t.id === id) ??
        tarefas.find((t) => t.id === id);
      if (!tarefa) return;

      if (
        tarefa.localizacao_tipo === "ponto" &&
        tarefa.ponto_x != null &&
        tarefa.ponto_y != null
      ) {
        setAssociacaoTipo("pino");
        if (
          tarefa.pagina &&
          tarefa.pagina !== paginaAtual &&
          (!tarefa.planta_id || tarefa.planta_id === planta.id)
        ) {
          setPaginaAtual(tarefa.pagina);
        }
        setConfirmacao({
          tipo: "ponto",
          ponto: { x: tarefa.ponto_x, y: tarefa.ponto_y },
        });
      } else if (tarefa.localizacao_tipo === "regiao" && tarefa.regiao != null) {
        setAssociacaoTipo("regiao");
        if (
          tarefa.pagina &&
          tarefa.pagina !== paginaAtual &&
          (!tarefa.planta_id || tarefa.planta_id === planta.id)
        ) {
          setPaginaAtual(tarefa.pagina);
        }
        setConfirmacao({ tipo: "regiao", regiao: tarefa.regiao });
        setRegiaoAtual(tarefa.regiao);
      } else {
        limparRascunho();
      }
    },
    [tarefasObra, tarefas, paginaAtual, planta.id],
  );

  useEffect(() => {
    if (associarParam && podeEditar) {
      aoSelecionarTarefaParaAssociar(associarParam);
    }
  }, [associarParam, podeEditar, aoSelecionarTarefaParaAssociar]);

  function confirmarCriacao() {
    if (!confirmacao) return;
    if (emAssociacao) {
      void confirmarAssociacao();
      return;
    }
    if (confirmacao.tipo === "ponto") {
      const { ponto } = confirmacao;
      router.push(
        `/tarefas/nova?obra=${obraId}&planta=${planta.id}&pagina=${paginaAtual}&tipo=ponto&x=${ponto.x.toFixed(2)}&y=${ponto.y.toFixed(2)}`,
      );
    } else {
      const regiaoJson = encodeURIComponent(JSON.stringify(confirmacao.regiao));
      router.push(
        `/tarefas/nova?obra=${obraId}&planta=${planta.id}&pagina=${paginaAtual}&tipo=regiao&regiao=${regiaoJson}`,
      );
    }
    setConfirmacao(null);
  }

  async function criarEmLote() {
    if (loteMarcadores.length === 0) return;
    setCriandoLote(true);
    setErroLote(null);
    const localizacoes = loteMarcadores.map((marcador) =>
      marcador.localizacao_tipo === "ponto"
        ? {
            localizacao_tipo: "ponto",
            planta_id: planta.id,
            pagina: paginaAtual,
            ponto_x: marcador.ponto.x,
            ponto_y: marcador.ponto.y,
          }
        : {
            localizacao_tipo: "regiao",
            planta_id: planta.id,
            pagina: paginaAtual,
            regiao: marcador.regiao,
          },
    );
    const resultado = await salvarRascunhoLote({
      obra_id: obraId,
      planta_id: planta.id,
      pagina: paginaAtual,
      localizacoes,
    });
    setCriandoLote(false);
    if ("erro" in resultado) {
      setErroLote(resultado.erro);
      return;
    }
    router.push(`/tarefas/nova-em-lote?lote=${resultado.id}`);
  }

  function limparLote() {
    setLoteMarcadores([]);
    setRegiaoAtual(null);
  }

  function aumentarZoom() {
    setAjusteLargura(false);
    setEscala((e) => Math.min(5, Number((e * 1.25).toFixed(3))));
  }

  function diminuirZoom() {
    setAjusteLargura(false);
    setEscala((e) => Math.max(0.1, Number((e / 1.25).toFixed(3))));
  }

  function resetarZoom() {
    setAjusteLargura(false);
    setEscala(1);
  }

  function aoRolar(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    animacaoZoomRef.current = {
      fx: (e.clientX - rect.left) / rect.width,
      fy: (e.clientY - rect.top) / rect.height,
      cx: e.clientX,
      cy: e.clientY,
    };
    const fator = Math.pow(0.9985, e.deltaY);
    setAjusteLargura(false);
    setEscala((atual) => Math.min(5, Math.max(0.1, Number((atual * fator).toFixed(4)))));
  }

  // Listener nativo com passive:false para garantir preventDefault().
  // React 17+ registra onWheel como passive por padrao, ignorando preventDefault.
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

  // Mantém o ponto da planta sob o cursor fixo durante o zoom pela roda.
  useEffect(() => {
    const alvo = animacaoZoomRef.current;
    if (!alvo) return;
    const el = contentRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const rectEl = el.getBoundingClientRect();
    const rectContainer = container.getBoundingClientRect();
    const scrollLeft = rectContainer.left + el.offsetLeft - (alvo.cx - alvo.fx * rectEl.width);
    const scrollTop = rectContainer.top + el.offsetTop - (alvo.cy - alvo.fy * rectEl.height);
    container.scrollLeft = scrollLeft;
    container.scrollTop = scrollTop;
    animacaoZoomRef.current = null;
  }, [escala]);

  async function renovarUrl() {
    setRenovando(true);
    const resultado = await renovarUrlPlanta(planta.id);
    if ("url" in resultado) {
      setUrlAtual(resultado.url);
      setErroDocumento(null);
    } else {
      setErroDocumento(resultado.erro);
    }
    setRenovando(false);
  }

  async function salvarCalibracao(
    distanciaReal: number,
    unidade: "m" | "cm",
  ): Promise<{ erro?: string }> {
    if (pontosCalibracao.length !== 2) {
      return { erro: "Selecione dois pontos na planta." };
    }
    const [p1, p2] = pontosCalibracao;
    let unidadesPorPonto: number;
    try {
      unidadesPorPonto = calcularCalibracao(p1, p2, distanciaReal);
    } catch (erro) {
      return { erro: erro instanceof Error ? erro.message : "Pontos de calibragem invalidos." };
    }

    const resultado = await salvarCalibracaoAcao({
      plantaId: planta.id,
      pagina: paginaAtual,
      unidadesPorPonto,
      unidade,
      refP1: p1,
      refP2: p2,
      distanciaReal,
    });

    if ("erro" in resultado) return { erro: resultado.erro };

    setCalibracoesPorPagina((atual) => {
      const novo = new Map(atual);
      novo.set(paginaAtual, {
        planta_id: planta.id,
        pagina: paginaAtual,
        unidades_por_ponto: unidadesPorPonto,
        unidade,
        ref_p1: p1,
        ref_p2: p2,
        distancia_real: distanciaReal,
        calibrado_por: null,
        criado_em: new Date().toISOString(),
      });
      return novo;
    });
    setPontosCalibracao([]);
    setFerramenta("navegar");
    return {};
  }

  const linhaMedicao =
    ferramenta === "medir" && pontosMedicao.length >= 2
      ? {
          p1: pontosMedicao[0],
          p2: pontosMedicao[1],
          distancia: calibracao
            ? formatarMedida(medirDistancia(pontosMedicao[0], pontosMedicao[1], calibracao), calibracao.unidade)
            : `${formatarMedida(distanciaEmPontos(pontosMedicao[0], pontosMedicao[1]), "pt")} - calibre a pagina`,
        }
      : null;

  const retanguloMedicao =
    ferramenta === "medir" && pontosMedicao.length >= 3 && calibracao
      ? (() => {
          const regiao = retanguloParaRegiao(pontosMedicao[0], pontosMedicao[2]);
          const area = medirArea(regiao.vertices, calibracao);
          const perimetro = medirPerimetro(regiao.vertices, calibracao);
          const centro = centroDaRegiao(regiao);
          return {
            regiao,
            texto: `Area: ${formatarMedida(area, `${calibracao.unidade}²`)} · Perimetro: ${formatarMedida(perimetro, calibracao.unidade)}`,
            centro,
          };
        })()
      : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-borda bg-fundo-card p-1.5 shadow-sm">
          <div className="flex items-center gap-1">
            {FERRAMENTAS.filter(
              (f) => f.valor === "navegar" || f.valor === "medir" || podeEditar,
            ).map((ferramentaOpcao) => {
              const Icone = ferramentaOpcao.icone;
              const ativa = ferramenta === ferramentaOpcao.valor;
              return (
                <button
                  key={ferramentaOpcao.valor}
                  type="button"
                  onClick={() => {
                    if (ferramentaOpcao.valor !== ferramenta) limparRascunho();
                    setFerramenta(ferramentaOpcao.valor);
                    if (ferramentaOpcao.valor === "associar") setTarefaAssociacao("");
                    if (ferramentaOpcao.valor !== "calibrar") setPontosCalibracao([]);
                  }}
                  title={ferramentaOpcao.rotulo}
                  aria-pressed={ativa}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    ativa
                      ? "bg-azul-600 text-white"
                      : "text-superficie-600 hover:bg-superficie-100",
                  )}
                >
                  <Icone className="h-4 w-4" />
                  <span className="hidden sm:inline">{ferramentaOpcao.rotulo}</span>
                </button>
              );
            })}
          </div>

          <div className="mx-1 hidden h-6 w-px bg-borda sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setModoLote((atual) => {
                  const novo = !atual;
                  if (novo) limparRascunho();
                  else setLoteMarcadores([]);
                  return novo;
                });
              }}
              disabled={ferramenta !== "pino" && ferramenta !== "regiao"}
              title="Criar varias tarefas de uma vez na planta"
              aria-pressed={modoLote}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-40",
                modoLote
                  ? "bg-azul-600 text-white"
                  : "text-superficie-600 hover:bg-superficie-100",
              )}
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Lote</span>
            </button>
          </div>

          <div className="mx-1 hidden h-6 w-px bg-borda sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={diminuirZoom}
              className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-sm tabular-nums text-superficie-700">
              {Math.round(escala * 100)}%
            </span>
            <button
              type="button"
              onClick={aumentarZoom}
              className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAjusteLargura(true)}
              className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100"
              title="Ajustar a largura"
            >
              <Maximize className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetarZoom}
              className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100"
              title="Zoom 100%"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {numPaginas > 1 && (
            <>
              <div className="mx-1 hidden h-6 w-px bg-borda sm:block" />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1}
                  className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100 disabled:opacity-40"
                  title="Pagina anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={numPaginas}
                  value={paginaAtual}
                  onChange={(e) => {
                    const valor = Number(e.target.value);
                    if (Number.isFinite(valor) && valor >= 1 && valor <= numPaginas) {
                      setPaginaAtual(valor);
                    }
                  }}
                  className="h-9 w-14 rounded-lg border border-borda bg-white px-2 text-center text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                  aria-label="Numero da pagina"
                />
                <span className="text-sm text-superficie-500">/ {numPaginas}</span>
                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.min(numPaginas, p + 1))}
                  disabled={paginaAtual >= numPaginas}
                  className="flex h-9 w-11 items-center justify-center rounded-lg text-superficie-600 hover:bg-superficie-100 disabled:opacity-40"
                  title="Proxima pagina"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {ferramenta === "medir" && pontosMedicao.length > 0 && (
            <>
              <div className="mx-1 hidden h-6 w-px bg-borda sm:block" />
              <button
                type="button"
                onClick={() => setPontosMedicao([])}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-superficie-600 hover:bg-superficie-100"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] text-superficie-400">{DICA_FERRAMENTA[ferramenta]}</p>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borda bg-fundo-card px-2.5 py-1.5 text-[11px]" role="group" aria-label="Legenda de cores">
          {OPCOES_SITUACAO_TAREFA.map((opcao) => (
            <span key={opcao.valor} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-full", opcao.pino)} />
              <span className="text-superficie-600">{opcao.rotulo}</span>
            </span>
          ))}
        </div>

        {ferramenta === "associar" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-azul-200 bg-azul-50/60 px-3 py-2.5">
            <div className="min-w-[220px] flex-1">
              <Selecao
                rotulo="Tarefa para associar ou editar"
                value={tarefaAssociacao}
                onChange={(e) => aoSelecionarTarefaParaAssociar(e.target.value)}
              >
                <option value="">Selecione uma tarefa</option>
                {tarefasObra.map((tarefa) => {
                  let status = "";
                  if (tarefa.localizacao_tipo === "ponto") {
                    status = "Pino";
                  } else if (tarefa.localizacao_tipo === "regiao") {
                    status = "Regiao";
                  }
                  const emOutraPlanta =
                    tarefa.planta_id && tarefa.planta_id !== planta.id;
                  const sufixo = status
                    ? emOutraPlanta
                      ? ` - ${status} em "${
                          tarefa.planta_nome ?? "outra planta"
                        }"`
                      : ` - ${status}`
                    : " - Sem localizacao";
                  return (
                    <option key={tarefa.id} value={tarefa.id}>
                      {tarefa.titulo}
                      {sufixo}
                    </option>
                  );
                })}
              </Selecao>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-superficie-600">
                Tipo de localizacao
              </span>
              <div className="flex overflow-hidden rounded-lg border border-borda bg-white">
                <button
                  type="button"
                  onClick={() => setAssociacaoTipo("pino")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    associacaoTipo === "pino"
                      ? "bg-azul-600 text-white"
                      : "text-superficie-600 hover:bg-superficie-100",
                  )}
                >
                  <MapPin className="h-4 w-4" />
                  Pino
                </button>
                <button
                  type="button"
                  onClick={() => setAssociacaoTipo("regiao")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    associacaoTipo === "regiao"
                      ? "bg-azul-600 text-white"
                      : "text-superficie-600 hover:bg-superficie-100",
                  )}
                >
                  <Square className="h-4 w-4" />
                  Regiao
                </button>
              </div>
            </div>
          </div>
        )}

        <Calibragem
          calibracao={calibracaoLinha}
          pontos={pontosCalibracao}
          podeEditar={podeEditar}
          aoIniciar={() => {
            setFerramenta("calibrar");
            setPontosCalibracao([]);
          }}
          aoSalvar={salvarCalibracao}
          aoCancelar={() => {
            setPontosCalibracao([]);
            setFerramenta("navegar");
          }}
        />

        <div
          ref={containerRef}
          className="relative h-[70vh] overflow-auto rounded-xl border border-borda bg-superficie-100/60"
          style={{ touchAction: "none" }}
        >
          <div className="flex min-h-full min-w-full p-4">
            <div
              ref={contentRef}
              className={cn("relative m-auto shadow-lg", !dimensoes && "w-fit")}
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
              {urlAtual ? (
                <Document
                  file={urlAtual}
                  onLoadSuccess={({ numPages: total }) => setNumPaginas(total)}
                  onLoadError={() =>
                    setErroDocumento(
                      "Nao foi possivel carregar o PDF. O link pode ter expirado.",
                    )
                  }
                  loading={<CarregandoPlanta />}
                  error={
                    <ErroPlanta
                      erro={erroDocumento ?? "Nao foi possivel carregar o PDF."}
                      aoTentar={renovarUrl}
                      renovando={renovando}
                    />
                  }
                >
                  <Page
                    pageNumber={paginaAtual}
                    scale={renderEscala}
                    devicePixelRatio={dpr}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(pagina) => {
                      const viewport = pagina.getViewport({ scale: 1 });
                      setDimensoes((atual) =>
                        atual &&
                        atual.largura === viewport.width &&
                        atual.altura === viewport.height
                          ? atual
                          : { largura: viewport.width, altura: viewport.height },
                      );
                    }}
                    loading={
                      <div className="flex h-[600px] w-[420px] max-w-full items-center justify-center">
                        <Spinner />
                      </div>
                    }
                    error={
                      <p className="p-8 text-center text-sm text-perigo">
                        Nao foi possivel renderizar esta pagina.
                      </p>
                    }
                  />
                </Document>
              ) : (
                <ErroPlanta
                  erro="Nao foi possivel gerar o link de acesso ao PDF."
                  aoTentar={renovarUrl}
                  renovando={renovando}
                />
              )}

              {dimensoes && (
                <div
                  ref={overlayRef}
                  className="absolute inset-0 z-10"
                  style={{
                    cursor: arrastando ? "grabbing" : cursorPorFerramenta[ferramenta],
                    touchAction: "none",
                  }}
                  onPointerDown={aoPressionar}
                  onPointerMove={aoMover}
                  onPointerUp={aoSoltar}
                  onPointerCancel={aoSoltar}
                  onClick={aoClicar}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    {linhaMedicao && (
                      <LinhaSvg
                        p1={linhaMedicao.p1}
                        p2={linhaMedicao.p2}
                        dimensoes={dimensoes}
                        classe="stroke-azul-600"
                      />
                    )}
                    {retanguloMedicao && (
                      <RectSvg
                        regiao={retanguloMedicao.regiao}
                        dimensoes={dimensoes}
                        classe="stroke-azul-600 fill-azul-600/10"
                      />
                    )}
                    {ferramenta === "calibrar" && pontosCalibracao.length === 2 && (
                      <LinhaSvg
                        p1={pontosCalibracao[0]}
                        p2={pontosCalibracao[1]}
                        dimensoes={dimensoes}
                        classe="stroke-perigo"
                      />
                    )}
                    {modoDesenho === "regiao" &&
                      regiaoAtual &&
                      confirmacao?.tipo !== "regiao" && (
                        <RectSvg
                          regiao={regiaoAtual}
                          dimensoes={dimensoes}
                          classe="stroke-azul-600"
                        />
                      )}
                  </svg>

                  {tarefasFiltradas
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
                      const sit = situacaoDaTarefa({ status: tarefa.status, aprovacao: tarefa.aprovacao });
                      return (
                        <div
                          key={tarefa.id}
                          className={cn(
                            "absolute -translate-x-1/2 -translate-y-1/2",
                            tarefaDestaque === tarefa.id &&
                              "rounded-lg border-2 border-dashed border-azul-600 bg-azul-600/30 p-1",
                            !modoInterativo && "pointer-events-none"
                          )}
                          style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              aoClicar(e);
                            }}
                            onMouseEnter={() => aoEntrarPino(tarefa.id)}
                            onMouseLeave={aoSairPino}
                            className="rounded-full p-2"
                            aria-label={`Tarefa: ${tarefa.titulo}`}
                          >
                            <span
                              className={cn(
                                "block h-4 w-4 rounded-full opacity-[0.45] shadow ring-2 ring-white",
                                SITUACAO_TAREFA[sit].pino,
                              )}
                            />
                          </button>
                          {dicaTarefa === tarefa.id && (
                            <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full pb-2">
                              <DicaTarefa tarefa={tarefa} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {tarefasFiltradas
                    .filter(
                      (t) => t.localizacao_tipo === "regiao" && t.regiao,
                    )
                    .map((tarefa) => {
                      const limites = limitesDaRegiao(tarefa.regiao!);
                      if (!limites) return null;
                      const canto1 = pdfParaPercentual(
                        { x: limites.x, y: limites.y },
                        dimensoes.largura,
                        dimensoes.altura,
                      );
                      const canto2 = pdfParaPercentual(
                        { x: limites.x + limites.largura, y: limites.y + limites.altura },
                        dimensoes.largura,
                        dimensoes.altura,
                      );
                      const sit = situacaoDaTarefa({ status: tarefa.status, aprovacao: tarefa.aprovacao });
                      return (
                        <div
                          key={tarefa.id}
                          className={cn(
                            "absolute cursor-pointer rounded-sm border-2 opacity-[0.45]",
                            SITUACAO_TAREFA[sit].regiao,
                            tarefaDestaque === tarefa.id &&
                              "!border-dashed !border-azul-600 bg-azul-500/30",
                            !modoInterativo && "pointer-events-none"
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
                          {dicaTarefa === tarefa.id && (
                            <div className="pointer-events-none absolute z-30 -translate-y-full pb-2">
                              <DicaTarefa tarefa={tarefa} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {loteMarcadores.map((marcador, indice) =>
                    marcador.localizacao_tipo === "ponto" ? (
                      <div
                        key={`lote-${indice}`}
                        className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${pdfParaPercentual(marcador.ponto, dimensoes.largura, dimensoes.altura).esquerda}%`,
                          top: `${pdfParaPercentual(marcador.ponto, dimensoes.largura, dimensoes.altura).topo}%`,
                        }}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-azul-600 text-[10px] font-bold text-white shadow ring-2 ring-white">
                          {indice + 1}
                        </span>
                      </div>
                    ) : (() => {
                      const limites = limitesDaRegiao(marcador.regiao);
                      if (!limites) return null;
                      const canto1 = pdfParaPercentual(
                        { x: limites.x, y: limites.y },
                        dimensoes.largura,
                        dimensoes.altura,
                      );
                      const canto2 = pdfParaPercentual(
                        { x: limites.x + limites.largura, y: limites.y + limites.altura },
                        dimensoes.largura,
                        dimensoes.altura,
                      );
                      return (
                        <div
                          key={`lote-${indice}`}
                          className="absolute z-30 flex items-start rounded-sm border-2 border-azul-600"
                          style={{
                            left: `${Math.min(canto1.esquerda, canto2.esquerda)}%`,
                            top: `${Math.min(canto1.topo, canto2.topo)}%`,
                            width: `${Math.abs(canto2.esquerda - canto1.esquerda)}%`,
                            height: `${Math.abs(canto2.topo - canto1.topo)}%`,
                          }}
                        >
                          <span className="-mt-2 -ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-azul-600 text-[10px] font-bold text-white shadow ring-2 ring-white">
                            {indice + 1}
                          </span>
                        </div>
                      );
                    })(),
                  )}

                  {ferramenta === "medir" &&
                    pontosMedicao.map((ponto, indice) => (
                      <Marcador
                        key={indice}
                        ponto={ponto}
                        dimensoes={dimensoes}
                        cor="bg-azul-600"
                      />
                    ))}

                  {ferramenta === "calibrar" &&
                    pontosCalibracao.map((ponto, indice) => (
                      <Marcador
                        key={indice}
                        ponto={ponto}
                        dimensoes={dimensoes}
                        cor="bg-perigo"
                      />
                    ))}

                  {modoDesenho === "regiao" && posicaoMouse && (
                    <RotuloMedicao
                      ponto={posicaoMouse}
                      texto={textoDimensoes(regiaoAtual ?? { vertices: [posicaoMouse] }, calibracao)}
                      dimensoes={dimensoes}
                    />
                  )}

                  {confirmacao?.tipo === "regiao" && (
                    <>
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
                      >
                        <RectSvg
                          regiao={confirmacao.regiao}
                          dimensoes={dimensoes}
                          classe="stroke-azul-600 fill-azul-600/10"
                        />
                      </svg>
                      {(() => {
                        const limites = limitesDaRegiao(confirmacao.regiao);
                        if (!limites) return null;
                        const c1 = pdfParaPercentual(
                          { x: limites.x, y: limites.y },
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        const c2 = pdfParaPercentual(
                          {
                            x: limites.x + limites.largura,
                            y: limites.y + limites.altura,
                          },
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        return (
                          <div
                            className="absolute z-25 cursor-move border border-dashed border-azul-600/60 bg-azul-500/10 hover:bg-azul-500/20 transition-colors"
                            style={{
                              left: `${Math.min(c1.esquerda, c2.esquerda)}%`,
                              top: `${Math.min(c1.topo, c2.topo)}%`,
                              width: `${Math.abs(c2.esquerda - c1.esquerda)}%`,
                              height: `${Math.abs(c2.topo - c1.topo)}%`,
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const p = pontoDoEvento(e);
                              if (!p) return;
                              regiaoCorpoDragRef.current = {
                                ancora: p,
                                regiaoInicial: confirmacao.regiao,
                              };
                              e.currentTarget.setPointerCapture(e.pointerId);
                            }}
                            onPointerMove={(e) => {
                              if (!regiaoCorpoDragRef.current) return;
                              e.stopPropagation();
                              const p = pontoDoEvento(e);
                              if (!p) return;
                              const dx = p.x - regiaoCorpoDragRef.current.ancora.x;
                              const dy = p.y - regiaoCorpoDragRef.current.ancora.y;
                              const nova = moverRegiao(
                                regiaoCorpoDragRef.current.regiaoInicial,
                                dx,
                                dy,
                              );
                              setConfirmacao({ tipo: "regiao", regiao: nova });
                              setRegiaoAtual(nova);
                            }}
                            onPointerUp={() => {
                              regiaoCorpoDragRef.current = null;
                            }}
                          />
                        );
                      })()}
                      {CANTOS.map((canto) => {
                        const limites = limitesDaRegiao(confirmacao.regiao);
                        if (!limites) return null;
                        const pos = pdfParaPercentual(
                          cantoParaPonto(limites, canto),
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        return (
                          <div
                            key={canto}
                            className="absolute z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-[2px] border-2 border-white bg-azul-600 shadow"
                            style={{
                              left: `${pos.esquerda}%`,
                              top: `${pos.topo}%`,
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              cantoDragRef.current = { canto };
                              e.currentTarget.setPointerCapture(e.pointerId);
                            }}
                            onPointerMove={(e) => {
                              if (!cantoDragRef.current) return;
                              e.stopPropagation();
                              const p = pontoDoEvento(e);
                              if (!p) return;
                              const nova = regiaoComCanto(confirmacao.regiao, canto, p);
                              setConfirmacao({ tipo: "regiao", regiao: nova });
                              setRegiaoAtual(nova);
                            }}
                            onPointerUp={() => {
                              cantoDragRef.current = null;
                            }}
                          />
                        );
                      })}
                    </>
                  )}

                  {confirmacao?.tipo === "ponto" && (
                    <>
                      <Marcador
                        ponto={confirmacao.ponto}
                        dimensoes={dimensoes}
                        cor="bg-azul-600"
                      />
                      <RotuloMedicao
                        ponto={confirmacao.ponto}
                        texto={textoPonto(confirmacao.ponto, calibracao)}
                        dimensoes={dimensoes}
                      />
                    </>
                  )}

                  {linhaMedicao && (
                    <RotuloMedicao
                      ponto={{
                        x: (linhaMedicao.p1.x + linhaMedicao.p2.x) / 2,
                        y: (linhaMedicao.p1.y + linhaMedicao.p2.y) / 2,
                      }}
                      texto={linhaMedicao.distancia}
                      dimensoes={dimensoes}
                    />
                  )}

                  {retanguloMedicao && retanguloMedicao.centro && (
                    <RotuloMedicao
                      ponto={retanguloMedicao.centro}
                      texto={retanguloMedicao.texto}
                      dimensoes={dimensoes}
                    />
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6">
        {modoLote && loteMarcadores.length > 0 && (
          <div className="rounded-lg border border-azul-200 bg-azul-50/60 px-4 py-3">
            <p className="text-sm font-medium text-azul-800">
              {loteMarcadores.length}{" "}
              {loteMarcadores.length === 1
                ? "localizacao"
                : "localizacoes"}{" "}
              marcadas
            </p>
            <p className="mt-0.5 text-xs text-azul-700">
              Clique em &quot;Criar tarefas&quot; para preencher um unico
              formulario e replicar os dados para cada localizacao.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Botao
                type="button"
                onClick={() => void criarEmLote()}
                carregando={criandoLote}
              >
                Criar {loteMarcadores.length === 1 ? "tarefa" : "tarefas"}
              </Botao>
              <Botao
                type="button"
                variante="fantasma"
                onClick={limparLote}
              >
                Limpar
              </Botao>
            </div>
            {erroLote && (
              <p role="alert" className="mt-2 text-sm text-perigo">
                {erroLote}
              </p>
            )}
          </div>
        )}

        {confirmacao && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-azul-200 bg-azul-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-azul-800">
                {emAssociacao
                  ? "Associar tarefa a esta localizacao"
                  : confirmacao.tipo === "regiao"
                    ? "Confirme a regiao antes de criar a tarefa"
                    : "Confirme o pino antes de criar a tarefa"}
              </p>
              <p className="mt-0.5 text-xs text-azul-700">
                {confirmacao.tipo === "regiao"
                  ? textoDimensoes(confirmacao.regiao, calibracao)
                  : textoPonto(confirmacao.ponto, calibracao)}
                {emAssociacao && tarefaAssociacao
                  ? ` - ${tarefasObra.find((t) => t.id === tarefaAssociacao)?.titulo ?? ""}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Botao
                type="button"
                variante="fantasma"
                onClick={limparRascunho}
                disabled={associando}
              >
                Cancelar
              </Botao>
              <Botao
                type="button"
                onClick={confirmarCriacao}
                carregando={associando}
                disabled={emAssociacao && !tarefaAssociacao}
              >
                {emAssociacao ? "Associar" : "Criar tarefa"}
              </Botao>
            </div>
            {erroAssociacao && emAssociacao && (
              <p role="alert" className="w-full text-sm text-perigo">
                {erroAssociacao}
              </p>
            )}
          </div>
        )}
        <ListaTarefasPlanta
          tarefas={tarefasFiltradas}
          todasTarefasPagina={tarefasPagina}
          paginaAtual={paginaAtual}
          executores={executores}
          filtroSituacao={filtroSituacao}
          aoMudarSituacao={setFiltroSituacao}
          filtroPrioridade={filtroPrioridade}
          aoMudarPrioridade={setFiltroPrioridade}
          filtroExecutor={filtroExecutor}
          aoMudarExecutor={setFiltroExecutor}
          filtroTag={filtroTag}
          aoMudarTag={setFiltroTag}
          tags={tags}
          tarefaDestaque={tarefaDestaque}
          aoDestaque={setTarefaDestaque}
          aoEditarNoMapa={
            podeEditar
              ? (id) => {
                  setFerramenta("associar");
                  aoSelecionarTarefaParaAssociar(id);
                }
              : undefined
          }
        />
      </div>

      {menuSobreposicao && (
        <MenuTarefasSobrepostas
          posicao={menuSobreposicao.posicao}
          tarefas={menuSobreposicao.tarefas}
          aoSelecionar={(t) => {
            setMenuSobreposicao(null);
            router.push(`/tarefas/${t.id}`);
          }}
          aoFechar={() => setMenuSobreposicao(null)}
          aoDestaque={setTarefaDestaque}
        />
      )}
    </div>
  );
}

function LinhaSvg({
  p1,
  p2,
  dimensoes,
  classe,
}: {
  p1: PontoPdf;
  p2: PontoPdf;
  dimensoes: DimensoesPagina;
  classe: string;
}) {
  const a = pdfParaPercentual(p1, dimensoes.largura, dimensoes.altura);
  const b = pdfParaPercentual(p2, dimensoes.largura, dimensoes.altura);
  return (
    <line
      x1={a.esquerda}
      y1={a.topo}
      x2={b.esquerda}
      y2={b.topo}
      className={cn("stroke-[2]", classe)}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function RectSvg({
  regiao,
  dimensoes,
  classe,
}: {
  regiao: RegiaoPdf;
  dimensoes: DimensoesPagina;
  classe: string;
}) {
  const limites = limitesDaRegiao(regiao);
  if (!limites) return null;
  const canto1 = pdfParaPercentual(
    { x: limites.x, y: limites.y },
    dimensoes.largura,
    dimensoes.altura,
  );
  const canto2 = pdfParaPercentual(
    { x: limites.x + limites.largura, y: limites.y + limites.altura },
    dimensoes.largura,
    dimensoes.altura,
  );
  return (
    <rect
      x={Math.min(canto1.esquerda, canto2.esquerda)}
      y={Math.min(canto1.topo, canto2.topo)}
      width={Math.abs(canto2.esquerda - canto1.esquerda)}
      height={Math.abs(canto2.topo - canto1.topo)}
      className={cn("stroke-[2]", classe)}
      vectorEffect="non-scaling-stroke"
    />
  );
}