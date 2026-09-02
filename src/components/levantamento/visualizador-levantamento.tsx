"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ArrowDownUp,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  FileText,
  Layers,
  MapPin,
  MousePointer2,
  Redo2,
  Ruler,
  Save,
  Scale,
  Settings2,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Botao, Spinner } from "@/components/ui";
import {
  calcularCalibracao,
  distanciaEmPontos,
  pdfParaPercentual,
  telaParaPdf,
  type Calibracao,
} from "@/lib/pdf/coordenadas";
import {
  calcularAreaPoligono,
  calcularDistanciaPontos,
  calcularResumoLevantamento,
  formatarDescricaoTarefaCircuito,
  formatarMetros,
  formatarMetrosQuadrados,
  obterNomeCorCabo,
  rotuloCondutor,
} from "@/lib/levantamento/calculos";
import {
  baixarArquivoTexto,
  gerarCsvLevantamento,
} from "@/lib/levantamento/exportacao";
import {
  CATEGORIAS_PADRAO,
  CONFIG_LEGENDA_PADRAO,
  NIVEIS_PADRAO,
  type CategoriaPredefinicao,
  type ConfigLegenda,
  type ItemLevantamento,
  type MetadadosCabo,
  type Nivel3D,
  type TipoElementoLevantamento,
} from "@/lib/levantamento/tipos";
import {
  obterCalibracoesPlanta,
  salvarCalibracaoDireta,
  salvarLevantamento,
} from "@/app/(protegido)/levantamento/acoes";
import { salvarRascunhoLote } from "@/app/(protegido)/tarefas/acoes";
import { renovarUrlPlanta } from "@/app/(protegido)/obras/[id]/plantas/acoes";
import { Calibragem } from "@/components/plantas/calibragem";
import { LegendaDinamica } from "./legenda-dinamica";
import { ModalConfigCabo, CORES_CIRCUITO_SUGERIDAS } from "./modal-config-cabo";
import { ModalDescidaSubida } from "./modal-descida-subida";
import {
  ModalEditarCircuitosLote,
  type DadosEdicaoLoteCircuito,
} from "./modal-editar-circuitos-lote";
import { GerenciadorNiveisModal } from "./gerenciador-niveis-modal";
import { GerenciadorCategoriasModal } from "./gerenciador-categorias-modal";
import { ModalUploadNovaPlanta } from "./modal-upload-nova-planta";
import { Visualizador3D } from "./visualizador-3d";

const ModalExportarPlanta = dynamic(
  () =>
    import("@/components/plantas/modal-exportar-planta").then(
      (m) => m.ModalExportarPlanta,
    ),
  { ssr: false },
);
import type {
  LevantamentoRow,
  ObraRow,
  PlantaCalibracaoRow,
  PlantaRow,
  PontoPdf,
} from "@/lib/supabase/database.types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type ModoVisualizacao = "2d" | "3d" | "tabelas";

type ModoExibicaoMedidas = "todas" | "sem_circuitos" | "nenhuma";

type FerramentaLevantamento =
  | "navegar"
  | "ponto"
  | "distancia"
  | "tubulacao_cabo"
  | "area"
  | "descida_subida"
  | "descida_subida_lote"
  | "calibrar";

function encontrarPontoSnap(
  ponto: PontoPdf,
  itensExistentes: ItemLevantamento[],
  pontosDesenhoAtuais: PontoPdf[],
  raioSnapPdf = 16,
): PontoPdf {
  let menorDist = raioSnapPdf;
  let pontoEncontrado: PontoPdf | null = null;

  for (const p of pontosDesenhoAtuais) {
    const d = distanciaEmPontos(ponto, p);
    if (d > 0.001 && d < menorDist) {
      menorDist = d;
      pontoEncontrado = p;
    }
  }

  for (const item of itensExistentes) {
    for (const p of item.pontos) {
      const d = distanciaEmPontos(ponto, p);
      if (d < menorDist) {
        menorDist = d;
        pontoEncontrado = p;
      }
    }
  }

  return pontoEncontrado ?? ponto;
}

interface VisualizadorLevantamentoProps {
  obras: ObraRow[];
  plantas: PlantaRow[];
  obraInicialId?: string;
  plantaInicialId?: string;
  paginaInicial?: number;
  levantamentoInicial?: LevantamentoRow | null;
  calibracoesIniciais: PlantaCalibracaoRow[];
  urlPdfInicial: string | null;
  podeEditar: boolean;
}

