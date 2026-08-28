import Link from "next/link";
import { Calendar, CheckSquare, CalendarClock, ChevronLeft, Plus } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  formatarDataExtensa,
  paraData,
  chaveDia,
} from "@/lib/datas";
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
import { PRIORIDADE_TAREFA, STATUS_TAREFA } from "@/lib/domain/rotulos";
import type {
  ObraRow,
  PerfilRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

interface TarefaComRelacao extends TarefaRow {
  obras: { nome: string };
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
}

const esquemaData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

function CorpoItem({ tarefa }: { tarefa: TarefaComRelacao }) {
  return (
    <Link
      href={`/tarefas/${tarefa.id}`}
      className="group flex items-start justify-between gap-4 rounded-lg border border-borda bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-superficie-900 group-hover:text-azul-700">
          {tarefa.titulo}
        </p>
        <p className="mt-1 text-sm text-superficie-500">{tarefa.obras.nome}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {tarefa.responsavel && (
            <span className="flex items-center gap-1.5 text-xs text-superficie-600">
              <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
              {tarefa.responsavel.nome}
            </span>
          )}
          <Etiqueta className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}>
            {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
          </Etiqueta>
          <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
            {STATUS_TAREFA[tarefa.status].rotulo}
          </Etiqueta>
        </div>
      </div>
    </Link>
  );
}

export default async function DiaPage({
  params,
}: {
  params: Promise<{ data: string }>;
}) {
  const { data: dataParam } = await params;
  const resultado = esquemaData.safeParse(dataParam);

  if (!resultado.success) {
    return (
      <div className="space-y-6">
        <Link
          href="/calendario"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao calendário
        </Link>
        <Cartao>
          <EstadoVazio
            icone={<Calendar className="h-8 w-8" />}
            titulo="Data inválida"
            descricao="O endereço informado não corresponde a uma data válida."
            acao={
              <Link href="/calendario">
                <Botao variante="primario">
                  Ir para o calendário
                </Botao>
              </Link>
            }
          />
        </Cartao>
      </div>
    );
  }

  const dataChave = resultado.data;
  const data = paraData(dataChave);
  const chave = chaveDia(data);
  if (chave !== dataChave) {
    return (
      <div className="space-y-6">
        <Link
          href="/calendario"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao calendário
        </Link>
        <Cartao>
          <EstadoVazio
            icone={<Calendar className="h-8 w-8" />}
            titulo="Data inválida"
            descricao="O endereço informado não corresponde a uma data válida."
          />
        </Cartao>
      </div>
    );
  }

  const supabase = await createClient();

  const planejadasQuery = supabase
    .from("tarefas")
    .select(
      "*, obras!inner(nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome)",
    )
    .eq("data_planejada", chave);

  const executadasQuery = supabase
    .from("tarefas")
    .select(
      "*, obras!inner(nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome)",
    )
    .eq("status", "concluido")
    .gte("concluida_em", `${chave}T00:00:00`)
    .lte("concluida_em", `${chave}T23:59:59`);

  const [{ data: planejadas }, { data: executadas }] = await Promise.all([
    planejadasQuery,
    executadasQuery,
  ]);

  const planejadasArr = (planejadas ?? []) as TarefaComRelacao[];
  const executadasArr = (executadas ?? []) as TarefaComRelacao[];

  const mesAtual = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/calendario?mes=${mesAtual}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar ao calendário
          </Link>
          <h1 className="mt-2 text-2xl font-bold capitalize text-superficie-900">
            {formatarDataExtensa(data)}
          </h1>
        </div>
        <Link href="/tarefas/nova">
          <Botao variante="primario">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Botao>
        </Link>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-azul-600" />
            <CartaoTitulo>Planejado para o dia</CartaoTitulo>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          {planejadasArr.length === 0 ? (
            <EstadoVazio
              icone={<CalendarClock className="h-8 w-8" />}
              titulo="Nada planejado para este dia"
              descricao="Você pode mover uma tarefa para esta data ou cadastrar uma nova."
              acao={
                <Link href="/tarefas/nova">
                  <Botao variante="contorno">
                    <Plus className="h-4 w-4" />
                    Nova tarefa
                  </Botao>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {planejadasArr.map((tarefa) => (
                <CorpoItem key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-600" />
            <CartaoTitulo>Executado no dia</CartaoTitulo>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          {executadasArr.length === 0 ? (
            <EstadoVazio
              icone={<CheckSquare className="h-8 w-8" />}
              titulo="Nenhuma tarefa concluída neste dia"
              descricao="Quando uma tarefa for concluída nesta data, ela aparecerá aqui."
            />
          ) : (
            <div className="space-y-3">
              {executadasArr.map((tarefa) => (
                <CorpoItem key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
