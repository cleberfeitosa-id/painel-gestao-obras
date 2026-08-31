import Link from "next/link";
import { z } from "zod";
import { Calendar, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  chaveDia,
  formatarDataExtensa,
  paraData,
} from "@/lib/datas";
import { BUCKET_ANEXOS, urlsAssinadas } from "@/lib/armazenamento";
import { Cartao, EstadoVazio } from "@/components/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { BotaoImprimir } from "@/components/relatorios/botao-imprimir";
import {
  DocumentoRelatorio,
  type TarefaRelatorio,
} from "@/components/relatorios/documento-relatorio";
import { montarSnapshotsDePlantas } from "@/app/(protegido)/relatorios/snapshots";

const esquemaData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((valor) => {
    const data = paraData(valor);
    return !Number.isNaN(data.getTime()) && chaveDia(data) === valor;
  }, "Data inválida.");

const SELECAO_TAREFA =
  "*, obras!inner(*), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome), supervisor:perfis!tarefas_supervisor_id_fkey(id, nome), executor:executores!tarefas_executor_id_fkey(id, nome), planta:plantas!tarefas_planta_id_fkey(id, nome), anexos:tarefa_anexos(*), comentarios:tarefa_comentarios(*)";

const SELECAO_ATIVIDADE =
  "tarefa_id, tarefas!inner(obra_id, responsavel_id, supervisor_id, executor_id, planta_id)";

interface FiltrosRelatorio {
  obra?: string;
  responsavel?: string;
  supervisor?: string;
  executor?: string;
  planta?: string;
}

type Cliente = SupabaseClient<Database>;
type Query = ReturnType<Cliente["from"]>;

function aplicarFiltrosTarefas(query: Query, filtros: FiltrosRelatorio) {
  if (filtros.obra) query = query.eq("obra_id", filtros.obra);
  if (filtros.responsavel)
    query = query.eq("responsavel_id", filtros.responsavel);
  if (filtros.supervisor) query = query.eq("supervisor_id", filtros.supervisor);
  if (filtros.executor) query = query.eq("executor_id", filtros.executor);
  if (filtros.planta) query = query.eq("planta_id", filtros.planta);
  return query;
}

function aplicarFiltrosAtividade(query: Query, filtros: FiltrosRelatorio) {
  if (filtros.obra) query = query.eq("tarefas.obra_id", filtros.obra);
  if (filtros.responsavel)
    query = query.eq("tarefas.responsavel_id", filtros.responsavel);
  if (filtros.supervisor)
    query = query.eq("tarefas.supervisor_id", filtros.supervisor);
  if (filtros.executor)
    query = query.eq("tarefas.executor_id", filtros.executor);
  if (filtros.planta) query = query.eq("tarefas.planta_id", filtros.planta);
  return query;
}

function validatePeriodo(inicio: string | undefined, fim: string | undefined) {
  if (!inicio || !fim) return null;
  const inicioOk = esquemaData.safeParse(inicio);
  const fimOk = esquemaData.safeParse(fim);
  if (!inicioOk.success || !fimOk.success) return null;
  if (fim < inicio) return null;
  return { inicio: inicioOk.data, fim: fimOk.data };
}