export function VisualizadorLevantamento({
  obras,
  plantas,
  obraInicialId,
  plantaInicialId,
  paginaInicial = 1,
  levantamentoInicial,
  calibracoesIniciais,
  urlPdfInicial,
  podeEditar,
}: VisualizadorLevantamentoProps) {
  const router = useRouter();
  const [obraSelecionadaId, setObraSelecionadaId] = useState(
    obraInicialId ?? (obras[0]?.id ?? ""),
  );
  const [plantaSelecionadaId, setPlantaSelecionadaId] = useState(
    plantaInicialId ?? (plantas[0]?.id ?? ""),
  );
  const [pagina, setPagina] = useState(paginaInicial);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [urlPdf, setUrlPdf] = useState<string | null>(urlPdfInicial);
  const [calibracoes, setCalibracoes] =
    useState<PlantaCalibracaoRow[]>(calibracoesIniciais);
  const [modo, setModo] = useState<ModoVisualizacao>("2d");
  const [ferramenta, setFerramenta] =
    useState<FerramentaLevantamento>("navegar");
  const [modalExportarAberto, setModalExportarAberto] = useState(false);

  const [levantamentoId, setLevantamentoId] = useState<string | undefined>(
    levantamentoInicial?.id,
  );
  const [nomeLevantamento] = useState(
    levantamentoInicial?.nome ?? "Levantamento Quantitativo",
  );
  const [descricaoLevantamento] = useState(
    levantamentoInicial?.descricao ?? "",
  );

  const [niveis, setNiveis] = useState<Nivel3D[]>(
    Array.isArray(levantamentoInicial?.niveis) &&
      (levantamentoInicial.niveis as unknown as Nivel3D[]).length > 0
      ? (levantamentoInicial.niveis as unknown as Nivel3D[])
      : NIVEIS_PADRAO,
  );

  const [categorias, setCategorias] = useState<CategoriaPredefinicao[]>(() => {
    if (
      Array.isArray(levantamentoInicial?.categorias) &&
      (levantamentoInicial.categorias as unknown as CategoriaPredefinicao[])
        .length > 0
    ) {
      return levantamentoInicial.categorias as unknown as CategoriaPredefinicao[];
    }
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem(
          "painel_levantamento_catalogo_personalizado",
        );
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return CATEGORIAS_PADRAO;
  });

  const [categoriaAtiva, setCategoriaAtiva] = useState(
    categorias[0]?.nome ?? "Elétrica",
  );
  const [elementoAtivo, setElementoAtivo] =
    useState<TipoElementoLevantamento | null>(
      categorias[0]?.elementos[0] ?? null,
    );

  const obterAlturaENivelElemento = useCallback(
    (el?: TipoElementoLevantamento | null) => {
      if (!el) return { altura: 0, nivelId: undefined };
      const nivelObj = el.nivelPadraoId
        ? niveis.find((n) => n.id === el.nivelPadraoId)
        : null;
      const altura =
        el.alturaPadrao !== undefined
          ? el.alturaPadrao
          : (nivelObj?.cota ??
            (el.tipoGeometria === "ponto"
              ? 0.3
              : el.tipoGeometria === "area"
                ? 0.0
                : 2.8));
      return { altura, nivelId: el.nivelPadraoId };
    },
    [niveis],
  );

  async function handleSalvarCategorias(
    novasCategorias: CategoriaPredefinicao[],
  ) {
    setCategorias(novasCategorias);
    try {
      localStorage.setItem(
        "painel_levantamento_catalogo_personalizado",
        JSON.stringify(novasCategorias),
      );
    } catch {}

    if (obraSelecionadaId && plantaSelecionadaId) {
      await salvarLevantamento({
        id: levantamentoId,
        obraId: obraSelecionadaId,
        plantaId: plantaSelecionadaId,
        pagina,
        nome: nomeLevantamento,
        descricao: descricaoLevantamento,
        niveis: JSON.parse(JSON.stringify(niveis)),
        categorias: JSON.parse(JSON.stringify(novasCategorias)),
        itens: JSON.parse(JSON.stringify(itens)),
        configLegenda: JSON.parse(JSON.stringify(configLegenda)),
      });
    }
  }

  async function handleSalvarNiveis(novosNiveis: Nivel3D[]) {
    setNiveis(novosNiveis);
    if (obraSelecionadaId && plantaSelecionadaId) {
      await salvarLevantamento({
        id: levantamentoId,
        obraId: obraSelecionadaId,
        plantaId: plantaSelecionadaId,
        pagina,
        nome: nomeLevantamento,
        descricao: descricaoLevantamento,
        niveis: JSON.parse(JSON.stringify(novosNiveis)),
        categorias: JSON.parse(JSON.stringify(categorias)),
        itens: JSON.parse(JSON.stringify(itens)),
        configLegenda: JSON.parse(JSON.stringify(configLegenda)),
      });
    }
  }

  const [itens, setItens] = useState<ItemLevantamento[]>(
    (levantamentoInicial?.itens as unknown as ItemLevantamento[]) ?? [],
  );

  const getNextNumero = useCallback(
    (subtipo: string) => {
      const itensDoSubtipo = itens.filter((i) => i.subtipo === subtipo);
      return itensDoSubtipo.length + 1;
    },
    [itens],
  );

  const circuitosDisponiveis = useMemo(() => {
    const setCircs = new Set<string>();
    for (const item of itens) {
      if (item.metadadosCabo?.circuito) {
        setCircs.add(item.metadadosCabo.circuito);
      }
    }
    return Array.from(setCircs).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [itens]);

  const [historicoDesfazer, setHistoricoDesfazer] = useState<
    ItemLevantamento[][]
  >([]);
  const [historicoRefazer, setHistoricoRefazer] = useState<
    ItemLevantamento[][]
  >([]);

  const [configLegenda, setConfigLegenda] = useState<ConfigLegenda>(
    (levantamentoInicial?.config_legenda as unknown as ConfigLegenda) ??
      CONFIG_LEGENDA_PADRAO,
  );

  const [configMarcador] = useState({
    raio: 22,
    espessura: 2.5,
    tamanhoFonte: 12,
    corBorda: "#ffffff",
    corTexto: "#ffffff",
  });

  const [pontosCalibracao, setPontosCalibracao] = useState<PontoPdf[]>([]);
  const [calibrando, setCalibrando] = useState(false);

  const [pontosEmDesenho, setPontosEmDesenho] = useState<PontoPdf[]>([]);
  const [pontoSnap, setPontoSnap] = useState<PontoPdf | null>(null);
  const [loteDescidasPontos, setLoteDescidasPontos] = useState<PontoPdf[]>([]);

  const [modalCaboAberto, setModalCaboAberto] = useState(false);
  const [itemCaboEmEdicao, setItemCaboEmEdicao] = useState<ItemLevantamento | null>(null);
  const [modalEditarLoteCircuitosAberto, setModalEditarLoteCircuitosAberto] = useState(false);
  const [pontosAlvoDescidaLote, setPontosAlvoDescidaLote] = useState<ItemLevantamento[]>([]);
  const [metadadosCaboAtivo, setMetadadosCaboAtivo] = useState<MetadadosCabo>({
    circuito: "C1",
    cor: "#eab308",
    tipoCabo: "Cabo Flexível 750V 2.5mm²",
    tipoCondutor: "Cobre",
    nivelId: "forro_teto",
    altura: 2.8,
    fases: [{ nome: "R", cor: "#FFFFFF", quantidade: 1 }],
    condutores: [
      { tipo: "fase", quantidade: 1 },
      { tipo: "neutro", quantidade: 1, cor: "#2563EB" },
      { tipo: "terra", quantidade: 1, cor: "#16A34A" },
    ],
  });

  const [modalDescidaAberto, setModalDescidaAberto] = useState(false);
  const [pontoDescidaPendente, setPontoDescidaPendente] =
    useState<PontoPdf | null>(null);

  const [modalNiveisAberto, setModalNiveisAberto] = useState(false);
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [modalUploadAberto, setModalUploadAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const [escala, setEscala] = useState(1);
  const [dimensoes, setDimensoes] = useState<{
    largura: number;
    altura: number;
  }>({
    largura: 842,
    altura: 595,
  });

  const [canvasPlanta2D, setCanvasPlanta2D] = useState<HTMLCanvasElement | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [arrastandoPan, setArrastandoPan] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<ItemLevantamento | null>(
    null,
  );
  const [abaLateral, setAbaLateral] = useState<"catalogo" | "itens">("catalogo");
  const [itensLoteSelecionados, setItensLoteSelecionados] = useState<string[]>(
    [],
  );
  const [criandoLoteTarefas, setCriandoLoteTarefas] = useState(false);
  const [mensagemLote, setMensagemLote] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);
  const [gruposRecolhidos, setGruposRecolhidos] = useState<string[]>([]);
  const [modoExibicaoMedidas, setModoExibicaoMedidas] =
    useState<ModoExibicaoMedidas>(() => {
      if (typeof window !== "undefined") {
        try {
          const salvo = localStorage.getItem(
            "painel_levantamento_exibicao_medidas",
          );
          if (
            salvo === "todas" ||
            salvo === "sem_circuitos" ||
            salvo === "nenhuma"
          ) {
            return salvo;
          }
        } catch {}
      }
      return "sem_circuitos";
    });

  function alternarExibicaoMedidas(novoModo: ModoExibicaoMedidas) {
    setModoExibicaoMedidas(novoModo);
    try {
      localStorage.setItem(
        "painel_levantamento_exibicao_medidas",
        novoModo,
      );
    } catch {}
  }

  const registrarEstado = useCallback((novosItens: ItemLevantamento[]) => {
    setHistoricoDesfazer((prev) => [...prev.slice(-30), itens]);
    setHistoricoRefazer([]);
    setItens(novosItens);
  }, [itens]);

  function excluirItem(id: string) {
    const novos = itens.filter((i) => i.id !== id);
    registrarEstado(novos);
    setItensLoteSelecionados((prev) => prev.filter((item) => item !== id));
    if (itemSelecionado?.id === id) {
      setItemSelecionado(null);
    }
  }

  function alternarSelecaoItem(id: string) {
    setItensLoteSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function alternarSelecaoGrupo(itensDoGrupo: ItemLevantamento[]) {
    const idsDoGrupo = itensDoGrupo.map((i) => i.id);
    const todosSelecionados = idsDoGrupo.every((id) =>
      itensLoteSelecionados.includes(id),
    );
    if (todosSelecionados) {
      setItensLoteSelecionados((prev) =>
        prev.filter((id) => !idsDoGrupo.includes(id)),
      );
    } else {
      setItensLoteSelecionados((prev) =>
        Array.from(new Set([...prev, ...idsDoGrupo])),
      );
    }
  }

  function alternarSelecionarTodos() {
    if (itensLoteSelecionados.length === itens.length) {
      setItensLoteSelecionados([]);
    } else {
      setItensLoteSelecionados(itens.map((i) => i.id));
    }
  }

  function alternarRecolhimentoGrupo(chave: string) {
    setGruposRecolhidos((prev) =>
      prev.includes(chave)
        ? prev.filter((c) => c !== chave)
        : [...prev, chave],
    );
  }

  function gerarDadosTarefaDeItem(
    item: ItemLevantamento,
    nomeLev: string,
  ) {
    const tipo =
      item.tipo === "tubulacao_cabo"
        ? ("circuito" as const)
        : item.tipo === "distancia"
          ? ("distancia" as const)
          : item.tipo === "area"
            ? ("area" as const)
            : item.tipo === "descida_subida"
              ? ("descida" as const)
              : ("ponto" as const);

    const detalhe: Record<string, unknown> = {
      elemento: item.nome,
      subtipo: item.subtipo,
      categoria: item.categoria,
      altura: item.altura,
      pontos: item.pontos,
      quantidade: 1,
    };

    let tituloSugerido = `Executar ${item.nome}`;
    let descSugerida = `Levantamento: ${nomeLev}\n`;

    if (item.tipo === "distancia") {
      detalhe.comprimento = item.comprimentoReal;
      tituloSugerido = `Instalar ${item.nome}`;
      descSugerida += `Segmento: ${item.nome} (${item.comprimentoReal ? `${item.comprimentoReal.toFixed(2)}m` : ""}). Cota/Altura: ${item.altura ?? 0}m.`;
    } else if (item.tipo === "tubulacao_cabo") {
      detalhe.circuito = item.metadadosCabo?.circuito;
      detalhe.comprimento = item.comprimentoReal;
      detalhe.condutores = item.metadadosCabo?.condutores;
      detalhe.fases = item.metadadosCabo?.fases;
      detalhe.tipoCabo = item.metadadosCabo?.tipoCabo;
      detalhe.tipoCondutor = item.metadadosCabo?.tipoCondutor;
      detalhe.nivelId = item.nivelId;
      detalhe.altura = item.altura;
      detalhe.cor = item.cor || item.metadadosCabo?.cor;
      detalhe.corFaseR = item.metadadosCabo?.corFaseR;
      detalhe.corFaseS = item.metadadosCabo?.corFaseS;
      detalhe.corFaseT = item.metadadosCabo?.corFaseT;
      detalhe.corFase = item.metadadosCabo?.corFase;
      detalhe.observacao = item.metadadosCabo?.observacao || item.observacao;
      tituloSugerido = `Passagem de Cabo - Circuito ${item.metadadosCabo?.circuito ?? ""}`;

      const nivelNome = item.nivelId
        ? niveis.find((n) => n.id === item.nivelId)?.nome
        : undefined;

      descSugerida = formatarDescricaoTarefaCircuito({
        nomeLevantamento: nomeLev,
        circuito: item.metadadosCabo?.circuito,
        tipoCabo: item.metadadosCabo?.tipoCabo,
        tipoCondutor: item.metadadosCabo?.tipoCondutor,
        comprimento: item.comprimentoReal,
        altura: item.altura,
        nivelNome,
        condutores: item.metadadosCabo?.condutores,
        fases: item.metadadosCabo?.fases,
        corFase: item.metadadosCabo?.corFase,
        corFaseR: item.metadadosCabo?.corFaseR,
        corFaseS: item.metadadosCabo?.corFaseS,
        corFaseT: item.metadadosCabo?.corFaseT,
        observacao: item.metadadosCabo?.observacao || item.observacao,
      });
    } else if (item.tipo === "area") {
      detalhe.area = item.areaReal;
      detalhe.perimetro = item.perimetroReal;
      tituloSugerido = `Execução de ${item.nome}`;
      descSugerida += `Área delimitada: ${item.areaReal ? `${item.areaReal.toFixed(2)} m²` : ""} (Perímetro: ${item.perimetroReal ? `${item.perimetroReal.toFixed(2)} m` : ""}).`;
    } else if (item.tipo === "ponto") {
      tituloSugerido = `Instalar ${item.nome}`;
      descSugerida += `Elemento #${item.numero} (${item.nome}). Altura: ${item.altura ?? 0}m.`;
    } else if (item.tipo === "descida_subida") {
      detalhe.comprimento = item.comprimentoReal;
      detalhe.alturaOrigem = item.alturaOrigem;
      detalhe.alturaDestino = item.alturaDestino;
      detalhe.nivelOrigemId = item.nivelOrigemId;
      detalhe.nivelDestinoId = item.nivelDestinoId;
      detalhe.circuito = item.circuito;
      tituloSugerido = item.circuito
        ? `Descida Eletroduto - Circuito ${item.circuito}`
        : `Descida/Subida Vertical ${item.nome}`;
      const nomeOrigem = item.nivelOrigemId
        ? niveis.find((n) => n.id === item.nivelOrigemId)?.nome
        : `${item.alturaOrigem ?? 0}m`;
      const nomeDestino = item.nivelDestinoId
        ? niveis.find((n) => n.id === item.nivelDestinoId)?.nome
        : `${item.alturaDestino ?? 0}m`;
      descSugerida =
        `Levantamento: ${nomeLev}\n` +
        `⚡ DESCIDA VERTICAL DE TUBULAÇÃO / ELETRODUTO${item.circuito ? ` — CIRCUITO ${item.circuito}` : ""}\n` +
        `• Trecho Vertical: ${formatarMetros(item.comprimentoReal ?? 0)}\n` +
        `• Origem: ${nomeOrigem} (${formatarMetros(item.alturaOrigem ?? 0)})\n` +
        `• Destino: ${nomeDestino} (${formatarMetros(item.alturaDestino ?? 0)})\n` +
        `• Quantidade: 1 prumada vertical`;
    }

    const p0 = item.pontos[0] ?? { x: 0, y: 0 };

    return {
      idOriginal: item.id,
      tipo,
      nome: item.nome,
      subtipo: item.subtipo,
      categoria: item.categoria,
      titulo: tituloSugerido,
      descricao: descSugerida,
      ponto_x: p0.x,
      ponto_y: p0.y,
      detalhe,
    };
  }

  async function criarTarefasLoteSelecionados(itensParaCriar?: ItemLevantamento[]) {
    if (!obraSelecionadaId || !plantaSelecionadaId) return;

    const itensAlvo =
      itensParaCriar ??
      itens.filter((i) => itensLoteSelecionados.includes(i.id));

    if (itensAlvo.length === 0) return;

    setCriandoLoteTarefas(true);
    setMensagemLote(null);

    let idLevantamentoAtual = levantamentoId;
    if (podeEditar) {
      const resSalvar = await salvarLevantamento({
        id: levantamentoId,
        obraId: obraSelecionadaId,
        plantaId: plantaSelecionadaId,
        pagina,
        nome: nomeLevantamento,
        descricao: descricaoLevantamento,
        niveis: JSON.parse(JSON.stringify(niveis)),
        categorias: JSON.parse(JSON.stringify(categorias)),
        itens: JSON.parse(JSON.stringify(itens)),
        configLegenda: JSON.parse(JSON.stringify(configLegenda)),
      });

      if ("erro" in resSalvar) {
        setCriandoLoteTarefas(false);
        setMensagemLote({
          tipo: "erro",
          texto: `Erro ao salvar anotações do levantamento: ${resSalvar.erro}`,
        });
        return;
      }

      idLevantamentoAtual = resSalvar.id;
      setLevantamentoId(resSalvar.id);
    }

    const mapaCircuitos = new Map<string, ItemLevantamento[]>();
    const outrosItens: ItemLevantamento[] = [];

    for (const it of itensAlvo) {
      if (it.tipo === "tubulacao_cabo") {
        const nomeCirc =
          it.metadadosCabo?.circuito?.trim() ||
          it.circuito?.trim() ||
          it.nome.trim();
        const lista = mapaCircuitos.get(nomeCirc) || [];
        lista.push(it);
        mapaCircuitos.set(nomeCirc, lista);
      } else {
        outrosItens.push(it);
      }
    }

    const localizacoes: Array<{
      localizacao_tipo:
        | "ponto"
        | "regiao"
        | "distancia"
        | "circuito"
        | "area"
        | "descida"
        | "nenhuma";
      planta_id: string;
      pagina: number;
      ponto_x?: number | null;
      ponto_y?: number | null;
      localizacao_detalhe?: Record<string, unknown>;
      levantamento_id?: string | null;
      descricao_especifica?: string;
      comprimento?: number;
      area?: number;
      quantidade?: number;
    }> = [];

    for (const [nomeCirc, itensCirc] of mapaCircuitos.entries()) {
      const primeiro = itensCirc[0];
      const totalComprimento = itensCirc.reduce(
        (acc, i) => acc + (i.comprimentoReal ?? 0),
        0,
      );
      const segmentos = itensCirc.map((i) => ({
        pontos: i.pontos,
        comprimento: i.comprimentoReal,
      }));

      const nivelNome = primeiro.nivelId
        ? niveis.find((n) => n.id === primeiro.nivelId)?.nome
        : undefined;

      const descSugerida = formatarDescricaoTarefaCircuito({
        nomeLevantamento,
        circuito: nomeCirc,
        tipoCabo: primeiro.metadadosCabo?.tipoCabo,
        tipoCondutor: primeiro.metadadosCabo?.tipoCondutor,
        comprimento: totalComprimento,
        quantidadeTrechos: itensCirc.length,
        altura: primeiro.altura,
        nivelNome,
        condutores: primeiro.metadadosCabo?.condutores,
        fases: primeiro.metadadosCabo?.fases,
        corFase: primeiro.metadadosCabo?.corFase,
        corFaseR: primeiro.metadadosCabo?.corFaseR,
        corFaseS: primeiro.metadadosCabo?.corFaseS,
        corFaseT: primeiro.metadadosCabo?.corFaseT,
        observacao: primeiro.metadadosCabo?.observacao || primeiro.observacao,
      });

      const p0 = primeiro.pontos[0] ?? { x: 0, y: 0 };

      const detalhe: Record<string, unknown> = {
        elemento: primeiro.nome,
        subtipo: primeiro.subtipo,
        categoria: primeiro.categoria,
        circuito: nomeCirc,
        comprimento: totalComprimento,
        quantidade: itensCirc.length,
        pontos: primeiro.pontos,
        segmentos,
        condutores: primeiro.metadadosCabo?.condutores,
        fases: primeiro.metadadosCabo?.fases,
        tipoCabo: primeiro.metadadosCabo?.tipoCabo,
        tipoCondutor: primeiro.metadadosCabo?.tipoCondutor,
        nivelId: primeiro.nivelId,
        altura: primeiro.altura,
        cor: primeiro.cor || primeiro.metadadosCabo?.cor,
        corFaseR: primeiro.metadadosCabo?.corFaseR,
        corFaseS: primeiro.metadadosCabo?.corFaseS,
        corFaseT: primeiro.metadadosCabo?.corFaseT,
        corFase: primeiro.metadadosCabo?.corFase,
        observacao: primeiro.metadadosCabo?.observacao || primeiro.observacao,
      };

      localizacoes.push({
        localizacao_tipo: "circuito",
        planta_id: plantaSelecionadaId,
        pagina,
        ponto_x: p0.x,
        ponto_y: p0.y,
        localizacao_detalhe: detalhe,
        levantamento_id: idLevantamentoAtual ?? null,
        descricao_especifica: descSugerida,
        comprimento: totalComprimento,
        quantidade: itensCirc.length,
      });
    }

    for (const it of outrosItens) {
      const dados = gerarDadosTarefaDeItem(it, nomeLevantamento);
      localizacoes.push({
        localizacao_tipo: dados.tipo,
        planta_id: plantaSelecionadaId,
        pagina,
        ponto_x: dados.ponto_x,
        ponto_y: dados.ponto_y,
        localizacao_detalhe: dados.detalhe,
        levantamento_id: idLevantamentoAtual ?? null,
        descricao_especifica: dados.descricao,
        comprimento: it.comprimentoReal,
        area: it.areaReal,
        quantidade: 1,
      });
    }

    const res = await salvarRascunhoLote({
      obra_id: obraSelecionadaId,
      planta_id: plantaSelecionadaId,
      pagina,
      localizacoes,
    });

    setCriandoLoteTarefas(false);
    if ("erro" in res) {
      setMensagemLote({ tipo: "erro", texto: res.erro });
      return;
    }

    let tituloComum = itensAlvo[0]?.nome ? `Executar ${itensAlvo[0].nome}` : "Tarefas em Lote";
    if (itensAlvo.every((i) => i.tipo === "tubulacao_cabo")) {
      const circuito = itensAlvo[0]?.metadadosCabo?.circuito;
      tituloComum = `Passagem de Cabo - ${circuito ? `Circuito ${circuito}` : "Elétrica"}`;
    }

    const params = new URLSearchParams({
      lote: res.id,
      titulo: tituloComum,
    });
    if (idLevantamentoAtual) {
      params.set("levantamento", idLevantamentoAtual);
    }

    router.push(`/tarefas/nova-em-lote?${params.toString()}`);
  }

  async function criarTarefaAPartirDeItem(item: ItemLevantamento) {
    if (!obraSelecionadaId || !plantaSelecionadaId) return;

    let idLevantamentoAtual = levantamentoId;
    if (podeEditar) {
      const resSalvar = await salvarLevantamento({
        id: levantamentoId,
        obraId: obraSelecionadaId,
        plantaId: plantaSelecionadaId,
        pagina,
        nome: nomeLevantamento,
        descricao: descricaoLevantamento,
        niveis: JSON.parse(JSON.stringify(niveis)),
        categorias: JSON.parse(JSON.stringify(categorias)),
        itens: JSON.parse(JSON.stringify(itens)),
        configLegenda: JSON.parse(JSON.stringify(configLegenda)),
      });

      if (!("erro" in resSalvar)) {
        idLevantamentoAtual = resSalvar.id;
        setLevantamentoId(resSalvar.id);
      }
    }

    const dados = gerarDadosTarefaDeItem(item, nomeLevantamento);

    const query = new URLSearchParams({
      obra: obraSelecionadaId,
      planta: plantaSelecionadaId,
      pagina: String(pagina),
      tipo: dados.tipo,
      x: String(dados.ponto_x),
      y: String(dados.ponto_y),
      titulo: dados.titulo,
      descricao: dados.descricao,
      detalhe: JSON.stringify(dados.detalhe),
    });

    if (idLevantamentoAtual) {
      query.set("levantamento", idLevantamentoAtual);
    }

    router.push(`/tarefas/nova?${query.toString()}`);
  }

  function desfazer() {
    if (historicoDesfazer.length === 0) return;
    const anterior = historicoDesfazer[historicoDesfazer.length - 1];
    setHistoricoRefazer((prev) => [...prev, itens]);
    setHistoricoDesfazer((prev) => prev.slice(0, -1));
    setItens(anterior);
  }

  function refazer() {
    if (historicoRefazer.length === 0) return;
    const proximo = historicoRefazer[historicoRefazer.length - 1];
    setHistoricoDesfazer((prev) => [...prev, itens]);
    setHistoricoRefazer((prev) => prev.slice(0, -1));
    setItens(proximo);
  }

  function resetarTudo() {
    if (
      itens.length > 0 &&
      !confirm("Deseja realmente limpar todas as marcações deste levantamento?")
    )
      return;
    registrarEstado([]);
  }

  const plantaAtual = useMemo(
    () => plantas.find((p) => p.id === plantaSelecionadaId),
    [plantas, plantaSelecionadaId],
  );

  const obraAtual = useMemo(
    () => obras.find((o) => o.id === obraSelecionadaId),
    [obras, obraSelecionadaId],
  );

  const calibracaoPagina = useMemo(() => {
    const cal = calibracoes.find(
      (c) => c.planta_id === plantaSelecionadaId && c.pagina === pagina,
    );
    if (!cal) return null;
    return {
      unidadesPorPonto: cal.unidades_por_ponto,
      unidade: cal.unidade,
    } as Calibracao;
  }, [calibracoes, plantaSelecionadaId, pagina]);

  const resumo = useMemo(
    () => calcularResumoLevantamento(itens, calibracaoPagina, niveis),
    [itens, calibracaoPagina, niveis],
  );

  const gruposItens = useMemo(() => {
    const map = new Map<
      string,
      {
        chave: string;
        tipo: string;
        nome: string;
        cor: string;
        categoria?: string;
        itens: ItemLevantamento[];
      }
    >();

    for (const it of itens) {
      const chave = `${it.tipo}:::${it.nome}`;
      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          tipo: it.tipo,
          nome: it.nome,
          cor: it.cor,
          categoria: it.categoria,
          itens: [],
        });
      }
      map.get(chave)!.itens.push(it);
    }

    return Array.from(map.values());
  }, [itens]);

  async function salvarLevantamentoAtual() {
    if (!podeEditar) return;
    setSalvando(true);
    setMensagemSucesso(null);

    const resultado = await salvarLevantamento({
      id: levantamentoId,
      obraId: obraSelecionadaId,
      plantaId: plantaSelecionadaId,
      pagina,
      nome: nomeLevantamento,
      descricao: descricaoLevantamento,
      niveis: JSON.parse(JSON.stringify(niveis)),
      categorias: JSON.parse(JSON.stringify(categorias)),
      itens: JSON.parse(JSON.stringify(itens)),
      configLegenda: JSON.parse(JSON.stringify(configLegenda)),
    });

    setSalvando(false);
    if ("erro" in resultado) {
      alert(`Erro ao salvar: ${resultado.erro}`);
    } else {
      setLevantamentoId(resultado.id);
      setMensagemSucesso("Levantamento salvo com sucesso!");
      setTimeout(() => setMensagemSucesso(null), 3500);
    }
  }

  async function selecionarPlanta(novaPlantaId: string) {
    setPlantaSelecionadaId(novaPlantaId);
    const p = plantas.find((x) => x.id === novaPlantaId);
    if (p) {
      setObraSelecionadaId(p.obra_id);
      setPagina(1);
      setItens([]);
      setHistoricoDesfazer([]);
      setHistoricoRefazer([]);
      setLevantamentoId(undefined);

      const resUrl = await renovarUrlPlanta(novaPlantaId);
      if (!("erro" in resUrl)) {
        setUrlPdf(resUrl.url);
      }

      const resCal = await obterCalibracoesPlanta(novaPlantaId);
      if (!resCal.erro) {
        setCalibracoes(resCal.calibracoes);
      }
    }
  }

  function aoCarregarDocumento(pdf: { numPages: number }) {
    setTotalPaginas(pdf.numPages);
  }

  function aoCarregarPagina(pageData: {
    getViewport: (options: { scale: number }) => {
      width: number;
      height: number;
    };
  }) {
    const vp = pageData.getViewport({ scale: 1 });
    setDimensoes({ largura: vp.width, altura: vp.height });

    setTimeout(() => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas) {
        setCanvasPlanta2D(canvas as HTMLCanvasElement);
      }
    }, 200);
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current && containerRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      containerRef.current.scrollLeft = panRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panRef.current.scrollTop - dy;
      return;
    }

    if (!overlayRef.current) return;
    if (
      ferramenta !== "distancia" &&
      ferramenta !== "tubulacao_cabo" &&
      ferramenta !== "area"
    ) {
      if (pontoSnap) setPontoSnap(null);
      return;
    }

    const rect = overlayRef.current.getBoundingClientRect();
    const pontoPdf = telaParaPdf(
      e.clientX,
      e.clientY,
      rect,
      dimensoes.largura,
      dimensoes.altura,
    );

    const snap = encontrarPontoSnap(pontoPdf, itens, pontosEmDesenho);
    if (snap !== pontoPdf) {
      setPontoSnap(snap);
    } else if (pontoSnap) {
      setPontoSnap(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ferramenta === "navegar" || e.button === 1) {
      if (containerRef.current) {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop,
        };
        setArrastandoPan(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const rawPontoPdf = telaParaPdf(
      e.clientX,
      e.clientY,
      rect,
      dimensoes.largura,
      dimensoes.altura,
    );

    const pontoPdf =
      ferramenta === "distancia" ||
      ferramenta === "tubulacao_cabo" ||
      ferramenta === "area"
        ? encontrarPontoSnap(rawPontoPdf, itens, pontosEmDesenho)
        : rawPontoPdf;

    if (calibrando || ferramenta === "calibrar") {
      const novos = [...pontosCalibracao, pontoPdf];
      setPontosCalibracao(novos);
      if (novos.length === 2) {
        setCalibrando(false);
      }
      return;
    }

    if (ferramenta === "ponto" && elementoAtivo) {
      const { altura, nivelId } = obterAlturaENivelElemento(elementoAtivo);
      const novoItem: ItemLevantamento = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        numero: getNextNumero(elementoAtivo.id),
        tipo: "ponto",
        categoria: elementoAtivo.categoria,
        subtipo: elementoAtivo.id,
        nome: elementoAtivo.nome,
        cor: elementoAtivo.cor,
        pontos: [pontoPdf],
        nivelId,
        altura,
        criadoEm: new Date().toISOString(),
      };
      registrarEstado([...itens, novoItem]);
      setItemSelecionado(novoItem);
    } else if (ferramenta === "distancia" && elementoAtivo) {
      const novosPontos = [...pontosEmDesenho, pontoPdf];
      setPontosEmDesenho(novosPontos);
    } else if (ferramenta === "tubulacao_cabo") {
      const novosPontos = [...pontosEmDesenho, pontoPdf];
      setPontosEmDesenho(novosPontos);
    } else if (ferramenta === "area" && elementoAtivo) {
      const novosPontos = [...pontosEmDesenho, pontoPdf];
      setPontosEmDesenho(novosPontos);
    } else if (ferramenta === "descida_subida") {
      setPontoDescidaPendente(pontoPdf);
      setModalDescidaAberto(true);
    } else if (ferramenta === "descida_subida_lote") {
      setLoteDescidasPontos((prev) => [...prev, pontoPdf]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      panRef.current = null;
      setArrastandoPan(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  function finalizarPolilinhaOuCabo() {
    if (pontosEmDesenho.length < 2) {
      setPontosEmDesenho([]);
      return;
    }

    const compReal = calcularDistanciaPontos(
      pontosEmDesenho,
      calibracaoPagina,
    );

    let novoItem: ItemLevantamento | null = null;

    if (ferramenta === "tubulacao_cabo") {
      const condsTexto =
        metadadosCaboAtivo.fases && metadadosCaboAtivo.fases.length > 0
          ? [
              ...metadadosCaboAtivo.fases.map(
                (f) => `${f.quantidade > 1 ? `${f.quantidade}x` : ""}${f.nome}`,
              ),
              ...metadadosCaboAtivo.condutores
                .filter((c) => c.tipo !== "fase")
                .map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`),
            ].join("+")
          : metadadosCaboAtivo.condutores
              .map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`)
              .join("+");
      const alturaCircuito =
        metadadosCaboAtivo.altura !== undefined
          ? metadadosCaboAtivo.altura
          : 2.8;
      const nivelCircuitoId =
        metadadosCaboAtivo.nivelId || "forro_teto";

      novoItem = {
        id: `cabo_${Date.now()}`,
        numero: getNextNumero("cabo_circuito"),
        tipo: "tubulacao_cabo",
        categoria: "Tubulações e Cabos",
        subtipo: "cabo_circuito",
        nome: `Circuito ${metadadosCaboAtivo.circuito} (${condsTexto})`,
        cor: metadadosCaboAtivo.cor || "#eab308",
        pontos: pontosEmDesenho,
        altura: alturaCircuito,
        nivelId: nivelCircuitoId,
        comprimentoReal: compReal,
        metadadosCabo: {
          ...metadadosCaboAtivo,
          altura: alturaCircuito,
          nivelId: nivelCircuitoId,
        },
        criadoEm: new Date().toISOString(),
      };
      registrarEstado([...itens, novoItem]);
      setItemSelecionado(novoItem);
    } else if (elementoAtivo) {
      const { altura, nivelId } = obterAlturaENivelElemento(elementoAtivo);
      novoItem = {
        id: `dist_${Date.now()}`,
        numero: getNextNumero(elementoAtivo.id),
        tipo: "distancia",
        categoria: elementoAtivo.categoria,
        subtipo: elementoAtivo.id,
        nome: elementoAtivo.nome,
        cor: elementoAtivo.cor,
        pontos: pontosEmDesenho,
        altura,
        nivelId,
        comprimentoReal: compReal,
        criadoEm: new Date().toISOString(),
      };
      registrarEstado([...itens, novoItem]);
      setItemSelecionado(novoItem);
    }
    setPontosEmDesenho([]);
  }

  function finalizarArea() {
    if (pontosEmDesenho.length < 3 || !elementoAtivo) {
      setPontosEmDesenho([]);
      return;
    }
    const { area, perimetro } = calcularAreaPoligono(
      pontosEmDesenho,
      calibracaoPagina,
    );
    const { altura, nivelId } = obterAlturaENivelElemento(elementoAtivo);
    const novoItem: ItemLevantamento = {
      id: `area_${Date.now()}`,
      numero: getNextNumero(elementoAtivo.id),
      tipo: "area",
      categoria: elementoAtivo.categoria,
      subtipo: elementoAtivo.id,
      nome: elementoAtivo.nome,
      cor: elementoAtivo.cor,
      pontos: pontosEmDesenho,
      altura,
      nivelId,
      areaReal: area,
      perimetroReal: perimetro,
      criadoEm: new Date().toISOString(),
    };
    registrarEstado([...itens, novoItem]);
    setItemSelecionado(novoItem);
    setPontosEmDesenho([]);
  }

  function salvarDescidaSubida(dados: {
    nome: string;
    subtipo: string;
    cor: string;
    circuito?: string;
    nivelOrigemId?: string;
    alturaOrigem: number;
    nivelDestinoId?: string;
    alturaDestino: number;
  }) {
    const alturaDelta = Math.abs(dados.alturaOrigem - dados.alturaDestino);
    const agora = new Date().toISOString();

    if (pontosAlvoDescidaLote.length > 0) {
      const novosItens: ItemLevantamento[] = pontosAlvoDescidaLote.map(
        (itemPonto, idx) => {
          const altDest =
            itemPonto.altura !== undefined
              ? itemPonto.altura
              : dados.alturaDestino;
          const delta = Math.abs(dados.alturaOrigem - altDest);
          const p = itemPonto.pontos[0] ?? { x: 0, y: 0 };
          const nomeItem = dados.circuito
            ? `Descida Circuito ${dados.circuito} (${itemPonto.nome})`
            : `${dados.nome} (${itemPonto.nome})`;

          return {
            id: `desc_lote_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
            numero: getNextNumero(dados.subtipo) + idx,
            tipo: "descida_subida",
            categoria: "Tubulações e Cabos",
            subtipo: dados.subtipo,
            nome: nomeItem,
            cor: dados.cor,
            circuito: dados.circuito,
            pontos: [p],
            nivelOrigemId: dados.nivelOrigemId,
            alturaOrigem: dados.alturaOrigem,
            nivelDestinoId: itemPonto.nivelId || dados.nivelDestinoId,
            alturaDestino: altDest,
            comprimentoReal: delta,
            criadoEm: agora,
          };
        },
      );

      registrarEstado([...itens, ...novosItens]);
      if (novosItens[0]) setItemSelecionado(novosItens[0]);
      setPontosAlvoDescidaLote([]);
      setMensagemLote({
        tipo: "sucesso",
        texto: `${novosItens.length} descida(s) vertical(is) criada(s) com sucesso!`,
      });
    } else if (loteDescidasPontos.length > 0) {
      const novosItens: ItemLevantamento[] = loteDescidasPontos.map(
        (p, idx) => ({
          id: `desc_lote_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          numero: getNextNumero(dados.subtipo) + idx,
          tipo: "descida_subida",
          categoria: "Tubulações e Cabos",
          subtipo: dados.subtipo,
          nome: dados.nome,
          cor: dados.cor,
          circuito: dados.circuito,
          pontos: [p],
          nivelOrigemId: dados.nivelOrigemId,
          alturaOrigem: dados.alturaOrigem,
          nivelDestinoId: dados.nivelDestinoId,
          alturaDestino: dados.alturaDestino,
          comprimentoReal: alturaDelta,
          criadoEm: agora,
        }),
      );
      registrarEstado([...itens, ...novosItens]);
      if (novosItens[0]) setItemSelecionado(novosItens[0]);
      setLoteDescidasPontos([]);
    } else if (pontoDescidaPendente) {
      const novoItem: ItemLevantamento = {
        id: `desc_${Date.now()}`,
        numero: getNextNumero(dados.subtipo),
        tipo: "descida_subida",
        categoria: "Tubulações e Cabos",
        subtipo: dados.subtipo,
        nome: dados.nome,
        cor: dados.cor,
        circuito: dados.circuito,
        pontos: [pontoDescidaPendente],
        nivelOrigemId: dados.nivelOrigemId,
        alturaOrigem: dados.alturaOrigem,
        nivelDestinoId: dados.nivelDestinoId,
        alturaDestino: dados.alturaDestino,
        comprimentoReal: alturaDelta,
        criadoEm: agora,
      };
      registrarEstado([...itens, novoItem]);
      setItemSelecionado(novoItem);
      setPontoDescidaPendente(null);
    }
    setModalDescidaAberto(false);
  }

  function salvarConfiguracaoCabo(dados: MetadadosCabo) {
    if (itemCaboEmEdicao) {
      const condsTexto =
        dados.fases && dados.fases.length > 0
          ? [
              ...dados.fases.map(
                (f) => `${f.quantidade > 1 ? `${f.quantidade}x` : ""}${f.nome}`,
              ),
              ...dados.condutores
                .filter((c) => c.tipo !== "fase")
                .map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`),
            ].join("+")
          : dados.condutores.map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`).join("+");

      const alturaCircuito =
        dados.altura !== undefined ? dados.altura : (itemCaboEmEdicao.altura ?? 2.8);
      const nivelCircuitoId =
        dados.nivelId || (itemCaboEmEdicao.nivelId || "forro_teto");

      const atualizado: ItemLevantamento = {
        ...itemCaboEmEdicao,
        nome: `Circuito ${dados.circuito} (${condsTexto})`,
        cor: dados.cor || "#eab308",
        altura: alturaCircuito,
        nivelId: nivelCircuitoId,
        metadadosCabo: {
          ...dados,
          altura: alturaCircuito,
          nivelId: nivelCircuitoId,
        },
      };

      const novosItens = itens.map((it) => (it.id === itemCaboEmEdicao.id ? atualizado : it));
      registrarEstado(novosItens);
      setItemSelecionado(atualizado);
      setItemCaboEmEdicao(null);
      setMensagemSucesso(`Circuito ${dados.circuito} atualizado com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 3000);
    } else {
      setMetadadosCaboAtivo(dados);
    }
    setModalCaboAberto(false);
  }

  function salvarEdicaoLoteCircuitos(dados: DadosEdicaoLoteCircuito) {
    const circuitosIds = new Set(
      itens
        .filter((i) => itensLoteSelecionados.includes(i.id) && i.tipo === "tubulacao_cabo")
        .map((i) => i.id),
    );

    if (circuitosIds.size === 0) return;

    const novosItens = itens.map((item) => {
      if (!circuitosIds.has(item.id)) return item;

      const metaAtual = item.metadadosCabo || {
        circuito: "C1",
        tipoCabo: "Cabo Flexível 750V 2.5mm²",
        tipoCondutor: "Cobre",
        condutores: [],
      };

      const novoCircuito = dados.alterarCircuito ? dados.circuito : metaAtual.circuito;
      const novoTipoCabo = dados.alterarTipoCabo ? dados.tipoCabo : metaAtual.tipoCabo;
      const novoTipoCondutor = dados.alterarTipoCondutor ? dados.tipoCondutor : metaAtual.tipoCondutor;
      const novoNivelId = dados.alterarNivel ? dados.nivelId : (metaAtual.nivelId || item.nivelId);
      const novaAltura = dados.alterarNivel ? dados.altura : (metaAtual.altura ?? item.altura ?? 2.8);
      const novaCor = dados.alterarCor ? dados.cor : (item.cor || metaAtual.cor || "#eab308");

      const novasFases = dados.alterarCondutores ? dados.fases : (metaAtual.fases || []);
      const novosCondutores = dados.alterarCondutores ? dados.condutores : (metaAtual.condutores || []);

      const condsTexto =
        novasFases && novasFases.length > 0
          ? [
              ...novasFases.map((f) => `${f.quantidade > 1 ? `${f.quantidade}x` : ""}${f.nome}`),
              ...novosCondutores
                .filter((c) => c.tipo !== "fase")
                .map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`),
            ].join("+")
          : novosCondutores.map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`).join("+");

      const novoNome = `Circuito ${novoCircuito} (${condsTexto})`;

      const novosMetadados: MetadadosCabo = {
        ...metaAtual,
        circuito: novoCircuito,
        tipoCabo: novoTipoCabo,
        tipoCondutor: novoTipoCondutor,
        nivelId: novoNivelId,
        altura: novaAltura,
        cor: novaCor,
        fases: novasFases,
        condutores: novosCondutores,
      };

      return {
        ...item,
        nome: novoNome,
        cor: novaCor,
        altura: novaAltura,
        nivelId: novoNivelId,
        metadadosCabo: novosMetadados,
      };
    });

    registrarEstado(novosItens);
    setModalEditarLoteCircuitosAberto(false);
    setMensagemLote({
      tipo: "sucesso",
      texto: `${circuitosIds.size} circuito(s) atualizado(s) com sucesso!`,
    });
  }

  async function salvarCalibracaoModal(
    distanciaReal: number,
    unidade: "m" | "cm",
  ) {
    if (pontosCalibracao.length !== 2)
      return { erro: "Selecione 2 pontos na planta." };
    const p1 = pontosCalibracao[0];
    const p2 = pontosCalibracao[1];
    const unidadesPorPonto = calcularCalibracao(p1, p2, distanciaReal);

    const res = await salvarCalibracaoDireta({
      plantaId: plantaSelecionadaId,
      pagina,
      unidadesPorPonto,
      unidade,
      refP1: p1,
      refP2: p2,
      distanciaReal,
    });

    if ("erro" in res) {
      return { erro: res.erro };
    }

    setCalibracoes((prev) => [
      ...prev.filter(
        (c) => !(c.planta_id === plantaSelecionadaId && c.pagina === pagina),
      ),
      {
        id: `cal_${Date.now()}`,
        planta_id: plantaSelecionadaId,
        pagina,
        unidades_por_ponto: unidadesPorPonto,
        unidade,
        ref_p1: p1,
        ref_p2: p2,
        distancia_real: distanciaReal,
        calibrado_por: null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
    ]);

    setPontosCalibracao([]);
    return {};
  }

  function exportarCsv() {
    const csv = gerarCsvLevantamento({
      nomeLevantamento,
      obraNome: obraAtual?.nome ?? "Obra",
      plantaNome: plantaAtual?.nome ?? "Planta",
      pagina,
      itens,
      resumo,
      niveis,
      calibracao: calibracaoPagina,
    });
    baixarArquivoTexto(
      csv,
      `levantamento-${(obraAtual?.nome ?? "obra").toLowerCase().replace(/\s+/g, "_")}-pag${pagina}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-superficie-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="w-52">
              <label className="text-[11px] font-semibold text-superficie-600 block mb-0.5">
                Obra:
              </label>
              <select
                value={obraSelecionadaId}
                onChange={(e) => {
                  setObraSelecionadaId(e.target.value);
                  const p = plantas.find(
                    (item) => item.obra_id === e.target.value,
                  );
                  if (p) selecionarPlanta(p.id);
                }}
                className="w-full rounded-lg border border-superficie-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-superficie-800 focus:border-azul-500 focus:outline-none"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-64">
              <label className="text-[11px] font-semibold text-superficie-600 block mb-0.5">
                Planta:
              </label>
              <select
                value={plantaSelecionadaId}
                onChange={(e) => selecionarPlanta(e.target.value)}
                className="w-full rounded-lg border border-superficie-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-superficie-800 focus:border-azul-500 focus:outline-none"
              >
                {plantas
                  .filter((p) => p.obra_id === obraSelecionadaId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.total_paginas} pág.)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-1 self-end">
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => setModalUploadAberto(true)}
                title="Incluir nova planta PDF"
              >
                <Upload className="h-3.5 w-3.5" />
                Nova Planta
              </Botao>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Botao
              variante="primario"
              tamanho="sm"
              onClick={salvarLevantamentoAtual}
              carregando={salvando}
            >
              <Save className="h-4 w-4" />
              Salvar
            </Botao>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={exportarCsv}
              title="Exportar para CSV (Excel)"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </Botao>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => setModalExportarAberto(true)}
              title="Exportar Relatório e Prancha A0 do Levantamento em PDF"
            >
              <FileDown className="h-4 w-4 text-azul-600" />
              Relatório PDF
            </Botao>
          </div>
        </div>

        {mensagemSucesso && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {mensagemSucesso}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-superficie-100 pt-3">
          <div className="flex items-center gap-1 bg-superficie-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setModo("2d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modo === "2d"
                  ? "bg-white text-azul-700 shadow-sm"
                  : "text-superficie-600 hover:text-superficie-900"
              }`}
            >
              <FileText className="h-4 w-4" />
              Planta 2D Interativa
            </button>
            <button
              type="button"
              onClick={() => setModo("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modo === "3d"
                  ? "bg-white text-azul-700 shadow-sm"
                  : "text-superficie-600 hover:text-superficie-900"
              }`}
            >
              <Box className="h-4 w-4" />
              Perspectiva Isométrica 3D
            </button>
            <button
              type="button"
              onClick={() => setModo("tabelas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modo === "tabelas"
                  ? "bg-white text-azul-700 shadow-sm"
                  : "text-superficie-600 hover:text-superficie-900"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Resumo e Quantitativos
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalNiveisAberto(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-50 text-xs font-medium text-superficie-700"
            >
              <Layers className="h-3.5 w-3.5 text-azul-600" />
              Níveis 3D ({niveis.length})
            </button>
            <button
              type="button"
              onClick={() => setModalCategoriasAberto(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-50 text-xs font-medium text-superficie-700"
            >
              <Settings2 className="h-3.5 w-3.5 text-azul-600" />
              Categorias & Elementos
            </button>
          </div>
        </div>
      </div>

      {modo === "2d" && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 min-w-0 max-w-full">
          <div className="flex flex-col gap-3 rounded-2xl border border-superficie-200 bg-white p-3.5 shadow-sm max-h-[800px] overflow-y-auto">
            <div className="flex p-1 bg-superficie-100 rounded-xl border border-superficie-200 shrink-0">
              <button
                type="button"
                onClick={() => setAbaLateral("catalogo")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  abaLateral === "catalogo"
                    ? "bg-white text-azul-700 shadow-sm"
                    : "text-superficie-600 hover:text-superficie-900"
                }`}
              >
                Catálogo
              </button>
              <button
                type="button"
                onClick={() => setAbaLateral("itens")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  abaLateral === "itens"
                    ? "bg-white text-azul-700 shadow-sm"
                    : "text-superficie-600 hover:text-superficie-900"
                }`}
              >
                <span>Itens Medidos</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    abaLateral === "itens"
                      ? "bg-azul-100 text-azul-800"
                      : "bg-superficie-200 text-superficie-700"
                  }`}
                >
                  {itens.length}
                </span>
              </button>
            </div>

            {abaLateral === "catalogo" ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-superficie-800 uppercase tracking-wider">
                      Disciplinas
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalCategoriasAberto(true)}
                      className="text-xs text-azul-600 hover:underline flex items-center gap-0.5"
                    >
                      <Edit2 className="h-3 w-3" /> Gerenciar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {categorias.map((cat) => (
                      <button
                        key={cat.nome}
                        type="button"
                        onClick={() => {
                          setCategoriaAtiva(cat.nome);
                          setElementoAtivo(cat.elementos[0] ?? null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          categoriaAtiva === cat.nome
                            ? "bg-azul-600 text-white shadow-sm"
                            : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                        }`}
                      >
                        {cat.nome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-superficie-800 uppercase tracking-wider block">
                    Elementos ({categoriaAtiva})
                  </span>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {categorias
                      .find((c) => c.nome === categoriaAtiva)
                      ?.elementos.map((el) => {
                        const ativo = elementoAtivo?.id === el.id;
                        const nivelObj = el.nivelPadraoId
                          ? niveis.find((n) => n.id === el.nivelPadraoId)
                          : null;
                        const cotaTexto =
                          el.alturaPadrao !== undefined
                            ? `${el.alturaPadrao}m`
                            : nivelObj
                              ? `${nivelObj.cota}m`
                              : "";

                        return (
                          <button
                            key={el.id}
                            type="button"
                            onClick={() => {
                              setElementoAtivo(el);
                              if (el.tipoGeometria === "ponto")
                                setFerramenta("ponto");
                              else if (el.tipoGeometria === "distancia")
                                setFerramenta("distancia");
                              else if (el.tipoGeometria === "tubulacao_cabo")
                                setFerramenta("tubulacao_cabo");
                              else if (el.tipoGeometria === "area")
                                setFerramenta("area");
                              else if (el.tipoGeometria === "descida_subida")
                                setFerramenta("descida_subida");
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                              ativo
                                ? "border-azul-500 bg-azul-50/70 text-azul-950 font-semibold shadow-xs"
                                : "border-superficie-200 hover:border-superficie-300 hover:bg-superficie-50 text-superficie-700"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span
                                className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                                style={{ backgroundColor: el.cor }}
                              />
                              <span className="truncate">{el.nome}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {cotaTexto && (
                                <span className="text-[10px] text-superficie-400 font-mono">
                                  {cotaTexto}
                                </span>
                              )}
                              <span className="text-[10px] text-superficie-500 font-mono font-semibold">
                                {el.tipoGeometria === "ponto"
                                  ? "Pt"
                                  : el.tipoGeometria === "area"
                                    ? "m²"
                                    : "m"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Zap className="h-4 w-4 text-amber-600" />
                      <span>Cabos & Circuitos</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setItemCaboEmEdicao(null);
                        setModalCaboAberto(true);
                      }}
                      className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                    >
                      Configurar
                    </button>
                  </div>
                  <div className="text-[11px] text-amber-800 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span>
                        Circuito: <strong>{metadadosCaboAtivo.circuito}</strong> ({metadadosCaboAtivo.tipoCabo})
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: metadadosCaboAtivo.cor || "#eab308" }}
                        title="Cor atual do traço do circuito"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-amber-900/80 font-medium">
                      <span>
                        Nível: {niveis.find((n) => n.id === metadadosCaboAtivo.nivelId)?.nome || formatarMetros(metadadosCaboAtivo.altura ?? 2.8)}
                      </span>
                      <span className="font-mono">Cota {formatarMetros(metadadosCaboAtivo.altura ?? 2.8)}</span>
                    </div>
                    <div className="text-[10px] text-amber-700">
                      {metadadosCaboAtivo.fases &&
                      metadadosCaboAtivo.fases.length > 0
                        ? [
                            ...metadadosCaboAtivo.fases.map(
                              (f) => `${f.quantidade}x Fase ${f.nome}`,
                            ),
                            ...metadadosCaboAtivo.condutores
                              .filter((c) => c.tipo !== "fase")
                              .map(
                                (c) =>
                                  `${c.quantidade}x ${rotuloCondutor(c.tipo)}`,
                              ),
                          ].join(", ")
                        : metadadosCaboAtivo.condutores
                            .map(
                              (c) =>
                                `${c.quantidade}x ${rotuloCondutor(c.tipo)}`,
                            )
                            .join(", ")}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-amber-900 mb-1">
                      Cor do traço na planta:
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {CORES_CIRCUITO_SUGERIDAS.slice(0, 7).map((c) => (
                        <button
                          key={c.cor}
                          type="button"
                          onClick={() =>
                            setMetadadosCaboAtivo((prev) => ({
                              ...prev,
                              cor: c.cor,
                            }))
                          }
                          title={c.nome}
                          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 border ${
                            (metadadosCaboAtivo.cor || "#eab308").toLowerCase() ===
                            c.cor.toLowerCase()
                              ? "ring-2 ring-azul-600 ring-offset-1 border-white scale-110"
                              : "border-black/20"
                          }`}
                          style={{ backgroundColor: c.cor }}
                        />
                      ))}
                      <label
                        className="w-5 h-5 rounded-full border border-dashed border-amber-600 flex items-center justify-center cursor-pointer hover:bg-amber-100/60"
                        title="Escolher cor personalizada"
                      >
                        <span className="text-[10px] text-amber-800 font-bold">+</span>
                        <input
                          type="color"
                          value={metadadosCaboAtivo.cor || "#eab308"}
                          onChange={(e) =>
                            setMetadadosCaboAtivo((prev) => ({
                              ...prev,
                              cor: e.target.value,
                            }))
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  <Botao
                    variante={
                      ferramenta === "tubulacao_cabo" ? "primario" : "contorno"
                    }
                    tamanho="sm"
                    className="w-full"
                    onClick={() => {
                      setFerramenta("tubulacao_cabo");
                      setPontosEmDesenho([]);
                    }}
                  >
                    Traçar Cabo / Circuito
                  </Botao>
                </div>

                <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <ArrowDownUp className="h-4 w-4 text-purple-600" />
                    <span>Descida / Subida 3D</span>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    Clique na planta para conectar cotas verticais.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Botao
                      variante={
                        ferramenta === "descida_subida" ? "primario" : "contorno"
                      }
                      tamanho="sm"
                      onClick={() => {
                        setFerramenta("descida_subida");
                        setLoteDescidasPontos([]);
                      }}
                    >
                      Individual
                    </Botao>
                    <Botao
                      variante={
                        ferramenta === "descida_subida_lote"
                          ? "primario"
                          : "contorno"
                      }
                      tamanho="sm"
                      onClick={() => {
                        setFerramenta("descida_subida_lote");
                        setPontoDescidaPendente(null);
                      }}
                    >
                      Em Lote
                    </Botao>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-superficie-100">
                  <label className="flex items-center gap-2 text-xs font-bold text-superficie-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        itens.length > 0 &&
                        itensLoteSelecionados.length === itens.length
                      }
                      onChange={alternarSelecionarTodos}
                      disabled={itens.length === 0}
                      className="rounded border-superficie-300 text-azul-600 focus:ring-azul-500 h-3.5 w-3.5"
                    />
                    <span>Medições ({itens.length})</span>
                  </label>
                  {itens.length > 0 && (
                    <button
                      type="button"
                      onClick={resetarTudo}
                      className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Limpar tudo
                    </button>
                  )}
                </div>

                {mensagemLote && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                      mensagemLote.tipo === "sucesso"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {mensagemLote.tipo === "sucesso" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <span className="truncate">{mensagemLote.texto}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMensagemLote(null)}
                      className="text-superficie-400 hover:text-superficie-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {itensLoteSelecionados.length > 0 && (() => {
                  const circuitosLote = itens.filter(
                    (i) =>
                      itensLoteSelecionados.includes(i.id) &&
                      i.tipo === "tubulacao_cabo",
                  );
                  const outrosLote = itens.filter(
                    (i) =>
                      itensLoteSelecionados.includes(i.id) &&
                      i.tipo !== "tubulacao_cabo",
                  );
                  const nomesCircuitosUnicos = new Set(
                    circuitosLote.map(
                      (c) =>
                        c.metadadosCabo?.circuito?.trim() ||
                        c.circuito?.trim() ||
                        c.nome.trim(),
                    ),
                  );
                  const totalTarefasLote =
                    outrosLote.length + nomesCircuitosUnicos.size;
                  const pontosLote = itens.filter(
                    (i) =>
                      itensLoteSelecionados.includes(i.id) &&
                      i.tipo === "ponto",
                  );

                  return (
                    <div className="p-2.5 bg-azul-50 border border-azul-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-azul-900 font-medium truncate">
                          <span className="font-bold">
                            {itensLoteSelecionados.length}
                          </span>{" "}
                          de {itens.length} selecionado(s)
                          {circuitosLote.length >
                            nomesCircuitosUnicos.size && (
                            <span className="block text-[11px] text-azul-700">
                              {circuitosLote.length} trechos agrupados em{" "}
                              {nomesCircuitosUnicos.size} circuito(s)
                            </span>
                          )}
                        </div>
                        <Botao
                          tamanho="sm"
                          onClick={() => criarTarefasLoteSelecionados()}
                          carregando={criandoLoteTarefas}
                          className="bg-azul-600 hover:bg-azul-700 text-white font-semibold text-xs py-1 px-2.5 shrink-0"
                        >
                          <Layers className="h-3.5 w-3.5 mr-1" />
                          Gerar {totalTarefasLote}{" "}
                          {totalTarefasLote === 1 ? "Tarefa" : "Tarefas"}
                        </Botao>
                      </div>

                      {(circuitosLote.length > 0 || pontosLote.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-azul-200/70">
                          {circuitosLote.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setModalEditarLoteCircuitosAberto(true)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold border border-amber-300 transition-colors cursor-pointer"
                              title="Editar propriedades dos circuitos selecionados em lote"
                            >
                              <Zap className="h-3.5 w-3.5 text-amber-700" />
                              <span>Editar {circuitosLote.length} Circuito(s)</span>
                            </button>
                          )}

                          {pontosLote.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPontosAlvoDescidaLote(pontosLote);
                                setModalDescidaAberto(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-semibold border border-purple-300 transition-colors cursor-pointer"
                              title="Lançar descidas verticais do forro para todos os pontos selecionados em lote"
                            >
                              <ArrowDownUp className="h-3.5 w-3.5 text-purple-700" />
                              <span>Lançar Descidas ({pontosLote.length} pts)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {itens.length === 0 ? (
                  <div className="py-8 text-center px-2 text-xs text-superficie-400 bg-superficie-50 rounded-xl border border-dashed border-superficie-200">
                    <p className="font-medium text-superficie-600">
                      Nenhum elemento medido
                    </p>
                    <p className="mt-1 text-[11px]">
                      Trace linhas, áreas ou conte pontos na planta para gerar
                      medições e tarefas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {gruposItens.map((grupo) => {
                      const totalGrupo =
                        grupo.tipo === "area"
                          ? formatarMetrosQuadrados(
                              grupo.itens.reduce(
                                (acc, i) => acc + (i.areaReal ?? 0),
                                0,
                              ),
                            )
                          : grupo.tipo === "distancia" ||
                              grupo.tipo === "tubulacao_cabo" ||
                              grupo.tipo === "descida_subida"
                            ? formatarMetros(
                                grupo.itens.reduce(
                                  (acc, i) => acc + (i.comprimentoReal ?? 0),
                                  0,
                                ),
                              )
                            : `${grupo.itens.length} un`;

                      const idsGrupo = grupo.itens.map((i) => i.id);
                      const todosGrupoSelecionados = idsGrupo.every((id) =>
                        itensLoteSelecionados.includes(id),
                      );
                      const algumGrupoSelecionado = idsGrupo.some((id) =>
                        itensLoteSelecionados.includes(id),
                      );
                      const recolhido = gruposRecolhidos.includes(grupo.chave);

                      return (
                        <div
                          key={grupo.chave}
                          className="rounded-xl border border-superficie-200 bg-superficie-50/50 overflow-hidden shadow-2xs"
                        >
                          <div className="p-2.5 bg-white border-b border-superficie-200 flex items-center justify-between gap-2 select-none">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={todosGrupoSelecionados}
                                ref={(el) => {
                                  if (el) {
                                    el.indeterminate =
                                      !todosGrupoSelecionados &&
                                      algumGrupoSelecionado;
                                  }
                                }}
                                onChange={() =>
                                  alternarSelecaoGrupo(grupo.itens)
                                }
                                className="rounded border-superficie-300 text-azul-600 focus:ring-azul-500 h-3.5 w-3.5 shrink-0 cursor-pointer"
                                title="Selecionar todos deste grupo"
                              />
                              <span
                                className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                                style={{ backgroundColor: grupo.cor }}
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-superficie-900 truncate">
                                  {grupo.nome}
                                </div>
                                <div className="text-[10px] text-superficie-500 font-mono">
                                  Total:{" "}
                                  <span className="font-bold text-superficie-700">
                                    {totalGrupo}
                                  </span>{" "}
                                  ({grupo.itens.length}{" "}
                                  {grupo.itens.length > 1 ? "itens" : "item"})
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  alternarRecolhimentoGrupo(grupo.chave)
                                }
                                className="p-1 rounded hover:bg-superficie-100 text-superficie-500 transition-colors"
                                title={
                                  recolhido
                                    ? "Expandir grupo"
                                    : "Recolher grupo"
                                }
                              >
                                {recolhido ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {!recolhido && (
                            <div className="p-2 space-y-1.5 divide-y divide-superficie-100/80 bg-white">
                              {grupo.itens.map((it) => {
                                const selecionado =
                                  itemSelecionado?.id === it.id;
                                const marcadoLote =
                                  itensLoteSelecionados.includes(it.id);

                                let distincao = "";
                                if (it.tipo === "ponto") {
                                  distincao = `Ponto #${it.numero}${it.altura !== undefined ? ` · Altura ${it.altura}m` : ""}`;
                                } else if (it.tipo === "distancia") {
                                  distincao = `Extensão: ${formatarMetros(it.comprimentoReal ?? 0)}${it.altura !== undefined ? ` · Cota ${it.altura}m` : ""}`;
                                } else if (it.tipo === "tubulacao_cabo") {
                                  distincao = `${it.metadadosCabo?.circuito ? `Circuito ${it.metadadosCabo.circuito} · ` : ""}${formatarMetros(it.comprimentoReal ?? 0)}${it.metadadosCabo?.tipoCabo ? ` (${it.metadadosCabo.tipoCabo})` : ""}`;
                                } else if (it.tipo === "area") {
                                  distincao = `Área: ${formatarMetrosQuadrados(it.areaReal ?? 0)}${it.perimetroReal ? ` · Perímetro: ${formatarMetros(it.perimetroReal)}` : ""}`;
                                } else if (it.tipo === "descida_subida") {
                                  distincao = `Trecho vertical: ${formatarMetros(it.comprimentoReal ?? 0)} (${it.alturaOrigem ?? 0}m -> ${it.alturaDestino ?? 0}m)`;
                                }

                                return (
                                  <div
                                    key={it.id}
                                    onClick={() => setItemSelecionado(it)}
                                    className={`pt-1.5 first:pt-0 rounded-lg p-2 transition-all text-xs cursor-pointer ${
                                      selecionado
                                        ? "border border-azul-500 bg-azul-50/80 shadow-2xs"
                                        : marcadoLote
                                          ? "bg-azul-50/40 border border-azul-200"
                                          : "hover:bg-superficie-50/70 border border-superficie-100"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        checked={marcadoLote}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() =>
                                          alternarSelecaoItem(it.id)
                                        }
                                        className="rounded border-superficie-300 text-azul-600 focus:ring-azul-500 h-3.5 w-3.5 mt-0.5 shrink-0 cursor-pointer"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-superficie-800 text-[11px] leading-tight font-mono">
                                          {distincao}
                                        </div>
                                        {it.observacao && (
                                          <div className="text-[10px] text-superficie-400 truncate mt-0.5">
                                            {it.observacao}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-1.5 pt-1.5 border-t border-superficie-100 flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          criarTarefaAPartirDeItem(it);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-azul-600 hover:bg-azul-700 text-white text-[10px] font-semibold transition-colors shadow-2xs"
                                        title="Criar tarefa individual"
                                      >
                                        <MapPin className="h-2.5 w-2.5" />
                                        Criar Tarefa
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          excluirItem(it.id);
                                        }}
                                        className="p-1 rounded hover:bg-rose-50 text-superficie-400 hover:text-rose-600 transition-colors"
                                        title="Excluir medição"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-superficie-100 flex items-center justify-between gap-2 mt-auto">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={desfazer}
                  disabled={historicoDesfazer.length === 0}
                  className="p-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-100 disabled:opacity-30"
                  title="Desfazer (Z)"
                >
                  <Undo2 className="h-4 w-4 text-superficie-700" />
                </button>
                <button
                  type="button"
                  onClick={refazer}
                  disabled={historicoRefazer.length === 0}
                  className="p-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-100 disabled:opacity-30"
                  title="Refazer (Y)"
                >
                  <Redo2 className="h-4 w-4 text-superficie-700" />
                </button>
              </div>
              <button
                type="button"
                onClick={resetarTudo}
                className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Tudo
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-superficie-200 bg-white px-4 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFerramenta("navegar");
                    setPontosEmDesenho([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    ferramenta === "navegar"
                      ? "bg-azul-600 text-white shadow-xs"
                      : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                  }`}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                  Navegar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFerramenta("ponto");
                    setPontosEmDesenho([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    ferramenta === "ponto"
                      ? "bg-azul-600 text-white shadow-xs"
                      : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Contar Ponto
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFerramenta("distancia");
                    setPontosEmDesenho([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    ferramenta === "distancia"
                      ? "bg-azul-600 text-white shadow-xs"
                      : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                  }`}
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Distância Linear
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFerramenta("area");
                    setPontosEmDesenho([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    ferramenta === "area"
                      ? "bg-azul-600 text-white shadow-xs"
                      : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                  }`}
                >
                  <Square className="h-3.5 w-3.5" />
                  Medir Área
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFerramenta("calibrar");
                    setPontosCalibracao([]);
                    setCalibrando(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    ferramenta === "calibrar"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  {calibracaoPagina ? "Recalibrar" : "Calibrar"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-superficie-100 p-1 rounded-xl border border-superficie-200">
                  <button
                    type="button"
                    onClick={() => {
                      const proximo: Record<ModoExibicaoMedidas, ModoExibicaoMedidas> = {
                        todas: "sem_circuitos",
                        sem_circuitos: "nenhuma",
                        nenhuma: "todas",
                      };
                      alternarExibicaoMedidas(proximo[modoExibicaoMedidas]);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      modoExibicaoMedidas === "todas"
                        ? "bg-white text-superficie-800 shadow-xs border border-superficie-200"
                        : modoExibicaoMedidas === "sem_circuitos"
                          ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs"
                          : "bg-superficie-200 text-superficie-600"
                    }`}
                    title={
                      modoExibicaoMedidas === "todas"
                        ? "Exibindo todas as medidas na planta (clique para ocultar circuitos)"
                        : modoExibicaoMedidas === "sem_circuitos"
                          ? "Medidas de circuitos ocultas para reduzir poluição (clique para ocultar todas)"
                          : "Todas as medidas ocultas na planta (clique para exibir todas)"
                    }
                  >
                    {modoExibicaoMedidas === "nenhuma" ? (
                      <EyeOff className="h-3.5 w-3.5 text-superficie-500" />
                    ) : modoExibicaoMedidas === "sem_circuitos" ? (
                      <Eye className="h-3.5 w-3.5 text-amber-700" />
                    ) : (
                      <Ruler className="h-3.5 w-3.5 text-superficie-700" />
                    )}
                    <span className="hidden md:inline">
                      {modoExibicaoMedidas === "todas"
                        ? "Medidas: Todas"
                        : modoExibicaoMedidas === "sem_circuitos"
                          ? "Medidas: Sem Circuitos"
                          : "Medidas: Ocultas"}
                    </span>
                  </button>
                </div>
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-1 bg-superficie-100 px-2 py-1 rounded-lg text-xs">
                    <button
                      type="button"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      className="p-0.5 rounded hover:bg-superficie-200 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="font-semibold text-superficie-800">
                      Pág. {pagina} / {totalPaginas}
                    </span>
                    <button
                      type="button"
                      disabled={pagina >= totalPaginas}
                      onClick={() =>
                        setPagina((p) => Math.min(totalPaginas, p + 1))
                      }
                      className="p-0.5 rounded hover:bg-superficie-200 disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEscala((e) => Math.max(0.4, e - 0.2))}
                    className="p-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-100"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5 text-superficie-700" />
                  </button>
                  <span className="text-xs font-mono text-superficie-600 min-w-10 text-center">
                    {Math.round(escala * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setEscala((e) => Math.min(4, e + 0.2))}
                    className="p-1.5 rounded-lg border border-superficie-200 hover:bg-superficie-100"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5 text-superficie-700" />
                  </button>
                </div>
              </div>
            </div>

            {pontosEmDesenho.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-azul-50 px-4 py-2 text-xs font-medium text-azul-900 border border-azul-200">
                <span>
                  {ferramenta === "area"
                    ? `Marcando vértices da área (${pontosEmDesenho.length} pontos marcados)`
                    : `Traçando linha/tubulação (${pontosEmDesenho.length} pontos)`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPontosEmDesenho([])}
                    className="text-superficie-600 hover:underline"
                  >
                    Cancelar
                  </button>
                  <Botao
                    variante="primario"
                    tamanho="sm"
                    onClick={
                      ferramenta === "area"
                        ? finalizarArea
                        : finalizarPolilinhaOuCabo
                    }
                  >
                    Concluir Traçado
                  </Botao>
                </div>
              </div>
            )}

            {loteDescidasPontos.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-2 text-xs font-medium text-purple-900 border border-purple-200">
                <span>
                  Descidas 3D em Lote ({loteDescidasPontos.length} pontos marcados)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLoteDescidasPontos([])}
                    className="text-superficie-600 hover:underline"
                  >
                    Limpar Lote
                  </button>
                  <Botao
                    variante="primario"
                    tamanho="sm"
                    onClick={() => setModalDescidaAberto(true)}
                  >
                    Aplicar Níveis e Criar ({loteDescidasPontos.length})
                  </Botao>
                </div>
              </div>
            )}

            <div
              ref={containerRef}
              onPointerDown={(e) => {
                if (ferramenta === "navegar" || e.button === 1) {
                  panRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    scrollLeft: e.currentTarget.scrollLeft,
                    scrollTop: e.currentTarget.scrollTop,
                  };
                  setArrastandoPan(true);
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                }
              }}
              onPointerMove={(e) => {
                if (panRef.current && containerRef.current) {
                  const dx = e.clientX - panRef.current.startX;
                  const dy = e.clientY - panRef.current.startY;
                  containerRef.current.scrollLeft = panRef.current.scrollLeft - dx;
                  containerRef.current.scrollTop = panRef.current.scrollTop - dy;
                }
              }}
              onPointerUp={(e) => {
                if (panRef.current) {
                  panRef.current = null;
                  setArrastandoPan(false);
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                }
              }}
              className={`relative w-full min-h-[640px] max-h-[780px] overflow-auto rounded-2xl border border-superficie-300 bg-superficie-900/90 shadow-inner select-none ${
                ferramenta === "navegar"
                  ? arrastandoPan
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : ""
              }`}
            >
              <div className="flex justify-center min-w-max min-h-full p-8">
                {urlPdf ? (
                  <div
                    className="relative transition-transform duration-75 shadow-2xl bg-white rounded-lg overflow-hidden select-none"
                    style={{
                      width: dimensoes.largura * escala,
                      height: dimensoes.altura * escala,
                    }}
                  >
                  <Document
                    file={urlPdf}
                    onLoadSuccess={aoCarregarDocumento}
                    loading={
                      <div className="flex h-96 w-full items-center justify-center gap-2 text-white">
                        <Spinner /> Carregando planta...
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pagina}
                      scale={escala}
                      onLoadSuccess={aoCarregarPagina}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  <div
                    ref={overlayRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`absolute inset-0 z-10 ${
                      ferramenta === "navegar"
                        ? arrastandoPan
                          ? "cursor-grabbing"
                          : "cursor-grab"
                        : "cursor-crosshair"
                    }`}
                  >
                    <svg className="w-full h-full pointer-events-none absolute inset-0">
                      {pontoSnap && (() => {
                        const pct = pdfParaPercentual(
                          pontoSnap,
                          dimensoes.largura,
                          dimensoes.altura,
                        );
                        const pxX =
                          (pct.esquerda / 100) * (dimensoes.largura * escala);
                        const pxY =
                          (pct.topo / 100) * (dimensoes.altura * escala);
                        return (
                          <g key="snap-indicator">
                            <circle
                              cx={pxX}
                              cy={pxY}
                              r="8"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              className="animate-pulse"
                            />
                            <circle cx={pxX} cy={pxY} r="3" fill="#10b981" />
                            <rect
                              x={pxX + 8}
                              y={pxY - 9}
                              width="38"
                              height="18"
                              rx="4"
                              fill="#0f172a"
                              fillOpacity="0.85"
                            />
                            <text
                              x={pxX + 27}
                              y={pxY}
                              fill="#10b981"
                              fontSize="10"
                              fontWeight="600"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="select-none font-mono"
                            >
                              Snap
                            </text>
                          </g>
                        );
                      })()}

                      {itens.map((item) => {
                        if (
                          item.tipo === "distancia" ||
                          item.tipo === "tubulacao_cabo"
                        ) {
                          if (item.pontos.length < 2) return null;
                          const d = item.pontos
                            .map((p, idx) => {
                              const pct = pdfParaPercentual(
                                p,
                                dimensoes.largura,
                                dimensoes.altura,
                              );
                              const pxX =
                                (pct.esquerda / 100) * (dimensoes.largura * escala);
                              const pxY =
                                (pct.topo / 100) * (dimensoes.altura * escala);
                              return `${idx === 0 ? "M" : "L"} ${pxX} ${pxY}`;
                            })
                            .join(" ");

                          const pMeio = item.pontos[Math.floor(item.pontos.length / 2)];
                          const pctMeio = pMeio
                            ? pdfParaPercentual(
                                pMeio,
                                dimensoes.largura,
                                dimensoes.altura,
                              )
                            : null;

                          const ativo = itemSelecionado?.id === item.id;
                          const isCabo = item.tipo === "tubulacao_cabo";

                          return (
                            <g key={item.id}>
                              {ativo && isCabo && (
                                <path
                                  d={d}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeWidth={3}
                                  strokeOpacity={0.4}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="pointer-events-none"
                                />
                              )}
                              <path
                                d={d}
                                fill="none"
                                stroke={item.cor}
                                strokeWidth={
                                  isCabo
                                    ? (ativo ? 2.0 : 1.2)
                                    : (ativo
                                        ? configMarcador.espessura * 2.2
                                        : configMarcador.espessura * 1.5)
                                }
                                strokeOpacity={isCabo ? (ativo ? 0.95 : 0.65) : 0.85}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="cursor-pointer pointer-events-auto hover:opacity-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemSelecionado(item);
                                }}
                              />
                              {pctMeio &&
                                item.comprimentoReal !== undefined &&
                                (ativo ||
                                  (isCabo
                                    ? modoExibicaoMedidas === "todas"
                                    : modoExibicaoMedidas !== "nenhuma")) && (
                                  <g
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemSelecionado(item);
                                    }}
                                    className="cursor-pointer pointer-events-auto"
                                  >
                                  {(() => {
                                    const texto = formatarMetros(item.comprimentoReal);
                                    const pxX =
                                      (pctMeio.esquerda / 100) *
                                      (dimensoes.largura * escala);
                                    const pxY =
                                      (pctMeio.topo / 100) *
                                      (dimensoes.altura * escala);
                                    const larguraBadge = Math.max(
                                      52,
                                      texto.length * 7.5 + 14,
                                    );
                                    return (
                                      <>
                                        <rect
                                          x={pxX - larguraBadge / 2}
                                          y={pxY - 18}
                                          width={larguraBadge}
                                          height="20"
                                          rx="5"
                                          fill="#0f172a"
                                          fillOpacity="0.88"
                                          stroke={
                                            ativo
                                              ? "#38bdf8"
                                              : "rgba(255,255,255,0.25)"
                                          }
                                          strokeWidth={ativo ? "1.5" : "0.75"}
                                          className="transition-all"
                                        />
                                        <text
                                          x={pxX}
                                          y={pxY - 8}
                                          fill="#ffffff"
                                          fontSize="10.5"
                                          fontWeight="500"
                                          textAnchor="middle"
                                          dominantBaseline="central"
                                          className="select-none font-mono"
                                        >
                                          {texto}
                                        </text>
                                      </>
                                    );
                                  })()}
                                </g>
                              )}
                            </g>
                          );
                        } else if (item.tipo === "area") {
                          if (item.pontos.length < 3) return null;
                          const d =
                            item.pontos
                              .map((p, idx) => {
                                const pct = pdfParaPercentual(
                                  p,
                                  dimensoes.largura,
                                  dimensoes.altura,
                                );
                                const pxX =
                                  (pct.esquerda / 100) *
                                  (dimensoes.largura * escala);
                                const pxY =
                                  (pct.topo / 100) * (dimensoes.altura * escala);
                                return `${idx === 0 ? "M" : "L"} ${pxX} ${pxY}`;
                              })
                              .join(" ") + " Z";

                          const cx =
                            item.pontos.reduce((acc, p) => acc + p.x, 0) /
                            item.pontos.length;
                          const cy =
                            item.pontos.reduce((acc, p) => acc + p.y, 0) /
                            item.pontos.length;
                          const pctCentro = pdfParaPercentual(
                            { x: cx, y: cy },
                            dimensoes.largura,
                            dimensoes.altura,
                          );

                          const ativo = itemSelecionado?.id === item.id;

                          return (
                            <g key={item.id}>
                              <path
                                d={d}
                                fill={item.cor}
                                fillOpacity={ativo ? 0.38 : 0.22}
                                stroke={item.cor}
                                strokeWidth={
                                  ativo
                                    ? configMarcador.espessura * 1.8
                                    : configMarcador.espessura
                                }
                                className="cursor-pointer pointer-events-auto hover:fill-opacity-35 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemSelecionado(item);
                                }}
                              />
                              {item.areaReal !== undefined &&
                                (ativo || modoExibicaoMedidas !== "nenhuma") && (
                                <g
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemSelecionado(item);
                                  }}
                                  className="cursor-pointer pointer-events-auto"
                                >
                                  {(() => {
                                    const texto = formatarMetrosQuadrados(
                                      item.areaReal,
                                    );
                                    const pxX =
                                      (pctCentro.esquerda / 100) *
                                      (dimensoes.largura * escala);
                                    const pxY =
                                      (pctCentro.topo / 100) *
                                      (dimensoes.altura * escala);
                                    const larguraBadge = Math.max(
                                      62,
                                      texto.length * 7.5 + 16,
                                    );
                                    return (
                                      <>
                                        <rect
                                          x={pxX - larguraBadge / 2}
                                          y={pxY - 10}
                                          width={larguraBadge}
                                          height="20"
                                          rx="5"
                                          fill="#0f172a"
                                          fillOpacity="0.88"
                                          stroke={
                                            ativo
                                              ? "#38bdf8"
                                              : "rgba(255,255,255,0.25)"
                                          }
                                          strokeWidth={ativo ? "1.5" : "0.75"}
                                          className="transition-all"
                                        />
                                        <text
                                          x={pxX}
                                          y={pxY}
                                          fill="#ffffff"
                                          fontSize="10.5"
                                          fontWeight="500"
                                          textAnchor="middle"
                                          dominantBaseline="central"
                                          className="select-none font-mono"
                                        >
                                          {texto}
                                        </text>
                                      </>
                                    );
                                  })()}
                                </g>
                              )}
                            </g>
                          );
                        }
                        return null;
                      })}

                      {pontosEmDesenho.length > 0 && (
                        <path
                          d={pontosEmDesenho
                            .map((p, idx) => {
                              const pct = pdfParaPercentual(
                                p,
                                dimensoes.largura,
                                dimensoes.altura,
                              );
                              const pxX =
                                (pct.esquerda / 100) *
                                (dimensoes.largura * escala);
                              const pxY =
                                (pct.topo / 100) * (dimensoes.altura * escala);
                              return `${idx === 0 ? "M" : "L"} ${pxX} ${pxY}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke={
                            ferramenta === "tubulacao_cabo"
                              ? (metadadosCaboAtivo.cor || "#eab308")
                              : "#38bdf8"
                          }
                          strokeWidth={ferramenta === "tubulacao_cabo" ? "1.5" : "2.5"}
                          strokeOpacity={ferramenta === "tubulacao_cabo" ? 0.75 : 1}
                          strokeDasharray="4 4"
                        />
                      )}
                    </svg>

                    {itens.map((item) => {
                      if (item.tipo === "ponto") {
                        const p = item.pontos[0];
                        if (!p) return null;
                        const pct = pdfParaPercentual(
                          p,
                          dimensoes.largura,
                          dimensoes.altura,
                        );

                        const ativo = itemSelecionado?.id === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemSelecionado(item);
                            }}
                            style={{
                              left: `${pct.esquerda}%`,
                              top: `${pct.topo}%`,
                              backgroundColor: item.cor,
                              width: `${configMarcador.raio}px`,
                              height: `${configMarcador.raio}px`,
                              transform: "translate(-50%, -50%)",
                            }}
                            className={`absolute z-20 rounded-full flex items-center justify-center font-bold text-white shadow-md border cursor-pointer hover:scale-110 transition-transform ${
                              ativo
                                ? "ring-4 ring-azul-400 border-white scale-110"
                                : "border-white"
                            }`}
                            title={`${item.nome} #${item.numero} (${item.altura ?? 0.3}m)`}
                          >
                            <span style={{ fontSize: "10px" }}>
                              {item.numero}
                            </span>
                          </div>
                        );
                      } else if (item.tipo === "descida_subida") {
                        const p = item.pontos[0];
                        if (!p) return null;
                        const pct = pdfParaPercentual(
                          p,
                          dimensoes.largura,
                          dimensoes.altura,
                        );

                        const ativo = itemSelecionado?.id === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemSelecionado(item);
                            }}
                            style={{
                              left: `${pct.esquerda}%`,
                              top: `${pct.topo}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                            className={`absolute z-20 flex flex-col items-center cursor-pointer pointer-events-auto transition-transform ${
                              ativo ? "scale-110" : ""
                            }`}
                            title={`Descida 3D: ${item.nome} (Δ=${item.comprimentoReal?.toFixed(2)}m)`}
                          >
                            <div
                              className={`p-1 rounded-full bg-purple-600 text-white shadow-lg border ${
                                ativo
                                  ? "ring-4 ring-purple-300 border-white"
                                  : "border-white"
                              }`}
                            >
                              <ArrowDownUp className="h-3.5 w-3.5" />
                            </div>
                            {(ativo || modoExibicaoMedidas !== "nenhuma") && (
                              <span className="bg-purple-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow mt-0.5 font-mono">
                                {item.comprimentoReal?.toFixed(2)}m
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}

                    {loteDescidasPontos.map((p, idx) => {
                      const pct = pdfParaPercentual(
                        p,
                        dimensoes.largura,
                        dimensoes.altura,
                      );
                      return (
                        <div
                          key={`lote-desc-${idx}`}
                          style={{
                            left: `${pct.esquerda}%`,
                            top: `${pct.topo}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                          className="absolute z-20 flex flex-col items-center cursor-pointer pointer-events-auto"
                          title={`Lote Descida #${idx + 1}`}
                        >
                          <div className="p-1 rounded-full bg-purple-600 text-white shadow-lg border-2 border-white ring-2 ring-purple-400 animate-pulse">
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </div>
                          <span className="bg-purple-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow mt-0.5">
                            Lote #{idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <LegendaDinamica
                    resumo={resumo}
                    config={configLegenda}
                    aoMudarConfig={setConfigLegenda}
                  />
                </div>
              ) : (
                <div className="text-center py-20 text-white/60">
                  Selecione uma planta cadastrada para iniciar o levantamento.
                </div>
              )}
              </div>

              {itemSelecionado && (
                <div className="sticky bottom-4 left-1/2 -translate-x-1/2 z-30 mx-auto w-fit max-w-[92%] flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-2xl bg-superficie-900/95 text-white shadow-2xl border border-superficie-700/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <label
                      className="relative flex items-center cursor-pointer group"
                      title="Clique para alterar a cor deste item"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/60 shadow-xs inline-block group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: itemSelecionado.cor }}
                      />
                      <input
                        type="color"
                        value={itemSelecionado.cor}
                        onChange={(e) => {
                          const novaCor = e.target.value;
                          const atualizados = itens.map((it) =>
                            it.id === itemSelecionado.id
                              ? {
                                  ...it,
                                  cor: novaCor,
                                  metadadosCabo: it.metadadosCabo
                                    ? { ...it.metadadosCabo, cor: novaCor }
                                    : undefined,
                                }
                              : it,
                          );
                          registrarEstado(atualizados);
                          setItemSelecionado({
                            ...itemSelecionado,
                            cor: novaCor,
                            metadadosCabo: itemSelecionado.metadadosCabo
                              ? {
                                  ...itemSelecionado.metadadosCabo,
                                  cor: novaCor,
                                }
                              : undefined,
                          });
                        }}
                        className="sr-only"
                      />
                    </label>
                    <div className="text-xs truncate">
                      <span className="font-bold text-white">
                        {itemSelecionado.nome}
                      </span>
                      <span className="text-superficie-300 ml-1.5 font-mono">
                        {itemSelecionado.tipo === "area"
                          ? `${formatarMetrosQuadrados(itemSelecionado.areaReal ?? 0)}`
                          : itemSelecionado.tipo === "distancia" ||
                              itemSelecionado.tipo === "tubulacao_cabo" ||
                              itemSelecionado.tipo === "descida_subida"
                            ? `${formatarMetros(itemSelecionado.comprimentoReal ?? 0)}`
                            : `#${itemSelecionado.numero}`}
                      </span>
                      {itemSelecionado.altura !== undefined && (
                        <span className="text-superficie-400 ml-1 text-[11px]">
                          (Cota {itemSelecionado.altura}m)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-4 w-px bg-superficie-700 hidden sm:block shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {itemSelecionado.tipo === "tubulacao_cabo" && (
                      <button
                        type="button"
                        onClick={() => {
                          setItemCaboEmEdicao(itemSelecionado);
                          setModalCaboAberto(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        title="Editar especificações, condutores e cota deste circuito"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>Editar Circuito</span>
                      </button>
                    )}

                    {itemSelecionado.tipo === "ponto" && (
                      <button
                        type="button"
                        onClick={() => {
                          setPontosAlvoDescidaLote([itemSelecionado]);
                          setModalDescidaAberto(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        title="Lançar descida vertical de eletroduto do forro até este ponto"
                      >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        <span>Lançar Descida</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => criarTarefaAPartirDeItem(itemSelecionado)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-azul-600 hover:bg-azul-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                      title="Criar uma tarefa no sistema vinculada a esta medição"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Criar Tarefa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirItem(itemSelecionado.id)}
                      className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      title="Excluir medição"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSelecionado(null)}
                      className="p-1.5 rounded-xl hover:bg-superficie-800 text-superficie-400 hover:text-white transition-colors cursor-pointer"
                      title="Fechar seleção"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {modo === "3d" && (
        <Visualizador3D
          itens={itens}
          resumo={resumo}
          niveis={niveis}
          configLegenda={configLegenda}
          aoMudarConfigLegenda={setConfigLegenda}
          larguraPdf={dimensoes.largura}
          alturaPdf={dimensoes.altura}
          canvasPlanta2D={canvasPlanta2D}
          obraNome={obraAtual?.nome ?? "Obra"}
          plantaNome={plantaAtual?.nome ?? "Planta"}
          pagina={pagina}
        />
      )}

      {modo === "tabelas" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-superficie-200 shadow-sm">
              <span className="text-xs text-superficie-500 font-semibold uppercase tracking-wider block">
                Total de Elementos
              </span>
              <div className="text-2xl font-bold text-azul-700 mt-1">
                {resumo.totalGeralElementos} un
              </div>
              <p className="text-xs text-superficie-500 mt-0.5">
                Em {resumo.elementos.length} tipos de itens
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-superficie-200 shadow-sm">
              <span className="text-xs text-superficie-500 font-semibold uppercase tracking-wider block">
                Tubulações / Distâncias
              </span>
              <div className="text-2xl font-bold text-cyan-700 mt-1">
                {formatarMetros(resumo.totalGeralDistancias)}
              </div>
              <p className="text-xs text-superficie-500 mt-0.5">
                Linhas + descidas verticais
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-superficie-200 shadow-sm">
              <span className="text-xs text-superficie-500 font-semibold uppercase tracking-wider block">
                Cabos e Fiação
              </span>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {formatarMetros(resumo.totalGeralCabos)}
              </div>
              <p className="text-xs text-superficie-500 mt-0.5">
                Soma de fases, neutros, terras, retornos
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-superficie-200 shadow-sm">
              <span className="text-xs text-superficie-500 font-semibold uppercase tracking-wider block">
                Áreas Medidas
              </span>
              <div className="text-2xl font-bold text-pink-700 mt-1">
                {formatarMetrosQuadrados(resumo.totalGeralAreas)}
              </div>
              <p className="text-xs text-superficie-500 mt-0.5">
                {resumo.areas.length} polígonos delimitados
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-superficie-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-superficie-100 font-bold text-superficie-900">
              Resumo de Elementos Contados (Pontos 2D / Cotas 3D)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-superficie-50 text-superficie-600 font-semibold border-b border-superficie-200">
                  <tr>
                    <th className="p-3">Elemento</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Nível / Altura</th>
                    <th className="p-3 text-right">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-superficie-100">
                  {resumo.elementos.map((el) => (
                    <tr key={`${el.subtipo}_${el.nivelNome ?? ""}`}>
                      <td className="p-3 flex items-center gap-2 font-medium text-superficie-900">
                        <span
                          className="w-3 h-3 rounded-full border border-black/20"
                          style={{ backgroundColor: el.cor }}
                        />
                        {el.nome}
                      </td>
                      <td className="p-3 text-superficie-600">{el.categoria}</td>
                      <td className="p-3 text-superficie-600 font-mono">
                        {el.nivelNome ?? "Padrão"}
                      </td>
                      <td className="p-3 text-right font-bold text-superficie-900">
                        {el.quantidade} un
                      </td>
                    </tr>
                  ))}
                  {resumo.elementos.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-6 text-center text-superficie-400 italic"
                      >
                        Nenhum elemento contado nesta página.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-superficie-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-superficie-100 font-bold text-superficie-900">
              Detalhamento de Fiação e Cabos por Circuito
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-superficie-50 text-superficie-600 font-semibold border-b border-superficie-200">
                  <tr>
                    <th className="p-3">Circuito</th>
                    <th className="p-3">Tipo do Cabo / Bitola</th>
                    <th className="p-3">Condutor</th>
                    <th className="p-3">Fase</th>
                    <th className="p-3">Cor do Cabo</th>
                    <th className="p-3">Qtd Condutores</th>
                    <th className="p-3 text-right">Comprimento Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-superficie-100">
                  {resumo.cabos.map((c, idx) => (
                    <tr key={`${c.circuito}_${c.tipoCabo}_${c.funcao}_${c.fase ?? ""}_${c.corCabo ?? ""}_${idx}`}>
                      <td className="p-3 font-bold text-azul-700">
                        <div className="flex items-center gap-2">
                          {c.corCircuito && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: c.corCircuito }}
                              title={`Cor do circuito: ${c.circuito}`}
                            />
                          )}
                          <span>{c.circuito}</span>
                        </div>
                      </td>
                      <td className="p-3 text-superficie-700">
                        <div>{c.tipoCabo}</div>
                        {c.tipoCondutor && (
                          <div className="text-[10px] text-superficie-400 font-mono">
                            {c.tipoCondutor}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-superficie-800">
                        {rotuloCondutor(c.funcao)}
                      </td>
                      <td className="p-3">
                        {c.fase ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold text-[11px] bg-superficie-100 text-superficie-800 border border-superficie-200">
                            Fase {c.fase}
                          </span>
                        ) : (
                          <span className="text-superficie-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {c.corCabo && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/25 shrink-0 shadow-xs"
                              style={{ backgroundColor: c.corCabo }}
                            />
                          )}
                          <span className="text-superficie-700 font-medium">
                            {obterNomeCorCabo(c.corCabo)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-superficie-600">
                        {c.quantidadeCondutores}x
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700">
                        {formatarMetros(c.comprimentoTotal)}
                      </td>
                    </tr>
                  ))}
                  {resumo.cabos.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-6 text-center text-superficie-400 italic"
                      >
                        Nenhum trecho de circuito ou fiação cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Calibragem
        calibracao={
          calibracoes.find(
            (c) => c.planta_id === plantaSelecionadaId && c.pagina === pagina,
          ) ?? null
        }
        pontos={pontosCalibracao}
        podeEditar={podeEditar}
        aoIniciar={() => {
          setFerramenta("calibrar");
          setPontosCalibracao([]);
          setCalibrando(true);
        }}
        aoSalvar={salvarCalibracaoModal}
        aoCancelar={() => {
          setPontosCalibracao([]);
          setCalibrando(false);
          setFerramenta("navegar");
        }}
      />

      <ModalConfigCabo
        aberto={modalCaboAberto}
        niveis={niveis}
        dadosIniciais={itemCaboEmEdicao?.metadadosCabo || metadadosCaboAtivo}
        aoSalvar={salvarConfiguracaoCabo}
        aoFechar={() => {
          setModalCaboAberto(false);
          setItemCaboEmEdicao(null);
        }}
      />

      <ModalEditarCircuitosLote
        aberto={modalEditarLoteCircuitosAberto}
        itensSelecionados={itens.filter(
          (i) =>
            itensLoteSelecionados.includes(i.id) &&
            i.tipo === "tubulacao_cabo",
        )}
        niveis={niveis}
        aoSalvar={salvarEdicaoLoteCircuitos}
        aoFechar={() => setModalEditarLoteCircuitosAberto(false)}
      />

      <ModalDescidaSubida
        aberto={modalDescidaAberto}
        niveis={niveis}
        circuitosDisponiveis={circuitosDisponiveis}
        aoSalvar={salvarDescidaSubida}
        aoFechar={() => {
          setModalDescidaAberto(false);
          setPontoDescidaPendente(null);
          setPontosAlvoDescidaLote([]);
        }}
      />

      <GerenciadorNiveisModal
        aberto={modalNiveisAberto}
        niveis={niveis}
        aoSalvar={handleSalvarNiveis}
        aoFechar={() => setModalNiveisAberto(false)}
      />

      <GerenciadorCategoriasModal
        aberto={modalCategoriasAberto}
        categorias={categorias}
        niveis={niveis}
        aoSalvar={handleSalvarCategorias}
        aoFechar={() => setModalCategoriasAberto(false)}
      />

      <ModalUploadNovaPlanta
        aberto={modalUploadAberto}
        obras={obras}
        obraIdPadrao={obraSelecionadaId}
        aoConcluir={(novoObraId, novaPlantaId) => {
          setModalUploadAberto(false);
          router.push(`/levantamento?obra=${novoObraId}&planta=${novaPlantaId}`);
        }}
        aoFechar={() => setModalUploadAberto(false)}
      />

      {urlPdf && plantaAtual && (
        <ModalExportarPlanta
          aberto={modalExportarAberto}
          aoFechar={() => setModalExportarAberto(false)}
          urlPdf={urlPdf}
          pagina={pagina}
          plantaId={plantaAtual.id}
          obraNome={obraAtual?.nome ?? "Obra"}
          plantaNome={plantaAtual.nome}
          modo="levantamento"
          levantamentoId={levantamentoId}
          itensLevantamento={itens}
          resumoLevantamento={resumo}
          nomeLevantamento={nomeLevantamento}
        />
      )}
    </div>
  );
}
