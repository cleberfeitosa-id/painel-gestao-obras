import type {
  AprovacaoTarefa,
  ExecutorRow,
  PlantaCalibracaoRow,
  PlantaRow,
  PrioridadeTarefa,
  RegiaoPdf,
  StatusTarefa,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";

export type DetalheLocalizacaoLevantamento = {
  elemento?: string;
  subtipo?: string;
  categoria?: string;
  altura?: number;
  pontos?: { x: number; y: number }[];
  comprimento?: number;
  area?: number;
  perimetro?: number;
  quantidade?: number;
  circuito?: string;
  tipoCabo?: string;
  tipoCondutor?: string;
  condutores?: { tipo: string; quantidade: number; cor?: string }[];
  corFase?: string;
  corFaseR?: string;
  corFaseS?: string;
  corFaseT?: string;
  alturaOrigem?: number;
  alturaDestino?: number;
  nivelOrigemId?: string;
  nivelDestinoId?: string;
};

export type TarefaPlanta = {
  id: string;
  titulo: string;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  aprovacao: AprovacaoTarefa;
  prazo: string | null;
  pagina: number | null;
  localizacao_tipo: TipoLocalizacao;
  ponto_x: number | null;
  ponto_y: number | null;
  regiao: RegiaoPdf | null;
  localizacao_detalhe?: DetalheLocalizacaoLevantamento | null;
  planta_id?: string | null;
  responsavel: { nome: string } | null;
  executor: { id: string; nome: string } | null;
  tags_tarefa: { id: string; nome: string } | null;
};

export type ExecutorFiltro = Pick<ExecutorRow, "id" | "nome">;

export type TarefaObraAssociacao = {
  id: string;
  titulo: string;
  localizacao_tipo: TipoLocalizacao;
  planta_id: string | null;
  planta_nome: string | null;
  pagina?: number | null;
  ponto_x?: number | null;
  ponto_y?: number | null;
  regiao?: RegiaoPdf | null;
};

export type PropsAreaPlanta = {
  obraId: string;
  obraNome: string;
  planta: PlantaRow;
  urlPdf: string | null;
  calibracoes: PlantaCalibracaoRow[];
  tarefas: TarefaPlanta[];
  tarefasObra: TarefaObraAssociacao[];
  executores: ExecutorFiltro[];
  tags: { id: string; nome: string }[];
  podeEditar: boolean;
};