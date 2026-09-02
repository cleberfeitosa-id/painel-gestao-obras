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
  | "canaleta_horizontal"
  | "canaleta_vertical"
  | "barramento_espinha_peixe";

export interface DimensaoPadraoComponente {
  tipo: TipoComponenteQuadro;
  nome: string;
  categoria: "disjuntor" | "protecao" | "conexao" | "estrutura" | "barramento";
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
  modulosDin?: number;
  normaReferencia: string;
  descricaoPadrao: string;
  requerTrilhoDin: boolean;
  correntDefaultA?: number;
}

export const MODULO_DIN_MM = 17.5;
export const ALTURA_PADRAO_DISJUNTOR_DIN_MM = 83;
export const ALTURA_PADRAO_TRILHO_DIN_MM = 35;

export const COMPONENTES_CATALOGO_PADRAO: Record<
  TipoComponenteQuadro,
  DimensaoPadraoComponente
> = {
  disjuntor_mono: {
    tipo: "disjuntor_mono",
    nome: "Minidisjuntor 1P (Monopolar)",
    categoria: "disjuntor",
    larguraMm: 17.5,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 1,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético monopolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 16,
  },
  disjuntor_bipolar: {
    tipo: "disjuntor_bipolar",
    nome: "Minidisjuntor 2P (Bipolar)",
    categoria: "disjuntor",
    larguraMm: 35.0,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 2,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético bipolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 32,
  },
  disjuntor_tripolar: {
    tipo: "disjuntor_tripolar",
    nome: "Minidisjuntor 3P (Tripolar)",
    categoria: "disjuntor",
    larguraMm: 52.5,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 3,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético tripolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 50,
  },
  disjuntor_tetrapolar: {
    tipo: "disjuntor_tetrapolar",
    nome: "Minidisjuntor 4P (Tetrapolar)",
    categoria: "disjuntor",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 4,
    normaReferencia: "DIN 43880 / NBR NM 60898",
    descricaoPadrao: "Minidisjuntor termomagnético tetrapolar curva C",
    requerTrilhoDin: true,
    correntDefaultA: 63,
  },
  disjuntor_caixa_moldada_3p: {
    tipo: "disjuntor_caixa_moldada_3p",
    nome: "Disjuntor Caixa Moldada 3P (MCCB)",
    categoria: "disjuntor",
    larguraMm: 105.0,
    alturaMm: 165.0,
    profundidadeMm: 85,
    normaReferencia: "NBR IEC 60947-2",
    descricaoPadrao: "Disjuntor em caixa moldada tripolar para entrada/geral",
    requerTrilhoDin: false,
    correntDefaultA: 125,
  },
  disjuntor_caixa_moldada_4p: {
    tipo: "disjuntor_caixa_moldada_4p",
    nome: "Disjuntor Caixa Moldada 4P (MCCB)",
    categoria: "disjuntor",
    larguraMm: 140.0,
    alturaMm: 165.0,
    profundidadeMm: 85,
    normaReferencia: "NBR IEC 60947-2",
    descricaoPadrao: "Disjuntor em caixa moldada tetrapolar para entrada/geral",
    requerTrilhoDin: false,
    correntDefaultA: 160,
  },
  idr_bipolar: {
    tipo: "idr_bipolar",
    nome: "Interruptor DR 2P (IDR Monofásico)",
    categoria: "protecao",
    larguraMm: 35.0,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 2,
    normaReferencia: "NBR NM 61008-1 / NBR 5410",
    descricaoPadrao: "Interruptor Diferencial Residual 2P 30mA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
  },
  idr_tetrapolar: {
    tipo: "idr_tetrapolar",
    nome: "Interruptor DR 4P (IDR Trifásico)",
    categoria: "protecao",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 70,
    modulosDin: 4,
    normaReferencia: "NBR NM 61008-1 / NBR 5410",
    descricaoPadrao: "Interruptor Diferencial Residual 4P 30mA",
    requerTrilhoDin: true,
    correntDefaultA: 63,
  },
  dps_mono: {
    tipo: "dps_mono",
    nome: "DPS Classe II 1P",
    categoria: "protecao",
    larguraMm: 17.5,
    alturaMm: 83,
    profundidadeMm: 65,
    modulosDin: 1,
    normaReferencia: "NBR IEC 61643-11 / NBR 5410",
    descricaoPadrao: "Dispositivo de Proteção contra Surtos 275V 20/40kA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
  },
  dps_tri_tetra: {
    tipo: "dps_tri_tetra",
    nome: "DPS Multipolo (3P+N)",
    categoria: "protecao",
    larguraMm: 70.0,
    alturaMm: 83,
    profundidadeMm: 65,
    modulosDin: 4,
    normaReferencia: "NBR IEC 61643-11 / NBR 5410",
    descricaoPadrao: "Conjunto DPS Classe II 3P+N 275V 20/40kA",
    requerTrilhoDin: true,
    correntDefaultA: 40,
  },
  borne_fase: {
    tipo: "borne_fase",
    nome: "Borne de Passagem Fase",
    categoria: "conexao",
    larguraMm: 8.0,
    alturaMm: 48.0,
    profundidadeMm: 42,
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
    normaReferencia: "IEC 60947-7-2",
    descricaoPadrao: "Borne terra verde/amarelo aterrado ao trilho",
    requerTrilhoDin: true,
  },
  trilho_din: {
    tipo: "trilho_din",
    nome: "Trilho DIN TS35 Perfurado",
    categoria: "estrutura",
    larguraMm: 500,
    alturaMm: 35.0,
    profundidadeMm: 7.5,
    normaReferencia: "EN 60715 / IEC 60715 (TS35)",
    descricaoPadrao: "Trilho DIN 35mm em aço zincado para fixação de componentes",
    requerTrilhoDin: false,
  },
  canaleta_horizontal: {
    tipo: "canaleta_horizontal",
    nome: "Canaleta Perfurada Horizontal",
    categoria: "estrutura",
    larguraMm: 500,
    alturaMm: 30.0,
    profundidadeMm: 50.0,
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
    normaReferencia: "NBR IEC 61439-1 / DIN 43670",
    descricaoPadrao: "Barramento tipo espinha de peixe com tronco principal e derivações horizontais para disjuntores",
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

export interface DerivacaoBarramento {
  id: string;
  yOffsetMm: number;
  fase: "R" | "S" | "T" | "N";
  larguraDerivacaoMm: number;
  lado: "esquerda" | "direita" | "ambos";
  correnteNominalA: number;
  elementoConectadoId?: string;
}

export interface BarramentoEspinhaPeixe {
  id: string;
  tag: string;
  tipo: "bifasico" | "trifasico";
  correnteSuportadaA: number;
  secaoTroncoMm2: number;
  material: "cobre_eletrolitico" | "aluminio";
  x: number;
  y: number;
  larguraTroncoMm: number;
  alturaMm: number;
  derivacoes: DerivacaoBarramento[];
}

export interface TrilhoDIN {
  id: string;
  tag: string;
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
