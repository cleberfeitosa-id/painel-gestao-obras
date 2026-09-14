import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EstadoVazio } from "@/components/ui";
import {
  PainelFinanceiro,
  type ItemMedidoSemOrcamento,
} from "@/components/orcamento/painel-financeiro";

export default async function PainelFinanceiroObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!obra) notFound();

  const [painelResult, custosResult, semOrcamentoResult] = await Promise.all([
    supabase.rpc("painel_compras_orcamento", { p_obra_id: id }),
    supabase.rpc("custo_composicoes", { p_obra_id: id }),
    supabase
      .from("catalogo_precos")
      .select(
        "id, nome, unidade, valor_unitario, medicoes!inner(obra_id, titulo), tarefa_medicoes(quantidade)",
      )
      .eq("medicoes.obra_id", id)
      .is("orcamento_item_id", null)
      .not("tarefa_medicoes", "is", null),
  ]);

  const linhas = painelResult.data ?? [];
  const custos = custosResult.data ?? [];

  const orcamentoItemIds = linhas.map((l) => l.orcamento_item_id);
  const vinculoCatalogo = new Map<string, Set<string>>();
  if (orcamentoItemIds.length > 0) {
    const { data: vinculos } = await supabase
      .from("catalogo_precos_orcamento_itens")
      .select("catalogo_id, orcamento_item_id")
      .in("orcamento_item_id", orcamentoItemIds);
    if (vinculos) {
      for (const v of vinculos) {
        const set = vinculoCatalogo.get(v.orcamento_item_id) ?? new Set();
        set.add(v.catalogo_id);
        vinculoCatalogo.set(v.orcamento_item_id, set);
      }
    }
  }

  const medidosSemOrcamento: ItemMedidoSemOrcamento[] = (
    semOrcamentoResult.data ?? []
  ).map((item) => {
    const quantidade = (item.tarefa_medicoes ?? []).reduce(
      (acc, tm) => acc + tm.quantidade,
      0,
    );
    return {
      id: item.id,
      nome: item.nome,
      unidade: item.unidade,
      valor_unitario: item.valor_unitario,
      medicao_titulo: item.medicoes?.titulo ?? "—",
      quantidade,
      valor: quantidade * item.valor_unitario,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${obra.id}/orcamentos`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para orçamentos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Painel financeiro
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Previsto vs medido da obra {obra.nome}
        </p>
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={<BarChart3 className="h-8 w-8" />}
          titulo="Nenhum item orçado"
          descricao="Importe um orçamento para esta obra para visualizar o comparativo entre o previsto e o medido."
        />
      ) : (
        <PainelFinanceiro
          linhas={linhas}
          custos={custos}
          medidosSemOrcamento={medidosSemOrcamento}
          vinculoCatalogo={vinculoCatalogo}
        />
      )}
    </div>
  );
}
