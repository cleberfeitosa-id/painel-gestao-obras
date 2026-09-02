export type TipoComponenteQuadro =
  | "disjuntor_mono"
  | "disjuntor_bipolar"
  | "disjuntor_tripolar"
  | "disjuntor_tetrapolar"
  | "disjuntor_caixa_moldada_3p"
  | "disjuntor_caixa_moldada_4p"
  | "idr_bipolar"
  | "idr_tetrapolar"
  | "dps_mono"
  | "dps_tri_tetra"
  | "borne_fase"
  | "borne_neutro"
  | "borne_terra"
  | "trilho_din"
  | "trilho_din_vertical"
  | "canaleta_horizontal"
  | "canaleta_vertical"
  | "barramento_espinha_peixe"
  | "barramento_terra"
  | "barramento_neutro"
  | string;

export interface DimensaoPadraoComponente {
  tipo: TipoComponenteQuadro;
  nome: string;
  categoria: "disjuntor" | "protecao" | "conexao" | "estrutura" | "barramento" | "outros";
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
  orientacao?: "horizontal" | "vertical";
  modulosDin?: number;
  normaReferencia: string;
  descricaoPadrao: string;
  requerTrilhoDin: boolean;
  correntDefaultA?: number;
  corPersonalizada?: string;
  tensaoV?: number;
  polos?: 1 | 2 | 3 | 4;
  curvaDisjuntor?: "B" | "C" | "D";
  personalizado?: boolean;
}

export const MODULO_DIN_MM = 17.5;
export const ALTURA_PADRAO_DISJUNTOR_DIN_MM = 83;
export const ALTURA_PADRAO_TRILHO_DIN_MM = 35;

export const COMPONENTES_CATALOGO_PADRAO: Record<
  string,
  DimensaoPadraoComponente
