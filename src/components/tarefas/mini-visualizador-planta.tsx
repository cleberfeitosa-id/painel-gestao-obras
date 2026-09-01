"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ExternalLink,
  ArrowDownUp,
  LocateFixed,
  MapPin,
  MousePointer2,
  Pencil,
  RotateCcw,
  Square,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { Botao, Etiqueta, Spinner } from "@/components/ui";
import {
  CANTOS,
  cantoParaPonto,
  centroDaRegiao,
  corredorDaPolilinha,
  distanciaPontoPolilinha,
  limitesDaRegiao,
  moverRegiao,
  pdfParaPercentual,
  pontoEmRegiao,
  regiaoComCanto,
  retanguloParaRegiao,
  telaParaPdf,
  type Canto,
} from "@/lib/pdf/coordenadas";
import {
  CORES_CORREDOR,
  PRIORIDADE_TAREFA,
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { formatarData, situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { MenuTarefasSobrepostas } from "@/components/plantas/menu-tarefas-sobrepostas";
import { associarLocalizacao } from "@/app/(protegido)/tarefas/acoes";
import type { TarefaPlanta } from "@/components/plantas/tipos";
import type { PontoPdf, RegiaoPdf } from "@/lib/supabase/database.types";

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
type FerramentaEdicao = "pino" | "regiao" | "navegar";

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
    <div className="w-56 max-w-[80vw] rounded-xl border border-borda bg-white p-2.5 shadow-xl text-left">
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
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Etiqueta className={cn("text-[10px]", opcaoSituacao.classe)}>
          {opcaoSituacao.rotulo}
        </Etiqueta>
        <Etiqueta className={cn("text-[10px]", PRIORIDADE_TAREFA[tarefa.prioridade].classe)}>
          {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
        </Etiqueta>
      </div>
      <p className="mt-1.5 text-[11px] text-superficie-500">{prazoInfo.texto}</p>
    </div>
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
  const x = Math.min(canto1.esquerda, canto2.esquerda);
  const y = Math.min(canto1.topo, canto2.topo);
  const width = Math.abs(canto2.esquerda - canto1.esquerda);
  const height = Math.abs(canto2.topo - canto1.topo);
  return (
    <rect
      x={`${x}%`}
      y={`${y}%`}
      width={`${width}%`}
      height={`${height}%`}
      className={classe}
    />
  );
}

export function MiniVisualizadorPlanta({
  obraId,
  plantaId,
  plantaNome,
  urlPdf,
  pagina,
  tarefaAtualId,
  tarefas: tarefasIniciais,
  podeEditar,
}: MiniVisualizadorPlantaProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [tarefaAtualOverride, setTarefaAtualOverride] = useState<Partial<TarefaPlanta> | null>(null);

  const tarefas = useMemo(() => {
    if (!tarefaAtualOverride) return tarefasIniciais;
    return tarefasIniciais.map((t) => {
      if (t.id !== tarefaAtualId) return t;
      return { ...t, ...tarefaAtualOverride };
    });
  }, [tarefasIniciais, tarefaAtualId, tarefaAtualOverride]);

  const [escala, setEscala] = useState(1.5);
  const [renderEscala, setRenderEscala] = useState(1.5);
  const [dpr] = useState(() =>
    typeof window !== "undefined"
      ? Math.min(1.2, window.devicePixelRatio || 1)
      : 1,
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

  const [modoEdicao, setModoEdicao] = useState(false);
  const [ferramentaEdicao, setFerramentaEdicao] = useState<FerramentaEdicao>("pino");
  const [edicaoPonto, setEdicaoPonto] = useState<PontoPdf | null>(null);
  const [edicaoRegiao, setEdicaoRegiao] = useState<RegiaoPdf | null>(null);
  const [salvandoLocalizacao, setSalvandoLocalizacao] = useState(false);
  const [erroSalvarLocalizacao, setErroSalvarLocalizacao] = useState<string | null>(null);

  const panRef = useRef<{ x: number; y: number; sl: number; st: number; moveu: boolean } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distancia: number; escala: number } | null>(null);
  const timerDicaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinoDragRef = useRef<{ ancora: PontoPdf } | null>(null);
  const cantoDragRef = useRef<{ canto: Canto } | null>(null);
  const regiaoCorpoDragRef = useRef<{ ancora: PontoPdf; regiaoInicial: RegiaoPdf } | null>(null);
  const regiaoDesenhoRef = useRef<PontoPdf | null>(null);

  const tarefaAtual = useMemo(
    () => tarefas.find((t) => t.id === tarefaAtualId),
    [tarefas, tarefaAtualId],
  );

  const pontoFocoTarefaAtual = useMemo<PontoPdf | null>(() => {
    if (modoEdicao) {
      if (ferramentaEdicao === "pino" && edicaoPonto) return edicaoPonto;
      if (ferramentaEdicao === "regiao" && edicaoRegiao) return centroDaRegiao(edicaoRegiao);
    }
    if (!tarefaAtual) return null;
    if (
      (tarefaAtual.localizacao_tipo === "ponto" ||
        tarefaAtual.localizacao_tipo === "descida") &&
      tarefaAtual.ponto_x != null &&
      tarefaAtual.ponto_y != null
    ) {
      return { x: tarefaAtual.ponto_x, y: tarefaAtual.ponto_y };
    }
    if (tarefaAtual.localizacao_tipo === "regiao" && tarefaAtual.regiao) {
      return centroDaRegiao(tarefaAtual.regiao);
    }
    if (
      (tarefaAtual.localizacao_tipo === "distancia" ||
        tarefaAtual.localizacao_tipo === "circuito" ||
        tarefaAtual.localizacao_tipo === "area") &&
      tarefaAtual.localizacao_detalhe?.pontos &&
      tarefaAtual.localizacao_detalhe.pontos.length > 0
    ) {
      const pts = tarefaAtual.localizacao_detalhe.pontos;
      const sumX = pts.reduce((acc, p) => acc + p.x, 0);
      const sumY = pts.reduce((acc, p) => acc + p.y, 0);
      return { x: sumX / pts.length, y: sumY / pts.length };
    }
    if (tarefaAtual.ponto_x != null && tarefaAtual.ponto_y != null) {
      return { x: tarefaAtual.ponto_x, y: tarefaAtual.ponto_y };
    }
    return null;
  }, [tarefaAtual, modoEdicao, ferramentaEdicao, edicaoPonto, edicaoRegiao]);

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
      const escalaCalculada = Math.min(3.5, Math.max(1.5, Number((escalaBase * 2).toFixed(2))));

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
    if (modoEdicao) return;
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    setDicaTarefa(null);
    timerDicaRef.current = setTimeout(() => setDicaTarefa(id), 300);
  }, [modoEdicao]);

  const aoSairPino = useCallback(() => {
    if (timerDicaRef.current) clearTimeout(timerDicaRef.current);
    timerDicaRef.current = null;
    setDicaTarefa(null);
  }, []);

  function pontoDoEvento(
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  ): PontoPdf | null {
    if (!dimensoes) return null;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return telaParaPdf(
      e.clientX,
      e.clientY,
      rect,
      dimensoes.largura,
      dimensoes.altura,
    );
  }

  function registrarPonteiro(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function iniciarEdicao() {
    const tipo = tarefaAtual?.localizacao_tipo === "regiao" ? "regiao" : "pino";
    setFerramentaEdicao(tipo);
    setEdicaoPonto(
      tarefaAtual?.localizacao_tipo === "ponto" &&
        tarefaAtual.ponto_x != null &&
        tarefaAtual.ponto_y != null
        ? { x: tarefaAtual.ponto_x, y: tarefaAtual.ponto_y }
        : dimensoes
          ? { x: dimensoes.largura / 2, y: dimensoes.altura / 2 }
          : null,
    );
    setEdicaoRegiao(
      tarefaAtual?.localizacao_tipo === "regiao" && tarefaAtual.regiao
        ? tarefaAtual.regiao
        : null,
    );
    setErroSalvarLocalizacao(null);
    setTarefaSelecionada(null);
    setMenuSobreposicao(null);
    setModoEdicao(true);
  }

  function cancelarEdicao() {
    setModoEdicao(false);
    setErroSalvarLocalizacao(null);
    setEdicaoPonto(null);
    setEdicaoRegiao(null);
    pinoDragRef.current = null;
    cantoDragRef.current = null;
    regiaoCorpoDragRef.current = null;
    regiaoDesenhoRef.current = null;
  }

  function mudarFerramentaEdicao(nova: "pino" | "regiao") {
    setFerramentaEdicao(nova);
    if (nova === "pino" && !edicaoPonto) {
      if (edicaoRegiao) {
        setEdicaoPonto(centroDaRegiao(edicaoRegiao));
      } else if (dimensoes) {
        setEdicaoPonto({ x: dimensoes.largura / 2, y: dimensoes.altura / 2 });
      }
    } else if (nova === "regiao" && !edicaoRegiao) {
      if (edicaoPonto) {
        setEdicaoRegiao(
          retanguloParaRegiao(
            { x: edicaoPonto.x - 30, y: edicaoPonto.y - 20 },
            { x: edicaoPonto.x + 30, y: edicaoPonto.y + 20 },
          ),
        );
      } else if (dimensoes) {
        const cx = dimensoes.largura / 2;
        const cy = dimensoes.altura / 2;
        setEdicaoRegiao(
          retanguloParaRegiao({ x: cx - 40, y: cy - 25 }, { x: cx + 40, y: cy + 25 }),
        );
      }
    }
  }

  async function salvarEdicao() {
    setErroSalvarLocalizacao(null);
    setSalvandoLocalizacao(true);

    let dadosPayload: {
      localizacao_tipo: "ponto" | "regiao";
      planta_id: string;
      pagina: number;
      ponto_x?: number | null;
      ponto_y?: number | null;
      regiao?: RegiaoPdf | null;
    };

    if (ferramentaEdicao === "pino") {
      if (!edicaoPonto) {
        setErroSalvarLocalizacao("Clique na planta para posicionar o pino.");
        setSalvandoLocalizacao(false);
        return;
      }
      dadosPayload = {
        localizacao_tipo: "ponto",
        planta_id: plantaId,
        pagina,
        ponto_x: edicaoPonto.x,
        ponto_y: edicaoPonto.y,
        regiao: null,
      };
    } else {
      if (!edicaoRegiao) {
        setErroSalvarLocalizacao("Desenhe ou ajuste a região na planta.");
        setSalvandoLocalizacao(false);
        return;
      }
      dadosPayload = {
        localizacao_tipo: "regiao",
        planta_id: plantaId,
        pagina,
        ponto_x: null,
        ponto_y: null,
        regiao: edicaoRegiao,
      };
    }

    const resultado = await associarLocalizacao(tarefaAtualId, dadosPayload);
    setSalvandoLocalizacao(false);

    if (resultado.erro) {
      setErroSalvarLocalizacao(resultado.erro);
      return;
    }

    setTarefaAtualOverride({
      localizacao_tipo: dadosPayload.localizacao_tipo,
      pagina,
      ponto_x: dadosPayload.ponto_x ?? null,
      ponto_y: dadosPayload.ponto_y ?? null,
      regiao: dadosPayload.regiao ?? null,
    });

    setModoEdicao(false);
    router.refresh();
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

    if (modoEdicao && ferramentaEdicao === "pino") {
      const ponto = pontoDoEvento(e);
      if (ponto) {
        setEdicaoPonto(ponto);
        pinoDragRef.current = { ancora: ponto };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (modoEdicao && ferramentaEdicao === "regiao") {
      const ponto = pontoDoEvento(e);
      if (ponto) {
        regiaoDesenhoRef.current = ponto;
        setEdicaoRegiao(retanguloParaRegiao(ponto, ponto));
        e.currentTarget.setPointerCapture(e.pointerId);
      }
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

    if (modoEdicao) {
      if (ferramentaEdicao === "pino" && pinoDragRef.current) {
        const ponto = pontoDoEvento(e);
        if (ponto) setEdicaoPonto(ponto);
        return;
      }

      if (cantoDragRef.current && edicaoRegiao) {
        const ponto = pontoDoEvento(e);
        if (ponto) {
          const nova = regiaoComCanto(edicaoRegiao, cantoDragRef.current.canto, ponto);
          setEdicaoRegiao(nova);
        }
        return;
      }

      if (regiaoCorpoDragRef.current) {
        const ponto = pontoDoEvento(e);
        if (ponto) {
          const dx = ponto.x - regiaoCorpoDragRef.current.ancora.x;
          const dy = ponto.y - regiaoCorpoDragRef.current.ancora.y;
          const nova = moverRegiao(regiaoCorpoDragRef.current.regiaoInicial, dx, dy);
          setEdicaoRegiao(nova);
        }
        return;
      }

      if (ferramentaEdicao === "regiao" && regiaoDesenhoRef.current) {
        const ponto = pontoDoEvento(e);
        if (ponto) {
          setEdicaoRegiao(retanguloParaRegiao(regiaoDesenhoRef.current, ponto));
        }
        return;
      }
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

    if (modoEdicao) {
      pinoDragRef.current = null;
      cantoDragRef.current = null;
      regiaoCorpoDragRef.current = null;
      if (regiaoDesenhoRef.current && edicaoRegiao) {
        const limites = limitesDaRegiao(edicaoRegiao);
        if (!limites || limites.largura < 3 || limites.altura < 3) {
          if (tarefaAtual?.regiao) {
            setEdicaoRegiao(tarefaAtual.regiao);
          }
        }
      }
      regiaoDesenhoRef.current = null;
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
        (t.localizacao_tipo === "ponto" || t.localizacao_tipo === "descida") &&
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
      if (
        (t.localizacao_tipo === "distancia" ||
          t.localizacao_tipo === "circuito") &&
        t.localizacao_detalhe?.pontos &&
        t.localizacao_detalhe.pontos.length >= 2
      ) {
        const distPdf = distanciaPontoPolilinha(
          pontoPdf,
          t.localizacao_detalhe.pontos,
        );
        return distPdf <= 15;
      }
      if (
        t.localizacao_tipo === "area" &&
        t.localizacao_detalhe?.pontos &&
        t.localizacao_detalhe.pontos.length >= 3
      ) {
        return pontoEmRegiao(pontoPdf, {
          vertices: t.localizacao_detalhe.pontos,
        });
      }
      return false;
    });
  }

  function aoClicar(e: React.MouseEvent<HTMLElement>) {
    if (modoEdicao) return;
    if (panRef.current?.moveu) {
      panRef.current = null;
      return;
    }
    panRef.current = null;

    const tarefasNoLocal = identificarTarefasNoPonto(e.clientX, e.clientY);
    if (tarefasNoLocal.length === 1) {
      setMenuSobreposicao(null);
      setTarefaSelecionada(tarefasNoLocal[0]);
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

  const limitesEdicaoRegiao = edicaoRegiao ? limitesDaRegiao(edicaoRegiao) : null;

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-borda bg-white shadow-xs">
      {modoEdicao ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-azul-200 bg-azul-50/90 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-bold text-azul-900">
              <MapPin className="h-4 w-4 text-azul-600" />
              Editar localização
            </span>
            <div className="flex overflow-hidden rounded-md border border-azul-200 bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => mudarFerramentaEdicao("pino")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  ferramentaEdicao === "pino"
                    ? "bg-azul-600 text-white"
                    : "text-superficie-700 hover:bg-superficie-100",
                )}
              >
                <MapPin className="h-3 w-3" />
                Pino
              </button>
              <button
                type="button"
                onClick={() => mudarFerramentaEdicao("regiao")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  ferramentaEdicao === "regiao"
                    ? "bg-azul-600 text-white"
                    : "text-superficie-700 hover:bg-superficie-100",
                )}
              >
                <Square className="h-3 w-3" />
                Região
              </button>
              <button
                type="button"
                onClick={() => setFerramentaEdicao("navegar")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  ferramentaEdicao === "navegar"
                    ? "bg-azul-600 text-white"
                    : "text-superficie-700 hover:bg-superficie-100",
                )}
              >
                <MousePointer2 className="h-3 w-3" />
                Mover mapa
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Botao
              type="button"
              tamanho="sm"
              variante="primario"
              onClick={salvarEdicao}
              carregando={salvandoLocalizacao}
              disabled={salvandoLocalizacao}
              className="h-7 text-xs font-medium"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar
            </Botao>
            <Botao
              type="button"
              tamanho="sm"
              variante="contorno"
              onClick={cancelarEdicao}
              disabled={salvandoLocalizacao}
              className="h-7 text-xs"
            >
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda bg-superficie-50/90 px-3 py-2 text-xs">
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <span className="truncate font-semibold text-superficie-800" title={plantaNome}>
              {plantaNome}
            </span>
            <span className="shrink-0 text-superficie-400">·</span>
            <span className="shrink-0 whitespace-nowrap text-superficie-600">Página {pagina}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => centralizarNaTarefa()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-borda bg-white px-2 text-[11px] font-medium text-azul-700 hover:bg-azul-50 hover:border-azul-300 transition-colors shadow-2xs"
              title="Centralizar na tarefa atual"
            >
              <LocateFixed className="h-3.5 w-3.5 text-azul-600" />
              <span>Centralizar</span>
            </button>

            {podeEditar && (
              <button
                type="button"
                onClick={iniciarEdicao}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-azul-200 bg-azul-50 px-2 text-[11px] font-semibold text-azul-700 hover:bg-azul-100 hover:border-azul-300 transition-colors shadow-2xs"
                title="Editar localização da tarefa no mapa"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar localização</span>
              </button>
            )}

            <div className="mx-0.5 h-4 w-px bg-borda" />

            <button
              type="button"
              onClick={() => setEscala((e) => Math.max(0.2, Number((e / 1.25).toFixed(3))))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-superficie-600 hover:bg-superficie-200"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-9 text-center text-[11px] tabular-nums font-medium text-superficie-700">
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
              onClick={() => {
                setEscala(1.5);
                centralizarNaTarefa(1.5);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-superficie-600 hover:bg-superficie-200"
              title="Resetar zoom (150%)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-borda" />

            <Link
              href={`/obras/${obraId}/plantas/${plantaId}?associar=${tarefaAtualId}`}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-superficie-600 hover:bg-superficie-200 hover:text-superficie-900 transition-colors"
              title="Abrir no visualizador completo"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abrir completa</span>
            </Link>
          </div>
        </div>
      )}

      {erroSalvarLocalizacao && (
        <div className="border-b border-perigo/20 bg-perigo/10 px-3 py-1.5 text-xs text-perigo">
          {erroSalvarLocalizacao}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative h-80 sm:h-96 w-full max-w-full overflow-auto bg-superficie-100/70 select-none"
        style={{
          touchAction: "none",
          cursor: modoEdicao
            ? ferramentaEdicao === "navegar"
              ? arrastando
                ? "grabbing"
                : "grab"
              : "crosshair"
            : arrastando
              ? "grabbing"
              : "grab",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex min-h-full min-w-full p-4">
          <div
            ref={contentRef}
            className={cn("relative m-auto shadow-md shrink-0", !dimensoes && "w-fit")}
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
                  <div className="flex h-64 w-full max-w-full items-center justify-center gap-2 text-xs text-superficie-500">
                    <Spinner tamanho="md" />
                    Carregando PDF da planta...
                  </div>
                }
                error={
                  <div className="flex h-64 w-full max-w-full items-center justify-center text-xs text-perigo">
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
                    <div className="flex h-64 w-full max-w-full items-center justify-center">
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
                        t.ponto_y != null &&
                        (!modoEdicao || t.id !== tarefaAtualId),
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
                            modoEdicao && "opacity-40",
                            tarefaDestaque === tarefa.id &&
                              "rounded-full ring-4 ring-azul-400/80 scale-125 z-40",
                          )}
                          style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                          onPointerDown={(e) => !modoEdicao && e.stopPropagation()}
                        >
                          {eAtual && !modoEdicao && (
                            <span className="absolute -inset-2 rounded-full bg-azul-500/30 animate-ping pointer-events-none" />
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              if (!modoEdicao) {
                                e.stopPropagation();
                                aoClicar(e);
                              }
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

                            {eAtual && !modoEdicao && (
                              <span className="absolute -bottom-5 whitespace-nowrap rounded-md bg-azul-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                                Atual
                              </span>
                            )}
                          </button>

                          {dicaTarefa === tarefa.id && !modoEdicao && (
                            <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full pb-2">
                              <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {tarefas
                    .filter(
                      (t) =>
                        t.localizacao_tipo === "regiao" &&
                        t.regiao &&
                        (!modoEdicao || t.id !== tarefaAtualId),
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
                            modoEdicao && "opacity-40 pointer-events-none",
                            tarefaDestaque === tarefa.id &&
                              "!border-dashed !border-azul-600 bg-azul-500/40 ring-4 ring-azul-300",
                          )}
                          style={{
                            left: `${Math.min(canto1.esquerda, canto2.esquerda)}%`,
                            top: `${Math.min(canto1.topo, canto2.topo)}%`,
                            width: `${Math.abs(canto2.esquerda - canto1.esquerda)}%`,
                            height: `${Math.abs(canto2.topo - canto1.topo)}%`,
                          }}
                          onPointerDown={(e) => !modoEdicao && e.stopPropagation()}
                          onClick={(e) => {
                            if (!modoEdicao) {
                              e.stopPropagation();
                              aoClicar(e);
                            }
                          }}
                          onMouseEnter={() => aoEntrarPino(tarefa.id)}
                          onMouseLeave={aoSairPino}
                        >
                          {eAtual && !modoEdicao && (
                            <span className="absolute -top-3 left-1 rounded bg-azul-600 px-1 py-0.5 text-[8px] font-bold text-white shadow-xs">
                              Tarefa atual
                            </span>
                          )}

                          {dicaTarefa === tarefa.id && !modoEdicao && (
                            <div className="pointer-events-none absolute z-40 -translate-y-full pb-2">
                              <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {tarefas
                    .filter(
                      (t) =>
                        t.localizacao_tipo === "distancia" &&
                        t.localizacao_detalhe?.pontos &&
                        t.localizacao_detalhe.pontos.length >= 2 &&
                        (!modoEdicao || t.id !== tarefaAtualId),
                    )
                    .map((tarefa) => {
                      const corredor = corredorDaPolilinha(
                        tarefa.localizacao_detalhe!.pontos!,
                        8,
                      );
                      if (corredor.length < 3) return null;
                      const pontosPct = corredor
                        .map((p) =>
                          pdfParaPercentual(
                            p,
                            dimensoes.largura,
                            dimensoes.altura,
                          ),
                        )
                        .map((p) => `${p.esquerda.toFixed(3)}% ${p.topo.toFixed(3)}%`)
                        .join(",");
                      const p0 = tarefa.localizacao_detalhe!.pontos![0];
                      const p0Pct = pdfParaPercentual(
                        p0,
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
                            "absolute inset-0 cursor-pointer transition-opacity",
                            eAtual ? "z-30 opacity-90 ring-2 ring-azul-400" : "z-20 opacity-50 hover:opacity-90",
                            modoEdicao && "opacity-40 pointer-events-none",
                          )}
                          style={{
                            clipPath: `polygon(${pontosPct})`,
                            backgroundColor: CORES_CORREDOR[sit],
                          }}
                          onPointerDown={(e) => !modoEdicao && e.stopPropagation()}
                          onClick={(e) => {
                            if (!modoEdicao) {
                              e.stopPropagation();
                              setTarefaSelecionada(tarefa);
                              setMenuSobreposicao(null);
                            }
                          }}
                          onMouseEnter={() => aoEntrarPino(tarefa.id)}
                          onMouseLeave={aoSairPino}
                        >
                          {dicaTarefa === tarefa.id && !modoEdicao && (
                            <div
                              className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full pb-2"
                              style={{
                                left: `${p0Pct.esquerda}%`,
                                top: `${p0Pct.topo}%`,
                              }}
                            >
                              <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {tarefas
                    .filter(
                      (t) =>
                        t.localizacao_tipo === "descida" &&
                        t.ponto_x != null &&
                        t.ponto_y != null &&
                        (!modoEdicao || t.id !== tarefaAtualId),
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
                            modoEdicao && "opacity-40",
                            tarefaDestaque === tarefa.id &&
                              "rounded-full ring-4 ring-azul-400/80 scale-125 z-40",
                          )}
                          style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                          onPointerDown={(e) => !modoEdicao && e.stopPropagation()}
                        >
                          {eAtual && !modoEdicao && (
                            <span className="absolute -inset-2 rounded-full bg-azul-500/30 animate-ping pointer-events-none" />
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              if (!modoEdicao) {
                                e.stopPropagation();
                                aoClicar(e);
                              }
                            }}
                            onMouseEnter={() => aoEntrarPino(tarefa.id)}
                            onMouseLeave={aoSairPino}
                            className={cn(
                              "group relative flex items-center justify-center rounded-full p-1.5 focus:outline-none shadow-md ring-2 ring-white",
                              eAtual && "ring-offset-2 ring-offset-azul-600 shadow-lg",
                            )}
                            aria-label={`Tarefa: ${tarefa.titulo}`}
                          >
                            <span
                              className={cn(
                                "flex items-center justify-center rounded-full",
                                eAtual
                                  ? "h-5 w-5 bg-azul-600"
                                  : cn("h-4 w-4 opacity-80 hover:opacity-100", SITUACAO_TAREFA[sit].pino),
                              )}
                            >
                              <ArrowDownUp className="h-3 w-3 text-white" />
                            </span>

                            {eAtual && !modoEdicao && (
                              <span className="absolute -bottom-5 whitespace-nowrap rounded-md bg-azul-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                                Atual
                              </span>
                            )}
                          </button>

                          {dicaTarefa === tarefa.id && !modoEdicao && (
                            <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full pb-2">
                              <DicaTarefa tarefa={tarefa} eAtual={eAtual} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {modoEdicao && ferramentaEdicao === "pino" && edicaoPonto && (
                    <>
                      <div
                        className="absolute z-40 -translate-x-1/2 -translate-y-1/2 cursor-move"
                        style={{
                          left: `${pdfParaPercentual(edicaoPonto, dimensoes.largura, dimensoes.altura).esquerda}%`,
                          top: `${pdfParaPercentual(edicaoPonto, dimensoes.largura, dimensoes.altura).topo}%`,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const p = pontoDoEvento(e);
                          if (p) {
                            pinoDragRef.current = { ancora: p };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }
                        }}
                        onPointerMove={(e) => {
                          if (!pinoDragRef.current) return;
                          e.stopPropagation();
                          const p = pontoDoEvento(e);
                          if (p) setEdicaoPonto(p);
                        }}
                        onPointerUp={() => {
                          pinoDragRef.current = null;
                        }}
                      >
                        <span className="absolute -inset-2 rounded-full bg-azul-500/40 animate-ping pointer-events-none" />
                        <span className="block h-6 w-6 rounded-full border-2 border-white bg-azul-600 shadow-xl ring-2 ring-azul-400" />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-azul-800 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                          Arrastar pino
                        </span>
                      </div>
                    </>
                  )}

                  {modoEdicao && ferramentaEdicao === "regiao" && edicaoRegiao && limitesEdicaoRegiao && (
                    <>
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="pointer-events-none absolute inset-0 z-30 h-full w-full"
                      >
                        <RectSvg
                          regiao={edicaoRegiao}
                          dimensoes={dimensoes}
                          classe="stroke-azul-600 stroke-[2] fill-azul-600/20"
                        />
                      </svg>

                      {(() => {
                        const c1 = pdfParaPercentual(
                          { x: limitesEdicaoRegiao.x, y: limitesEdicaoRegiao.y },
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        const c2 = pdfParaPercentual(
                          {
                            x: limitesEdicaoRegiao.x + limitesEdicaoRegiao.largura,
                            y: limitesEdicaoRegiao.y + limitesEdicaoRegiao.altura,
                          },
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        return (
                          <div
                            className="absolute z-35 cursor-move border border-dashed border-azul-600/80 bg-azul-500/10 hover:bg-azul-500/20 transition-colors"
                            style={{
                              left: `${Math.min(c1.esquerda, c2.esquerda)}%`,
                              top: `${Math.min(c1.topo, c2.topo)}%`,
                              width: `${Math.abs(c2.esquerda - canto1_left(c1, c2))}%`,
                              height: `${Math.abs(c2.topo - canto1_top(c1, c2))}%`,
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const p = pontoDoEvento(e);
                              if (p) {
                                regiaoCorpoDragRef.current = {
                                  ancora: p,
                                  regiaoInicial: edicaoRegiao,
                                };
                                e.currentTarget.setPointerCapture(e.pointerId);
                              }
                            }}
                            onPointerMove={(e) => {
                              if (!regiaoCorpoDragRef.current) return;
                              e.stopPropagation();
                              const p = pontoDoEvento(e);
                              if (p) {
                                const dx = p.x - regiaoCorpoDragRef.current.ancora.x;
                                const dy = p.y - regiaoCorpoDragRef.current.ancora.y;
                                const nova = moverRegiao(
                                  regiaoCorpoDragRef.current.regiaoInicial,
                                  dx,
                                  dy,
                                );
                                setEdicaoRegiao(nova);
                              }
                            }}
                            onPointerUp={() => {
                              regiaoCorpoDragRef.current = null;
                            }}
                          >
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-azul-800 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                              Mover região
                            </span>
                          </div>
                        );
                      })()}

                      {CANTOS.map((canto) => {
                        const pos = pdfParaPercentual(
                          cantoParaPonto(limitesEdicaoRegiao, canto),
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        return (
                          <div
                            key={canto}
                            className="absolute z-40 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-[2px] border-2 border-white bg-azul-600 shadow-md ring-2 ring-azul-400"
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
                              if (p) {
                                const nova = regiaoComCanto(edicaoRegiao, canto, p);
                                setEdicaoRegiao(nova);
                              }
                            }}
                            onPointerUp={() => {
                              cantoDragRef.current = null;
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modoEdicao && (
        <div className="border-t border-azul-200 bg-azul-50/70 px-3 py-2 text-xs text-azul-900 flex flex-wrap items-center justify-between gap-2">
          <div>
            {ferramentaEdicao === "pino" && edicaoPonto && (
              <span>
                Posição do pino: <strong>x: {edicaoPonto.x.toFixed(1)}</strong>,{" "}
                <strong>y: {edicaoPonto.y.toFixed(1)}</strong> (arraste ou clique para posicionar)
              </span>
            )}
            {ferramentaEdicao === "regiao" && limitesEdicaoRegiao && (
              <span>
                Região: <strong>{limitesEdicaoRegiao.largura.toFixed(1)} × {limitesEdicaoRegiao.altura.toFixed(1)}</strong> (arraste o corpo para mover, os cantos para redimensionar)
              </span>
            )}
            {ferramentaEdicao === "navegar" && (
              <span>Modo navegação: arraste para mover a visualização da planta.</span>
            )}
          </div>
          <div className="text-[11px] text-azul-700">
            Clique em <strong>Salvar</strong> para confirmar as alterações.
          </div>
        </div>
      )}

      {tarefaSelecionada && !modoEdicao && (
        <div className="border-t border-borda bg-superficie-50/90 p-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                {tarefaSelecionada.id === tarefaAtualId ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-azul-100 px-1.5 py-0.5 text-[10px] font-bold text-azul-800">
                    <MapPin className="h-3 w-3" />
                    Tarefa atual
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-superficie-200 px-1.5 py-0.5 text-[10px] font-medium text-superficie-700">
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
                  <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                    <User className="h-3 w-3 shrink-0 text-superficie-400" />
                    <span className="truncate">{tarefaSelecionada.responsavel.nome}</span>
                  </span>
                )}
                {tarefaSelecionada.prazo && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3 text-superficie-400" />
                    {formatarData(tarefaSelecionada.prazo)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
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
              </div>
              <button
                type="button"
                onClick={() => setTarefaSelecionada(null)}
                className="rounded-lg p-1 text-superficie-400 hover:bg-superficie-200 hover:text-superficie-700 ml-auto sm:ml-0"
                aria-label="Fechar resumo da tarefa"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {menuSobreposicao && !modoEdicao && (
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

function canto1_left(
  c1: { esquerda: number; topo: number },
  c2: { esquerda: number; topo: number },
) {
  return Math.min(c1.esquerda, c2.esquerda);
}

function canto1_top(
  c1: { esquerda: number; topo: number },
  c2: { esquerda: number; topo: number },
) {
  return Math.min(c1.topo, c2.topo);
}
