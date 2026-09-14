import type { ColunaOrcamento, FuncaoColunaOrcamento, LinhaOrcamento } from "./tipos";
import { numeroBrasileiro, texto } from "./planilha";

export type MapaFuncoes = Partial<Record<FuncaoColunaOrcamento, string>>;

// Constroi o mapa funcao -> id da coluna a partir de coluna.funcao.
// Quando duas colunas reivindicam a mesma funcao, a PRIMEIRA vence
// (ordem do array de colunas); as demais sao ignoradas no mapa.
export function mapearFuncoes(colunas: ColunaOrcamento[]): MapaFuncoes {
  const mapa: MapaFuncoes = {};
  for (const coluna of colunas) {
    if (!coluna.funcao) continue;
    if (mapa[coluna.funcao] === undefined) {
      mapa[coluna.funcao] = coluna.id;
    }
  }
  return mapa;
}

// Mesmo filtro de resumirOrcamento: grupo, subtotal e informativa ficam de fora.
function ehItem(linha: LinhaOrcamento): boolean {
  return linha.__tipo !== "grupo" && linha.__tipo !== "subtotal" && linha.__tipo !== "informativa";
}

function numero(valor: LinhaOrcamento[string]): number {
  return numeroBrasileiro(valor) ?? 0;
}

// Valor previsto da linha: soma da coluna valor_total; sem ela, usa o
// fallback quantidade x valor_unitario (mesma regra dos cards antigos).
function previstoDaLinha(linha: LinhaOrcamento, mapa: MapaFuncoes): number {
  const colunaValorTotal = mapa.valor_total;
  if (colunaValorTotal) return numero(linha[colunaValorTotal]);
  const quantidade = mapa.quantidade ? numero(linha[mapa.quantidade]) : 0;
  const valorUnitario = mapa.valor_unitario ? numero(linha[mapa.valor_unitario]) : 0;
  return quantidade * valorUnitario;
}

export type IndicadoresOrcamento = {
  totalPrevisto: number; // soma de valor_total (fallback: quantidade x valor_unitario)
  totalComBdi: number; // soma de valor_total x (1 + bdi/100) quando ha coluna bdi; senao totalPrevisto
  totalReal: number; // soma de custo_real
  variacao: number; // totalReal - totalPrevisto
  percentualVariacao: number; // variacao / totalPrevisto (0 quando totalPrevisto === 0)
  quantidadePrevista: number; // soma de quantidade
  quantidadeExecutada: number; // soma de quantidade_executada
  percentualExecutado: number; // quantidadeExecutada / quantidadePrevista (0 quando divisor 0)
  quantidadeLinhas: number; // linhas de item (sem grupo/subtotal/informativa)
  itensSemCusto: number; // itens com custo_real nulo/vazio
  itensSemComposicao: number; // itens sem __composicao_id e sem valor nas colunas composicao/codigo
  // Origem de cada cartao na UI; null quando a funcao nao esta mapeada.
  colunaPrevistaId: string | null;
  colunaRealId: string | null;
  colunaBdiId: string | null;
  colunaQuantidadeId: string | null;
  colunaQuantidadeExecutadaId: string | null;
  colunaComposicaoId: string | null;
  colunaCodigoId: string | null;
  temColunaBdi: boolean;
};

