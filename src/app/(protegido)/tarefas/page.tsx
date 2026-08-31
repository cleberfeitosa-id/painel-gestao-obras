import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hojeChave, chaveDia, paraData } from "@/lib/datas";
import { endOfWeek } from "date-fns";
import {
  Cartao,
  CartaoConteudo,
  Botao,
} from "@/components/ui";
import { FiltrosTarefas } from "@/components/tarefas/filtros-tarefas";
import { ListaTarefas } from "@/components/tarefas/lista-tarefas";
import type {
  ExecutorRow,
  ObraRow,
  PlantaRow,
  PerfilRow,
  TarefaRow,
  StatusTarefa,
  PrioridadeTarefa,
} from "@/lib/supabase/database.types";

export interface TarefaComDados extends TarefaRow {
  obras: { nome: string };
  plantas: { nome: string } | null;
  tags_tarefa: { nome: string } | null;
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
  executor: Pick<ExecutorRow, "id" | "nome"> | null;
  supervisor: Pick<PerfilRow, "id" | "nome"> | null;
  tarefa_medicoes?: {
    id: string;
    catalogo_id: string;
    quantidade: number;
    catalogo_precos: {
      id: string;
      nome: string;
      unidade: string;
      valor_unitario: number;
      medicao_id?: string;
      medicoes: {
        id: string;
        titulo: string;
      } | null;
    } | null;
  }[];
}