> = {
  disjuntor_mono: {
    tipo: "disjuntor_mono",
    nome: "Minidisjuntor 1P (Monopolar)",
    categoria: "disjuntor",
    larguraMm: 17.5,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 1,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético monopolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 16,
    polos: 1,
    curvaDisjuntor: "C",
  },
  disjuntor_bipolar: {
    tipo: "disjuntor_bipolar",
    nome: "Minidisjuntor 2P (Bipolar)",
    categoria: "disjuntor",
    larguraMm: 35.0,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 2,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético bipolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 32,
    polos: 2,
    curvaDisjuntor: "C",
  },
  disjuntor_tripolar: {
    tipo: "disjuntor_tripolar",
    nome: "Minidisjuntor 3P (Tripolar)",
    categoria: "disjuntor",
    larguraMm: 52.5,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 3,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético tripolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 50,
    polos: 3,
    curvaDisjuntor: "C",
  },
  disjuntor_tetrapolar: {
    tipo: "disjuntor_tetrapolar",
    nome: "Minidisjuntor 4P (Tetrapolar)",
    categoria: "disjuntor",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 4,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético tetrapolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 63,
    polos: 4,
    curvaDisjuntor: "C",
  },
  disjuntor_caixa_moldada_3p: {
    tipo: "disjuntor_caixa_moldada_3p",
    nome: "Disjuntor Caixa Moldada 3P (MCCB)",
    categoria: "disjuntor",
    larguraMm: 105.0,
    alturaMm: 165.0,
    profundidadeMm: 85,
    orientacao: "vertical",
    normaReferencia: "NBR IEC 60947-2",
    descricaoPadrao: "Disjuntor em caixa moldada tripolar para entrada/geral",
    requerTrilhoDin: false,
    correntDefaultA: 125,
    polos: 3,
  },
  disjuntor_caixa_moldada_4p: {
    tipo: "disjuntor_caixa_moldada_4p",
    nome: "Disjuntor Caixa Moldada 4P (MCCB)",
    categoria: "disjuntor",
    larguraMm: 140.0,
    alturaMm: 165.0,
    profundidadeMm: 85,
    orientacao: "vertical",
    normaReferencia: "NBR IEC 60947-2",
    descricaoPadrao: "Disjuntor em caixa moldada tetrapolar para entrada/geral",
    requerTrilhoDin: false,
    correntDefaultA: 160,
    polos: 4,
  },
  idr_bipolar: {
    tipo: "idr_bipolar",
    nome: "Interruptor DR 2P (IDR Monofásico)",
    categoria: "protecao",
    larguraMm: 35.0,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 2,
    normaReferencia: "NBR NM 61008-1 / NBR 5410",
    descricaoPadrao: "Interruptor Diferencial Residual 2P 30mA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
    polos: 2,
  },
  idr_tetrapolar: {
    tipo: "idr_tetrapolar",
    nome: "Interruptor DR 4P (IDR Trifásico)",
    categoria: "protecao",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 70,
    orientacao: "vertical",
    modulosDin: 4,
    normaReferencia: "NBR NM 61008-1 / NBR 5410",
    descricaoPadrao: "Interruptor Diferencial Residual 4P 30mA",
    requerTrilhoDin: true,
    correntDefaultA: 63,
    polos: 4,
  },
  dps_mono: {
    tipo: "dps_mono",
    nome: "DPS Classe II 1P",
    categoria: "protecao",
    larguraMm: 17.5,
    alturaMm: 83,
    profundidadeMm: 65,
    orientacao: "vertical",
    modulosDin: 1,
    normaReferencia: "NBR IEC 61643-11 / NBR 5410",
    descricaoPadrao: "Dispositivo de Proteção contra Surtos 275V 20/40kA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
    polos: 1,
  },
  dps_tri_tetra: {
    tipo: "dps_tri_tetra",
    nome: "DPS Multipolo (3P+N)",
    categoria: "protecao",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 65,
    orientacao: "vertical",
    modulosDin: 4,
    normaReferencia: "NBR IEC 61643-11 / NBR 5410",
    descricaoPadrao: "Conjunto DPS Classe II 3P+N 275V 20/40kA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
    polos: 4,
  },
  borne_fase: {
    tipo: "borne_fase",
    nome: "Borne de Passagem Fase",
    categoria: "conexao",
    larguraMm: 8.0,
    alturaMm: 48.0,
    profundidadeMm: 42,
    orientacao: "vertical",
    normaReferencia: "IEC 60947-7-1",
    descricaoPadrao: "Borne de passagem cinza para conexão de condutores fase",
    requerTrilhoDin: true,
    correntDefaultA: 41,
  },
  borne_neutro: {
    tipo: "borne_neutro",
    nome: "Borne de Passagem Neutro (Azul)",
    categoria: "conexao",
    larguraMm: 8.0,
    alturaMm: 48.0,
    profundidadeMm: 42,
    orientacao: "vertical",
    normaReferencia: "IEC 60947-7-1",
    descricaoPadrao: "Borne de passagem azul para condutores neutro",
    requerTrilhoDin: true,
    correntDefaultA: 41,
  },
  borne_terra: {
    tipo: "borne_terra",
    nome: "Borne de Proteção Terra (Verde/Amarelo)",
    categoria: "conexao",
    larguraMm: 8.0,
    alturaMm: 48.0,
    profundidadeMm: 42,
    orientacao: "vertical",
    normaReferencia: "IEC 60947-7-2",
    descricaoPadrao: "Borne terra verde/amarelo aterrado ao trilho",
    requerTrilhoDin: true,
  },
  trilho_din: {
    tipo: "trilho_din",
    nome: "Trilho DIN TS35 Perfurado Horizontal",
    categoria: "estrutura",
    larguraMm: 500,
    alturaMm: 35.0,
    profundidadeMm: 7.5,
    orientacao: "horizontal",
    normaReferencia: "EN 60715 / IEC 60715 (TS35)",
    descricaoPadrao: "Trilho DIN 35mm horizontal em aço zincado para fixação de componentes",
    requerTrilhoDin: false,
  },
  trilho_din_vertical: {
    tipo: "trilho_din_vertical",
    nome: "Trilho DIN TS35 Vertical",
    categoria: "estrutura",
    larguraMm: 35.0,
    alturaMm: 500,
    profundidadeMm: 7.5,
    orientacao: "vertical",
    normaReferencia: "EN 60715 / IEC 60715 (TS35)",
    descricaoPadrao: "Trilho DIN 35mm vertical em aço zincado para fixação de componentes e bornes",
    requerTrilhoDin: false,
  },
  canaleta_horizontal: {
    tipo: "canaleta_horizontal",
    nome: "Canaleta Perfurada Horizontal",
    categoria: "estrutura",
    larguraMm: 500,
    alturaMm: 30.0,
    profundidadeMm: 50.0,
    orientacao: "horizontal",
    normaReferencia: "IEC 61084 / NBR 15715",
    descricaoPadrao: "Canaleta de fiação perfurada horizontal em PVC antichama",
    requerTrilhoDin: false,
  },
  canaleta_vertical: {
    tipo: "canaleta_vertical",
    nome: "Canaleta Perfurada Vertical",
    categoria: "estrutura",
    larguraMm: 30.0,
    alturaMm: 600,
    profundidadeMm: 50.0,
    orientacao: "vertical",
    normaReferencia: "IEC 61084 / NBR 15715",
    descricaoPadrao: "Canaleta de fiação perfurada vertical lateral em PVC antichama",
    requerTrilhoDin: false,
  },
  barramento_espinha_peixe: {
    tipo: "barramento_espinha_peixe",
    nome: "Barramento Espinha de Peixe Trifásico/Bifásico",
    categoria: "barramento",
    larguraMm: 120.0,
    alturaMm: 350.0,
    profundidadeMm: 25.0,
    orientacao: "vertical",
    normaReferencia: "NBR IEC 61439-1 / DIN 43670",
    descricaoPadrao: "Barramento tipo espinha de peixe com tronco principal (3 barras paralelas) e derivações horizontais",
    requerTrilhoDin: false,
    correntDefaultA: 100,
  },
  barramento_terra: {
    tipo: "barramento_terra",
    nome: "Barramento de Terra (PE) com Bornes/Furos",
    categoria: "barramento",
    larguraMm: 200.0,
    alturaMm: 20.0,
    profundidadeMm: 15.0,
    orientacao: "horizontal",
    normaReferencia: "NBR 5410 / IEC 60947-7-2",
    descricaoPadrao: "Barramento de proteção e equipotencialização terra em latão/cobre com furos e parafusos para condutores PE",
    requerTrilhoDin: false,
    correntDefaultA: 100,
  },
  barramento_neutro: {
    tipo: "barramento_neutro",
    nome: "Barramento de Neutro (N) Isolado com Bornes/Furos",
    categoria: "barramento",
    larguraMm: 200.0,
    alturaMm: 20.0,
    profundidadeMm: 15.0,
    orientacao: "horizontal",
    normaReferencia: "NBR 5410 / IEC 60947-7-1",
    descricaoPadrao: "Barramento de neutro isolado em latão/cobre com furos e parafusos para condutores N",
    requerTrilhoDin: false,
    correntDefaultA: 100,
  },
};

