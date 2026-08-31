import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  formatarMesAno,
  gradeDoMes,
  chaveDia,
  hojeChave,
  formatarData,
} from "@/lib/datas";
import { Cartao, CartaoConteudo, EstadoVazio, Botao } from "@/components/ui";
import { cn } from "@/lib/utils";
import { FiltrosCalendario } from "@/components/calendario/filtros-calendario";
import { CalendarioInterativo } from "@/components/calendario/calendario-interativo";
import {
  GraficoGantt,
  type ItemGantt,
} from "@/components/calendario/grafico-gantt";
import type { ItemCalendario } from "@/components/calendario/calendario-interativo";
import type {
  ObraRow,
  PerfilRow,
  TarefaRow,
  PapelUsuario,
} from "@/lib/supabase/database.types";

interface TarefaComRelacao extends TarefaRow {
  obras: { nome: string };
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
}

function chaveMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function navegar(mes: string, obra: string, responsavel: string, vista?: string) {
  const params = new URLSearchParams();
  if (mes) params.set("mes", mes);
  if (obra) params.set("obra", obra);
  if (responsavel) params.set("responsavel", responsavel);
  if (vista) params.set("vista", vista);
  const qs = params.toString();
  return qs ? `/calendario?${qs}` : "/calendario";
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const hoje = new Date();

  const mesValido = /^\d{4}-\d{2}$/.test(params.mes ?? "");
  let referencia: Date;
  if (mesValido) {
    const [ano, mes] = (params.mes as string).split("-").map(Number);
    if (ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12) {
      referencia = new Date(ano, mes - 1, 1);
    } else {
      referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }
  } else {
    referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  const obra = params.obra ?? "";
  const responsavel = params.responsavel ?? "";
  const vista = params.vista === "gantt" ? "gantt" : "mes";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let papel: PapelUsuario | null = null;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", user.id)
      .single();
    papel = perfil?.papel ?? null;
  }
  const podeReagendar = papel === "admin" || papel === "gestor";

  const dias = gradeDoMes(referencia);
  const primeiraChave = dias[0].chave;
  const ultimaChave = dias[dias.length - 1].chave;

  let query = supabase
    .from("tarefas")
    .select(
      "*, obras!inner(nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome)",
    )
    .or(
      `and(data_planejada.gte.${primeiraChave},data_planejada.lte.${ultimaChave}),and(concluida_em.gte.${primeiraChave}T00:00:00,concluida_em.lte.${ultimaChave}T23:59:59),and(data_inicio.gte.${primeiraChave},data_inicio.lte.${ultimaChave}),and(data_fim.gte.${primeiraChave},data_fim.lte.${ultimaChave})`,
    );

  if (obra) query = query.eq("obra_id", obra);
  if (responsavel) query = query.eq("responsavel_id", responsavel);

  const [{ data: tarefasBrutas }, { data: dependenciasBrutas }] =
    await Promise.all([query, supabase.from("tarefa_dependencias").select("tarefa_id, depende_de")]);
  const tarefas = (tarefasBrutas ?? []) as TarefaComRelacao[];

  const dependencias: Record<string, string[]> = {};
  for (const d of dependenciasBrutas ?? []) {
    (dependencias[d.tarefa_id] ??= []).push(d.depende_de);
  }

  const itensGantt: ItemGantt[] = tarefas.map((tarefa) => ({
    tarefa,
    obraNome: tarefa.obras.nome,
  }));

  const itensPorChave = new Map<string, ItemCalendario[]>();
  for (const tarefa of tarefas) {
    const item: ItemCalendario = {
      tarefa,
      obraNome: tarefa.obras.nome,
      responsavelNome: tarefa.responsavel?.nome ?? null,
    };
    const chaves: string[] = [];
    if (tarefa.data_planejada) chaves.push(chaveDia(tarefa.data_planejada));
    if (tarefa.status === "concluido" && tarefa.concluida_em) {
      chaves.push(chaveDia(tarefa.concluida_em));
    }
    for (const chave of new Set(chaves)) {
      if (chave >= primeiraChave && chave <= ultimaChave) {
        const atual = itensPorChave.get(chave) ?? [];
        atual.push(item);
        itensPorChave.set(chave, atual);
      }
    }
  }

  const [{ data: obras }, { data: perfis }] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const listaObras = (obras ?? []) as Pick<ObraRow, "id" | "nome">[];
  const listaResponsaveis = (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[];

  const mesAtual = chaveMes(referencia);
  const mesAnterior = new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1);
  const mesProximo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 1);
  const hojeMes = chaveMes(hoje);

  const semana: {
    data: Date;
    chave: string;
    doMesAtual: boolean;
    hoje: boolean;
  }[][] = [];
  for (let i = 0; i < dias.length; i += 7) {
    semana.push(dias.slice(i, i + 7));
  }

  const totalItens = [...itensPorChave.values()].reduce(
    (acc, itens) => acc + itens.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Calendário</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Planejamento das atividades do mês e registro diário das executadas.
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
          <FiltrosCalendario
            obras={listaObras}
            responsaveis={listaResponsaveis}
            obraAtual={obra}
            responsavelAtual={responsavel}
            mes={mesAtual}
            vista={vista}
          />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoConteudo className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={navegar(chaveMes(mesAnterior), obra, responsavel, vista)}
                aria-label="Mês anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-borda bg-white text-superficie-600 hover:bg-superficie-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <Link
                href={navegar(chaveMes(mesProximo), obra, responsavel, vista)}
                aria-label="Próximo mês"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-borda bg-white text-superficie-600 hover:bg-superficie-50"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
              <h2 className="ml-2 text-xl font-semibold capitalize text-superficie-900">
                {formatarMesAno(referencia)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-borda bg-white">
                <Link
                  href={navegar(chaveMes(referencia), obra, responsavel, "mes")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium",
                    vista === "mes"
                      ? "bg-azul-600 text-white"
                      : "text-superficie-700 hover:bg-superficie-50",
                  )}
                >
                  Mês
                </Link>
                <Link
                  href={navegar(chaveMes(referencia), obra, responsavel, "gantt")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium",
                    vista === "gantt"
                      ? "bg-azul-600 text-white"
                      : "text-superficie-700 hover:bg-superficie-50",
                  )}
                >
                  Gantt
                </Link>
              </div>
              <span className="hidden text-sm text-superficie-500 md:inline">
                Hoje é {formatarData(hojeChave())}
              </span>
              <Link
                href={navegar(hojeMes, "", "", vista)}
                className="rounded-lg border border-borda bg-white px-3 py-2 text-sm font-medium text-superficie-700 hover:bg-superficie-50"
              >
                Voltar a hoje
              </Link>
            </div>
          </div>

          {vista === "gantt" ? (
            <GraficoGantt itens={itensGantt} dependencias={dependencias} />
          ) : (
            <>
              <CalendarioInterativo
                semana={semana}
                itensPorDia={itensPorChave}
                podeReagendar={podeReagendar}
              />

              {totalItens === 0 && (
                <EstadoVazio
                  icone={<Calendar className="h-8 w-8" />}
                  titulo="Nenhuma atividade neste período"
                  descricao={
                    obra || responsavel
                      ? "Ajuste os filtros para visualizar as tarefas planejadas ou concluídas."
                      : "Planeje tarefas para dias futuros para organizar o trabalho no canteiro."
                  }
                  acao={
                    !obra && !responsavel ? (
                      <Link href="/tarefas/nova">
                        <Botao variante="primario">
                          <Plus className="h-4 w-4" />
                          Nova tarefa
                        </Botao>
                      </Link>
                    ) : undefined
                  }
                />
              )}
            </>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
