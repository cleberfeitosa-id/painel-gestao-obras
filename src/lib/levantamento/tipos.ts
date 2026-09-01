import type { PontoPdf, RegiaoPdf } from "@/lib/supabase/database.types";

export type PosicaoLegenda = "nw" | "ne" | "sw" | "se";

export interface Nivel3D {
  id: string;
  nome: string;
  cota: number;
  cor: string;
  padrao?: boolean;
}

export type TipoGeometriaLevantamento =
  | "ponto"
  | "distancia"
  | "area"
  | "tubulacao_cabo"
  | "descida_subida";

export interface TipoElementoLevantamento {
  id: string;
  nome: string;
  cor: string;
  categoria: string;
  tipoGeometria: TipoGeometriaLevantamento;
  alturaPadrao?: number;
  nivelPadraoId?: string;
  simbolo?: string;
}

export interface CategoriaPredefinicao {
  nome: string;
  elementos: TipoElementoLevantamento[];
}

export type FuncaoCondutor = "fase" | "neutro" | "terra" | "retorno";

export interface FaseCabo {
  nome: string;
  cor: string;
  quantidade: number;
}

export interface CondutorCabo {
  tipo: FuncaoCondutor;
  quantidade: number;
  secaoMm2?: string;
  cor?: string;
  fase?: string;
}

export const CORES_PADRAO_CONDUTOR = {
  faseR: "#FFFFFF",
  faseS: "#000000",
  faseT: "#EF4444",
  neutro: "#2563EB",
  terra: "#16A34A",
  retorno: "#F59E0B",
} as const;

export interface MetadadosCabo {
  circuito: string;
  tipoCabo: string;
  tipoCondutor: string;
  condutores: CondutorCabo[];
  fases?: FaseCabo[];
  nivelId?: string;
  altura?: number;
  observacao?: string;
  cor?: string;
  corFase?: string;
  corFaseR?: string;
  corFaseS?: string;
  corFaseT?: string;
}

export interface ItemLevantamento {
  id: string;
  numero: number;
  tipo: TipoGeometriaLevantamento;
  categoria: string;
  subtipo: string;
  nome: string;
  cor: string;
  pontos: PontoPdf[];
  regiao?: RegiaoPdf;
  nivelId?: string;
  altura?: number;
  nivelOrigemId?: string;
  alturaOrigem?: number;
  nivelDestinoId?: string;
  alturaDestino?: number;
  circuito?: string;
  comprimentoReal?: number;
  areaReal?: number;
  perimetroReal?: number;
  metadadosCabo?: MetadadosCabo;
  observacao?: string;
  criadoEm?: string;
}

export interface ConfigLegenda {
  posicao: PosicaoLegenda;
  tamanhoFonte: number;
  corFundo: string;
  corTexto: string;
  opacidade: number;
  visivel: boolean;
}

export interface ResumoItemElemento {
  subtipo: string;
  nome: string;
  categoria: string;
  cor: string;
  quantidade: number;
  nivelNome?: string;
}

export interface ResumoItemDistancia {
  subtipo: string;
  nome: string;
  categoria: string;
  cor: string;
  totalMetros: number;
  quantidadeTrechos: number;
}

export interface ResumoItemCabo {
  circuito: string;
  corCircuito?: string;
  tipoCabo: string;
  tipoCondutor: string;
  funcao: FuncaoCondutor;
  fase?: string;
  corCabo?: string;
  quantidadeCondutores: number;
  comprimentoTotal: number;
}

export interface ResumoItemCaboPorTipo {
  tipoCabo: string;
  funcao: FuncaoCondutor;
  corCabo?: string;
  comprimentoTotal: number;
}

export interface ResumoItemArea {
  subtipo: string;
  nome: string;
  categoria: string;
  cor: string;
  totalArea: number;
  totalPerimetro: number;
  quantidade: number;
}

export interface ResumoItemDescidaSubida {
  nome: string;
  subtipo: string;
  cor: string;
  alturaTotal: number;
  quantidade: number;
}

