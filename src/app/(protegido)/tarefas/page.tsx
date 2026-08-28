import Link from "next/link";
import { Plus, CheckSquare, MapPin, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_TAREFA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import { situacaoPrazo, hojeChave, chaveDia } from "@/lib/datas";
import { endOfWeek } from "date-fns";
import {
  Cartao,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Botao,
  Avatar,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
} from "@/components/ui";
import { FiltrosTarefas } from "@/components/tarefas/filtros-tarefas";
import type {
  ObraRow,
  PerfilRow,
  TarefaRow,
  StatusTarefa,
  PrioridadeTarefa,
} from "@/lib/supabase/database.types";

interface TarefaComDados extends TarefaRow {
  obras: { nome: string };
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
}

const COR_PRAZO: Record<string, string> = {
  atrasado: "text-red-600",
  hoje: "text-amber-600",
  proximo: "text-amber-600",
  ok: "text-superficie-500",
  sem_prazo: "text-superficie-400",
};

async function buscarTarefas(params: Record<string, string | undefined>) {
  const supabase = await createClient();

  let query = supabase
    .from("tarefas")
    .select(
      "*, obras!inner(nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome)",
    );

  const busca = params.busca?.trim();
  if (busca) {
    query = query.or(`titulo.ilike.%${busca}%,descricao.ilike.%${busca}%`);
  }
  if (params.obra) query = query.eq("obra_id", params.obra);
  if (params.responsavel) query = query.eq("responsavel_id", params.responsavel);
  if (params.status) query = query.eq("status", params.status as StatusTarefa);
  if (params.prioridade)
    query = query.eq("prioridade", params.prioridade as PrioridadeTarefa);
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
      const inicio = hojeChave();
      const fim = chaveDia(endOfWeek(new Date(), { weekStartsOn: 0 }));
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

  const { data } = await query;
  return (data ?? []) as TarefaComDados[];
}

async function buscarOpcoes() {
  const supabase = await createClient();
  const [{ data: obras }, { data: perfis }] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return {
    obras: (obras ?? []) as Pick<ObraRow, "id" | "nome">[],
    responsaveis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
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
    localizacao: ["com_local", "sem_local"].includes(params.localizacao ?? "")
      ? params.localizacao
      : undefined,
    ordenar: ["prazo", "prioridade", "criacao"].includes(params.ordenar ?? "")
      ? params.ordenar
      : undefined,
  };

  const [tarefas, opcoes] = await Promise.all([
    buscarTarefas(filtros),
    buscarOpcoes(),
  ]);

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
        <Link href="/tarefas/nova">
          <Botao variante="primario">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Botao>
        </Link>
      </div>

      <Cartao>
        <CartaoConteudo>
          <FiltrosTarefas
            obras={opcoes.obras}
            responsaveis={opcoes.responsaveis}
          />
        </CartaoConteudo>
      </Cartao>

      {tarefas.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={<CheckSquare className="h-8 w-8" />}
            titulo={
              temFiltros ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa cadastrada"
            }
            descricao={
              temFiltros
                ? "Ajuste os filtros ou o termo de busca para encontrar tarefas."
                : "Crie a primeira tarefa para comecar o acompanhamento dos canteiros."
            }
            acao={
              !temFiltros ? (
                <Link href="/tarefas/nova">
                  <Botao variante="primario">
                    <Plus className="h-4 w-4" />
                    Criar tarefa
                  </Botao>
                </Link>
              ) : undefined
            }
          />
        </Cartao>
      ) : (
        <>
          <Cartao className="hidden lg:block">
            <Tabela>
              <table className="w-full">
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Tarefa</CelulaCabecalho>
                    <CelulaCabecalho>Obra</CelulaCabecalho>
                    <CelulaCabecalho>Responsavel</CelulaCabecalho>
                    <CelulaCabecalho>Status</CelulaCabecalho>
                    <CelulaCabecalho>Prioridade</CelulaCabecalho>
                    <CelulaCabecalho>Prazo</CelulaCabecalho>
                    <CelulaCabecalho>Local</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {tarefas.map((tarefa) => {
                    const prazoInfo = situacaoPrazo(
                      tarefa.prazo,
                      tarefa.status === "concluido",
                    );
                    return (
                      <Linha key={tarefa.id}>
                        <Celula>
                          <Link
                            href={`/tarefas/${tarefa.id}`}
                            className="font-medium text-azul-600 hover:text-azul-700"
                          >
                            {tarefa.titulo}
                          </Link>
                        </Celula>
                        <Celula>{tarefa.obras.nome}</Celula>
                        <Celula>
                          {tarefa.responsavel ? (
                            <span className="flex items-center gap-2">
                              <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
                              <span className="text-superficie-700">
                                {tarefa.responsavel.nome}
                              </span>
                            </span>
                          ) : (
                            <span className="text-superficie-400">—</span>
                          )}
                        </Celula>
                        <Celula>
                          <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
                            {STATUS_TAREFA[tarefa.status].rotulo}
                          </Etiqueta>
                        </Celula>
                        <Celula>
                          <Etiqueta
                            className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
                          >
                            {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                          </Etiqueta>
                        </Celula>
                        <Celula>
                          <span className={COR_PRAZO[prazoInfo.situacao]}>
                            {prazoInfo.texto}
                          </span>
                        </Celula>
                        <Celula>
                          {tarefa.localizacao_tipo !== "nenhuma" &&
                          tarefa.planta_id ? (
                            <Link
                              href={`/obras/${tarefa.obra_id}/plantas/${tarefa.planta_id}`}
                              className="inline-flex items-center gap-1 text-azul-600 hover:text-azul-700"
                              aria-label="Ver localizacao na planta"
                            >
                              <MapPin className="h-4 w-4" />
                            </Link>
                          ) : (
                            <span className="text-superficie-300">—</span>
                          )}
                        </Celula>
                      </Linha>
                    );
                  })}
                </Corpo>
              </table>
            </Tabela>
          </Cartao>

          <div className="grid gap-4 lg:hidden">
            {tarefas.map((tarefa) => {
              const prazoInfo = situacaoPrazo(
                tarefa.prazo,
                tarefa.status === "concluido",
              );
              return (
                <Link key={tarefa.id} href={`/tarefas/${tarefa.id}`} className="group">
                  <Cartao className="transition-shadow group-hover:shadow-md">
                    <CartaoConteudo className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-superficie-900">
                          {tarefa.titulo}
                        </p>
                        <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
                          {STATUS_TAREFA[tarefa.status].rotulo}
                        </Etiqueta>
                      </div>
                      <p className="text-sm text-superficie-500">{tarefa.obras.nome}</p>
                      <div className="flex items-center justify-between border-t border-borda pt-3">
                        <div className="flex items-center gap-2">
                          {tarefa.responsavel ? (
                            <>
                              <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
                              <span className="text-xs text-superficie-600">
                                {tarefa.responsavel.nome}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-superficie-400">
                              Sem responsavel
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Etiqueta
                            className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
                          >
                            {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                          </Etiqueta>
                          {tarefa.localizacao_tipo !== "nenhuma" &&
                            tarefa.planta_id && (
                              <MapPin className="h-4 w-4 text-azul-600" />
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="h-3.5 w-3.5 text-superficie-400" />
                        <span className={COR_PRAZO[prazoInfo.situacao]}>
                          {prazoInfo.texto}
                        </span>
                      </div>
                    </CartaoConteudo>
                  </Cartao>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
