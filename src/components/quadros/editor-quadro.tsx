"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Copy,
  Settings,
  ZoomIn,
  ZoomOut,
  FileSpreadsheet,
  BookmarkPlus,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  RotateCw,
  Box,
  Eye,
  FolderCog,
} from "lucide-react";
import { Botao } from "@/components/ui";
import {
  COMPONENTES_CATALOGO_PADRAO,
  MODULO_DIN_MM,
  type ElementoQuadro,
  type TrilhoDIN,
  type CanaletaFiacao,
  type BarramentoEspinhaPeixe,
  type BarramentoNeutroTerra,
  type FuroBarramento,
  type DerivacaoBarramento,
  type QuadroEletricoLayout,
  type TipoComponenteQuadro,
  type CircuitoVinculado,
  type DimensaoPadraoComponente,
  mmParaPolegadaTexto,
  polegadaParaMm,
} from "@/lib/quadros/tipos";
import {
  validarLayoutQuadro,
  gerarListaMateriaisQuadro,
} from "@/lib/quadros/calculos";
import {
  salvarQuadroEletrico,
  salvarQuadroComoTemplate,
} from "@/app/(protegido)/obras/[id]/quadros/acoes";
import { ModalDimensoesQuadro, type DimensoesQuadroConfig } from "./modal-dimensoes-quadro";
import { ModalListaMateriais } from "./modal-lista-materiais";
import { ModalSalvarTemplate } from "./modal-salvar-template";
import { ModalGerenciadorBiblioteca } from "./modal-gerenciador-biblioteca";
import { VisualizadorQuadro3D } from "./visualizador-quadro-3d";

interface EditorQuadroProps {
  obraId: string;
  obraNome: string;
  quadro: {
    id: string;
    tag: string;
    nome: string | null;
    tipo_quadro: string;
    largura_mm: number;
    altura_mm: number;
    profundidade_mm: number;
    largura_util_mm: number;
    altura_util_mm: number;
    margem_lateral_mm: number;
    margem_topo_mm: number;
    margem_base_mm?: number | null;
    margem_direita_mm?: number | null;
    corrente_nominal: number | null;
    tensao_nominal: string | null;
    grau_protecao: string | null;
    material_caixa: string | null;
    layout: QuadroEletricoLayout;
    circuitos_vinculados: CircuitoVinculado[];
  };
  circuitosDisponiveis: CircuitoVinculado[];
  podeEditar: boolean;
}

