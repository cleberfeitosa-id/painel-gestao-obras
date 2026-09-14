import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calculator, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoConteudo, EstadoVazio } from "@/components/ui";
import { ImportarPlanilha } from "@/components/orcamento/importar-planilha";
import { ResumoComposicoes } from "@/components/orcamento/resumo-composicoes";
import { BotaoExcluirOrcamento } from "@/components/orcamento/botao-excluir-orcamento";
import { BotaoExcluirTudo } from "@/components/orcamento/botao-excluir-tudo";
import type { OrcamentoRow, ComposicaoRow } from "@/lib/supabase/database.types";

export default async function OrcamentosObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [obraResult, orcamentosResult, totalResult, semCodigoResult, recentesResult] = await Promise.all([
    supabase.from("obras").select("id, nome").eq("id", id).single(),
    supabase.from("orcamentos").select("*").eq("obra_id", id).order("atualizado_em", { ascending: false }),
    supabase.from("composicoes").select("*", { count: "exact", head: true }).eq("obra_id", id),
    supabase.from("composicoes").select("*", { count: "exact", head: true }).eq("obra_id", id).is("codigo", null),
    supabase.from("composicoes").select("id, codigo, nome, custo_unitario").eq("obra_id", id).order("criado_em", { ascending: false }).limit(5),
  ]);
  const obra = obraResult.data;
  if (!obra) notFound();
  const lista = (orcamentosResult.data ?? []) as OrcamentoRow[];
  const totalComposicoes = totalResult.count ?? 0;
  const semCodigo = semCodigoResult.count ?? 0;
  const recentes = (recentesResult.data ?? []) as ComposicaoRow[];

  // Orcamentos com itens vinculados a catalogo de precos (bloqueiam a exclusao).
  const orcamentosComVinculo = new Set<string>();
  if (lista.length > 0) {
    const { data: itens } = await supabase
      .from("orcamento_itens")
      .select("id, orcamento_id")
      .in("orcamento_id", lista.map((orcamento) => orcamento.id));
    const itemIds = (itens ?? []).map((item) => item.id);
    for (let i = 0; i < itemIds.length; i += 200) {
      const { data: vinculados } = await supabase
        .from("catalogo_precos")
        .select("orcamento_item_id")
        .in("orcamento_item_id", itemIds.slice(i, i + 200));
      for (const vinculo of vinculados ?? []) {
        const item = (itens ?? []).find((candidato) => candidato.id === vinculo.orcamento_item_id);
        if (item) orcamentosComVinculo.add(item.orcamento_id);
      }
    }
    for (let i = 0; i < itemIds.length; i += 200) {
      const { data: vinculados } = await supabase
        .from("catalogo_precos_orcamento_itens")
        .select("orcamento_item_id")
        .in("orcamento_item_id", itemIds.slice(i, i + 200));
      for (const vinculo of vinculados ?? []) {
        const item = (itens ?? []).find((candidato) => candidato.id === vinculo.orcamento_item_id);
        if (item) orcamentosComVinculo.add(item.orcamento_id);
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-azul-600">
          <ArrowLeft className="h-4 w-4" />Voltar para a obra
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Validação de orçamento</h1>
        <p className="text-sm text-superficie-500">{obra.nome}</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Orçamentos</h2>
          <div className="flex items-center gap-2">
            <BotaoExcluirTudo
              obraId={id}
              orcamentos={lista.length}
              composicoes={totalComposicoes}
            />
            <Link
              href={`/obras/${id}/orcamentos/painel`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-borda px-3 py-1.5 text-sm font-medium text-superficie-700 hover:bg-superficie-50 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Painel financeiro
            </Link>
          </div>
        </div>
        <ImportarPlanilha obraId={id} />
        {lista.length === 0 ? (
          <Cartao>
            <CartaoConteudo>
              <EstadoVazio
                icone={<Calculator className="h-8 w-8" />}
                titulo="Nenhum orçamento"
                descricao="Importe uma planilha para começar a validar custos previstos e reais."
              />
            </CartaoConteudo>
          </Cartao>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((orcamento) => {
              const linhas = Array.isArray(orcamento.linhas) ? orcamento.linhas.length : 0;
              return (
                <Cartao key={orcamento.id} className="flex h-full flex-col transition-shadow hover:shadow-md">
                  <Link href={`/obras/${id}/orcamentos/${orcamento.id}`} className="flex-1">
                    <CartaoConteudo>
                      <h2 className="font-semibold">{orcamento.nome}</h2>
                      <p className="mt-2 text-sm text-superficie-500">{linhas} linhas · {orcamento.arquivo_nome ?? "dados editáveis"}</p>
                    </CartaoConteudo>
                  </Link>
                  <div className="flex items-center justify-end px-6 pb-4">
                    <BotaoExcluirOrcamento
                      orcamentoId={orcamento.id}
                      obraId={id}
                      nome={orcamento.nome}
                      compacto
                      temItensVinculados={orcamentosComVinculo.has(orcamento.id)}
                    />
                  </div>
                </Cartao>
              );
            })}
          </div>
        )}
      </section>

      <ResumoComposicoes
        obraId={id}
        total={totalComposicoes}
        semCodigo={semCodigo}
        recentes={recentes}
      />
    </div>
  );
}
