import Link from "next/link";
import {
  HardHat,
  CheckSquare,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  Hammer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { situacaoPrazo, formatarData } from "@/lib/datas";
import { STATUS_TAREFA, STATUS_OBRA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Botao,
} from "@/components/ui";

async function buscarDados() {
  const supabase = await createClient();

  const [
    { count: totalObras },
    { count: tarefasPendentes },
    { count: tarefasExecucao },
    { count: tarefasConcluidas },
    { data: tarefasUrgentes },
    { data: obrasRecentes },
  ] = await Promise.all([
    supabase
      .from("obras")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_andamento"),
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
      .select("*, obras!inner(nome)")
      .in("status", ["pendente", "em_execucao"])
      .order("prioridade", { ascending: false })
      .order("prazo", { ascending: true, nullsFirst: true })
      .limit(8),
    supabase
      .from("obras")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);

  const hoje = new Date().toISOString().split("T")[0];
  const { count: tarefasAtrasadas } = await supabase
    .from("tarefas")
    .select("*", { count: "exact", head: true })
    .neq("status", "concluido")
    .lt("prazo", hoje);

  return {
    totalObras: totalObras ?? 0,
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
      obras: { nome: string };
    }>,
    obrasRecentes: (obrasRecentes ?? []) as Array<{
      id: string;
      nome: string;
      status: string;
      cidade: string | null;
      criado_em: string;
    }>,
  };
}

function CartaoMetrica({
  icone,
  rotulo,
  valor,
  cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <Cartao>
      <CartaoConteudo>
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${cor}`}
          >
            {icone}
          </div>
          <div>
            <p className="text-2xl font-bold text-superficie-900">{valor}</p>
            <p className="text-sm text-superficie-500">{rotulo}</p>
          </div>
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}

export default async function PainelPage() {
  const dados = await buscarDados();

  const temDados =
    dados.totalObras > 0 ||
    dados.tarefasPendentes > 0 ||
    dados.tarefasExecucao > 0;

  if (!temDados) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Painel</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Visao geral do seu sistema de gestao.
          </p>
        </div>

        <EstadoVazio
          icone={<Hammer className="h-8 w-8" />}
          titulo="Nenhuma obra cadastrada"
          descricao="Comece cadastrando sua primeira obra para visualizar metricas e tarefas no painel."
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
      <div>
        <h1 className="text-2xl font-bold text-superficie-900">Painel</h1>
        <p className="mt-1 text-sm text-superficie-500">
          Visao geral do seu sistema de gestao.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CartaoMetrica
          icone={<HardHat className="h-6 w-6 text-blue-600" />}
          rotulo="Obras em andamento"
          valor={dados.totalObras}
          cor="bg-blue-50"
        />
        <CartaoMetrica
          icone={<Clock className="h-6 w-6 text-amber-600" />}
          rotulo="Tarefas pendentes"
          valor={dados.tarefasPendentes}
          cor="bg-amber-50"
        />
        <CartaoMetrica
          icone={<CheckSquare className="h-6 w-6 text-emerald-600" />}
          rotulo="Tarefas concluidas"
          valor={dados.tarefasConcluidas}
          cor="bg-emerald-50"
        />
        <CartaoMetrica
          icone={<AlertTriangle className="h-6 w-6 text-red-600" />}
          rotulo="Tarefas atrasadas"
          valor={dados.tarefasAtrasadas}
          cor="bg-red-50"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Tarefas urgentes</CartaoTitulo>
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
                  Nenhuma tarefa pendente no momento.
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
                        className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-superficie-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-superficie-900 truncate">
                            {tarefa.titulo}
                          </p>
                          <p className="text-xs text-superficie-500 mt-0.5">
                            {tarefa.obras.nome}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Etiqueta
                            className={PRIORIDADE_TAREFA[tarefa.prioridade as keyof typeof PRIORIDADE_TAREFA]?.classe}
                          >
                            {PRIORIDADE_TAREFA[tarefa.prioridade as keyof typeof PRIORIDADE_TAREFA]?.rotulo}
                          </Etiqueta>
                          <span className={`text-xs ${corPrazo}`}>
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
        </div>

        <div>
          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo>Obras recentes</CartaoTitulo>
                <Link
                  href="/obras"
                  className="text-sm font-medium text-azul-600 hover:text-azul-700 flex items-center gap-1"
                >
                  Ver todas
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="p-0">
              {dados.obrasRecentes.length === 0 ? (
                <p className="px-6 py-8 text-sm text-superficie-500 text-center">
                  Nenhuma obra cadastrada.
                </p>
              ) : (
                <div className="divide-y divide-superficie-100">
                  {dados.obrasRecentes.map((obra) => (
                    <Link
                      key={obra.id}
                      href={`/obras/${obra.id}`}
                      className="block px-6 py-3 hover:bg-superficie-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-superficie-900 truncate">
                          {obra.nome}
                        </p>
                        <Etiqueta
                          className={
                            STATUS_OBRA[obra.status as keyof typeof STATUS_OBRA]
                              ?.classe
                          }
                        >
                          {STATUS_OBRA[obra.status as keyof typeof STATUS_OBRA]
                            ?.rotulo}
                        </Etiqueta>
                      </div>
                      {obra.cidade && (
                        <p className="text-xs text-superficie-500 mt-0.5">
                          {obra.cidade}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CartaoConteudo>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
