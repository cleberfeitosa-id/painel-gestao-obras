import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Plus,
  MapPin,
  FileText,
  CheckSquare,
  AlertTriangle,
  Clock,
  Hammer,
  Users,
  Ruler,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_OBRA, STATUS_TAREFA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import { formatarData, situacaoPrazo, hojeChave } from "@/lib/datas";
import { formatarMoeda } from "@/lib/utils";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Botao,
  Avatar,
} from "@/components/ui";
import type {
  ObraRow,
  PerfilRow,
  PlantaRow,
  TarefaRow,
  PapelUsuario,
  MedicaoRow,
} from "@/lib/supabase/database.types";

interface ObraComResponsavel extends ObraRow {
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
}

interface TarefaComObra extends TarefaRow {
  obras: { nome: string };
}

async function buscarObra(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("obras")
    .select("*, responsavel:perfis!obras_responsavel_id_fkey(id, nome)")
    .eq("id", id)
    .single();
  return data as ObraComResponsavel | null;
}

async function buscarPapel(): Promise<PapelUsuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  return perfil?.papel ?? null;
}

async function buscarDados(id: string) {
  const supabase = await createClient();
  const hoje = hojeChave();

  const [
    { data: plantas },
    { data: tarefasRecentes },
    { count: countTotalTarefas },
    { count: countTarefasConcluidas },
    { count: countTarefasExecucao },
    { count: countTarefasPendentes },
    { count: countTarefasAtrasadas },
    { data: medicoes },
    { count: countLevantamentos },
  ] = await Promise.all([
    supabase
      .from("plantas")
      .select("*")
      .eq("obra_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("tarefas")
      .select("*, obras!inner(nome)")
      .eq("obra_id", id)
      .order("criado_em", { ascending: false })
      .limit(8),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id)
      .eq("status", "concluido"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id)
      .eq("status", "em_execucao"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id)
      .eq("status", "pendente"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id)
      .neq("status", "concluido")
      .lt("prazo", hoje),
    supabase
      .from("medicoes")
      .select("id, titulo, valor_contrato")
      .eq("obra_id", id)
      .order("criado_em", { ascending: true }),
    supabase
      .from("levantamentos")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", id),
  ]);

  let totalContratoMedicoes = 0;
  let totalExecutadoMedicoes = 0;
  let totalPagoMedicoes = 0;

  const medicoesLista = (medicoes ?? []) as MedicaoRow[];
  if (medicoesLista.length > 0) {
    const valoresCalculados = await Promise.all(
      medicoesLista.map(async (m) => {
        const [{ data: vExec }, { data: vPago }] = await Promise.all([
          supabase.rpc("valor_executado_medicao", { p_medicao_id: m.id }),
          supabase.rpc("valor_pago_medicao", { p_medicao_id: m.id }),
        ]);
        return {
          contrato: Number(m.valor_contrato) || 0,
          executado: Number(vExec) || 0,
          pago: Number(vPago) || 0,
        };
      }),
    );

    for (const v of valoresCalculados) {
      totalContratoMedicoes += v.contrato;
      totalExecutadoMedicoes += v.executado;
      totalPagoMedicoes += v.pago;
    }
  }

  return {
    plantas: (plantas ?? []) as PlantaRow[],
    tarefas: (tarefasRecentes ?? []) as TarefaComObra[],
    estatisticasTarefas: {
      total: countTotalTarefas ?? 0,
      concluidas: countTarefasConcluidas ?? 0,
      emExecucao: countTarefasExecucao ?? 0,
      pendentes: countTarefasPendentes ?? 0,
      atrasadas: countTarefasAtrasadas ?? 0,
    },
    resumoFinanceiro: {
      quantidadeMedicoes: medicoesLista.length,
      totalContrato: totalContratoMedicoes,
      totalExecutado: totalExecutadoMedicoes,
      totalPago: totalPagoMedicoes,
      saldo: totalContratoMedicoes - totalPagoMedicoes,
    },
    totalLevantamentos: countLevantamentos ?? 0,
  };
}

