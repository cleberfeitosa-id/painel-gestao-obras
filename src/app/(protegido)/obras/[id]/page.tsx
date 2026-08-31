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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_OBRA, STATUS_TAREFA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import { formatarData, situacaoPrazo, hojeChave } from "@/lib/datas";
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

  const [{ data: plantas }, { data: tarefas }] = await Promise.all([
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
  ]);

  return {
    plantas: (plantas ?? []) as PlantaRow[],
    tarefas: (tarefas ?? []) as TarefaComObra[],
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

  const [papel, { plantas, tarefas }] = await Promise.all([
    buscarPapel(),
    buscarDados(id),
  ]);

  const podeMedir = papel === "admin" || papel === "gestor";

  const porStatus = {
    pendente: 0,
    em_execucao: 0,
    concluido: 0,
  };
  let atrasadas = 0;
  const hoje = hojeChave();
  for (const tarefa of tarefas) {
    porStatus[tarefa.status] += 1;
    if (
      tarefa.status !== "concluido" &&
      tarefa.prazo &&
      tarefa.prazo < hoje
    ) {
      atrasadas += 1;
    }
  }
  const totalTarefas = tarefas.length;
  const percentualConcluido =
    totalTarefas > 0
      ? Math.round((porStatus.concluido / totalTarefas) * 100)
      : 0;

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
          <div className="flex gap-2">
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
              <CartaoTitulo>Informacoes</CartaoTitulo>
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
                    Responsavel
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
                    Localizacao
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-superficie-900">
                    <MapPin className="h-4 w-4 text-superficie-400" />
                    {[obra.endereco, obra.cidade, obra.estado]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Periodo
                  </dt>
                  <dd className="mt-1 text-sm text-superficie-900">
                    {formatarData(obra.data_inicio)} ate{" "}
                    {formatarData(obra.data_prevista_fim)}
                  </dd>
                </div>
              </dl>
              {obra.descricao && (
                <div className="mt-4 border-t border-borda pt-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Descricao
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-superficie-700">
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
                        className="flex items-center justify-between gap-3 py-3 hover:bg-superficie-50"
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
                          {planta.total_paginas === 1 ? "pagina" : "paginas"}
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
              <CartaoTitulo>Progresso</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-superficie-600">Concluido</span>
                  <span className="font-semibold text-superficie-900">
                    {percentualConcluido}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-superficie-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${percentualConcluido}%` }}
                  />
                </div>
              </div>

              <ul className="space-y-2">
                {Object.entries(porStatus).map(([status, quantidade]) => {
                  const info = STATUS_TAREFA[status as keyof typeof STATUS_TAREFA];
                  return (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2 text-superficie-600">
                        <CheckSquare className="h-4 w-4 text-superficie-400" />
                        {info.rotulo}
                      </span>
                      <span className="font-medium text-superficie-900">
                        {quantidade}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-center gap-2 border-t border-borda pt-4 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-superficie-600">Atrasadas</span>
                <span className="ml-auto font-semibold text-red-600">
                  {atrasadas}
                </span>
              </div>
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
                          className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-superficie-50"
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