export function EditorQuadro({
  obraId,
  obraNome,
  quadro,
  circuitosDisponiveis,
  podeEditar,
}: EditorQuadroProps) {
  const [tag, setTag] = useState(quadro.tag);
  const [nome, setNome] = useState(quadro.nome ?? "");
  const [dimensoes, setDimensoes] = useState<DimensoesQuadroConfig>({
    larguraMm: Number(quadro.largura_mm) || 600,
    alturaMm: Number(quadro.altura_mm) || 800,
    profundidadeMm: Number(quadro.profundidade_mm) || 200,
    larguraUtilMm: Number(quadro.largura_util_mm) || 540,
    alturaUtilMm: Number(quadro.altura_util_mm) || 740,
    margemLateralMm: Number(quadro.margem_lateral_mm) || 30,
    margemTopoMm: Number(quadro.margem_topo_mm) || 30,
    margemBaseMm: Number(quadro.margem_base_mm) || Number(quadro.margem_topo_mm) || 30,
    margemDireitaMm: Number(quadro.margem_direita_mm) || Number(quadro.margem_lateral_mm) || 30,
  });

  const [layout, setLayout] = useState<QuadroEletricoLayout>(() => {
    const l = quadro.layout || {};
    return {
      elementos: l.elementos || [],
      trilhos: l.trilhos || [],
      canaletas: l.canaletas || [],
      barramentos: l.barramentos || [],
      barramentosNeutroTerra: l.barramentosNeutroTerra || [],
    };
  });

  const [catalogo, setCatalogo] = useState<Record<string, DimensaoPadraoComponente>>(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem("painel_gestao_catalogo_quadros_v1");
        if (salvo) {
          const parsed = JSON.parse(salvo);
          return { ...COMPONENTES_CATALOGO_PADRAO, ...parsed };
        }
      } catch {}
    }
    return COMPONENTES_CATALOGO_PADRAO;
  });

  const circuitos = quadro.circuitos_vinculados || [];

  const [elementoSelecionadoId, setElementoSelecionadoId] = useState<string | null>(null);
  const [trilhoSelecionadoId, setTrilhoSelecionadoId] = useState<string | null>(null);
  const [barramentoSelecionadoId, setBarramentoSelecionadoId] = useState<string | null>(null);
  const [barramentoNTSelecionadoId, setBarramentoNTSelecionadoId] = useState<string | null>(null);
  const [canaletaSelecionadaId, setCanaletaSelecionadaId] = useState<string | null>(null);

  const [modoVisualizacao, setModoVisualizacao] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1);
  const [snapGrid] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const [modalDimensoesAberto, setModalDimensoesAberto] = useState(false);
  const [modalMateriaisAberto, setModalMateriaisAberto] = useState(false);
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
  const [modalBibliotecaAberto, setModalBibliotecaAberto] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("disjuntor");

  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [arrastandoTipo, setArrastandoTipo] = useState<"elemento" | "trilho" | "canaleta" | "barramento" | "barramento_nt" | null>(null);
  const [offsetArrasto, setOffsetArrasto] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const startDragCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<SVGSVGElement>(null);

  const validacao = validarLayoutQuadro(layout, {
    larguraMm: dimensoes.larguraUtilMm,
    alturaMm: dimensoes.alturaUtilMm,
    profundidadeMm: dimensoes.profundidadeMm,
  });

  const elementoSelecionado = layout.elementos.find((e) => e.id === elementoSelecionadoId);
  const trilhoSelecionado = layout.trilhos.find((t) => t.id === trilhoSelecionadoId);
  const barramentoSelecionado = layout.barramentos.find((b) => b.id === barramentoSelecionadoId);
  const barramentoNTSelecionado = (layout.barramentosNeutroTerra || []).find((b) => b.id === barramentoNTSelecionadoId);
  const canaletaSelecionada = layout.canaletas.find((c) => c.id === canaletaSelecionadaId);

  const adicionarComponente = useCallback(
    (tipo: TipoComponenteQuadro) => {
      if (!podeEditar) return;
      const cat = catalogo[tipo] || COMPONENTES_CATALOGO_PADRAO[tipo];
      if (!cat) return;

      const novoId = `${tipo}-${Date.now().toString(36)}`;
      const contagemTipo = layout.elementos.filter((e) => e.tipo === tipo).length + 1;

      if (tipo === "trilho_din" || tipo === "trilho_din_vertical") {
        const isVertical = tipo === "trilho_din_vertical";
        const novoTrilho: TrilhoDIN = {
          id: `trilho-${Date.now().toString(36)}`,
          tag: `TRILHO-${isVertical ? "V" : "H"}${layout.trilhos.length + 1}`,
          orientacao: isVertical ? "vertical" : "horizontal",
          x: 20,
          y: isVertical ? 20 : Math.min(dimensoes.alturaUtilMm - 60, (layout.trilhos.length + 1) * 120),
          larguraMm: isVertical ? 35 : Math.max(150, dimensoes.larguraUtilMm - 40),
          alturaMm: isVertical ? Math.min(dimensoes.alturaUtilMm - 40, 400) : 35,
          profundidadeMm: 7.5,
        };
        setLayout((ant) => ({ ...ant, trilhos: [...ant.trilhos, novoTrilho] }));
        setTrilhoSelecionadoId(novoTrilho.id);
        setElementoSelecionadoId(null);
        setBarramentoSelecionadoId(null);
        setBarramentoNTSelecionadoId(null);
        setCanaletaSelecionadaId(null);
        return;
      }

      if (tipo === "barramento_terra" || tipo === "barramento_neutro") {
        const isTerra = tipo === "barramento_terra";
        const totalExistente = (layout.barramentosNeutroTerra || []).filter((b) => b.tipo === (isTerra ? "terra" : "neutro")).length + 1;
        const compMm = 200;
        const espacamento = 14;
        const diamPadrao = 5;

        const furosIniciais: FuroBarramento[] = [];
        let posX = 16;
        let fIdx = 1;
        while (posX < compMm - 12) {
          furosIniciais.push({
            id: `f-${Date.now().toString(36)}-${fIdx}`,
            posicaoMm: posX,
            diametroMm: diamPadrao,
            secaoMaximaMm2: 16,
            rotulo: `${isTerra ? "PE" : "N"}-${fIdx}`,
          });
          posX += espacamento;
          fIdx++;
        }

        const novoBarNT: BarramentoNeutroTerra = {
          id: `barnt-${Date.now().toString(36)}`,
          tag: isTerra ? `BAR-PE-${totalExistente}` : `BAR-N-${totalExistente}`,
          tipo: isTerra ? "terra" : "neutro",
          orientacao: "horizontal",
          x: Math.max(20, Math.floor(dimensoes.larguraUtilMm / 2) - 100),
          y: isTerra ? Math.max(20, dimensoes.alturaUtilMm - 60) : 20,
          comprimentoMm: compMm,
          larguraMm: 20,
          profundidadeMm: 15,
          correnteSuportadaA: 100,
          material: "latao",
          diametroFuroPadraoMm: diamPadrao,
          espacamentoFurosMm: espacamento,
          furos: furosIniciais,
        };

        setLayout((ant) => ({
          ...ant,
          barramentosNeutroTerra: [...(ant.barramentosNeutroTerra || []), novoBarNT],
        }));
        setBarramentoNTSelecionadoId(novoBarNT.id);
        setElementoSelecionadoId(null);
        setTrilhoSelecionadoId(null);
        setBarramentoSelecionadoId(null);
        setCanaletaSelecionadaId(null);
        return;
      }

      if (tipo === "canaleta_horizontal" || tipo === "canaleta_vertical") {
        const orientacao = tipo === "canaleta_horizontal" ? "horizontal" : "vertical";
        const novaCanaleta: CanaletaFiacao = {
          id: `can-${Date.now().toString(36)}`,
          tag: `CAN-${orientacao === "horizontal" ? "H" : "V"}${layout.canaletas.length + 1}`,
          orientacao,
          x: orientacao === "horizontal" ? 10 : 10,
          y: orientacao === "horizontal" ? 10 : 10,
          larguraMm: orientacao === "horizontal" ? dimensoes.larguraUtilMm - 20 : 30,
          alturaMm: orientacao === "horizontal" ? 30 : dimensoes.alturaUtilMm - 20,
          profundidadeMm: 50,
        };
        setLayout((ant) => ({ ...ant, canaletas: [...ant.canaletas, novaCanaleta] }));
        setCanaletaSelecionadaId(novaCanaleta.id);
        setElementoSelecionadoId(null);
        setTrilhoSelecionadoId(null);
        setBarramentoSelecionadoId(null);
        setBarramentoNTSelecionadoId(null);
        return;
      }

      if (tipo === "barramento_espinha_peixe") {
        const novoBarramento: BarramentoEspinhaPeixe = {
          id: `bar-${Date.now().toString(36)}`,
          tag: `BAR-TRI-${layout.barramentos.length + 1}`,
          tipo: "trifasico",
          correnteSuportadaA: 125,
          secaoTroncoMm2: 60,
          material: "cobre_eletrolitico",
          unidadeMedida: "mm",
          x: Math.max(20, Math.floor(dimensoes.larguraUtilMm / 2) - 35),
          y: 60,
          larguraBarraIndividualMm: 12.7,
          espessuraBarraMm: 3.175,
          espacamentoEntreBarrasMm: 12,
          larguraTroncoMm: 65,
          alturaMm: Math.min(dimensoes.alturaUtilMm - 100, 360),
          espacamentoDerivacoesMm: 45,
          larguraDerivacaoMm: 12,
          espessuraDerivacaoMm: 2,
          comprimentoDerivacaoMm: 35,
          derivacoes: [
            { id: "d1", yOffsetMm: 45, fase: "R", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d2", yOffsetMm: 90, fase: "S", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d3", yOffsetMm: 135, fase: "T", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d4", yOffsetMm: 180, fase: "R", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d5", yOffsetMm: 225, fase: "S", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d6", yOffsetMm: 270, fase: "T", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
          ],
        };
        setLayout((ant) => ({ ...ant, barramentos: [...ant.barramentos, novoBarramento] }));
        setBarramentoSelecionadoId(novoBarramento.id);
        setElementoSelecionadoId(null);
        setTrilhoSelecionadoId(null);
        setBarramentoNTSelecionadoId(null);
        setCanaletaSelecionadaId(null);
        return;
      }

      let posX = 30;
      let posY = 50;
      let trilhoIdAssociado: string | undefined;

      if (cat.requerTrilhoDin && layout.trilhos.length > 0) {
        const primeiroTrilho = layout.trilhos[0];
        trilhoIdAssociado = primeiroTrilho.id;
        posX = primeiroTrilho.x + 10;
        posY = primeiroTrilho.y - (cat.alturaMm - primeiroTrilho.alturaMm) / 2;

        const ocupados = layout.elementos.filter((e) => e.trilhoId === primeiroTrilho.id);
        if (ocupados.length > 0) {
          const ultimo = ocupados[ocupados.length - 1];
          posX = ultimo.x + ultimo.larguraMm + 2;
        }
      }

      const novoElemento: ElementoQuadro = {
        id: novoId,
        tipo,
        tag: `${cat.categoria.slice(0, 3).toUpperCase()}-${contagemTipo}`,
        descricao: `${cat.nome} ${cat.correntDefaultA ? `${cat.correntDefaultA}A` : ""}`.trim(),
        x: Math.min(dimensoes.larguraUtilMm - cat.larguraMm, Math.max(0, posX)),
        y: Math.min(dimensoes.alturaUtilMm - cat.alturaMm, Math.max(0, posY)),
        larguraMm: cat.larguraMm,
        alturaMm: cat.alturaMm,
        profundidadeMm: cat.profundidadeMm,
        orientacao: cat.orientacao || "vertical",
        trilhoId: trilhoIdAssociado,
        correnteNominal: cat.correntDefaultA,
        curvaDisjuntor: cat.categoria === "disjuntor" ? "C" : undefined,
        polos: (cat.polos ?? (cat.modulosDin as 1 | 2 | 3 | 4)) ?? 1,
        corPersonalizada: cat.corPersonalizada,
      };

      setLayout((ant) => ({
        ...ant,
        elementos: [...ant.elementos, novoElemento],
      }));
      setElementoSelecionadoId(novoId);
      setTrilhoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setBarramentoNTSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    },
    [podeEditar, layout, dimensoes, catalogo],
  );

  function atualizarElemento(id: string, updates: Partial<ElementoQuadro>) {
    setLayout((ant) => ({
      ...ant,
      elementos: ant.elementos.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  }

  function excluirElemento(id: string) {
    setLayout((ant) => ({
      ...ant,
      elementos: ant.elementos.filter((e) => e.id !== id),
    }));
    if (elementoSelecionadoId === id) setElementoSelecionadoId(null);
  }

  function duplicarElemento(id: string) {
    const el = layout.elementos.find((e) => e.id === id);
    if (!el) return;
    const novoId = `${el.tipo}-${Date.now().toString(36)}`;
    const clone: ElementoQuadro = {
      ...el,
      id: novoId,
      tag: `${el.tag}-COPIA`,
      x: Math.min(dimensoes.larguraUtilMm - el.larguraMm, el.x + el.larguraMm + 5),
    };
    setLayout((ant) => ({ ...ant, elementos: [...ant.elementos, clone] }));
    setElementoSelecionadoId(novoId);
  }

  function alternarOrientacaoElemento(id: string) {
    const el = layout.elementos.find((e) => e.id === id);
    if (!el) return;
    const novaOrientacao = el.orientacao === "horizontal" ? "vertical" : "horizontal";
    const novaLargura = el.alturaMm;
    const novaAltura = el.larguraMm;
    atualizarElemento(id, {
      orientacao: novaOrientacao,
      larguraMm: novaLargura,
      alturaMm: novaAltura,
    });
  }

  function excluirTrilho(id: string) {
    setLayout((ant) => ({
      ...ant,
      trilhos: ant.trilhos.filter((t) => t.id !== id),
      elementos: ant.elementos.map((e) => (e.trilhoId === id ? { ...e, trilhoId: undefined } : e)),
    }));
    if (trilhoSelecionadoId === id) setTrilhoSelecionadoId(null);
  }

  function excluirCanaleta(id: string) {
    setLayout((ant) => ({
      ...ant,
      canaletas: ant.canaletas.filter((c) => c.id !== id),
    }));
    if (canaletaSelecionadaId === id) setCanaletaSelecionadaId(null);
  }

  function excluirBarramento(id: string) {
    setLayout((ant) => ({
      ...ant,
      barramentos: ant.barramentos.filter((b) => b.id !== id),
    }));
    if (barramentoSelecionadoId === id) setBarramentoSelecionadoId(null);
  }

  function excluirBarramentoNT(id: string) {
    setLayout((ant) => ({
      ...ant,
      barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).filter((b) => b.id !== id),
    }));
    if (barramentoNTSelecionadoId === id) setBarramentoNTSelecionadoId(null);
  }

  function redistribuirFurosBarramentoNT(barId: string) {
    const bar = (layout.barramentosNeutroTerra || []).find((b) => b.id === barId);
    if (!bar) return;

    const espacamento = bar.espacamentoFurosMm || 14;
    const diamPadrao = bar.diametroFuroPadraoMm || 5;
    const comp = bar.comprimentoMm;
    const isTerra = bar.tipo === "terra";

    const novosFuros: FuroBarramento[] = [];
    let pos = 16;
    let idx = 1;

    while (pos < comp - 12) {
      novosFuros.push({
        id: `f-${Date.now().toString(36)}-${idx}`,
        posicaoMm: pos,
        diametroMm: diamPadrao,
        secaoMaximaMm2: diamPadrao >= 8 ? 35 : diamPadrao >= 6 ? 25 : 16,
        rotulo: `${isTerra ? "PE" : "N"}-${idx}`,
      });
      pos += espacamento;
      idx++;
    }

    setLayout((ant) => ({
      ...ant,
      barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
        b.id === barId ? { ...b, furos: novosFuros } : b,
      ),
    }));
  }

  function adicionarFuroIndividual(barId: string) {
    const bar = (layout.barramentosNeutroTerra || []).find((b) => b.id === barId);
    if (!bar) return;

    const ultFuro = bar.furos[bar.furos.length - 1];
    const novaPos = ultFuro ? ultFuro.posicaoMm + bar.espacamentoFurosMm : 16;
    const isTerra = bar.tipo === "terra";
    const novoNum = bar.furos.length + 1;

    const novoFuro: FuroBarramento = {
      id: `f-${Date.now().toString(36)}-${novoNum}`,
      posicaoMm: Math.min(bar.comprimentoMm - 8, novaPos),
      diametroMm: bar.diametroFuroPadraoMm || 5,
      secaoMaximaMm2: 16,
      rotulo: `${isTerra ? "PE" : "N"}-${novoNum}`,
    };

    setLayout((ant) => ({
      ...ant,
      barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
        b.id === barId ? { ...b, furos: [...b.furos, novoFuro] } : b,
      ),
    }));
  }

  function atualizarFuro(barId: string, furoId: string, updates: Partial<FuroBarramento>) {
    setLayout((ant) => ({
      ...ant,
      barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
        b.id === barId
          ? {
              ...b,
              furos: b.furos.map((f) => (f.id === furoId ? { ...f, ...updates } : f)),
            }
          : b,
      ),
    }));
  }

  function excluirFuro(barId: string, furoId: string) {
    setLayout((ant) => ({
      ...ant,
      barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
        b.id === barId
          ? {
              ...b,
              furos: b.furos.filter((f) => f.id !== furoId),
            }
          : b,
      ),
    }));
  }

  function regenerarDerivacoesBarramento(barId: string) {
    const bar = layout.barramentos.find((b) => b.id === barId);
    if (!bar) return;

    const espacamento = bar.espacamentoDerivacoesMm || 45;
    const larguraDeriv = bar.comprimentoDerivacaoMm || 35;
    const fases = bar.tipo === "trifasico" ? ["R", "S", "T"] : bar.tipo === "tetrapolar" ? ["R", "S", "T", "N"] : bar.tipo === "bifasico" ? ["R", "S"] : ["R"];

    const novasDerivacoes: DerivacaoBarramento[] = [];
    let yAtual = espacamento;
    let idx = 0;

    while (yAtual < bar.alturaMm - 20) {
      const fase = fases[idx % fases.length] as "R" | "S" | "T" | "N";
      novasDerivacoes.push({
        id: `der-${Date.now().toString(36)}-${idx}`,
        yOffsetMm: yAtual,
        fase,
        larguraDerivacaoMm: larguraDeriv,
        lado: "ambos",
        correnteNominalA: Math.round(bar.correnteSuportadaA * 0.4),
      });
      yAtual += espacamento;
      idx++;
    }

    setLayout((ant) => ({
      ...ant,
      barramentos: ant.barramentos.map((b) => (b.id === barId ? { ...b, derivacoes: novasDerivacoes } : b)),
    }));
  }

  function aoIniciarArrasto(
    e: React.MouseEvent,
    id: string,
    tipo: "elemento" | "trilho" | "canaleta" | "barramento" | "barramento_nt",
    itemX: number,
    itemY: number,
  ) {
    if (!podeEditar || e.button !== 0) return;
    e.stopPropagation();

    startDragCoordRef.current = { x: e.clientX, y: e.clientY };

    if (tipo === "elemento") {
      setElementoSelecionadoId(id);
      setTrilhoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setBarramentoNTSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    } else if (tipo === "trilho") {
      setTrilhoSelecionadoId(id);
      setElementoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setBarramentoNTSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    } else if (tipo === "canaleta") {
      setCanaletaSelecionadaId(id);
      setElementoSelecionadoId(null);
      setTrilhoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setBarramentoNTSelecionadoId(null);
    } else if (tipo === "barramento") {
      setBarramentoSelecionadoId(id);
      setElementoSelecionadoId(null);
      setTrilhoSelecionadoId(null);
      setBarramentoNTSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    } else if (tipo === "barramento_nt") {
      setBarramentoNTSelecionadoId(id);
      setElementoSelecionadoId(null);
      setTrilhoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    }

    setArrastandoId(id);
    setArrastandoTipo(tipo);

    const svg = canvasRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    setOffsetArrasto({ x: svgP.x - itemX, y: svgP.y - itemY });
  }

  function aoMoverArrasto(e: React.MouseEvent) {
    if (!arrastandoId || !arrastandoTipo || !podeEditar) return;

    const svg = canvasRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    let novoX = svgP.x - offsetArrasto.x;
    let novoY = svgP.y - offsetArrasto.y;

    if (snapGrid) {
      const step = 5;
      novoX = Math.round(novoX / step) * step;
      novoY = Math.round(novoY / step) * step;
    }

    if (arrastandoTipo === "elemento") {
      const el = layout.elementos.find((item) => item.id === arrastandoId);
      if (!el) return;

      novoX = Math.max(0, Math.min(dimensoes.larguraUtilMm - el.larguraMm, novoX));
      novoY = Math.max(0, Math.min(dimensoes.alturaUtilMm - el.alturaMm, novoY));

      let trilhoEncontrado: string | undefined;
      for (const t of layout.trilhos) {
        if (
          novoX >= t.x - 20 &&
          novoX + el.larguraMm <= t.x + t.larguraMm + 20 &&
          Math.abs(novoY + el.alturaMm / 2 - (t.y + t.alturaMm / 2)) <= 30
        ) {
          trilhoEncontrado = t.id;
          novoY = t.y - (el.alturaMm - t.alturaMm) / 2;
          break;
        }
      }

      setLayout((ant) => ({
        ...ant,
        elementos: ant.elementos.map((item) =>
          item.id === arrastandoId
            ? { ...item, x: novoX, y: novoY, trilhoId: trilhoEncontrado }
            : item,
        ),
      }));
    } else if (arrastandoTipo === "trilho") {
      const t = layout.trilhos.find((item) => item.id === arrastandoId);
      if (!t) return;
      novoX = Math.max(0, Math.min(dimensoes.larguraUtilMm - t.larguraMm, novoX));
      novoY = Math.max(0, Math.min(dimensoes.alturaUtilMm - t.alturaMm, novoY));

      const deltaY = novoY - t.y;
      const deltaX = novoX - t.x;

      setLayout((ant) => ({
        ...ant,
        trilhos: ant.trilhos.map((item) =>
          item.id === arrastandoId ? { ...item, x: novoX, y: novoY } : item,
        ),
        elementos: ant.elementos.map((e) =>
          e.trilhoId === arrastandoId
            ? { ...e, x: e.x + deltaX, y: e.y + deltaY }
            : e,
        ),
      }));
    } else if (arrastandoTipo === "canaleta") {
      const c = layout.canaletas.find((item) => item.id === arrastandoId);
      if (!c) return;
      novoX = Math.max(0, Math.min(dimensoes.larguraUtilMm - c.larguraMm, novoX));
      novoY = Math.max(0, Math.min(dimensoes.alturaUtilMm - c.alturaMm, novoY));
      setLayout((ant) => ({
        ...ant,
        canaletas: ant.canaletas.map((item) =>
          item.id === arrastandoId ? { ...item, x: novoX, y: novoY } : item,
        ),
      }));
    } else if (arrastandoTipo === "barramento") {
      const b = layout.barramentos.find((item) => item.id === arrastandoId);
      if (!b) return;
      novoX = Math.max(0, Math.min(dimensoes.larguraUtilMm - b.larguraTroncoMm, novoX));
      novoY = Math.max(0, Math.min(dimensoes.alturaUtilMm - b.alturaMm, novoY));
      setLayout((ant) => ({
        ...ant,
        barramentos: ant.barramentos.map((item) =>
          item.id === arrastandoId ? { ...item, x: novoX, y: novoY } : item,
        ),
      }));
    } else if (arrastandoTipo === "barramento_nt") {
      const b = (layout.barramentosNeutroTerra || []).find((item) => item.id === arrastandoId);
      if (!b) return;
      const isH = b.orientacao !== "vertical";
      const w = isH ? b.comprimentoMm : b.larguraMm;
      const h = isH ? b.larguraMm : b.comprimentoMm;
      novoX = Math.max(0, Math.min(dimensoes.larguraUtilMm - w, novoX));
      novoY = Math.max(0, Math.min(dimensoes.alturaUtilMm - h, novoY));
      setLayout((ant) => ({
        ...ant,
        barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((item) =>
          item.id === arrastandoId ? { ...item, x: novoX, y: novoY } : item,
        ),
      }));
    }
  }

  function aoFinalizarArrasto() {
    setArrastandoId(null);
    setArrastandoTipo(null);
  }

  async function salvar() {
    if (!podeEditar) return;
    try {
      setSalvando(true);
      setErroMsg(null);
      setSucessoMsg(null);

      const res = await salvarQuadroEletrico({
        id: quadro.id,
        obraId,
        tag: tag.trim(),
        nome: nome.trim() || null,
        tipoQuadro: quadro.tipo_quadro,
        tensaoNominal: quadro.tensao_nominal || "220/380V",
        correnteNominal: quadro.corrente_nominal || 63,
        correnteCurtoKa: 10,
        grauProtecao: quadro.grau_protecao || "IP54",
        materialCaixa: quadro.material_caixa || "Aço tratado com pintura eletrostática",
        larguraMm: dimensoes.larguraMm,
        alturaMm: dimensoes.alturaMm,
        profundidadeMm: dimensoes.profundidadeMm,
        larguraUtilMm: dimensoes.larguraUtilMm,
        alturaUtilMm: dimensoes.alturaUtilMm,
        margemLateralMm: dimensoes.margemLateralMm,
        margemTopoMm: dimensoes.margemTopoMm,
        layout,
        circuitosVinculados: circuitos,
      });

      if (res.erro) {
        setErroMsg(res.erro);
      } else {
        setSucessoMsg("Quadro elétrico salvo com sucesso!");
        setTimeout(() => setSucessoMsg(null), 3000);
      }
    } catch {
      setErroMsg("Erro ao salvar o quadro elétrico.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTemplate(nomeTemplate: string, descTemplate: string) {
    const res = await salvarQuadroComoTemplate({
      quadroId: quadro.id,
      nome: nomeTemplate,
      descricao: descTemplate,
    });
    if (res.erro) throw new Error(res.erro);
    setSucessoMsg("Template salvo na biblioteca com sucesso!");
    setTimeout(() => setSucessoMsg(null), 3000);
  }

  const materiais = gerarListaMateriaisQuadro(layout, {
    tag,
    nome,
    tipoQuadro: quadro.tipo_quadro,
    larguraMm: dimensoes.larguraMm,
    alturaMm: dimensoes.alturaMm,
    profundidadeMm: dimensoes.profundidadeMm,
    grauProtecao: quadro.grau_protecao,
  });

  const margemBaseEfetiva = dimensoes.margemBaseMm ?? dimensoes.margemTopoMm;
  const margemDireitaEfetiva = dimensoes.margemDireitaMm ?? dimensoes.margemLateralMm;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden bg-superficie-100">
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-white border-b border-borda shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/obras/${obraId}/quadros`}
            className="p-1.5 rounded-lg text-superficie-500 hover:text-superficie-900 hover:bg-superficie-100 transition-colors"
            title="Voltar para lista de quadros"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                disabled={!podeEditar}
                className="font-bold text-base text-superficie-900 bg-transparent border-b border-transparent hover:border-borda focus:border-azul-500 focus:outline-none px-1 py-0.5 max-w-[140px]"
                title="Tag do quadro"
              />
              <span className="text-superficie-300">|</span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Descrição do quadro..."
                disabled={!podeEditar}
                className="text-sm text-superficie-600 bg-transparent border-b border-transparent hover:border-borda focus:border-azul-500 focus:outline-none px-1 py-0.5 truncate max-w-[200px] sm:max-w-xs"
                title="Nome amigável"
              />
            </div>
            <p className="text-[11px] text-superficie-500 px-1">
              {obraNome} · {dimensoes.larguraMm}×{dimensoes.alturaMm}×{dimensoes.profundidadeMm}mm (Útil: {dimensoes.larguraUtilMm}×{dimensoes.alturaUtilMm}mm)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-superficie-100 p-0.5 rounded-lg border border-borda text-xs">
            <button
              type="button"
              onClick={() => setModoVisualizacao("2d")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                modoVisualizacao === "2d"
                  ? "bg-white text-azul-700 shadow-sm"
                  : "text-superficie-600 hover:text-superficie-900"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              2D (CAD / Diagrama)
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao("3d")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                modoVisualizacao === "3d"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-superficie-600 hover:text-superficie-900"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              3D (Isométrica)
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs">
            {validacao.valido ? (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" /> Layout NBR Válido
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full cursor-help"
                title={validacao.erros.join("\n")}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {validacao.erros.length} alerta(s)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {modoVisualizacao === "2d" && (
            <div className="flex items-center rounded-lg border border-borda bg-white p-0.5 text-superficie-600 mr-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                className="p-1 rounded hover:bg-superficie-100"
                title="Diminuir Zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs px-1.5 font-mono select-none">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(1))))}
                className="p-1 rounded hover:bg-superficie-100"
                title="Aumentar Zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1 rounded hover:bg-superficie-100 text-[10px] font-semibold px-1.5"
                title="Resetar Zoom"
              >
                100%
              </button>
            </div>
          )}

          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            onClick={() => setModalDimensoesAberto(true)}
            title="Editar dimensões e 4 margens do quadro"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Dimensões & Margens</span>
          </Botao>

          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            onClick={() => setModalBibliotecaAberto(true)}
            title="Gerenciar catálogo de componentes"
          >
            <FolderCog className="h-4 w-4" />
            <span className="hidden sm:inline">Biblioteca</span>
          </Botao>

          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            onClick={() => setModalMateriaisAberto(true)}
            title="Ver lista de componentes e materiais (BOM)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Materiais</span>
          </Botao>

          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            onClick={() => setModalTemplateAberto(true)}
            title="Salvar layout como template reutilizável"
          >
            <BookmarkPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Template</span>
          </Botao>

          {podeEditar && (
            <Botao
              type="button"
              variante="primario"
              tamanho="sm"
              onClick={salvar}
              carregando={salvando}
            >
              <Save className="h-4 w-4" />
              Salvar
            </Botao>
          )}
        </div>
      </div>

      {sucessoMsg && (
        <div className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-sm shrink-0">
          {sucessoMsg}
        </div>
      )}
      {erroMsg && (
        <div className="bg-red-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-sm shrink-0">
          {erroMsg}
        </div>
      )}

      {modoVisualizacao === "3d" ? (
        <VisualizadorQuadro3D
          quadro={{
            tag,
            nome,
            tipo_quadro: quadro.tipo_quadro,
            corrente_nominal: quadro.corrente_nominal,
            tensao_nominal: quadro.tensao_nominal,
            grau_protecao: quadro.grau_protecao,
          }}
          dimensoes={dimensoes}
          layout={layout}
          catalogo={catalogo}
        />
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-64 sm:w-72 bg-white border-r border-borda flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b border-borda">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                  Biblioteca de Componentes
                </h3>
                <button
                  type="button"
                  onClick={() => setModalBibliotecaAberto(true)}
                  className="p-1 rounded hover:bg-superficie-100 text-azul-600 font-medium text-[11px] flex items-center gap-1"
                  title="Gerenciar e adicionar novos componentes"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Gerenciar
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 bg-superficie-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva("disjuntor")}
                  className={`py-1 rounded font-medium transition-colors ${
                    categoriaAtiva === "disjuntor"
                      ? "bg-white text-azul-700 shadow-sm"
                      : "text-superficie-600 hover:text-superficie-900"
                  }`}
                >
                  Disjuntores
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva("protecao")}
                  className={`py-1 rounded font-medium transition-colors ${
                    categoriaAtiva === "protecao"
                      ? "bg-white text-azul-700 shadow-sm"
                      : "text-superficie-600 hover:text-superficie-900"
                  }`}
                >
                  DR & DPS
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva("estrutura")}
                  className={`py-1 rounded font-medium transition-colors ${
                    categoriaAtiva === "estrutura"
                      ? "bg-white text-azul-700 shadow-sm"
                      : "text-superficie-600 hover:text-superficie-900"
                  }`}
                >
                  Trilhos/Barra
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {Object.entries(catalogo)
                .filter(([, cat]) => {
                  if (categoriaAtiva === "disjuntor") return cat.categoria === "disjuntor";
                  if (categoriaAtiva === "protecao") return cat.categoria === "protecao" || cat.categoria === "conexao";
                  return cat.categoria === "estrutura" || cat.categoria === "barramento" || cat.categoria === "outros";
                })
                .map(([chave, cat]) => (
                  <div
                    key={chave}
                    className="rounded-lg border border-borda p-2.5 bg-white hover:border-azul-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-superficie-900 group-hover:text-azul-600 transition-colors truncate">
                            {cat.nome}
                          </p>
                          {cat.personalizado && (
                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.2 rounded font-medium">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-superficie-500 mt-0.5 leading-tight">
                          {cat.larguraMm}×{cat.alturaMm}×{cat.profundidadeMm}mm
                          {cat.modulosDin ? ` (${cat.modulosDin}M DIN)` : ""}
                        </p>
                      </div>
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => adicionarComponente(chave as TipoComponenteQuadro)}
                          className="p-1.5 rounded-md bg-azul-50 text-azul-700 hover:bg-azul-600 hover:text-white transition-colors shrink-0"
                          title="Adicionar ao quadro"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-superficie-400 font-mono">
                      <span>{cat.normaReferencia.split("/")[0]}</span>
                      {cat.correntDefaultA && <span>In: {cat.correntDefaultA}A</span>}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div
            className="flex-1 bg-superficie-200/70 overflow-auto p-8 flex items-center justify-center select-none"
            onMouseMove={aoMoverArrasto}
            onMouseUp={aoFinalizarArrasto}
            onMouseLeave={aoFinalizarArrasto}
          >
            <div
              className="transition-transform origin-center shadow-2xl rounded-xl bg-slate-300 border-4 border-slate-400 relative flex flex-col justify-start"
              style={{
                transform: `scale(${zoom})`,
                width: `${dimensoes.larguraMm}px`,
                height: `${dimensoes.alturaMm}px`,
                boxSizing: "content-box",
              }}
            >
              <div className="absolute top-1.5 left-3 z-10 text-[10px] font-bold text-slate-700 tracking-wider uppercase flex items-center gap-2 pointer-events-none">
                <span>{quadro.tipo_quadro} {tag}</span>
                <span className="text-slate-500 font-normal">
                  Invólucro: {dimensoes.larguraMm}×{dimensoes.alturaMm}×{dimensoes.profundidadeMm}mm
                </span>
              </div>

              <div
                className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-500 bg-slate-200/80 px-1 rounded pointer-events-none"
                title="Margem Superior"
              >
                Topo: {dimensoes.margemTopoMm}mm
              </div>
              <div
                className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-500 bg-slate-200/80 px-1 rounded pointer-events-none"
                title="Margem Inferior"
              >
                Base: {margemBaseEfetiva}mm
              </div>
              <div
                className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 bg-slate-200/80 px-1 rounded pointer-events-none -rotate-90 origin-center"
                title="Margem Esquerda"
              >
                Esq: {dimensoes.margemLateralMm}mm
              </div>
              <div
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 bg-slate-200/80 px-1 rounded pointer-events-none rotate-90 origin-center"
                title="Margem Direita"
              >
                Dir: {margemDireitaEfetiva}mm
              </div>

              <div
                id="chapa-background"
                className="absolute bg-amber-100/90 rounded-md border-2 border-dashed border-amber-600/60 shadow-inner overflow-hidden"
                style={{
                  top: `${dimensoes.margemTopoMm}px`,
                  left: `${dimensoes.margemLateralMm}px`,
                  width: `${dimensoes.larguraUtilMm}px`,
                  height: `${dimensoes.alturaUtilMm}px`,
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget || (e.target as HTMLElement).id === "chapa-background") {
                    setElementoSelecionadoId(null);
                    setTrilhoSelecionadoId(null);
                    setBarramentoSelecionadoId(null);
                    setBarramentoNTSelecionadoId(null);
                    setCanaletaSelecionadaId(null);
                  }
                }}
              >
                <div
                  className="absolute inset-0 opacity-25 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, #b45309 1px, transparent 1px)`,
                    backgroundSize: "17.5px 17.5px",
                  }}
                />

                <svg
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  viewBox={`0 0 ${dimensoes.larguraUtilMm} ${dimensoes.alturaUtilMm}`}
                  onClick={(e) => {
                    if (e.target === canvasRef.current) {
                      setElementoSelecionadoId(null);
                      setTrilhoSelecionadoId(null);
                      setBarramentoSelecionadoId(null);
                      setBarramentoNTSelecionadoId(null);
                      setCanaletaSelecionadaId(null);
                    }
                  }}
                >
                  {layout.trilhos.map((t) => {
                    const selecionado = t.id === trilhoSelecionadoId;
                    const isVertical = t.orientacao === "vertical" || t.alturaMm > t.larguraMm;
                    const modulos = Math.floor((isVertical ? t.alturaMm : t.larguraMm) / MODULO_DIN_MM);

                    return (
                      <g
                        key={t.id}
                        onMouseDown={(e) => aoIniciarArrasto(e, t.id, "trilho", t.x, t.y)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrilhoSelecionadoId(t.id);
                          setElementoSelecionadoId(null);
                          setBarramentoSelecionadoId(null);
                          setBarramentoNTSelecionadoId(null);
                          setCanaletaSelecionadaId(null);
                        }}
                        className="cursor-move"
                      >
                        <rect
                          x={t.x}
                          y={t.y}
                          width={t.larguraMm}
                          height={t.alturaMm}
                          rx={2}
                          fill="#cbd5e1"
                          stroke={selecionado ? "#2563eb" : "#94a3b8"}
                          strokeWidth={selecionado ? 2.5 : 1}
                        />

                        {isVertical ? (
                          <>
                            {Array.from({ length: Math.floor(t.alturaMm / 35) }).map((_, i) => (
                              <rect
                                key={i}
                                x={t.x + 12}
                                y={t.y + 10 + i * 35}
                                width={11}
                                height={15}
                                rx={3}
                                fill="#f8fafc"
                                stroke="#94a3b8"
                                strokeWidth={0.5}
                              />
                            ))}
                            {Array.from({ length: modulos }).map((_, m) => (
                              <line
                                key={m}
                                x1={t.x + t.larguraMm - 4}
                                y1={t.y + m * MODULO_DIN_MM}
                                x2={t.x + t.larguraMm}
                                y2={t.y + m * MODULO_DIN_MM}
                                stroke="#64748b"
                                strokeWidth={1}
                              />
                            ))}
                          </>
                        ) : (
                          <>
                            {Array.from({ length: Math.floor(t.larguraMm / 35) }).map((_, i) => (
                              <rect
                                key={i}
                                x={t.x + 10 + i * 35}
                                y={t.y + 12}
                                width={15}
                                height={11}
                                rx={3}
                                fill="#f8fafc"
                                stroke="#94a3b8"
                                strokeWidth={0.5}
                              />
                            ))}
                            {Array.from({ length: modulos }).map((_, m) => (
                              <line
                                key={m}
                                x1={t.x + m * MODULO_DIN_MM}
                                y1={t.y + t.alturaMm - 4}
                                x2={t.x + m * MODULO_DIN_MM}
                                y2={t.y + t.alturaMm}
                                stroke="#64748b"
                                strokeWidth={1}
                              />
                            ))}
                          </>
                        )}

                        <text
                          x={t.x + 4}
                          y={t.y - 4}
                          fontSize="9"
                          fill="#475569"
                          fontWeight="600"
                        >
                          {t.tag} ({modulos}M DIN)
                        </text>
                      </g>
                    );
                  })}

                  {layout.canaletas.map((c) => {
                    const selecionado = c.id === canaletaSelecionadaId;
                    return (
                      <g
                        key={c.id}
                        onMouseDown={(e) => aoIniciarArrasto(e, c.id, "canaleta", c.x, c.y)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCanaletaSelecionadaId(c.id);
                          setElementoSelecionadoId(null);
                          setTrilhoSelecionadoId(null);
                          setBarramentoSelecionadoId(null);
                          setBarramentoNTSelecionadoId(null);
                        }}
                        className="cursor-move"
                      >
                        <rect
                          x={c.x}
                          y={c.y}
                          width={c.larguraMm}
                          height={c.alturaMm}
                          rx={2}
                          fill="#e2e8f0"
                          stroke={selecionado ? "#2563eb" : "#94a3b8"}
                          strokeWidth={selecionado ? 2.5 : 1}
                          strokeDasharray={c.orientacao === "horizontal" ? "4 2" : "2 4"}
                        />
                        <text
                          x={c.x + 3}
                          y={c.y + 12}
                          fontSize="8"
                          fill="#64748b"
                          fontWeight="500"
                        >
                          {c.tag}
                        </text>
                      </g>
                    );
                  })}

                  {(layout.barramentosNeutroTerra || []).map((bar) => {
                    const selecionado = bar.id === barramentoNTSelecionadoId;
                    const isH = bar.orientacao !== "vertical";
                    const w = isH ? bar.comprimentoMm : bar.larguraMm;
                    const h = isH ? bar.larguraMm : bar.comprimentoMm;
                    const isTerra = bar.tipo === "terra";
                    const corBase = isTerra ? "#84cc16" : "#0284c7";
                    const corBorda = isTerra ? "#4d7c0f" : "#0369a1";

                    return (
                      <g
                        key={bar.id}
                        onMouseDown={(e) => aoIniciarArrasto(e, bar.id, "barramento_nt", bar.x, bar.y)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBarramentoNTSelecionadoId(bar.id);
                          setElementoSelecionadoId(null);
                          setTrilhoSelecionadoId(null);
                          setBarramentoSelecionadoId(null);
                          setCanaletaSelecionadaId(null);
                        }}
                        className="cursor-move"
                      >
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={w}
                          height={h}
                          rx={3}
                          fill={bar.material === "latao" ? "#f59e0b" : "#c2410c"}
                          stroke={selecionado ? "#2563eb" : "#78350f"}
                          strokeWidth={selecionado ? 2.5 : 1}
                        />

                        {isH ? (
                          <>
                            <rect x={bar.x} y={bar.y} width={12} height={h} rx={2} fill={corBase} stroke={corBorda} strokeWidth={0.5} />
                            <rect x={bar.x + w - 12} y={bar.y} width={12} height={h} rx={2} fill={corBase} stroke={corBorda} strokeWidth={0.5} />
                          </>
                        ) : (
                          <>
                            <rect x={bar.x} y={bar.y} width={w} height={12} rx={2} fill={corBase} stroke={corBorda} strokeWidth={0.5} />
                            <rect x={bar.x} y={bar.y + h - 12} width={w} height={12} rx={2} fill={corBase} stroke={corBorda} strokeWidth={0.5} />
                          </>
                        )}

                        {bar.furos.map((furo) => {
                          const furoX = isH ? bar.x + furo.posicaoMm : bar.x + w / 2;
                          const furoY = isH ? bar.y + h / 2 : bar.y + furo.posicaoMm;
                          const raio = (furo.diametroMm || 5) / 2;
                          const temCircuito = Boolean(furo.circuitoConectadoNome);

                          return (
                            <g key={furo.id}>
                              <circle
                                cx={furoX}
                                cy={furoY}
                                r={raio}
                                fill={temCircuito ? corBase : "#1e293b"}
                                stroke="#451a03"
                                strokeWidth={0.7}
                              />
                              <line
                                x1={furoX - raio * 0.6}
                                y1={furoY}
                                x2={furoX + raio * 0.6}
                                y2={furoY}
                                stroke="#ffffff"
                                strokeWidth={0.6}
                              />
                              {temCircuito && (
                                <g transform={`translate(${furoX}, ${furoY + (isH ? 12 : 0)})`}>
                                  <rect
                                    x={-18}
                                    y={-5}
                                    width={36}
                                    height={10}
                                    rx={2}
                                    fill={corBase}
                                    stroke={corBorda}
                                    strokeWidth={0.5}
                                  />
                                  <text
                                    x={0}
                                    y={3}
                                    fontSize="7"
                                    fill="#ffffff"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {furo.circuitoConectadoNome}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}

                        <text
                          x={bar.x + w / 2}
                          y={bar.y - 4}
                          fontSize="9"
                          fill={isTerra ? "#4d7c0f" : "#0369a1"}
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {bar.tag} ({bar.furos.length} furos Ø{bar.diametroFuroPadraoMm}mm)
                        </text>
                      </g>
                    );
                  })}

                  {layout.barramentos.map((bar) => {
                    const selecionado = bar.id === barramentoSelecionadoId;
                    const numBarras = bar.tipo === "trifasico" ? 3 : bar.tipo === "tetrapolar" ? 4 : bar.tipo === "bifasico" ? 2 : 1;
                    const larguraBarra = bar.larguraBarraIndividualMm || Math.max(10, Math.floor(bar.larguraTroncoMm / (numBarras * 1.4)));
                    const espacamento = bar.espacamentoEntreBarrasMm || 12;
                    const larguraTotalBarras = numBarras * larguraBarra + (numBarras - 1) * espacamento;

                    const fasesRotulos = bar.tipo === "tetrapolar" ? ["R", "S", "T", "N"] : bar.tipo === "trifasico" ? ["R", "S", "T"] : ["R", "S"];
                    const fasesCores = ["#ef4444", "#eab308", "#3b82f6", "#10b981"];

                    return (
                      <g
                        key={bar.id}
                        onMouseDown={(e) => aoIniciarArrasto(e, bar.id, "barramento", bar.x, bar.y)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBarramentoSelecionadoId(bar.id);
                          setElementoSelecionadoId(null);
                          setTrilhoSelecionadoId(null);
                          setBarramentoNTSelecionadoId(null);
                          setCanaletaSelecionadaId(null);
                        }}
                        className="cursor-move"
                      >
                        <rect
                          x={bar.x - 4}
                          y={bar.y - 4}
                          width={Math.max(bar.larguraTroncoMm, larguraTotalBarras) + 8}
                          height={bar.alturaMm + 8}
                          rx={4}
                          fill="#fef3c7"
                          fillOpacity={0.6}
                          stroke={selecionado ? "#2563eb" : "#f59e0b"}
                          strokeWidth={selecionado ? 2.5 : 1}
                          strokeDasharray="3 3"
                        />

                        {Array.from({ length: numBarras }).map((_, bIdx) => {
                          const barraX = bar.x + bIdx * (larguraBarra + espacamento);
                          const corFase = fasesCores[bIdx % fasesCores.length];
                          const rotuloFase = fasesRotulos[bIdx % fasesRotulos.length];

                          return (
                            <g key={bIdx}>
                              <rect
                                x={barraX}
                                y={bar.y}
                                width={larguraBarra}
                                height={bar.alturaMm}
                                rx={2}
                                fill="#c2410c"
                                stroke="#7c2d12"
                                strokeWidth={1}
                              />
                              <rect
                                x={barraX + 1}
                                y={bar.y + 4}
                                width={larguraBarra - 2}
                                height={14}
                                rx={2}
                                fill={corFase}
                              />
                              <text
                                x={barraX + larguraBarra / 2}
                                y={bar.y + 14}
                                fontSize="9"
                                fill="#ffffff"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {rotuloFase}
                              </text>
                            </g>
                          );
                        })}

                        {bar.derivacoes.map((der) => {
                          const corFase =
                            der.fase === "R"
                              ? "#ef4444"
                              : der.fase === "S"
                                ? "#eab308"
                                : der.fase === "T"
                                  ? "#3b82f6"
                                  : "#10b981";

                          const compDeriv = der.larguraDerivacaoMm || 35;
                          const espessuraDeriv = der.espessuraDerivacaoMm || 10;

                          return (
                            <g key={der.id}>
                              <rect
                                x={bar.x - compDeriv}
                                y={bar.y + der.yOffsetMm}
                                width={Math.max(bar.larguraTroncoMm, larguraTotalBarras) + compDeriv * 2}
                                height={espessuraDeriv}
                                rx={2}
                                fill={corFase}
                                stroke="#451a03"
                                strokeWidth={0.5}
                              />
                              <text
                                x={bar.x + larguraTotalBarras / 2}
                                y={bar.y + der.yOffsetMm + espessuraDeriv - 2}
                                fontSize="8"
                                fill="#ffffff"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {der.fase} ({der.correnteNominalA}A)
                              </text>
                            </g>
                          );
                        })}

                        <text
                          x={bar.x + larguraTotalBarras / 2}
                          y={bar.y - 8}
                          fontSize="9"
                          fill="#92400e"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {bar.tag} ({bar.correnteSuportadaA}A · {numBarras} barras)
                        </text>
                      </g>
                    );
                  })}

                  {layout.elementos.map((el) => {
                    const selecionado = el.id === elementoSelecionadoId;
                    const cat = catalogo[el.tipo] || COMPONENTES_CATALOGO_PADRAO[el.tipo];

                    let corFundo = "#ffffff";
                    let corBorda = "#64748b";
                    if (el.tipo.startsWith("disjuntor_caixa_moldada")) {
                      corFundo = "#1e293b";
                      corBorda = "#0f172a";
                    } else if (el.tipo.startsWith("idr")) {
                      corFundo = "#f8fafc";
                      corBorda = "#0284c7";
                    } else if (el.tipo.startsWith("dps")) {
                      corFundo = "#fef2f2";
                      corBorda = "#ef4444";
                    } else if (el.tipo === "borne_terra") {
                      corFundo = "#bef264";
                      corBorda = "#65a30d";
                    } else if (el.tipo === "borne_neutro") {
                      corFundo = "#bfdbfe";
                      corBorda = "#2563eb";
                    }

                    return (
                      <g
                        key={el.id}
                        onMouseDown={(e) => aoIniciarArrasto(e, el.id, "elemento", el.x, el.y)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setElementoSelecionadoId(el.id);
                          setTrilhoSelecionadoId(null);
                          setBarramentoSelecionadoId(null);
                          setBarramentoNTSelecionadoId(null);
                          setCanaletaSelecionadaId(null);
                        }}
                        className="cursor-pointer group"
                      >
                        <rect
                          x={el.x}
                          y={el.y}
                          width={el.larguraMm}
                          height={el.alturaMm}
                          rx={3}
                          fill={el.corPersonalizada || corFundo}
                          stroke={selecionado ? "#2563eb" : corBorda}
                          strokeWidth={selecionado ? 2.5 : 1}
                          filter="drop-shadow(0 2px 3px rgba(0,0,0,0.1))"
                        />

                        {cat?.categoria === "disjuntor" && (
                          <rect
                            x={el.x + el.larguraMm / 2 - 4}
                            y={el.y + el.alturaMm / 2 - 10}
                            width={8}
                            height={20}
                            rx={2}
                            fill={el.tipo.includes("caixa_moldada") ? "#ef4444" : "#0f172a"}
                          />
                        )}

                        {el.tipo.startsWith("idr") && (
                          <rect
                            x={el.x + 4}
                            y={el.y + el.alturaMm / 2 - 8}
                            width={8}
                            height={8}
                            rx={1}
                            fill="#0284c7"
                          />
                        )}

                        <text
                          x={el.x + el.larguraMm / 2}
                          y={el.y + 14}
                          fontSize={el.larguraMm > 25 ? "10" : "8"}
                          fontWeight="bold"
                          fill={el.tipo.includes("caixa_moldada") ? "#ffffff" : "#0f172a"}
                          textAnchor="middle"
                        >
                          {el.tag}
                        </text>

                        {el.correnteNominal && (
                          <text
                            x={el.x + el.larguraMm / 2}
                            y={el.y + el.alturaMm - 8}
                            fontSize={el.larguraMm > 25 ? "9" : "7"}
                            fontWeight="600"
                            fill={el.tipo.includes("caixa_moldada") ? "#93c5fd" : "#2563eb"}
                            textAnchor="middle"
                          >
                            {el.curvaDisjuntor ?? ""}{el.correnteNominal}A
                          </text>
                        )}

                        {el.circuitoAssociadoNome && (
                          <rect
                            x={el.x + 2}
                            y={el.y + 20}
                            width={el.larguraMm - 4}
                            height={10}
                            rx={1}
                            fill="#e0f2fe"
                            stroke="#38bdf8"
                            strokeWidth={0.5}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          <div className="w-72 sm:w-80 bg-white border-l border-borda flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
            {elementoSelecionado ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    Propriedades do Componente
                  </h3>
                  <div className="flex items-center gap-1">
                    {podeEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => alternarOrientacaoElemento(elementoSelecionado.id)}
                          className="p-1 rounded text-superficie-500 hover:text-azul-600 hover:bg-superficie-100"
                          title="Alternar Orientação (Vertical/Horizontal)"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicarElemento(elementoSelecionado.id)}
                          className="p-1 rounded text-superficie-500 hover:text-azul-600 hover:bg-superficie-100"
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirElemento(elementoSelecionado.id)}
                          className="p-1 rounded text-superficie-500 hover:text-perigo hover:bg-superficie-100"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Tag / Identificador
                    </label>
                    <input
                      type="text"
                      value={elementoSelecionado.tag}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { tag: e.target.value })}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-3 py-1.5 text-sm font-semibold text-superficie-900 focus:ring-2 focus:ring-azul-500"
                    />
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Descrição do Componente
                    </label>
                    <input
                      type="text"
                      value={elementoSelecionado.descricao}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { descricao: e.target.value })}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-3 py-1.5 text-xs text-superficie-900 focus:ring-2 focus:ring-azul-500"
                    />
                  </div>

                  <div className="rounded-lg bg-superficie-50 p-2.5 border border-borda space-y-2">
                    <span className="block font-semibold text-superficie-800 text-[11px]">
                      Dimensões Editáveis (mm)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-superficie-500 mb-0.5">Largura</label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={elementoSelecionado.larguraMm}
                          onChange={(e) =>
                            atualizarElemento(elementoSelecionado.id, {
                              larguraMm: Number(e.target.value) || 10,
                            })
                          }
                          disabled={!podeEditar}
                          className="w-full rounded border border-borda px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-superficie-500 mb-0.5">Altura</label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={elementoSelecionado.alturaMm}
                          onChange={(e) =>
                            atualizarElemento(elementoSelecionado.id, {
                              alturaMm: Number(e.target.value) || 10,
                            })
                          }
                          disabled={!podeEditar}
                          className="w-full rounded border border-borda px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-superficie-500 mb-0.5">Profundidade</label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={elementoSelecionado.profundidadeMm}
                          onChange={(e) =>
                            atualizarElemento(elementoSelecionado.id, {
                              profundidadeMm: Number(e.target.value) || 10,
                            })
                          }
                          disabled={!podeEditar}
                          className="w-full rounded border border-borda px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-superficie-700 font-medium mb-1">
                        Orientação
                      </label>
                      <select
                        value={elementoSelecionado.orientacao || "vertical"}
                        onChange={(e) =>
                          atualizarElemento(elementoSelecionado.id, {
                            orientacao: e.target.value as "vertical" | "horizontal",
                          })
                        }
                        disabled={!podeEditar}
                        className="w-full rounded-lg border border-borda px-2 py-1 text-xs text-superficie-900"
                      >
                        <option value="vertical">Vertical</option>
                        <option value="horizontal">Horizontal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-superficie-700 font-medium mb-1">
                        Polos
                      </label>
                      <select
                        value={elementoSelecionado.polos ?? 1}
                        onChange={(e) =>
                          atualizarElemento(elementoSelecionado.id, {
                            polos: Number(e.target.value) as 1 | 2 | 3 | 4,
                          })
                        }
                        disabled={!podeEditar}
                        className="w-full rounded-lg border border-borda px-2 py-1 text-xs text-superficie-900"
                      >
                        <option value={1}>1 Polo (1P)</option>
                        <option value={2}>2 Polos (2P)</option>
                        <option value={3}>3 Polos (3P)</option>
                        <option value={4}>4 Polos (4P)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-superficie-700 font-medium mb-1">
                        Corrente In (A)
                      </label>
                      <input
                        type="number"
                        value={elementoSelecionado.correnteNominal ?? ""}
                        onChange={(e) =>
                          atualizarElemento(elementoSelecionado.id, {
                            correnteNominal: Number(e.target.value) || undefined,
                          })
                        }
                        disabled={!podeEditar}
                        className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs text-superficie-900"
                      />
                    </div>

                    {elementoSelecionado.curvaDisjuntor && (
                      <div>
                        <label className="block text-superficie-700 font-medium mb-1">
                          Curva de Disparo
                        </label>
                        <select
                          value={elementoSelecionado.curvaDisjuntor}
                          onChange={(e) =>
                            atualizarElemento(elementoSelecionado.id, {
                              curvaDisjuntor: e.target.value as "B" | "C" | "D",
                            })
                          }
                          disabled={!podeEditar}
                          className="w-full rounded-lg border border-borda px-2 py-1 text-xs text-superficie-900"
                        >
                          <option value="B">Curva B (Resistivo)</option>
                          <option value="C">Curva C (Geral / Indutivo)</option>
                          <option value="D">Curva D (Motores)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-borda pt-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-superficie-800 font-semibold">
                      <LinkIcon className="h-3.5 w-3.5 text-azul-600" />
                      Circuito Vinculado
                    </div>

                    <select
                      value={elementoSelecionado.circuitoAssociadoId ?? ""}
                      onChange={(e) => {
                        const circId = e.target.value;
                        const c = circuitosDisponiveis.find((item) => item.id === circId);
                        atualizarElemento(elementoSelecionado.id, {
                          circuitoAssociadoId: circId || undefined,
                          circuitoAssociadoNome: c ? c.tag : undefined,
                        });
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                    >
                      <option value="">Nenhum circuito vinculado</option>
                      {circuitosDisponiveis.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.tag} {c.condutor ? `(${c.condutor})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : trilhoSelecionado ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    Trilho DIN TS35
                  </h3>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => excluirTrilho(trilhoSelecionado.id)}
                      className="p-1 rounded text-superficie-500 hover:text-perigo hover:bg-superficie-100"
                      title="Excluir trilho"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Orientação do Trilho
                    </label>
                    <select
                      value={trilhoSelecionado.orientacao || (trilhoSelecionado.alturaMm > trilhoSelecionado.larguraMm ? "vertical" : "horizontal")}
                      onChange={(e) => {
                        const ori = e.target.value as "horizontal" | "vertical";
                        setLayout((ant) => ({
                          ...ant,
                          trilhos: ant.trilhos.map((t) => {
                            if (t.id !== trilhoSelecionado.id) return t;
                            if (ori === "vertical" && t.larguraMm > t.alturaMm) {
                              return { ...t, orientacao: ori, larguraMm: 35, alturaMm: t.larguraMm };
                            }
                            if (ori === "horizontal" && t.alturaMm > t.larguraMm) {
                              return { ...t, orientacao: ori, larguraMm: t.alturaMm, alturaMm: 35 };
                            }
                            return { ...t, orientacao: ori };
                          }),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda bg-white px-2.5 py-1 text-xs text-superficie-900"
                    >
                      <option value="horizontal">Horizontal (Padrão)</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Comprimento do Trilho (mm)
                    </label>
                    <input
                      type="number"
                      value={trilhoSelecionado.orientacao === "vertical" || trilhoSelecionado.alturaMm > trilhoSelecionado.larguraMm ? trilhoSelecionado.alturaMm : trilhoSelecionado.larguraMm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const isV = trilhoSelecionado.orientacao === "vertical" || trilhoSelecionado.alturaMm > trilhoSelecionado.larguraMm;
                        setLayout((ant) => ({
                          ...ant,
                          trilhos: ant.trilhos.map((t) =>
                            t.id === trilhoSelecionado.id
                              ? isV
                                ? { ...t, alturaMm: val }
                                : { ...t, larguraMm: val }
                              : t,
                          ),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs text-superficie-900"
                    />
                  </div>
                  <p className="text-[11px] text-superficie-500">
                    Capacidade: {Math.floor((trilhoSelecionado.orientacao === "vertical" || trilhoSelecionado.alturaMm > trilhoSelecionado.larguraMm ? trilhoSelecionado.alturaMm : trilhoSelecionado.larguraMm) / MODULO_DIN_MM)} módulos de 17.5mm.
                  </p>
                </div>
              </div>
            ) : barramentoNTSelecionado ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    {barramentoNTSelecionado.tipo === "terra" ? "Barramento Terra (PE)" : "Barramento Neutro (N)"}
                  </h3>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => excluirBarramentoNT(barramentoNTSelecionado.id)}
                      className="p-1 rounded text-superficie-500 hover:text-perigo hover:bg-superficie-100"
                      title="Excluir barramento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Identificador / Tag
                    </label>
                    <input
                      type="text"
                      value={barramentoNTSelecionado.tag}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLayout((ant) => ({
                          ...ant,
                          barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
                            b.id === barramentoNTSelecionado.id ? { ...b, tag: val } : b,
                          ),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs font-bold text-superficie-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-superficie-700 font-medium mb-1">
                        Orientação
                      </label>
                      <select
                        value={barramentoNTSelecionado.orientacao}
                        onChange={(e) => {
                          const ori = e.target.value as "horizontal" | "vertical";
                          setLayout((ant) => ({
                            ...ant,
                            barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
                              b.id === barramentoNTSelecionado.id ? { ...b, orientacao: ori } : b,
                            ),
                          }));
                        }}
                        disabled={!podeEditar}
                        className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs"
                      >
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-superficie-700 font-medium mb-1">
                        Comprimento (mm)
                      </label>
                      <input
                        type="number"
                        step={10}
                        value={barramentoNTSelecionado.comprimentoMm}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setLayout((ant) => ({
                            ...ant,
                            barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
                              b.id === barramentoNTSelecionado.id ? { ...b, comprimentoMm: val } : b,
                            ),
                          }));
                        }}
                        disabled={!podeEditar}
                        className="w-full rounded-lg border border-borda px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-superficie-50 p-3 border border-borda space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-superficie-800 text-[11px] uppercase tracking-wider">
                        Distribuição de Furos ({barramentoNTSelecionado.furos.length})
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => redistribuirFurosBarramentoNT(barramentoNTSelecionado.id)}
                          className="text-[10px] bg-azul-600 hover:bg-azul-500 text-white font-semibold px-2 py-0.5 rounded shadow-sm"
                          title="Distribuir furos igualmente pelo comprimento"
                        >
                          Auto-distribuir
                        </button>
                        <button
                          type="button"
                          onClick={() => adicionarFuroIndividual(barramentoNTSelecionado.id)}
                          className="p-1 bg-white border border-borda hover:border-azul-500 text-superficie-700 rounded"
                          title="Adicionar furo individual"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="block text-superficie-500 mb-0.5">Ø Padrão (mm)</label>
                        <select
                          value={barramentoNTSelecionado.diametroFuroPadraoMm || 5}
                          onChange={(e) => {
                            const d = Number(e.target.value);
                            setLayout((ant) => ({
                              ...ant,
                              barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
                                b.id === barramentoNTSelecionado.id
                                  ? {
                                      ...b,
                                      diametroFuroPadraoMm: d,
                                      furos: b.furos.map((f) => ({ ...f, diametroMm: d })),
                                    }
                                  : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-borda bg-white px-2 py-1 text-xs"
                        >
                          <option value={4}>4.0 mm (até 10mm²)</option>
                          <option value={5}>5.0 mm (até 16mm²)</option>
                          <option value={6.5}>6.5 mm (até 25mm²)</option>
                          <option value={8}>8.0 mm (até 35mm²)</option>
                          <option value={10}>10.0 mm (até 50mm²)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-superficie-500 mb-0.5">Espaçamento (mm)</label>
                        <input
                          type="number"
                          step={2}
                          value={barramentoNTSelecionado.espacamentoFurosMm || 14}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLayout((ant) => ({
                              ...ant,
                              barramentosNeutroTerra: (ant.barramentosNeutroTerra || []).map((b) =>
                                b.id === barramentoNTSelecionado.id ? { ...b, espacamentoFurosMm: val } : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-borda bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {barramentoNTSelecionado.furos.map((furo, fIdx) => (
                        <div
                          key={furo.id}
                          className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-borda text-[11px]"
                        >
                          <span className="font-mono font-bold text-superficie-500 w-5 shrink-0 text-center">
                            #{fIdx + 1}
                          </span>

                          <div className="w-16 shrink-0">
                            <input
                              type="number"
                              step={0.5}
                              value={furo.diametroMm}
                              onChange={(e) =>
                                atualizarFuro(barramentoNTSelecionado.id, furo.id, {
                                  diametroMm: Number(e.target.value) || 5,
                                })
                              }
                              title="Diâmetro do furo (mm)"
                              className="w-full rounded border border-borda px-1 py-0.5 text-xs text-center"
                            />
                          </div>

                          <select
                            value={furo.circuitoConectadoId ?? ""}
                            onChange={(e) => {
                              const cId = e.target.value;
                              const c = circuitosDisponiveis.find((item) => item.id === cId);
                              atualizarFuro(barramentoNTSelecionado.id, furo.id, {
                                circuitoConectadoId: cId || undefined,
                                circuitoConectadoNome: c ? c.tag : undefined,
                              });
                            }}
                            className="flex-1 min-w-0 rounded border border-borda bg-white px-1.5 py-0.5 text-[11px] truncate"
                          >
                            <option value="">Livre / Desconectado</option>
                            {circuitosDisponiveis.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.tag} {c.condutor ? `(${c.condutor})` : ""}
                              </option>
                            ))}
                          </select>

                          {podeEditar && (
                            <button
                              type="button"
                              onClick={() => excluirFuro(barramentoNTSelecionado.id, furo.id)}
                              className="p-1 text-superficie-400 hover:text-perigo"
                              title="Remover furo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : canaletaSelecionada ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    Canaleta Perfurada
                  </h3>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => excluirCanaleta(canaletaSelecionada.id)}
                      className="p-1 rounded text-superficie-500 hover:text-perigo hover:bg-superficie-100"
                      title="Excluir canaleta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Tag da Canaleta
                    </label>
                    <input
                      type="text"
                      value={canaletaSelecionada.tag}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLayout((ant) => ({
                          ...ant,
                          canaletas: ant.canaletas.map((c) =>
                            c.id === canaletaSelecionada.id ? { ...c, tag: val } : c,
                          ),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs text-superficie-900"
                    />
                  </div>
                  <p className="text-[11px] text-superficie-500">
                    {canaletaSelecionada.orientacao === "horizontal"
                      ? `Comprimento: ${canaletaSelecionada.larguraMm}mm`
                      : `Altura: ${canaletaSelecionada.alturaMm}mm`}
                  </p>
                </div>
              </div>
            ) : barramentoSelecionado ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    Barramento Espinha de Peixe
                  </h3>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => excluirBarramento(barramentoSelecionado.id)}
                      className="p-1 rounded text-superficie-500 hover:text-perigo hover:bg-superficie-100"
                      title="Excluir barramento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Tipo de Barramento
                    </label>
                    <select
                      value={barramentoSelecionado.tipo}
                      onChange={(e) => {
                        const t = e.target.value as "monofasico" | "bifasico" | "trifasico" | "tetrapolar";
                        setLayout((ant) => ({
                          ...ant,
                          barramentos: ant.barramentos.map((b) =>
                            b.id === barramentoSelecionado.id ? { ...b, tipo: t } : b,
                          ),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs font-semibold text-superficie-900"
                    >
                      <option value="trifasico">Trifásico (3 Barras Paralelas: R, S, T)</option>
                      <option value="tetrapolar">Tetrapolar (4 Barras: 3P + Neutro)</option>
                      <option value="bifasico">Bifásico (2 Barras Paralelas)</option>
                      <option value="monofasico">Monofásico (1 Barra)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Unidade de Dimensões
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLayout((ant) => ({
                            ...ant,
                            barramentos: ant.barramentos.map((b) =>
                              b.id === barramentoSelecionado.id ? { ...b, unidadeMedida: "mm" } : b,
                            ),
                          }));
                        }}
                        className={`py-1 rounded border text-xs font-semibold ${
                          (barramentoSelecionado.unidadeMedida || "mm") === "mm"
                            ? "bg-azul-600 text-white border-azul-600 shadow-sm"
                            : "bg-white text-superficie-700 border-borda"
                        }`}
                      >
                        Milímetros (mm)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLayout((ant) => ({
                            ...ant,
                            barramentos: ant.barramentos.map((b) =>
                              b.id === barramentoSelecionado.id ? { ...b, unidadeMedida: "pol" } : b,
                            ),
                          }));
                        }}
                        className={`py-1 rounded border text-xs font-semibold ${
                          barramentoSelecionado.unidadeMedida === "pol"
                            ? "bg-azul-600 text-white border-azul-600 shadow-sm"
                            : "bg-white text-superficie-700 border-borda"
                        }`}
                      >
                        Polegadas (pol / &quot;)
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-50/70 p-3 border border-amber-200 space-y-2.5">
                    <span className="block font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                      Barramento Principal (Tronco)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-amber-800 mb-0.5">
                          Largura Barra ({barramentoSelecionado.unidadeMedida === "pol" ? "pol" : "mm"})
                        </label>
                        <input
                          type="number"
                          step={barramentoSelecionado.unidadeMedida === "pol" ? 0.05 : 1}
                          value={
                            barramentoSelecionado.unidadeMedida === "pol"
                              ? Number(((barramentoSelecionado.larguraBarraIndividualMm || 12.7) / 25.4).toFixed(3))
                              : barramentoSelecionado.larguraBarraIndividualMm || 12.7
                          }
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const valMm = barramentoSelecionado.unidadeMedida === "pol" ? polegadaParaMm(val) : val;
                            setLayout((ant) => ({
                              ...ant,
                              barramentos: ant.barramentos.map((b) =>
                                b.id === barramentoSelecionado.id
                                  ? { ...b, larguraBarraIndividualMm: valMm }
                                  : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs"
                        />
                        <span className="text-[9px] text-amber-700 font-mono">
                          {mmParaPolegadaTexto(barramentoSelecionado.larguraBarraIndividualMm || 12.7)}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] text-amber-800 mb-0.5">
                          Espaçamento Barras ({barramentoSelecionado.unidadeMedida === "pol" ? "pol" : "mm"})
                        </label>
                        <input
                          type="number"
                          step={barramentoSelecionado.unidadeMedida === "pol" ? 0.05 : 1}
                          value={
                            barramentoSelecionado.unidadeMedida === "pol"
                              ? Number(((barramentoSelecionado.espacamentoEntreBarrasMm || 12) / 25.4).toFixed(3))
                              : barramentoSelecionado.espacamentoEntreBarrasMm || 12
                          }
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const valMm = barramentoSelecionado.unidadeMedida === "pol" ? polegadaParaMm(val) : val;
                            setLayout((ant) => ({
                              ...ant,
                              barramentos: ant.barramentos.map((b) =>
                                b.id === barramentoSelecionado.id
                                  ? { ...b, espacamentoEntreBarrasMm: valMm }
                                  : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs"
                        />
                        <span className="text-[9px] text-amber-700 font-mono">
                          {mmParaPolegadaTexto(barramentoSelecionado.espacamentoEntreBarrasMm || 12)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-amber-800 mb-0.5">
                        Altura / Comprimento Total (mm)
                      </label>
                      <input
                        type="number"
                        step={10}
                        value={barramentoSelecionado.alturaMm}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setLayout((ant) => ({
                            ...ant,
                            barramentos: ant.barramentos.map((b) =>
                              b.id === barramentoSelecionado.id ? { ...b, alturaMm: val } : b,
                            ),
                          }));
                        }}
                        disabled={!podeEditar}
                        className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-sky-50/70 p-3 border border-sky-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-900 text-[11px] uppercase tracking-wider">
                        Derivações Horizontais
                      </span>
                      <button
                        type="button"
                        onClick={() => regenerarDerivacoesBarramento(barramentoSelecionado.id)}
                        className="text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-semibold px-2 py-0.5 rounded shadow-sm"
                        title="Auto-preencher derivações pelo espaçamento"
                      >
                        Auto-gerar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-sky-800 mb-0.5">
                          Espaçamento Vertical (mm)
                        </label>
                        <input
                          type="number"
                          step={5}
                          value={barramentoSelecionado.espacamentoDerivacoesMm || 45}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLayout((ant) => ({
                              ...ant,
                              barramentos: ant.barramentos.map((b) =>
                                b.id === barramentoSelecionado.id
                                  ? { ...b, espacamentoDerivacoesMm: val }
                                  : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-sky-300 bg-white px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-sky-800 mb-0.5">
                          Comprimento da Lâmina (mm)
                        </label>
                        <input
                          type="number"
                          step={5}
                          value={barramentoSelecionado.comprimentoDerivacaoMm || 35}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLayout((ant) => ({
                              ...ant,
                              barramentos: ant.barramentos.map((b) =>
                                b.id === barramentoSelecionado.id
                                  ? { ...b, comprimentoDerivacaoMm: val }
                                  : b,
                              ),
                            }));
                          }}
                          disabled={!podeEditar}
                          className="w-full rounded border border-sky-300 bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-sky-700 font-medium">
                      {barramentoSelecionado.derivacoes.length} derivações horizontais ativas.
                    </p>
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Corrente Nominal Suportada (A)
                    </label>
                    <input
                      type="number"
                      value={barramentoSelecionado.correnteSuportadaA}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLayout((ant) => ({
                          ...ant,
                          barramentos: ant.barramentos.map((b) =>
                            b.id === barramentoSelecionado.id ? { ...b, correnteSuportadaA: val } : b,
                          ),
                        }));
                      }}
                      disabled={!podeEditar}
                      className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs text-superficie-900"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-borda pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500">
                    Resumo do Quadro
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="rounded-lg bg-superficie-50 p-3 space-y-2 border border-borda">
                    <div className="flex justify-between">
                      <span className="text-superficie-500">Total de Componentes:</span>
                      <span className="font-bold text-superficie-900">{layout.elementos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-superficie-500">Trilhos DIN:</span>
                      <span className="font-bold text-superficie-900">{layout.trilhos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-superficie-500">Barramentos Terra / Neutro:</span>
                      <span className="font-bold text-superficie-900">{(layout.barramentosNeutroTerra || []).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-superficie-500">Canaletas de Fiação:</span>
                      <span className="font-bold text-superficie-900">{layout.canaletas.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-superficie-500">Barramentos Espinha de Peixe:</span>
                      <span className="font-bold text-superficie-900">{layout.barramentos.length}</span>
                    </div>
                  </div>

                  <div className="border-t border-borda pt-3 space-y-2">
                    <p className="font-semibold text-superficie-800">Diretrizes NBR 5410 / NBR IEC 61439:</p>
                    <ul className="text-[11px] text-superficie-600 space-y-1 list-disc pl-4">
                      <li>Barramento trifásico com 3 barras paralelas em cobre eletrolítico.</li>
                      <li>Barramentos de Terra e Neutro com furos dimensionados e fixação isolada.</li>
                      <li>Disjuntores e DPS fixados em trilho DIN TS35 horizontal ou vertical.</li>
                      <li>Recuos de margem garantem passagem de cabos e isolamento perimetral.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ModalDimensoesQuadro
        aberto={modalDimensoesAberto}
        aoFechar={() => setModalDimensoesAberto(false)}
        aoSalvar={(novasDimensoes) => setDimensoes(novasDimensoes)}
        valoresIniciais={dimensoes}
      />

      <ModalGerenciadorBiblioteca
        aberto={modalBibliotecaAberto}
        aoFechar={() => setModalBibliotecaAberto(false)}
        catalogo={catalogo}
        aoAtualizarCatalogo={(novoCat) => setCatalogo(novoCat)}
      />

      <ModalListaMateriais
        aberto={modalMateriaisAberto}
        aoFechar={() => setModalMateriaisAberto(false)}
        quadroTag={tag}
        quadroNome={nome}
        materiais={materiais}
      />

      <ModalSalvarTemplate
        aberto={modalTemplateAberto}
        aoFechar={() => setModalTemplateAberto(false)}
        aoConfirmar={salvarTemplate}
        sugestaoNome={`Template ${tag} - ${dimensoes.larguraMm}x${dimensoes.alturaMm}`}
      />
    </div>
  );
}
