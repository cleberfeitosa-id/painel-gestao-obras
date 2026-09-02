import Link from "next/link";
import {
  HardHat,
  CheckSquare,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  Hammer,
  TrendingUp,
  Layers,
  Ruler,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { situacaoPrazo, hojeChave } from "@/lib/datas";
import { formatarMoeda } from "@/lib/utils";
import { STATUS_OBRA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Botao,
} from "@/components/ui";

interface ObraComCompletude {
  id: string;
  nome: string;
  status: string;
  cidade: string | null;
  totalTarefas: number;
  tarefasConcluidas: number;
  tarefasExecucao: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  percentualTarefas: number;
  valorContrato: number;
  valorExecutado: number;
  valorPago: number;
  percentualFinanceiro: number | null;
}

interface MedicaoResumo {
  id: string;
  obraId: string;
  obraNome: string;
  titulo: string;
  valorContrato: number;
  valorExecutado: number;
  valorPago: number;
}

async function buscarDados() {
  const supabase = await createClient();
  const hoje = hojeChave();

  const [
    { count: totalObrasAndamento },
    { count: totalObrasGeral },
    { count: tarefasPendentes },
    { count: tarefasExecucao },
    { count: tarefasConcluidas },
    { count: tarefasAtrasadas },
    { data: tarefasUrgentes },
    { data: todasObras },
    { data: todasMedicoes },
  ] = await Promise.all([
    supabase
      .from("obras")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_andamento"),
    supabase
      .from("obras")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_execucao"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "concluido"),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .neq("status", "concluido")
      .lt("prazo", hoje),
    supabase
      .from("tarefas")
      .select("*, obras!inner(id, nome)")
      .in("status", ["pendente", "em_execucao"])
      .order("prioridade", { ascending: false })
      .order("prazo", { ascending: true, nullsFirst: true })
      .limit(6),
    supabase
      .from("obras")
      .select("id, nome, status, cidade, criado_em")
      .order("criado_em", { ascending: false }),
    supabase
      .from("medicoes")
      .select("id, obra_id, titulo, valor_contrato, obras!inner(nome)")
      .order("criado_em", { ascending: false }),
  ]);

  const obrasLista = (todasObras ?? []) as Array<{
    id: string;
    nome: string;
    status: string;
    cidade: string | null;
    criado_em: string;
  }>;

  const { data: todasTarefasObra } = await supabase
    .from("tarefas")
    .select("id, obra_id, status, prazo");

  const tarefasAgrupadas = new Map<
    string,
    { total: number; concluidas: number; execucao: number; pendentes: number; atrasadas: number }
  >();

  for (const t of todasTarefasObra ?? []) {
    if (!t.obra_id) continue;
    const atual = tarefasAgrupadas.get(t.obra_id) ?? {
      total: 0,
      concluidas: 0,
      execucao: 0,
      pendentes: 0,
      atrasadas: 0,
    };
    atual.total += 1;
    if (t.status === "concluido") atual.concluidas += 1;
    else if (t.status === "em_execucao") atual.execucao += 1;
    else if (t.status === "pendente") atual.pendentes += 1;

    if (t.status !== "concluido" && t.prazo && t.prazo < hoje) {
      atual.atrasadas += 1;
    }
    tarefasAgrupadas.set(t.obra_id, atual);
  }

  const medicoesRaw = (todasMedicoes ?? []) as Array<{
    id: string;
    obra_id: string;
    titulo: string;
    valor_contrato: number | null;
    obras: { nome: string };
  }>;

  let somaTotalContrato = 0;
  let somaTotalExecutado = 0;
  let somaTotalPago = 0;

  const medicoesCalculadas: MedicaoResumo[] = await Promise.all(
    medicoesRaw.slice(0, 15).map(async (m) => {
      const [{ data: vExec }, { data: vPago }] = await Promise.all([
        supabase.rpc("valor_executado_medicao", { p_medicao_id: m.id }),
        supabase.rpc("valor_pago_medicao", { p_medicao_id: m.id }),
      ]);
      const contrato = Number(m.valor_contrato) || 0;
      const executado = Number(vExec) || 0;
      const pago = Number(vPago) || 0;

      somaTotalContrato += contrato;
      somaTotalExecutado += executado;
      somaTotalPago += pago;

      return {
        id: m.id,
        obraId: m.obra_id,
        obraNome: m.obras?.nome ?? "Obra",
        titulo: m.titulo,
        valorContrato: contrato,
        valorExecutado: executado,
        valorPago: pago,
      };
    }),
  );

  const financeiroPorObra = new Map<
    string,
    { contrato: number; executado: number; pago: number }
  >();

  for (const m of medicoesCalculadas) {
    const atual = financeiroPorObra.get(m.obraId) ?? {
      contrato: 0,
      executado: 0,
      pago: 0,
    };
    atual.contrato += m.valorContrato;
    atual.executado += m.valorExecutado;
    atual.pago += m.valorPago;
    financeiroPorObra.set(m.obraId, atual);
  }

  const obrasCompletude: ObraComCompletude[] = obrasLista.map((obra) => {
    const t = tarefasAgrupadas.get(obra.id) ?? {
      total: 0,
      concluidas: 0,
      execucao: 0,
      pendentes: 0,
      atrasadas: 0,
    };
    const f = financeiroPorObra.get(obra.id) ?? {
      contrato: 0,
      executado: 0,
      pago: 0,
    };

    const percentualTarefas =
      t.total > 0 ? Math.round((t.concluidas / t.total) * 100) : 0;
    const percentualFinanceiro =
      f.contrato > 0 ? Math.min(100, Math.round((f.executado / f.contrato) * 100)) : null;

    return {
      id: obra.id,
      nome: obra.nome,
      status: obra.status,
      cidade: obra.cidade,
      totalTarefas: t.total,
      tarefasConcluidas: t.concluidas,
      tarefasExecucao: t.execucao,
      tarefasPendentes: t.pendentes,
      tarefasAtrasadas: t.atrasadas,
      percentualTarefas,
      valorContrato: f.contrato,
      valorExecutado: f.executado,
      valorPago: f.pago,
      percentualFinanceiro,
    };
  });

  return {
    totalObrasAndamento: totalObrasAndamento ?? 0,
    totalObrasGeral: totalObrasGeral ?? 0,
    tarefasPendentes: tarefasPendentes ?? 0,
    tarefasExecucao: tarefasExecucao ?? 0,
    tarefasConcluidas: tarefasConcluidas ?? 0,
    tarefasAtrasadas: tarefasAtrasadas ?? 0,
    tarefasUrgentes: (tarefasUrgentes ?? []) as Array<{
      id: string;
      titulo: string;
      prioridade: string;
      prazo: string | null;
      status: string;
      obras: { id: string; nome: string };
    }>,
    obrasCompletude,
    resumoFinanceiroGlobal: {
      totalContrato: somaTotalContrato,
      totalExecutado: somaTotalExecutado,
      totalPago: somaTotalPago,
      saldo: somaTotalContrato - somaTotalPago,
      percentualExecutado:
        somaTotalContrato > 0
          ? Math.min(100, Math.round((somaTotalExecutado / somaTotalContrato) * 100))
          : 0,
      percentualPago:
        somaTotalContrato > 0
          ? Math.min(100, Math.round((somaTotalPago / somaTotalContrato) * 100))
          : 0,
    },
    medicoesRecentes: medicoesCalculadas.slice(0, 5),
  };
}

function CartaoMetricaClicavel({
  icone,
  rotulo,
  valor,
  subtitulo,
  cor,
  href,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number | string;
  subtitulo?: string;
  cor: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <Cartao className="transition-all duration-200 group-hover:shadow-md group-hover:border-azul-300">
        <CartaoConteudo>
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${cor}`}
            >
              {icone}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-superficie-900 group-hover:text-azul-600 transition-colors">
                {valor}
              </p>
              <p className="text-sm text-superficie-500 truncate">{rotulo}</p>
              {subtitulo && (
                <p className="text-[11px] text-superficie-400 mt-0.5">{subtitulo}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-superficie-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
          </div>
        </CartaoConteudo>
      </Cartao>
    </Link>
  );
}

export default async function PainelPage() {
  const dados = await buscarDados();

  const temDados =
    dados.totalObrasGeral > 0 ||
    dados.tarefasPendentes > 0 ||
    dados.tarefasExecucao > 0 ||
    dados.tarefasConcluidas > 0;

  if (!temDados) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Painel Geral</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Visão geral e métricas de acompanhamento de obras.
          </p>
        </div>

        <EstadoVazio
          icone={<Hammer className="h-8 w-8" />}
          titulo="Nenhuma obra cadastrada"
          descricao="Comece cadastrando sua primeira obra para visualizar métricas, completude e medições no painel."
          acao={
            <Link href="/obras">
              <Botao variante="primario">
                <Plus className="h-4 w-4" />
                Cadastrar obra
              </Botao>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Painel de Gestão</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Visão geral de completude física, financeira e acompanhamento em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tarefas/nova">
            <Botao variante="primario">
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Botao>
          </Link>
          <Link href="/obras">
            <Botao variante="contorno">
              <HardHat className="h-4 w-4" />
              Ver Obras
            </Botao>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CartaoMetricaClicavel
          href="/obras"
          icone={<HardHat className="h-6 w-6 text-blue-600" />}
          rotulo="Obras em andamento"
          valor={dados.totalObrasAndamento}
          subtitulo={`${dados.totalObrasGeral} obras cadastradas`}
          cor="bg-blue-50"
        />
        <CartaoMetricaClicavel
          href="/tarefas?status=pendente"
          icone={<Clock className="h-6 w-6 text-amber-600" />}
          rotulo="Tarefas pendentes"
          valor={dados.tarefasPendentes}
          subtitulo={`${dados.tarefasExecucao} em execução`}
          cor="bg-amber-50"
        />
        <CartaoMetricaClicavel
          href="/tarefas?status=concluido"
          icone={<CheckSquare className="h-6 w-6 text-emerald-600" />}
          rotulo="Tarefas concluídas"
          valor={dados.tarefasConcluidas}
          subtitulo="Total finalizado"
          cor="bg-emerald-50"
        />
        <CartaoMetricaClicavel
          href="/tarefas"
          icone={<AlertTriangle className="h-6 w-6 text-red-600" />}
          rotulo="Tarefas atrasadas"
          valor={dados.tarefasAtrasadas}
          subtitulo="Requerem atenção"
          cor="bg-red-50"
        />
      </div>

      {dados.resumoFinanceiroGlobal.totalContrato > 0 && (
        <Cartao>
          <CartaoCabecalho>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-azul-600" />
                <CartaoTitulo>Resumo Consolidado de Medições</CartaoTitulo>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-azul-50 text-azul-700">
                {dados.resumoFinanceiroGlobal.percentualExecutado}% Executado
              </span>
            </div>
          </CartaoCabecalho>
          <CartaoConteudo>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="rounded-lg bg-superficie-50 p-3">
                <span className="text-xs text-superficie-500 font-medium block">
                  Total Contratado
                </span>
                <p className="text-lg font-bold text-superficie-900 mt-1">
                  {formatarMoeda(dados.resumoFinanceiroGlobal.totalContrato)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-100">
                <span className="text-xs text-emerald-700 font-medium block">
                  Total Executado
                </span>
                <p className="text-lg font-bold text-emerald-900 mt-1">
                  {formatarMoeda(dados.resumoFinanceiroGlobal.totalExecutado)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50/60 p-3 border border-blue-100">
                <span className="text-xs text-blue-700 font-medium block">
                  Total Pago
                </span>
                <p className="text-lg font-bold text-blue-900 mt-1">
                  {formatarMoeda(dados.resumoFinanceiroGlobal.totalPago)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50/60 p-3 border border-amber-100">
                <span className="text-xs text-amber-700 font-medium block">
                  Saldo Contratual
                </span>
                <p className="text-lg font-bold text-amber-900 mt-1">
                  {formatarMoeda(dados.resumoFinanceiroGlobal.saldo)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-superficie-600 mb-1.5">
                <span>Progresso Financeiro Consolidado</span>
                <span className="font-semibold text-superficie-900">
                  {dados.resumoFinanceiroGlobal.percentualExecutado}% Medido · {dados.resumoFinanceiroGlobal.percentualPago}% Quitado
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-100 flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${dados.resumoFinanceiroGlobal.percentualExecutado}%` }}
                  title={`Executado: ${dados.resumoFinanceiroGlobal.percentualExecutado}%`}
                />
              </div>
            </div>
          </CartaoConteudo>
        </Cartao>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-superficie-600" />
                  <CartaoTitulo>Completude das Obras</CartaoTitulo>
                </div>
                <Link
                  href="/obras"
                  className="text-sm font-medium text-azul-600 hover:text-azul-700 flex items-center gap-1"
                >
                  Todas as obras
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="p-0">
              {dados.obrasCompletude.length === 0 ? (
                <p className="px-6 py-8 text-sm text-superficie-500 text-center">
                  Nenhuma obra cadastrada no momento.
                </p>
              ) : (
                <div className="divide-y divide-superficie-100">
                  {dados.obrasCompletude.map((obra) => (
                    <Link
                      key={obra.id}
                      href={`/obras/${obra.id}`}
                      className="block p-4 sm:p-5 hover:bg-superficie-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-superficie-900 group-hover:text-azul-600 transition-colors truncate">
                            {obra.nome}
                          </p>
                          {obra.cidade && (
                            <p className="text-xs text-superficie-500">
                              {obra.cidade}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Etiqueta
                            className={
                              STATUS_OBRA[obra.status as keyof typeof STATUS_OBRA]?.classe
                            }
                          >
                            {STATUS_OBRA[obra.status as keyof typeof STATUS_OBRA]?.rotulo}
                          </Etiqueta>
                          <span className="text-xs font-bold text-superficie-700 bg-superficie-100 px-2 py-0.5 rounded-full">
                            {obra.percentualTarefas}%
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 mt-3">
                        <div className="flex items-center justify-between text-[11px] text-superficie-500">
                          <span>
                            Tarefas: {obra.tarefasConcluidas}/{obra.totalTarefas} concluídas
                          </span>
                          {obra.tarefasAtrasadas > 0 && (
                            <span className="text-red-600 font-semibold flex items-center gap-0.5">
                              <AlertTriangle className="h-3 w-3" /> {obra.tarefasAtrasadas} atrasada(s)
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-superficie-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${obra.percentualTarefas}%` }}
                          />
                        </div>
                      </div>

                      {obra.valorContrato > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-superficie-100 flex items-center justify-between text-[11px] text-superficie-600">
                          <span>Contrato: {formatarMoeda(obra.valorContrato)}</span>
                          <span className="font-medium text-azul-600">
                            Executado: {formatarMoeda(obra.valorExecutado)} ({obra.percentualFinanceiro}%)
                          </span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CartaoConteudo>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Tarefas Urgentes</CartaoTitulo>
                <Link
                  href="/tarefas"
                  className="text-sm font-medium text-azul-600 hover:text-azul-700 flex items-center gap-1"
                >
                  Ver todas
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="p-0">
              {dados.tarefasUrgentes.length === 0 ? (
                <p className="px-6 py-8 text-sm text-superficie-500 text-center">
                  Nenhuma tarefa urgente pendente.
                </p>
              ) : (
                <div className="divide-y divide-superficie-100">
                  {dados.tarefasUrgentes.map((tarefa) => {
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
                      <Link
                        key={tarefa.id}
                        href={`/tarefas/${tarefa.id}`}
                        className="block px-5 py-3 hover:bg-superficie-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-superficie-900 group-hover:text-azul-600 transition-colors truncate">
                            {tarefa.titulo}
                          </p>
                          <Etiqueta
                            className={
                              PRIORIDADE_TAREFA[
                                tarefa.prioridade as keyof typeof PRIORIDADE_TAREFA
                              ]?.classe
                            }
                          >
                            {
                              PRIORIDADE_TAREFA[
                                tarefa.prioridade as keyof typeof PRIORIDADE_TAREFA
                              ]?.rotulo
                            }
                          </Etiqueta>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-superficie-500">
                          <span className="truncate">{tarefa.obras?.nome}</span>
                          <span className={`font-medium ${corPrazo}`}>
                            {prazoInfo.texto}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CartaoConteudo>
          </Cartao>

          {dados.medicoesRecentes.length > 0 && (
            <Cartao>
              <CartaoCabecalho>
                <div className="flex items-center justify-between">
                  <CartaoTitulo>Medições Recentes</CartaoTitulo>
                  <Ruler className="h-4 w-4 text-superficie-400" />
                </div>
              </CartaoCabecalho>
              <CartaoConteudo className="p-0">
                <div className="divide-y divide-superficie-100">
                  {dados.medicoesRecentes.map((m) => (
                    <Link
                      key={m.id}
                      href={`/obras/${m.obraId}/medicoes/${m.id}`}
                      className="block px-5 py-3 hover:bg-superficie-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-superficie-900 group-hover:text-azul-600 truncate">
                          {m.titulo}
                        </p>
                        <span className="text-xs font-semibold text-emerald-700">
                          {formatarMoeda(m.valorExecutado)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-superficie-500">
                        <span className="truncate">{m.obraNome}</span>
                        <span>Contrato: {formatarMoeda(m.valorContrato)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CartaoConteudo>
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}
