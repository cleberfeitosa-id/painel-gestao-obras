"use client";

import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Botao } from "@/components/ui";
import {
  COMPONENTES_CATALOGO_PADRAO,
  MODULO_DIN_MM,
  type ElementoQuadro,
  type TrilhoDIN,
  type CanaletaFiacao,
  type BarramentoEspinhaPeixe,
  type QuadroEletricoLayout,
  type TipoComponenteQuadro,
  type CircuitoVinculado,
} from "@/lib/quadros/tipos";
import {
  validarLayoutQuadro,
  gerarListaMateriaisQuadro,
} from "@/lib/quadros/calculos";
import {
  salvarQuadroEletrico,
  salvarQuadroComoTemplate,
} from "@/app/(protegido)/obras/[id]/quadros/acoes";
import { ModalDimensoesQuadro } from "./modal-dimensoes-quadro";
import { ModalListaMateriais } from "./modal-lista-materiais";
import { ModalSalvarTemplate } from "./modal-salvar-template";

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
  const [dimensoes, setDimensoes] = useState({
    larguraMm: Number(quadro.largura_mm) || 600,
    alturaMm: Number(quadro.altura_mm) || 800,
    profundidadeMm: Number(quadro.profundidade_mm) || 200,
    larguraUtilMm: Number(quadro.largura_util_mm) || 540,
    alturaUtilMm: Number(quadro.altura_util_mm) || 740,
    margemLateralMm: Number(quadro.margem_lateral_mm) || 30,
    margemTopoMm: Number(quadro.margem_topo_mm) || 30,
  });

  const [layout, setLayout] = useState<QuadroEletricoLayout>(() => {
    const l = quadro.layout || {};
    return {
      elementos: l.elementos || [],
      trilhos: l.trilhos || [],
      canaletas: l.canaletas || [],
      barramentos: l.barramentos || [],
    };
  });

  const [circuitos, setCircuitos] = useState<CircuitoVinculado[]>(
    quadro.circuitos_vinculados || [],
  );

  const [elementoSelecionadoId, setElementoSelecionadoId] = useState<string | null>(null);
  const [trilhoSelecionadoId, setTrilhoSelecionadoId] = useState<string | null>(null);
  const [barramentoSelecionadoId, setBarramentoSelecionadoId] = useState<string | null>(null);
  const [canaletaSelecionadaId, setCanaletaSelecionadaId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [snapGrid, setSnapGrid] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const [modalDimensoesAberto, setModalDimensoesAberto] = useState(false);
  const [modalMateriaisAberto, setModalMateriaisAberto] = useState(false);
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("disjuntor");

  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [arrastandoTipo, setArrastandoTipo] = useState<"elemento" | "trilho" | "canaleta" | "barramento" | null>(null);
  const [offsetArrasto, setOffsetArrasto] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<SVGSVGElement>(null);

  const validacao = validarLayoutQuadro(layout, {
    larguraMm: dimensoes.larguraUtilMm,
    alturaMm: dimensoes.alturaUtilMm,
    profundidadeMm: dimensoes.profundidadeMm,
  });

  const elementoSelecionado = layout.elementos.find((e) => e.id === elementoSelecionadoId);
  const trilhoSelecionado = layout.trilhos.find((t) => t.id === trilhoSelecionadoId);
  const barramentoSelecionado = layout.barramentos.find((b) => b.id === barramentoSelecionadoId);
  const canaletaSelecionada = layout.canaletas.find((c) => c.id === canaletaSelecionadaId);

  const adicionarComponente = useCallback(
    (tipo: TipoComponenteQuadro) => {
      if (!podeEditar) return;
      const cat = COMPONENTES_CATALOGO_PADRAO[tipo];
      if (!cat) return;

      const novoId = `${tipo}-${Date.now().toString(36)}`;
      const contagemTipo = layout.elementos.filter((e) => e.tipo === tipo).length + 1;

      if (tipo === "trilho_din") {
        const novoTrilho: TrilhoDIN = {
          id: `trilho-${Date.now().toString(36)}`,
          tag: `TRILHO-${layout.trilhos.length + 1}`,
          x: 20,
          y: Math.min(dimensoes.alturaUtilMm - 60, (layout.trilhos.length + 1) * 120),
          larguraMm: Math.max(150, dimensoes.larguraUtilMm - 40),
          alturaMm: 35,
          profundidadeMm: 7.5,
        };
        setLayout((ant) => ({ ...ant, trilhos: [...ant.trilhos, novoTrilho] }));
        setTrilhoSelecionadoId(novoTrilho.id);
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
        return;
      }

      if (tipo === "barramento_espinha_peixe") {
        const novoBarramento: BarramentoEspinhaPeixe = {
          id: `bar-${Date.now().toString(36)}`,
          tag: `BAR-${layout.barramentos.length + 1}`,
          tipo: "trifasico",
          correnteSuportadaA: 100,
          secaoTroncoMm2: 50,
          material: "cobre_eletrolitico",
          x: Math.max(20, Math.floor(dimensoes.larguraUtilMm / 2) - 30),
          y: 60,
          larguraTroncoMm: 50,
          alturaMm: Math.min(dimensoes.alturaUtilMm - 100, 350),
          derivacoes: [
            { id: "d1", yOffsetMm: 50, fase: "R", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d2", yOffsetMm: 110, fase: "S", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d3", yOffsetMm: 170, fase: "T", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
            { id: "d4", yOffsetMm: 230, fase: "R", larguraDerivacaoMm: 35, lado: "ambos", correnteNominalA: 40 },
          ],
        };
        setLayout((ant) => ({ ...ant, barramentos: [...ant.barramentos, novoBarramento] }));
        setBarramentoSelecionadoId(novoBarramento.id);
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
        trilhoId: trilhoIdAssociado,
        correnteNominal: cat.correntDefaultA,
        curvaDisjuntor: cat.categoria === "disjuntor" ? "C" : undefined,
        polos: (cat.modulosDin as 1 | 2 | 3 | 4) ?? 1,
      };

      setLayout((ant) => ({
        ...ant,
        elementos: [...ant.elementos, novoElemento],
      }));
      setElementoSelecionadoId(novoId);
    },
    [podeEditar, layout, dimensoes],
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

  function aoIniciarArrasto(
    e: React.MouseEvent,
    id: string,
    tipo: "elemento" | "trilho" | "canaleta" | "barramento",
    itemX: number,
    itemY: number,
  ) {
    if (!podeEditar || e.button !== 0) return;
    e.stopPropagation();

    if (tipo === "elemento") {
      setElementoSelecionadoId(id);
      setTrilhoSelecionadoId(null);
      setBarramentoSelecionadoId(null);
      setCanaletaSelecionadaId(null);
    } else if (tipo === "trilho") {
      setTrilhoSelecionadoId(id);
      setElementoSelecionadoId(null);
    } else if (tipo === "canaleta") {
      setCanaletaSelecionadaId(id);
      setElementoSelecionadoId(null);
    } else if (tipo === "barramento") {
      setBarramentoSelecionadoId(id);
      setElementoSelecionadoId(null);
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

        <div className="hidden md:flex items-center gap-2 text-xs">
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

        <div className="flex items-center gap-1.5 shrink-0">
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

          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            onClick={() => setModalDimensoesAberto(true)}
            title="Editar dimensões da chapa útil"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Dimensões</span>
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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-64 sm:w-72 bg-white border-r border-borda flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-borda">
            <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-500 mb-2">
              Biblioteca de Componentes
            </h3>
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
            {Object.entries(COMPONENTES_CATALOGO_PADRAO)
              .filter(([_, cat]) => {
                if (categoriaAtiva === "disjuntor") return cat.categoria === "disjuntor";
                if (categoriaAtiva === "protecao") return cat.categoria === "protecao" || cat.categoria === "conexao";
                return cat.categoria === "estrutura" || cat.categoria === "barramento";
              })
              .map(([chave, cat]) => (
                <div
                  key={chave}
                  className="rounded-lg border border-borda p-2.5 bg-white hover:border-azul-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-superficie-900 group-hover:text-azul-600 transition-colors">
                        {cat.nome}
                      </p>
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
          className="flex-1 bg-superficie-200/70 overflow-auto p-6 flex items-center justify-center select-none"
          onMouseMove={aoMoverArrasto}
          onMouseUp={aoFinalizarArrasto}
          onMouseLeave={aoFinalizarArrasto}
        >
          <div
            className="transition-transform origin-center shadow-2xl rounded-xl bg-white p-6 border-4 border-superficie-400 relative"
            style={{
              transform: `scale(${zoom})`,
              width: `${dimensoes.larguraMm}px`,
              height: `${dimensoes.alturaMm}px`,
            }}
          >
            <div className="absolute top-2 left-4 text-[11px] font-bold text-superficie-500 tracking-wider uppercase flex items-center gap-2">
              <span>{quadro.tipo_quadro} {tag}</span>
              <span className="text-superficie-400 font-normal">
                {dimensoes.larguraMm}mm (L) × {dimensoes.alturaMm}mm (A) × {dimensoes.profundidadeMm}mm (P)
              </span>
            </div>

            <div
              className="relative w-full h-full bg-superficie-100 rounded-lg border-2 border-dashed border-superficie-400 shadow-inner overflow-hidden"
              style={{
                marginTop: `${dimensoes.margemTopoMm}px`,
                marginLeft: `${dimensoes.margemLateralMm}px`,
                width: `${dimensoes.larguraUtilMm}px`,
                height: `${dimensoes.alturaUtilMm}px`,
              }}
              onClick={() => {
                setElementoSelecionadoId(null);
                setTrilhoSelecionadoId(null);
                setBarramentoSelecionadoId(null);
                setCanaletaSelecionadaId(null);
              }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle, #64748b 1px, transparent 1px)`,
                  backgroundSize: "17.5px 17.5px",
                }}
              />

              <svg
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${dimensoes.larguraUtilMm} ${dimensoes.alturaUtilMm}`}
              >
                {layout.trilhos.map((t) => {
                  const selecionado = t.id === trilhoSelecionadoId;
                  const modulos = Math.floor(t.larguraMm / MODULO_DIN_MM);

                  return (
                    <g
                      key={t.id}
                      onMouseDown={(e) => aoIniciarArrasto(e, t.id, "trilho", t.x, t.y)}
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
                        strokeWidth={selecionado ? 2 : 1}
                      />
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
                      <text
                        x={t.x + 4}
                        y={t.y - 4}
                        fontSize="9"
                        fill="#64748b"
                        fontWeight="600"
                      >
                        {t.tag} ({modulos}M)
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
                        strokeWidth={selecionado ? 2 : 1}
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

                {layout.barramentos.map((bar) => {
                  const selecionado = bar.id === barramentoSelecionadoId;
                  return (
                    <g
                      key={bar.id}
                      onMouseDown={(e) => aoIniciarArrasto(e, bar.id, "barramento", bar.x, bar.y)}
                      className="cursor-move"
                    >
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.larguraTroncoMm}
                        height={bar.alturaMm}
                        rx={3}
                        fill="#b45309"
                        stroke={selecionado ? "#2563eb" : "#78350f"}
                        strokeWidth={selecionado ? 2 : 1}
                      />
                      {bar.derivacoes.map((der) => {
                        const corFase =
                          der.fase === "R"
                            ? "#ef4444"
                            : der.fase === "S"
                              ? "#eab308"
                              : der.fase === "T"
                                ? "#3b82f6"
                                : "#3b82f6";
                        return (
                          <g key={der.id}>
                            <rect
                              x={bar.x - der.larguraDerivacaoMm}
                              y={bar.y + der.yOffsetMm}
                              width={bar.larguraTroncoMm + der.larguraDerivacaoMm * 2}
                              height={12}
                              rx={2}
                              fill={corFase}
                              stroke="#451a03"
                              strokeWidth={0.5}
                            />
                            <text
                              x={bar.x + bar.larguraTroncoMm / 2}
                              y={bar.y + der.yOffsetMm + 9}
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
                        x={bar.x + bar.larguraTroncoMm / 2}
                        y={bar.y - 4}
                        fontSize="9"
                        fill="#92400e"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {bar.tag} ({bar.correnteSuportadaA}A)
                      </text>
                    </g>
                  );
                })}

                {layout.elementos.map((el) => {
                  const selecionado = el.id === elementoSelecionadoId;
                  const cat = COMPONENTES_CATALOGO_PADRAO[el.tipo];

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
                        <option value="D">Curva D (Motores / Transformadores)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-superficie-50 p-2.5 rounded-lg border border-borda">
                  <div>
                    <span className="text-[10px] text-superficie-500 block">Largura</span>
                    <span className="font-semibold">{elementoSelecionado.larguraMm} mm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-superficie-500 block">Altura</span>
                    <span className="font-semibold">{elementoSelecionado.alturaMm} mm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-superficie-500 block">Profundidade</span>
                    <span className="font-semibold">{elementoSelecionado.profundidadeMm} mm</span>
                  </div>
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
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-superficie-700 font-medium mb-1">
                    Comprimento do Trilho (mm)
                  </label>
                  <input
                    type="number"
                    value={trilhoSelecionado.larguraMm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLayout((ant) => ({
                        ...ant,
                        trilhos: ant.trilhos.map((t) =>
                          t.id === trilhoSelecionado.id ? { ...t, larguraMm: val } : t,
                        ),
                      }));
                    }}
                    disabled={!podeEditar}
                    className="w-full rounded-lg border border-borda px-2.5 py-1 text-xs text-superficie-900"
                  />
                </div>
                <p className="text-[11px] text-superficie-500">
                  Capacidade: {Math.floor(trilhoSelecionado.larguraMm / MODULO_DIN_MM)} módulos de 17.5mm.
                </p>
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
              <div className="space-y-2 text-xs">
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
              <div className="space-y-2 text-xs">
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
                <p className="text-[11px] text-superficie-500">
                  {barramentoSelecionado.derivacoes.length} derivações configuradas.
                </p>
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
                    <span className="text-superficie-500">Canaletas de Fiação:</span>
                    <span className="font-bold text-superficie-900">{layout.canaletas.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-superficie-500">Barramentos:</span>
                    <span className="font-bold text-superficie-900">{layout.barramentos.length}</span>
                  </div>
                </div>

                <div className="border-t border-borda pt-3 space-y-2">
                  <p className="font-semibold text-superficie-800">Diretrizes NBR 5410 / DIN:</p>
                  <ul className="text-[11px] text-superficie-600 space-y-1 list-disc pl-4">
                    <li>Disjuntores e DPS devem ser fixados em trilho DIN TS35.</li>
                    <li>Deixe folga mínima de 20% para expansão futura.</li>
                    <li>Chapa metálica garante isolamento e aterramento da carcaça.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ModalDimensoesQuadro
        aberto={modalDimensoesAberto}
        aoFechar={() => setModalDimensoesAberto(false)}
        aoSalvar={(novasDimensoes) => setDimensoes(novasDimensoes)}
        valoresIniciais={dimensoes}
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