async function buscarTarefas(params: Record<string, string | undefined>) {
  const supabase = await createClient();

  let query = supabase
    .from("tarefas")
    .select(
      "*, obras!inner(nome), plantas!tarefas_planta_id_fkey(nome), tags_tarefa(nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome), executor:executores!tarefas_executor_id_fkey(id, nome), supervisor:perfis!tarefas_supervisor_id_fkey(id, nome), tarefa_medicoes(id, catalogo_id, quantidade, catalogo_precos(id, nome, unidade, valor_unitario, medicao_id, medicoes(id, titulo)))",
    );

  const busca = params.busca?.trim();
  if (busca) {
    query = query.or(`titulo.ilike.%${busca}%,descricao.ilike.%${busca}%`);
  }
  if (params.obra) query = query.eq("obra_id", params.obra);
  if (params.responsavel) query = query.eq("responsavel_id", params.responsavel);
  if (params.supervisor) query = query.eq("supervisor_id", params.supervisor);
  if (params.executor) query = query.eq("executor_id", params.executor);
  if (params.status) query = query.eq("status", params.status as StatusTarefa);
  if (params.prioridade) query = query.eq("prioridade", params.prioridade as PrioridadeTarefa);
  if (params.tag_id) query = query.eq("tag_id", params.tag_id);
  if (params.planta) query = query.eq("planta_id", params.planta);
  if (params.pagina) query = query.eq("pagina", Number(params.pagina));

  const hoje = hojeChave();
  switch (params.prazo) {
    case "atrasadas":
      query = query.neq("status", "concluido").lt("prazo", hoje);
      break;
    case "hoje":
      query = query.eq("prazo", hoje);
      break;
    case "semana": {
      const inicio = hoje;
      const fim = chaveDia(endOfWeek(paraData(hoje), { weekStartsOn: 0 }));
      query = query.gte("prazo", inicio).lte("prazo", fim);
      break;
    }
    case "sem_prazo":
      query = query.is("prazo", null);
      break;
  }

  if (params.localizacao === "com_local") {
    query = query.neq("localizacao_tipo", "nenhuma");
  } else if (params.localizacao === "sem_local") {
    query = query.eq("localizacao_tipo", "nenhuma");
  }

  switch (params.ordenar) {
    case "prazo":
      query = query.order("prazo", { ascending: true, nullsFirst: true });
      break;
    case "prioridade":
      query = query.order("prioridade", { ascending: false });
      break;
    case "criacao":
      query = query.order("criado_em", { ascending: false });
      break;
    default:
      query = query.order("criado_em", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao buscar tarefas:", error);
    return [];
  }

  let lista = (data ?? []) as TarefaComDados[];

  if (params.medicao === "com_medicao") {
    lista = lista.filter((t) => (t.tarefa_medicoes?.length ?? 0) > 0);
  } else if (params.medicao === "sem_medicao") {
    lista = lista.filter((t) => (t.tarefa_medicoes?.length ?? 0) === 0);
  } else if (params.medicao) {
    lista = lista.filter((t) =>
      t.tarefa_medicoes?.some(
        (tm) =>
          tm.catalogo_precos?.medicoes?.id === params.medicao ||
          tm.catalogo_precos?.medicao_id === params.medicao,
      ),
    );
  }

  return lista;
}

async function buscarOpcoes() {
  const supabase = await createClient();
  const [
    { data: obras },
    { data: perfis },
    { data: executores },
    { data: plantas },
    { data: tags },
    { data: catalogo },
    { data: medicoes },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("executores").select("id, nome").order("nome"),
    supabase.from("plantas").select("id, nome").order("nome"),
    supabase.from("tags_tarefa").select("id, nome").order("nome"),
    supabase.from("catalogo_precos").select("id, nome, unidade, medicoes!inner(id, titulo, obra_id)").order("nome"),
    supabase.from("medicoes").select("id, titulo, obra_id, obras(nome)").order("titulo"),
    supabase.auth.getUser(),
  ]);

  let papel = "";
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", user.id)
      .single();
    papel = perfil?.papel ?? "";
  }

  return {
    obras: (obras ?? []) as Pick<ObraRow, "id" | "nome">[],
    responsaveis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    supervisores: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    executores: (executores ?? []) as Pick<ExecutorRow, "id" | "nome">[],
    plantas: (plantas ?? []) as Pick<PlantaRow, "id" | "nome">[],
    tags: (tags ?? []) as { id: string; nome: string }[],
    catalogoPrecos: (catalogo ?? []) as {
      id: string;
      nome: string;
      unidade: string;
      medicoes: { id: string; titulo: string; obra_id: string };
    }[],
    medicoes: (medicoes ?? []) as {
      id: string;
      titulo: string;
      obra_id: string;
      obras: { nome: string } | null;
    }[],
    podeExcluir: papel === "admin" || papel === "gestor",
  };
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const statusValido: StatusTarefa[] = ["pendente", "em_execucao", "concluido"];
  const prioridadeValida: PrioridadeTarefa[] = ["baixa", "media", "alta", "urgente"];

  const filtros = {
    busca: params.busca,
    obra: params.obra,
    responsavel: params.responsavel,
    supervisor: params.supervisor,
    executor: params.executor,
    status: statusValido.includes(params.status as StatusTarefa)
      ? params.status
      : undefined,
    prioridade: prioridadeValida.includes(params.prioridade as PrioridadeTarefa)
      ? params.prioridade
      : undefined,
    prazo: ["atrasadas", "hoje", "semana", "sem_prazo"].includes(params.prazo ?? "")
      ? params.prazo
      : undefined,
    planta: params.planta,
    pagina: params.pagina,
    tag_id: params.tag,
    localizacao: ["com_local", "sem_local"].includes(params.localizacao ?? "")
      ? params.localizacao
      : undefined,
    medicao: params.medicao,
    ordenar: ["prazo", "prioridade", "criacao"].includes(params.ordenar ?? "")
      ? params.ordenar
      : undefined,
  };

  const [tarefas, opcoes] = await Promise.all([
    buscarTarefas(filtros),
    buscarOpcoes(),
  ]);
  const { obras, responsaveis, supervisores, executores, plantas, tags, catalogoPrecos, medicoes, podeExcluir } = opcoes;

  const temFiltros = Object.values(filtros).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Tarefas</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Acompanhe e gerencie as tarefas dos canteiros.
          </p>
        </div>
        <div className="flex gap-2">
          {podeExcluir && (
            <Link href="/tarefas/tags">
              <Botao variante="secundario">
                Gerenciar tags
              </Botao>
            </Link>
          )}
          <Link href="/tarefas/nova">
            <Botao variante="primario">
              <Plus className="h-4 w-4" />
              Nova tarefa
            </Botao>
          </Link>
        </div>
      </div>

      <Cartao>
        <CartaoConteudo>
          <FiltrosTarefas
            obras={obras}
            responsaveis={responsaveis}
            supervisores={supervisores}
            executores={executores}
            plantas={plantas}
            tags={tags}
            medicoes={medicoes}
          />
        </CartaoConteudo>
      </Cartao>

      <ListaTarefas
        tarefas={tarefas}
        podeExcluir={podeExcluir}
        temFiltros={temFiltros}
        responsaveis={responsaveis}
        supervisores={supervisores}
        executores={executores}
        tags={tags}
        catalogoPrecos={catalogoPrecos}
      />
    </div>
  );
}