export default async function RelatorioPeriodoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filtros: FiltrosRelatorio = {
    obra: sp.obra,
    responsavel: sp.responsavel,
    supervisor: sp.supervisor,
    executor: sp.executor,
    planta: sp.planta,
  };

  const periodo = validatePeriodo(sp.inicio, sp.fim);
  if (!periodo) {
    return (
      <div className="space-y-6">
        <Link
          href="/relatorios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar aos relatórios
        </Link>
        <Cartao>
          <EstadoVazio
            icone={<Calendar className="h-8 w-8" />}
            titulo="Período inválido"
            descricao="Informe uma data de início e de fim válidas para gerar o relatório de período."
            acao={
              <Link href="/relatorios">
                <span className="inline-flex items-center justify-center rounded-lg bg-azul-600 px-4 py-2 text-sm font-medium text-white">
                  Ir para os relatórios
                </span>
              </Link>
            }
          />
        </Cartao>
      </div>
    );
  }

  const { inicio, fim } = periodo;
  const dataInicio = `${inicio}T00:00:00-03:00`;
  const dataFim = `${chaveDia(addDays(paraData(fim), 1))}T00:00:00-03:00`;

  const supabase = await createClient();

  let queryConcluidas = supabase
    .from("tarefas")
    .select(SELECAO_TAREFA)
    .eq("status", "concluido")
    .gte("concluida_em", dataInicio)
    .lt("concluida_em", dataFim);

  let queryAnexosPeriodo = supabase
    .from("tarefa_anexos")
    .select(SELECAO_ATIVIDADE)
    .gte("criado_em", dataInicio)
    .lt("criado_em", dataFim);

  let queryComentariosPeriodo = supabase
    .from("tarefa_comentarios")
    .select(SELECAO_ATIVIDADE)
    .gte("criado_em", dataInicio)
    .lt("criado_em", dataFim);

  let queryAbertas = supabase
    .from("tarefas")
    .select("*", { count: "exact", head: true })
    .neq("status", "concluido");

  queryConcluidas = aplicarFiltrosTarefas(queryConcluidas, filtros);
  queryAnexosPeriodo = aplicarFiltrosAtividade(queryAnexosPeriodo, filtros);
  queryComentariosPeriodo = aplicarFiltrosAtividade(
    queryComentariosPeriodo,
    filtros,
  );
  queryAbertas = aplicarFiltrosTarefas(queryAbertas, filtros);

  const [
    { data: concluidasBrutas },
    { data: anexosPeriodo },
    { data: comentariosPeriodo },
    { count: totalAbertas },
  ] = await Promise.all([
    queryConcluidas,
    queryAnexosPeriodo,
    queryComentariosPeriodo,
    queryAbertas,
  ]);

  const filtroRaiz = filtros.obra ?? filtros.planta;
  let obraFiltro = "Todas as obras";
  if (filtros.obra) {
    const { data: obra } = await supabase
      .from("obras")
      .select("nome")
      .eq("id", filtros.obra)
      .maybeSingle();
    obraFiltro = obra?.nome ?? "Obra não encontrada";
  } else if (filtros.planta) {
    const { data: planta } = await supabase
      .from("plantas")
      .select("nome, obras!inner(nome)")
      .eq("id", filtros.planta)
      .maybeSingle();
    obraFiltro = planta
      ? `${planta.nome} — ${planta.obras?.nome}`
      : "Planta não encontrada";
  }

  const concluidas = (concluidasBrutas ?? []) as TarefaRelatorio[];

  const idsComAtividade = new Set<string>();
  for (const anexo of anexosPeriodo ?? []) idsComAtividade.add(anexo.tarefa_id);
  for (const comentario of comentariosPeriodo ?? [])
    idsComAtividade.add(comentario.tarefa_id);
  for (const tarefa of concluidas) idsComAtividade.delete(tarefa.id);

  const idsAndamento = Array.from(idsComAtividade);

  let andamento: TarefaRelatorio[] = [];
  if (idsAndamento.length > 0) {
    let queryAndamento = supabase
      .from("tarefas")
      .select(SELECAO_TAREFA)
      .in("id", idsAndamento)
      .neq("status", "concluido");
    queryAndamento = aplicarFiltrosTarefas(queryAndamento, filtros);
    const { data: andamentoBruto } = await queryAndamento;
    andamento = (andamentoBruto ?? []) as TarefaRelatorio[];
  }

  const todasTarefas = [...concluidas, ...andamento];
  const caminhosImagens = todasTarefas.flatMap((tarefa) =>
    tarefa.anexos
      .filter((anexo) => anexo.tipo === "imagem")
      .map((anexo) => anexo.caminho),
  );
  const urlsMap = await urlsAssinadas(BUCKET_ANEXOS, caminhosImagens, 3600);

  const totalFotos = caminhosImagens.length;

  const plantas = await montarSnapshotsDePlantas(supabase, todasTarefas);

  const filtrosDescricao = [
    {
      rotulo: "Período",
      valor: `De ${formatarDataExtensa(paraData(inicio))} até ${formatarDataExtensa(paraData(fim))}`,
    },
    { rotulo: "Obra", valor: obraFiltro },
  ];
  if (filtros.responsavel) {
    const { data: p } = await supabase
      .from("perfis")
      .select("nome")
      .eq("id", filtros.responsavel)
      .maybeSingle();
    filtrosDescricao.push({ rotulo: "Responsável", valor: p?.nome ?? "—" });
  }
  if (filtros.supervisor) {
    const { data: p } = await supabase
      .from("perfis")
      .select("nome")
      .eq("id", filtros.supervisor)
      .maybeSingle();
    filtrosDescricao.push({ rotulo: "Supervisor", valor: p?.nome ?? "—" });
  }
  if (filtros.executor) {
    const { data: e } = await supabase
      .from("executores")
      .select("nome")
      .eq("id", filtros.executor)
      .maybeSingle();
    filtrosDescricao.push({ rotulo: "Executor", valor: e?.nome ?? "—" });
  }

  return (
    <BotaoImprimir>
      <div className="nao-imprimir">
        <Link
          href="/relatorios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar aos relatórios
        </Link>
      </div>

      <DocumentoRelatorio
        titulo="Relatório de Período de Obra (RDO)"
        subtitulo="período"
        filtros={filtrosDescricao}
        geradoEm={new Date()}
        concluidas={concluidas}
        andamento={andamento}
        totalAbertas={totalAbertas ?? 0}
        totalFotos={totalFotos}
        urlsMap={urlsMap}
        plantas={plantas}
        agruparPorObra={!filtroRaiz}
      />
    </BotaoImprimir>
  );
}
