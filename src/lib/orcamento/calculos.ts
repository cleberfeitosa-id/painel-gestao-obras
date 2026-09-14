import type { LinhaOrcamento, ResumoOrcamento } from "./tipos";
import { numeroBrasileiro } from "./planilha";

function numero(valor: LinhaOrcamento[string]): number {
  return numeroBrasileiro(valor) ?? 0;
}

export function resumirOrcamento(
  linhas: LinhaOrcamento[],
  colunaPrevista = "valor_previsto",
  colunaReal = "custo_real",
): ResumoOrcamento {
  const itens = linhas.filter((linha) => linha.__tipo !== "grupo" && linha.__tipo !== "informativa" && linha.__tipo !== "subtotal");
  const totalPrevisto = itens.reduce((total, linha) => total + numero(linha[colunaPrevista]), 0);
  const totalReal = itens.reduce((total, linha) => total + numero(linha[colunaReal]), 0);
  return {
    totalPrevisto,
    totalReal,
    variacao: totalReal - totalPrevisto,
    quantidadeLinhas: itens.length,
  };
}

export function calcularCustoComposicao(componentes: { quantidade: number; custo_unitario: number }[]): number {
  return componentes.reduce((total, item) => total + item.quantidade * item.custo_unitario, 0);
}
