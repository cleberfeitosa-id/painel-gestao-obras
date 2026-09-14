import type { OrcamentoItemRow } from "@/lib/supabase/database.types";
import type { LinhaOrcamento } from "@/lib/orcamento/tipos";

export type StatusVinculo = "encontrada" | "ausente" | "duplicada" | "desatualizada";

export type ItemVinculo = {
  chaveEstavel: string;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  valorOriginal: number | null; // __valor_original quando aplicado, senao o valor unitario atual
  valorAtual: number;
  valorCalculado: number | null;
  diferenca: number | null;
  status: StatusVinculo;
  composicaoId: string | null;
  porCategoria: Record<string, number>;
  aplicado: boolean;
};

export type ComposicaoVinculo = {
  id: string;
  codigo: string | null;
  atualizado_em: string;
};

export type CustoComposicao = {
  total: number;
  porCategoria: Record<string, number>;
};

// Divergencia e um assunto de exibicao: nao entra no enum de status.
export const LIMIAR_DIVERGENCIA = 0.005;

export function temDivergencia(item: ItemVinculo): boolean {
  return item.diferenca != null && Math.abs(item.diferenca) > LIMIAR_DIVERGENCIA;
}

function lerDados(item: OrcamentoItemRow): LinhaOrcamento {
  const dados = item.dados;
  if (typeof dados === "object" && dados !== null && !Array.isArray(dados)) {
    return dados as unknown as LinhaOrcamento;
  }
  return {};
}

function valorNumerico(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function composicaoDesatualizada(versao: string | null, atualizadoEm: string | undefined): boolean {
  // Sem versao registrada ou sem a composicao na obra nao da para confirmar
  // que o vinculo esta atual; tratamos como desatualizado.
  if (versao == null || atualizadoEm == null) return true;
  const versaoMs = Date.parse(versao);
  const atualizadoMs = Date.parse(atualizadoEm);
  if (Number.isNaN(versaoMs) || Number.isNaN(atualizadoMs)) return true;
  return atualizadoMs > versaoMs;
}

export function construirVinculos(
  itens: OrcamentoItemRow[],
  composicoes: ComposicaoVinculo[],
  custos: Map<string, CustoComposicao>,
): ItemVinculo[] {
  // O SQL devolve NULL para codigo ambiguo (0 ou mais de 1 match). Para
  // distinguir "ausente" de "duplicada" contamos os codigos da obra aqui.
  const contagemPorCodigo = new Map<string, number>();
  const atualizadoEm = new Map<string, string>();
  for (const composicao of composicoes) {
    if (composicao.codigo) {
      contagemPorCodigo.set(composicao.codigo, (contagemPorCodigo.get(composicao.codigo) ?? 0) + 1);
    }
    atualizadoEm.set(composicao.id, composicao.atualizado_em);
  }

  return itens.map((item) => {
    const dados = lerDados(item);
    const valorOriginalStash = valorNumerico(dados.__valor_original);
    const aplicado = valorOriginalStash != null;
    const valorOriginal = valorOriginalStash ?? item.valor_unitario;
    const custo = item.composicao_id ? custos.get(item.composicao_id) : undefined;
    const valorCalculado = custo?.total ?? null;
    const valorAtual = item.valor_unitario;
    const diferenca = valorCalculado != null ? valorCalculado - valorAtual : null;

    let status: StatusVinculo;
    if (item.composicao_id) {
      status = composicaoDesatualizada(item.composicao_versao, atualizadoEm.get(item.composicao_id))
        ? "desatualizada"
        : "encontrada";
    } else if (!item.codigo) {
      status = "ausente";
    } else {
      const contagem = contagemPorCodigo.get(item.codigo) ?? 0;
      status = contagem > 1 ? "duplicada" : "ausente";
    }

    return {
      chaveEstavel: item.chave_estavel,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorOriginal,
      valorAtual,
      valorCalculado,
      diferenca,
      status,
      composicaoId: item.composicao_id,
      porCategoria: custo?.porCategoria ?? {},
      aplicado,
    };
  });
}