export interface ResumoLevantamento {
  elementos: ResumoItemElemento[];
  distancias: ResumoItemDistancia[];
  cabos: ResumoItemCabo[];
  cabosPorTipo: ResumoItemCaboPorTipo[];
  areas: ResumoItemArea[];
  descidasSubidas: ResumoItemDescidaSubida[];
  totalGeralElementos: number;
  totalGeralDistancias: number;
  totalGeralCabos: number;
  totalGeralAreas: number;
}

export const NIVEIS_PADRAO: Nivel3D[] = [
  { id: "piso", nome: "Piso (0.00m)", cota: 0.0, cor: "#94a3b8", padrao: true },
  { id: "tomada_baixa", nome: "Tomada Baixa (0.30m)", cota: 0.3, cor: "#cbb0ff", padrao: true },
  { id: "tomada_media", nome: "Média / Interruptor (1.20m)", cota: 1.2, cor: "#b482f0", padrao: true },
  { id: "tomada_alta", nome: "Tomada Alta (2.20m)", cota: 2.2, cor: "#9664dc", padrao: true },
  { id: "forro_teto", nome: "Forro / Teto (2.80m)", cota: 2.8, cor: "#38bdf8", padrao: true },
];

export const CATEGORIAS_PADRAO: CategoriaPredefinicao[] = [
  {
    nome: "Elétrica",
    elementos: [
      { id: "tomada_bx", nome: "Tomada Baixa", cor: "#cbb0ff", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 0.3, nivelPadraoId: "tomada_baixa" },
      { id: "tomada_md", nome: "Tomada Média", cor: "#b482f0", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 1.2, nivelPadraoId: "tomada_media" },
      { id: "tomada_alt", nome: "Tomada Alta", cor: "#9664dc", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 2.2, nivelPadraoId: "tomada_alta" },
      { id: "interruptor", nome: "Interruptor", cor: "#e6e6fa", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 1.2, nivelPadraoId: "tomada_media" },
      { id: "interruptor_tomada", nome: "Interruptor + Tomada", cor: "#ffb6c1", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 1.2, nivelPadraoId: "tomada_media" },
      { id: "luminaria", nome: "Luminária", cor: "#00ffff", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "luminaria_embutir", nome: "Luminária Embutir", cor: "#00c8c8", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "refletor", nome: "Refletor", cor: "#ffff00", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "quadro", nome: "Quadro Elétrico (QDC)", cor: "#90ee90", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 1.6, nivelPadraoId: "tomada_media" },
      { id: "caixa_passagem", nome: "Caixa de Passagem 4x2 / 4x4", cor: "#9370db", categoria: "Elétrica", tipoGeometria: "ponto", alturaPadrao: 1.2, nivelPadraoId: "tomada_media" },
    ],
  },
  {
    nome: "Tubulações e Cabos",
    elementos: [
      { id: "eletroduto_pvc", nome: "Eletroduto Corrugado 3/4\"", cor: "#fb923c", categoria: "Tubulações e Cabos", tipoGeometria: "distancia", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "eletroduto_1pol", nome: "Eletroduto Rígido 1\"", cor: "#f97316", categoria: "Tubulações e Cabos", tipoGeometria: "distancia", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "tubo_cabo_eletrico", nome: "Trecho de Circuito / Cabos", cor: "#eab308", categoria: "Tubulações e Cabos", tipoGeometria: "tubulacao_cabo", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "descida_eletroduto", nome: "Descida/Subida Vertical de Eletroduto", cor: "#a855f7", categoria: "Tubulações e Cabos", tipoGeometria: "descida_subida", alturaPadrao: 1.6 },
    ],
  },
  {
    nome: "SPDA",
    elementos: [
      { id: "spda_captador", nome: "Captador SPDA", cor: "#ff0000", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "spda_haste", nome: "Haste de Aterramento", cor: "#c80000", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "spda_cabo", nome: "Cabo de Cobre Nu 50mm²", cor: "#0000c8", categoria: "SPDA", tipoGeometria: "distancia", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "spda_mao_franca", nome: "Mão Francesa", cor: "#0064ff", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "spda_terminal", nome: "Terminal Aéreo", cor: "#ff00ff", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "spda_aterramento", nome: "Caixa de Inspeção Aterramento", cor: "#8b4513", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "spda_primerio", nome: "Conector Estanhado", cor: "#ffa500", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "spda_isolador", nome: "Isolador Guia", cor: "#808000", categoria: "SPDA", tipoGeometria: "ponto", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
    ],
  },
  {
    nome: "Hidráulica e Junções",
    elementos: [
      { id: "curva_90_pvc", nome: "Curva 90° PVC", cor: "#00ced1", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "joelho_90_pvc", nome: "Joelho 90° PVC", cor: "#20b2aa", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "curva_45_pvc", nome: "Curva 45° PVC", cor: "#48d1cc", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "joelho_45_pvc", nome: "Joelho 45° PVC", cor: "#40e0d0", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "tee_pvc", nome: "Tê PVC", cor: "#5f9ea0", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "reducao_pvc", nome: "Redução PVC", cor: "#778899", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "luva_pvc", nome: "Luva PVC", cor: "#8fbc8f", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.5, nivelPadraoId: "piso" },
      { id: "registro", nome: "Registro de Gaveta / Pressão", cor: "#cd853f", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 1.2, nivelPadraoId: "tomada_media" },
      { id: "caixa_inspecao", nome: "Caixa de Inspeção / Gordura", cor: "#dda0dd", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "ralo", nome: "Ralo Sifonado", cor: "#b0c4de", categoria: "Hidráulica e Junções", tipoGeometria: "ponto", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "tubo_agua_fria", nome: "Tubulação PVC Água Fria 25mm", cor: "#0284c7", categoria: "Hidráulica e Junções", tipoGeometria: "distancia", alturaPadrao: 0.3, nivelPadraoId: "tomada_baixa" },
      { id: "tubo_esgoto_100", nome: "Tubulação Esgoto PVC 100mm", cor: "#78716c", categoria: "Hidráulica e Junções", tipoGeometria: "distancia", alturaPadrao: 0.0, nivelPadraoId: "piso" },
    ],
  },
  {
    nome: "Bombas e Equipamentos",
    elementos: [
      { id: "bomba", nome: "Bomba Hidráulica", cor: "#ffa500", categoria: "Bombas e Equipamentos", tipoGeometria: "ponto", alturaPadrao: 0.3, nivelPadraoId: "tomada_baixa" },
      { id: "quadro_comando", nome: "Quadro de Comando da Bomba", cor: "#ff6347", categoria: "Bombas e Equipamentos", tipoGeometria: "ponto", alturaPadrao: 1.5, nivelPadraoId: "tomada_media" },
      { id: "ventilador", nome: "Ventilador / Exaustor", cor: "#64c864", categoria: "Bombas e Equipamentos", tipoGeometria: "ponto", alturaPadrao: 2.5, nivelPadraoId: "forro_teto" },
      { id: "reservatorio", nome: "Reservatório / Caixa d'Água", cor: "#009696", categoria: "Bombas e Equipamentos", tipoGeometria: "ponto", alturaPadrao: 0.0, nivelPadraoId: "piso" },
    ],
  },
  {
    nome: "Áreas e Acabamentos",
    elementos: [
      { id: "area_piso", nome: "Área de Piso Cerâmico / Porcelanato", cor: "#10b981", categoria: "Áreas e Acabamentos", tipoGeometria: "area", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "area_pintura", nome: "Área de Pintura / Teto", cor: "#3b82f6", categoria: "Áreas e Acabamentos", tipoGeometria: "area", alturaPadrao: 2.8, nivelPadraoId: "forro_teto" },
      { id: "area_impermeabilizacao", nome: "Área de Impermeabilização", cor: "#ec4899", categoria: "Áreas e Acabamentos", tipoGeometria: "area", alturaPadrao: 0.0, nivelPadraoId: "piso" },
      { id: "area_alvenaria", nome: "Área de Alvenaria / Drywall", cor: "#8b5cf6", categoria: "Áreas e Acabamentos", tipoGeometria: "area", alturaPadrao: 0.0, nivelPadraoId: "piso" },
    ],
  },
];

export const CONFIG_LEGENDA_PADRAO: ConfigLegenda = {
  posicao: "se",
  tamanhoFonte: 13,
  corFundo: "#0f172a",
  corTexto: "#f8fafc",
  opacidade: 235,
  visivel: true,
};
