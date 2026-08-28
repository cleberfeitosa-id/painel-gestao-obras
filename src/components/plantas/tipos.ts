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
  responsavel: { nome: string } | null;
  executor: { id: string; nome: string } | null;
};

export type ExecutorFiltro = Pick<ExecutorRow, "id" | "nome">;

export type PropsAreaPlanta = {
  obraId: string;
  obraNome: string;
  planta: PlantaRow;
  urlPdf: string | null;
  calibracoes: PlantaCalibracaoRow[];
  tarefas: TarefaPlanta[];
  executores: ExecutorFiltro[];
  podeEditar: boolean;
};