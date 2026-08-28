import type {
  AprovacaoTarefa,
  MomentoAnexo,
  PapelUsuario,
  PrioridadeTarefa,
  StatusObra,
  StatusTarefa,
  TipoAnexo,
} from "@/lib/supabase/database.types";

type Opcao<T extends string> = { valor: T; rotulo: string; classe: string };

export const STATUS_TAREFA: Record<StatusTarefa, Opcao<StatusTarefa>> = {
  pendente: {
    valor: "pendente",
    rotulo: "Pendente",
    classe: "bg-slate-100 text-slate-700 ring-slate-600/20",
  },
  em_execucao: {
    valor: "em_execucao",
    rotulo: "Em execução",
    classe: "bg-amber-100 text-amber-800 ring-amber-600/25",
  },
  concluido: {
    valor: "concluido",
    rotulo: "Concluído",
    classe: "bg-emerald-100 text-emerald-800 ring-emerald-600/25",
  },
};

export const PRIORIDADE_TAREFA: Record<
  PrioridadeTarefa,
  Opcao<PrioridadeTarefa> & { peso: number }
> = {
  baixa: {
    valor: "baixa",
    rotulo: "Baixa",
    peso: 1,
    classe: "bg-sky-100 text-sky-800 ring-sky-600/25",
  },
  media: {
    valor: "media",
    rotulo: "Média",
    peso: 2,
    classe: "bg-slate-100 text-slate-700 ring-slate-600/20",
  },
  alta: {
    valor: "alta",
    rotulo: "Alta",
    peso: 3,
    classe: "bg-orange-100 text-orange-800 ring-orange-600/25",
  },
  urgente: {
    valor: "urgente",
    rotulo: "Urgente",
    peso: 4,
    classe: "bg-red-100 text-red-800 ring-red-600/25",
  },
};

export const STATUS_OBRA: Record<StatusObra, Opcao<StatusObra>> = {
  planejamento: {
    valor: "planejamento",
    rotulo: "Planejamento",
    classe: "bg-slate-100 text-slate-700 ring-slate-600/20",
  },
  em_andamento: {
    valor: "em_andamento",
    rotulo: "Em andamento",
    classe: "bg-blue-100 text-blue-800 ring-blue-600/25",
  },
  pausada: {
    valor: "pausada",
    rotulo: "Pausada",
    classe: "bg-amber-100 text-amber-800 ring-amber-600/25",
  },
  concluida: {
    valor: "concluida",
    rotulo: "Concluída",
    classe: "bg-emerald-100 text-emerald-800 ring-emerald-600/25",
  },
};

export const PAPEL_USUARIO: Record<PapelUsuario, { rotulo: string }> = {
  admin: { rotulo: "Administrador" },
  gestor: { rotulo: "Gestor" },
  colaborador: { rotulo: "Colaborador" },
};

export const TIPO_ANEXO: Record<TipoAnexo, { rotulo: string; plural: string }> =
  {
    imagem: { rotulo: "Imagem", plural: "Imagens" },
    video: { rotulo: "Vídeo", plural: "Vídeos" },
    arquivo: { rotulo: "Arquivo", plural: "Arquivos" },
  };

export const MOMENTO_ANEXO: Record<MomentoAnexo, { rotulo: string }> = {
  criacao: { rotulo: "Abertura" },
  andamento: { rotulo: "Andamento" },
  conclusao: { rotulo: "Conclusão" },
};

export const APROVACAO_TAREFA: Record<AprovacaoTarefa, Opcao<AprovacaoTarefa>> = {
  pendente: {
    valor: "pendente",
    rotulo: "Aguardando validação",
    classe: "bg-slate-100 text-slate-700 ring-slate-600/20",
  },
  aprovado: {
    valor: "aprovado",
    rotulo: "Aprovado",
    classe: "bg-emerald-100 text-emerald-800 ring-emerald-600/25",
  },
  reprovado: {
    valor: "reprovado",
    rotulo: "Reprovado",
    classe: "bg-red-100 text-red-800 ring-red-600/25",
  },
};

// A planta pinta o pino por SITUACAO: a aprovacao do supervisor tem precedencia
// sobre o status de execucao, por isso as duas colunas viram um valor unico.
export type SituacaoTarefa = StatusTarefa | "aprovado" | "reprovado";

export const SITUACAO_TAREFA: Record<
  SituacaoTarefa,
  { valor: SituacaoTarefa; rotulo: string; classe: string; pino: string; regiao: string }
> = {
  pendente: {
    valor: "pendente",
    rotulo: "Não iniciado",
    classe: STATUS_TAREFA.pendente.classe,
    pino: "bg-slate-400",
    regiao: "border-slate-400/80 bg-slate-400/10",
  },
  em_execucao: {
    valor: "em_execucao",
    rotulo: "Em execução",
    classe: STATUS_TAREFA.em_execucao.classe,
    pino: "bg-amber-500",
    regiao: "border-amber-500/80 bg-amber-500/10",
  },
  concluido: {
    valor: "concluido",
    rotulo: "Concluído",
    classe: STATUS_TAREFA.concluido.classe,
    pino: "bg-sky-500",
    regiao: "border-sky-500/80 bg-sky-500/10",
  },
  aprovado: {
    valor: "aprovado",
    rotulo: "Aprovado",
    classe: APROVACAO_TAREFA.aprovado.classe,
    pino: "bg-emerald-500",
    regiao: "border-emerald-500/80 bg-emerald-500/10",
  },
  reprovado: {
    valor: "reprovado",
    rotulo: "Reprovado",
    classe: APROVACAO_TAREFA.reprovado.classe,
    pino: "bg-red-500",
    regiao: "border-red-500/80 bg-red-500/10",
  },
};

export function situacaoDaTarefa(tarefa: {
  status: StatusTarefa;
  aprovacao: AprovacaoTarefa;
}): SituacaoTarefa {
  if (tarefa.aprovacao === "aprovado") return "aprovado";
  if (tarefa.aprovacao === "reprovado") return "reprovado";
  return tarefa.status;
}

export const OPCOES_APROVACAO = Object.values(APROVACAO_TAREFA);
export const OPCOES_SITUACAO_TAREFA = Object.values(SITUACAO_TAREFA);
export const OPCOES_STATUS_TAREFA = Object.values(STATUS_TAREFA);
export const OPCOES_PRIORIDADE = Object.values(PRIORIDADE_TAREFA);
export const OPCOES_STATUS_OBRA = Object.values(STATUS_OBRA);
