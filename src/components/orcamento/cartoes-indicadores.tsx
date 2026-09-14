"use client";

import { Cartao, CartaoConteudo } from "@/components/ui";
import { cn, formatarMoeda } from "@/lib/utils";
import type { IndicadoresOrcamento } from "@/lib/orcamento/indicadores";
import type { ColunaOrcamento } from "@/lib/orcamento/tipos";
import { FUNCAO_COLUNA_ORCAMENTO } from "@/lib/domain/rotulos";

interface CartoesIndicadoresProps {
  indicadores: IndicadoresOrcamento;
  colunas: ColunaOrcamento[];
}

function obterNomeColuna(colunas: ColunaOrcamento[], colunaId: string | null): string {
  if (!colunaId) return "não configurada";
  const coluna = colunas.find((c) => c.id === colunaId);
  return coluna ? coluna.nome : "não configurada";
}

export function CartoesIndicadores({ indicadores, colunas }: CartoesIndicadoresProps) {
  const cards: Array<{
    titulo: string;
    valor: string;
    classeValor?: string;
    fonte: string;
    funcao?: keyof typeof FUNCAO_COLUNA_ORCAMENTO;
    mostrar?: boolean;
  }> = [
    {
      titulo: "Previsto",
      valor: formatarMoeda(indicadores.totalPrevisto),
      fonte: obterNomeColuna(colunas, indicadores.colunaPrevistaId),
      funcao: "valor_total",
    },
    {
      titulo: "Valor com BDI",
      valor: formatarMoeda(indicadores.totalComBdi),
      fonte: obterNomeColuna(colunas, indicadores.colunaBdiId),
      funcao: "bdi",
      mostrar: indicadores.temColunaBdi,
    },
    {
      titulo: "Custo real",
      valor: formatarMoeda(indicadores.totalReal),
      fonte: obterNomeColuna(colunas, indicadores.colunaRealId),
      funcao: "custo_real",
    },
    {
      titulo: "Variação",
      valor: formatarMoeda(indicadores.variacao),
      classeValor: indicadores.variacao > 0 ? "text-red-600" : "text-emerald-600",
      fonte: "Cálculo: Real - Previsto",
    },
    {
      titulo: "% Executado (qtd)",
      valor: `${(indicadores.percentualExecutado * 100).toFixed(1)}%`,
      fonte: `Qtd: ${obterNomeColuna(colunas, indicadores.colunaQuantidadeId)} / Exec: ${obterNomeColuna(colunas, indicadores.colunaQuantidadeExecutadaId)}`,
    },
    {
      titulo: "Linhas (itens)",
      valor: indicadores.quantidadeLinhas.toLocaleString("pt-BR"),
      fonte: "Linhas do tipo item",
    },
    {
      titulo: "Itens sem custo real",
      valor: indicadores.itensSemCusto.toLocaleString("pt-BR"),
      fonte: obterNomeColuna(colunas, indicadores.colunaRealId),
      funcao: "custo_real",
    },
    {
      titulo: "Itens sem composição",
      valor: indicadores.itensSemComposicao.toLocaleString("pt-BR"),
      fonte: `Comp: ${obterNomeColuna(colunas, indicadores.colunaComposicaoId)} / Cód: ${obterNomeColuna(colunas, indicadores.colunaCodigoId)}`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards
        .filter((card) => card.mostrar !== false)
        .map((card) => (
          <Cartao key={card.titulo}>
            <CartaoConteudo className="space-y-1">
              <p className="text-xs text-superficie-500">{card.titulo}</p>
              <strong className={cn("text-lg", card.classeValor)}>{card.valor}</strong>
              <p className="text-[10px] text-superficie-400">Fonte: {card.fonte}</p>
            </CartaoConteudo>
          </Cartao>
        ))}
    </div>
  );
}