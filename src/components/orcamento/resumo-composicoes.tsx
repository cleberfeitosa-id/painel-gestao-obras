import Link from "next/link";
import { Layers } from "lucide-react";
import { Cartao, CartaoCabecalho, CartaoConteudo } from "@/components/ui";
import { formatarMoeda } from "@/lib/utils";
import { EditorComposicao } from "@/components/orcamento/editor-composicao";
import { ImportarComposicoes } from "@/components/orcamento/importar-composicoes";
import type { ComposicaoRow } from "@/lib/supabase/database.types";

interface ResumoComposicoesProps {
  obraId: string;
  total: number;
  semCodigo: number;
  recentes: ComposicaoRow[];
}

export function ResumoComposicoes({
  obraId,
  total,
  semCodigo,
  recentes,
}: ResumoComposicoesProps) {
  return (
    <section className="space-y-4">
      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-superficie-400" />
              <h2 className="text-lg font-semibold">Composições</h2>
            </div>
            <Link
              href={`/obras/${obraId}/orcamentos/composicoes`}
              className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
            >
              Ver todas
            </Link>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold text-superficie-900">
              {total.toLocaleString("pt-BR")} cadastradas
            </span>
            <span className="text-superficie-500">
              {semCodigo.toLocaleString("pt-BR")} sem código
            </span>
          </div>
          {recentes.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-superficie-500">
                Últimas cadastradas
              </p>
              <ul className="divide-y divide-borda">
                {recentes.map((composicao) => (
                  <li
                    key={composicao.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-superficie-900">
                        {composicao.nome}
                      </p>
                      <p className="text-xs text-superficie-500">
                        {composicao.codigo ?? "Sem código"}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-superficie-900">
                      {formatarMoeda(composicao.custo_unitario)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-superficie-500">
              Nenhuma composição cadastrada ainda.
            </p>
          )}
          {semCodigo > 0 && (
            <p className="text-xs text-superficie-500">
              Composições sem código não podem ser vinculadas a itens do
              orçamento.
            </p>
          )}
        </CartaoConteudo>
      </Cartao>
      <div className="grid gap-4 lg:grid-cols-2">
        <EditorComposicao obraId={obraId} />
        <ImportarComposicoes obraId={obraId} />
      </div>
    </section>
  );
}