export default async function DetalheObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const obra = await buscarObra(id);

  if (!obra) notFound();

  const [papel, dadosObra] = await Promise.all([
    buscarPapel(),
    buscarDados(id),
  ]);

  const { plantas, tarefas, estatisticasTarefas, resumoFinanceiro, totalLevantamentos } =
    dadosObra;

  const podeMedir = papel === "admin" || papel === "gestor";

  const totalTarefas = estatisticasTarefas.total;
  const percentualConcluido =
    totalTarefas > 0
      ? Math.round((estatisticasTarefas.concluidas / totalTarefas) * 100)
      : 0;

  const percentualFinanceiro =
    resumoFinanceiro.totalContrato > 0
      ? Math.min(
          100,
          Math.round(
            (resumoFinanceiro.totalExecutado / resumoFinanceiro.totalContrato) *
              100,
          ),
        )
      : null;

  const statusInfo = STATUS_OBRA[obra.status];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/obras"
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para obras
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-superficie-900">
                {obra.nome}
              </h1>
              <Etiqueta className={statusInfo.classe}>
                {statusInfo.rotulo}
              </Etiqueta>
            </div>
            {obra.codigo && (
              <p className="mt-1 text-sm text-superficie-500">{obra.codigo}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tarefas/nova?obra=${obra.id}`}>
              <Botao variante="primario">
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Botao>
            </Link>
            {podeMedir && (
              <Link href={`/obras/${obra.id}/medicoes`}>
                <Botao variante="contorno">
                  <Ruler className="h-4 w-4" />
                  Medição
                </Botao>
              </Link>
            )}
            <Link href={`/obras/${obra.id}/quadros`}>
              <Botao variante="contorno">
                <Layers className="h-4 w-4" />
                Quadros
              </Botao>
            </Link>
            <Link href={`/obras/${obra.id}/executores`}>
              <Botao variante="contorno">
                <Users className="h-4 w-4" />
                Executores
              </Botao>
            </Link>
            <Link href={`/obras/${obra.id}/editar`}>
              <Botao variante="contorno">
                <Pencil className="h-4 w-4" />
                Editar
              </Botao>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Informações</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Cliente
                  </dt>
                  <dd className="mt-1 text-sm text-superficie-900">
                    {obra.cliente || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Responsável
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {obra.responsavel ? (
                      <>
                        <Avatar nome={obra.responsavel.nome} tamanho="sm" />
                        <span className="text-sm text-superficie-900">
                          {obra.responsavel.nome}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-superficie-400">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Localização
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-superficie-900">
                    <MapPin className="h-4 w-4 text-superficie-400 shrink-0" />
                    {[obra.endereco, obra.cidade, obra.estado]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Período
                  </dt>
                  <dd className="mt-1 text-sm text-superficie-900">
                    {formatarData(obra.data_inicio)} até{" "}
                    {formatarData(obra.data_prevista_fim)}
                  </dd>
                </div>
              </dl>
              {obra.descricao && (
                <div className="mt-4 border-t border-borda pt-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Descrição
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-superficie-700 whitespace-pre-wrap">
                    {obra.descricao}
                  </dd>
                </div>
              )}
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Plantas</CartaoTitulo>
                <Link href={`/obras/${obra.id}/plantas/nova`}>
                  <Botao variante="contorno" tamanho="sm">
                    <Plus className="h-4 w-4" />
                    Enviar plantas
                  </Botao>
                </Link>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo>
              {plantas.length === 0 ? (
                <EstadoVazio
                  icone={<FileText className="h-8 w-8" />}
                  titulo="Nenhuma planta anexada"
                  descricao="Envie as plantas em PDF para marcar tarefas em pontos e regiões."
                  acao={
                    <Link href={`/obras/${obra.id}/plantas/nova`}>
                      <Botao variante="primario">
                        <Plus className="h-4 w-4" />
                        Enviar plantas
                      </Botao>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-superficie-100">
                  {plantas.map((planta) => (
                    <li key={planta.id}>
                      <Link
                        href={`/obras/${obra.id}/plantas/${planta.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:bg-superficie-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-superficie-900">
                            {planta.nome}
                          </p>
                          {planta.descricao && (
                            <p className="truncate text-xs text-superficie-500">
                              {planta.descricao}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-superficie-400">
                          {planta.total_paginas}{" "}
                          {planta.total_paginas === 1 ? "página" : "páginas"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CartaoConteudo>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Progresso da Obra</CartaoTitulo>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {percentualConcluido}% concluído
                </span>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-superficie-600 mb-1.5">
                  <span>Avanço Físico (Tarefas)</span>
                  <span className="font-semibold text-superficie-900">
                    {estatisticasTarefas.concluidas} de {totalTarefas} tarefas
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${percentualConcluido}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href={`/tarefas?obra=${obra.id}&status=concluido`}
                  className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 hover:bg-emerald-50 transition-colors"
                >
                  <p className="text-xs text-emerald-700 font-medium">Concluídas</p>
                  <p className="text-lg font-bold text-emerald-900">
                    {estatisticasTarefas.concluidas}
                  </p>
                </Link>
                <Link
                  href={`/tarefas?obra=${obra.id}&status=em_execucao`}
                  className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-xs text-blue-700 font-medium">Em execução</p>
                  <p className="text-lg font-bold text-blue-900">
                    {estatisticasTarefas.emExecucao}
                  </p>
                </Link>
                <Link
                  href={`/tarefas?obra=${obra.id}&status=pendente`}
                  className="rounded-lg border border-superficie-200 bg-superficie-50 p-2.5 hover:bg-superficie-100 transition-colors"
                >
                  <p className="text-xs text-superficie-600 font-medium">Pendentes</p>
                  <p className="text-lg font-bold text-superficie-900">
                    {estatisticasTarefas.pendentes}
                  </p>
                </Link>
                <Link
                  href={`/tarefas?obra=${obra.id}`}
                  className="rounded-lg border border-red-100 bg-red-50/50 p-2.5 hover:bg-red-50 transition-colors"
                >
                  <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Atrasadas
                  </p>
                  <p className="text-lg font-bold text-red-900">
                    {estatisticasTarefas.atrasadas}
                  </p>
                </Link>
              </div>

              {resumoFinanceiro.quantidadeMedicoes > 0 && (
                <div className="border-t border-borda pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-superficie-600 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-azul-600" />
                      Medições Financeiras
                    </span>
                    <Link
                      href={`/obras/${obra.id}/medicoes`}
                      className="text-xs text-azul-600 hover:text-azul-700 flex items-center gap-0.5"
                    >
                      Ver medições <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {percentualFinanceiro !== null && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-superficie-600 mb-1">
                        <span>Executado vs Contrato</span>
                        <span className="font-semibold text-superficie-900">
                          {percentualFinanceiro}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-superficie-100">
                        <div
                          className="h-full rounded-full bg-azul-600 transition-all duration-500"
                          style={{ width: `${percentualFinanceiro}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-superficie-50 p-2">
                      <span className="text-superficie-500 block">Contratado</span>
                      <span className="font-semibold text-superficie-900">
                        {formatarMoeda(resumoFinanceiro.totalContrato)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-superficie-50 p-2">
                      <span className="text-superficie-500 block">Executado</span>
                      <span className="font-semibold text-azul-600">
                        {formatarMoeda(resumoFinanceiro.totalExecutado)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {totalLevantamentos > 0 && (
                <div className="border-t border-borda pt-3 flex items-center justify-between text-xs text-superficie-600">
                  <span>Levantamentos quantitativos</span>
                  <Link
                    href={`/levantamento?obra=${obra.id}`}
                    className="font-medium text-azul-600 hover:text-azul-700 inline-flex items-center gap-1"
                  >
                    {totalLevantamentos} cadastrados <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Tarefas recentes</CartaoTitulo>
                <Link
                  href={`/tarefas?obra=${obra.id}`}
                  className="text-sm font-medium text-azul-600 hover:text-azul-700"
                >
                  Ver todas
                </Link>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="p-0">
              {tarefas.length === 0 ? (
                <EstadoVazio
                  icone={<Hammer className="h-8 w-8" />}
                  titulo="Nenhuma tarefa"
                  descricao="Crie a primeira tarefa desta obra para comecar o acompanhamento."
                  acao={
                    <Link href={`/tarefas/nova?obra=${obra.id}`}>
                      <Botao variante="primario" tamanho="sm">
                        <Plus className="h-4 w-4" />
                        Nova tarefa
                      </Botao>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-superficie-100">
                  {tarefas.map((tarefa) => {
                    const prazoInfo = situacaoPrazo(
                      tarefa.prazo,
                      tarefa.status === "concluido",
                    );
                    const corPrazo = {
                      atrasado: "text-red-600",
                      hoje: "text-amber-600",
                      proximo: "text-amber-600",
                      ok: "text-superficie-500",
                      sem_prazo: "text-superficie-400",
                    }[prazoInfo.situacao];
                    return (
                      <li key={tarefa.id}>
                        <Link
                          href={`/tarefas/${tarefa.id}`}
                          className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-superficie-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-superficie-900">
                              {tarefa.titulo}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-superficie-500">
                              <Clock className="h-3 w-3" />
                              <span className={corPrazo}>
                                {prazoInfo.texto}
                              </span>
                            </p>
                          </div>
                          <Etiqueta
                            className={
                              PRIORIDADE_TAREFA[tarefa.prioridade]?.classe
                            }
                          >
                            {PRIORIDADE_TAREFA[tarefa.prioridade]?.rotulo}
                          </Etiqueta>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CartaoConteudo>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