export function calcularIndicadores(
  linhas: LinhaOrcamento[],
  colunas: ColunaOrcamento[],
): IndicadoresOrcamento {
  const mapa = mapearFuncoes(colunas);
  const itens = linhas.filter(ehItem);

  const colunaCustoReal = mapa.custo_real;
  const colunaQuantidade = mapa.quantidade;
  const colunaQuantidadeExecutada = mapa.quantidade_executada;
  const colunaBdi = mapa.bdi;
  const colunaComposicao = mapa.composicao;
  const colunaCodigo = mapa.codigo;

  let totalPrevisto = 0;
  let totalComBdi = 0;
  let totalReal = 0;
  let quantidadePrevista = 0;
  let quantidadeExecutada = 0;
  let itensSemCusto = 0;
  let itensSemComposicao = 0;

  for (const linha of itens) {
    const previsto = previstoDaLinha(linha, mapa);
    totalPrevisto += previsto;

    // O parser ja remove o "%" e guarda 10 para "10%", entao o multiplicador e (1 + bdi/100).
    const bdi = colunaBdi ? numero(linha[colunaBdi]) : 0;
    totalComBdi += previsto * (1 + bdi / 100);

    const real = colunaCustoReal ? numero(linha[colunaCustoReal]) : 0;
    totalReal += real;

    quantidadePrevista += colunaQuantidade ? numero(linha[colunaQuantidade]) : 0;
    quantidadeExecutada += colunaQuantidadeExecutada ? numero(linha[colunaQuantidadeExecutada]) : 0;

    if (colunaCustoReal && (linha[colunaCustoReal] == null || linha[colunaCustoReal] === "")) {
      itensSemCusto += 1;
    }

    const temComposicaoId = linha.__composicao_id != null && linha.__composicao_id !== "";
    const valorComposicao = colunaComposicao ? texto(linha[colunaComposicao]) : "";
    const valorCodigo = colunaCodigo ? texto(linha[colunaCodigo]) : "";
    if (!temComposicaoId && !valorComposicao && !valorCodigo) {
      itensSemComposicao += 1;
    }
  }

  const variacao = totalReal - totalPrevisto;

  return {
    totalPrevisto,
    totalComBdi: colunaBdi ? totalComBdi : totalPrevisto,
    totalReal,
    variacao,
    percentualVariacao: totalPrevisto === 0 ? 0 : variacao / totalPrevisto,
    quantidadePrevista,
    quantidadeExecutada,
    percentualExecutado: quantidadePrevista === 0 ? 0 : quantidadeExecutada / quantidadePrevista,
    quantidadeLinhas: itens.length,
    itensSemCusto,
    itensSemComposicao,
    colunaPrevistaId: mapa.valor_total ?? null,
    colunaRealId: colunaCustoReal ?? null,
    colunaBdiId: colunaBdi ?? null,
    colunaQuantidadeId: colunaQuantidade ?? null,
    colunaQuantidadeExecutadaId: colunaQuantidadeExecutada ?? null,
    colunaComposicaoId: colunaComposicao ?? null,
    colunaCodigoId: colunaCodigo ?? null,
    temColunaBdi: Boolean(colunaBdi),
  };
}

export type AgregadoDimensao = {
  chave: string;
  previsto: number;
  real: number;
  quantidade: number;
  linhas: number;
};

// Agrupa os itens pelo valor da coluna mapeada para a dimensao pedida.
// Para "grupo", cai para __grupo quando a coluna nao esta mapeada.
// Linhas sem valor agrupam sob "Sem classificacao". Ordena por previsto desc.
export function agregarPorDimensao(
  linhas: LinhaOrcamento[],
  colunas: ColunaOrcamento[],
  dimensao: "grupo" | "fonte" | "categoria",
): AgregadoDimensao[] {
  const mapa = mapearFuncoes(colunas);
  const colunaDimensao = mapa[dimensao];
  const itens = linhas.filter(ehItem);
  const agregados = new Map<string, AgregadoDimensao>();

  for (const linha of itens) {
    let chave = colunaDimensao ? texto(linha[colunaDimensao]) : "";
    if (!chave && dimensao === "grupo") chave = texto(linha.__grupo);
    if (!chave) chave = "Sem classificação";

    const atual = agregados.get(chave) ?? { chave, previsto: 0, real: 0, quantidade: 0, linhas: 0 };
    atual.previsto += previstoDaLinha(linha, mapa);
    atual.real += mapa.custo_real ? numero(linha[mapa.custo_real]) : 0;
    atual.quantidade += mapa.quantidade ? numero(linha[mapa.quantidade]) : 0;
    atual.linhas += 1;
    agregados.set(chave, atual);
  }

  return [...agregados.values()].sort((a, b) => b.previsto - a.previsto);
}