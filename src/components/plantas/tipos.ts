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