export interface ElementoQuadro {
  id: string;
  tipo: TipoComponenteQuadro;
  tag: string;
  descricao: string;
  x: number;
  y: number;
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
  orientacao?: "horizontal" | "vertical";
  trilhoId?: string;
  posicaoModuloNoTrilho?: number;
  correnteNominal?: number;
  curvaDisjuntor?: "B" | "C" | "D";
  polos?: 1 | 2 | 3 | 4;
  tensaoV?: number;
  sensibilidadeDrMa?: number;
  secaoCaboMm2?: number;
  circuitoAssociadoId?: string;
  circuitoAssociadoNome?: string;
  corPersonalizada?: string;
}

export type UnidadeMedidaBarramento = "mm" | "pol";

export interface DerivacaoBarramento {
  id: string;
  yOffsetMm: number;
  fase: "R" | "S" | "T" | "N";
  larguraDerivacaoMm: number;
  espessuraDerivacaoMm?: number;
  comprimentoDerivacaoMm?: number;
  lado: "esquerda" | "direita" | "ambos";
  correnteNominalA: number;
  elementoConectadoId?: string;
}

export interface BarramentoEspinhaPeixe {
  id: string;
  tag: string;
  tipo: "monofasico" | "bifasico" | "trifasico" | "tetrapolar";
  correnteSuportadaA: number;
  secaoTroncoMm2: number;
  material: "cobre_eletrolitico" | "aluminio";
  x: number;
  y: number;
  unidadeMedida?: UnidadeMedidaBarramento;
  larguraBarraIndividualMm?: number;
  espessuraBarraMm?: number;
  espacamentoEntreBarrasMm?: number;
  larguraTroncoMm: number;
  alturaMm: number;
  espacamentoDerivacoesMm?: number;
  larguraDerivacaoMm?: number;
  espessuraDerivacaoMm?: number;
  comprimentoDerivacaoMm?: number;
  derivacoes: DerivacaoBarramento[];
}

export interface FuroBarramento {
  id: string;
  posicaoMm: number;
  diametroMm: number;
  secaoMaximaMm2?: number;
  circuitoConectadoId?: string;
  circuitoConectadoNome?: string;
  rotulo?: string;
}

export interface BarramentoNeutroTerra {
  id: string;
  tag: string;
  tipo: "terra" | "neutro";
  orientacao: "horizontal" | "vertical";
  x: number;
  y: number;
  comprimentoMm: number;
  larguraMm: number;
  profundidadeMm: number;
  correnteSuportadaA: number;
  material: "latao" | "cobre_eletrolitico";
  diametroFuroPadraoMm: number;
  espacamentoFurosMm: number;
  furos: FuroBarramento[];
}

export interface TrilhoDIN {
  id: string;
  tag: string;
  orientacao?: "horizontal" | "vertical";
  x: number;
  y: number;
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
}

export interface CanaletaFiacao {
  id: string;
  tag: string;
  orientacao: "horizontal" | "vertical";
  x: number;
  y: number;
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
}

export interface QuadroEletricoLayout {
  elementos: ElementoQuadro[];
  trilhos: TrilhoDIN[];
  canaletas: CanaletaFiacao[];
  barramentos: BarramentoEspinhaPeixe[];
  barramentosNeutroTerra?: BarramentoNeutroTerra[];
}

export interface CircuitoVinculado {
  id: string;
  tag: string;
  descricao?: string;
  origem: "levantamento" | "tarefa" | "manual";
  origemId?: string;
  condutor?: string;
  secaoMm2?: number;
  correnteNominalA?: number;
  elementoId?: string;
}

export interface QuadroTemplateItem {
  id: string;
  nome: string;
  descricao: string | null;
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
  publico: boolean;
}

export interface ItemListaMateriais {
  item: string;
  especificacao: string;
  quantidade: number;
  unidade: string;
  norma: string;
  detalhes: string;
}

export const POLEGADAS_PADRAO: Array<{ fracao: string; pol: number; mm: number }> = [
  { fracao: '1/8"', pol: 1 / 8, mm: 3.175 },
  { fracao: '3/16"', pol: 3 / 16, mm: 4.7625 },
  { fracao: '1/4"', pol: 1 / 4, mm: 6.35 },
  { fracao: '5/16"', pol: 5 / 16, mm: 7.9375 },
  { fracao: '3/8"', pol: 3 / 8, mm: 9.525 },
  { fracao: '1/2"', pol: 1 / 2, mm: 12.7 },
  { fracao: '5/8"', pol: 5 / 8, mm: 15.875 },
  { fracao: '3/4"', pol: 3 / 4, mm: 19.05 },
  { fracao: '7/8"', pol: 7 / 8, mm: 22.225 },
  { fracao: '1"', pol: 1, mm: 25.4 },
  { fracao: '1.1/4"', pol: 1.25, mm: 31.75 },
  { fracao: '1.1/2"', pol: 1.5, mm: 38.1 },
  { fracao: '2"', pol: 2, mm: 50.8 },
  { fracao: '2.1/2"', pol: 2.5, mm: 63.5 },
  { fracao: '3"', pol: 3, mm: 76.2 },
];

export function mmParaPolegadaTexto(mm: number): string {
  if (!mm || mm <= 0) return '0"';
  const maisProxima = POLEGADAS_PADRAO.reduce((prev, curr) =>
    Math.abs(curr.mm - mm) < Math.abs(prev.mm - mm) ? curr : prev,
  );
  if (Math.abs(maisProxima.mm - mm) < 0.3) {
    return maisProxima.fracao;
  }
  const valorPol = mm / 25.4;
  return `${valorPol.toFixed(2)}"`;
}

export function polegadaParaMm(pol: number): number {
  return Number((pol * 25.4).toFixed(2));
}
