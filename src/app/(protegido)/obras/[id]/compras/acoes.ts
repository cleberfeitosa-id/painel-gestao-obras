"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Resultado = { erro?: string };

async function verificarFinanceiro(): Promise<Resultado | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };
  const { data: perfil } = await supabase.from("perfis").select("papel, pode_editar_financeiro").eq("id", user.id).single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor") || (perfil.papel === "gestor" && perfil.pode_editar_financeiro === false)) {
    return { erro: "Voce nao tem permissao para gerenciar compras." };
  }
  return null;
}

// --- Schemas ---

const itemSchema = z.object({
  orcamentoItemId: z.string().uuid().nullable().optional(),
  composicaoId: z.string().uuid().nullable().optional(),
  composicaoComponenteId: z.string().uuid().nullable().optional(),
  codigoInsumo: z.string().trim().max(80).nullable().optional(),
  descricao: z.string().trim().min(1).max(300),
  unidade: z.string().trim().min(1).max(20),
  quantidade: z.number().positive().max(1_000_000_000),
  valorUnitario: z.number().min(0).max(1_000_000_000),
  categoria: z.enum(["mao_de_obra", "material", "equipamento", "outro"]).nullable().optional(),
  coeficiente: z.number().min(0).max(1_000_000_000).nullable().optional(),
});

const compraSchema = z.object({
  obraId: z.string().uuid(),
  fornecedor: z.string().trim().max(200).nullable().optional(),
  documento: z.string().trim().max(100).nullable().optional(),
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().trim().max(1000).nullable().optional(),
  itens: z.array(itemSchema).min(1).max(500),
});

// --- Actions ---

export type InsumoCompra = {
  componenteId: string;
  orcamentoItemId: string;
  orcamentoCodigo: string | null;
  orcamentoDescricao: string | null;
  quantidadeComposicao: number;
  quantidadePrevista: number;
  valorPrevisto: number;
  codigo: string | null;
  nome: string;
  unidade: string;
  coeficiente: number;
  custoUnitario: number;
  composicaoId: string;
  composicaoCodigo: string | null;
  composicaoNome: string;
  categoria: "mao_de_obra" | "material" | "equipamento" | "outro";
  quantidadeReal: number;
  valorUnitarioReal: number;
};

export async function buscarInsumosCompra(obraId: string, termo: string): Promise<Resultado & { insumos?: InsumoCompra[] }> {
  const negado = await verificarFinanceiro();
  if (negado) return negado;
  const obraValidada = z.string().uuid().safeParse(obraId);
  if (!obraValidada.success) return { erro: "Obra invalida." };
  const termoValidado = z.string().trim().max(100).safeParse(termo);
  if (!termoValidado.success) return { erro: "Termo de busca muito longo." };
  if (!termoValidado.data) return { insumos: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_insumos_compra_hierarquicos", { p_obra_id: obraValidada.data, p_termo: termoValidado.data });
  if (error) return { erro: "Erro ao buscar insumos." };
  return { insumos: (data ?? []).map((item: Record<string, unknown>) => ({
    componenteId: item.componente_id as string,
    orcamentoItemId: item.orcamento_item_id as string,
    orcamentoCodigo: item.orcamento_codigo as string | null,
    orcamentoDescricao: item.orcamento_descricao as string | null,
    quantidadeComposicao: item.quantidade_composicao as number,
    quantidadePrevista: item.quantidade_prevista as number,
    valorPrevisto: item.valor_previsto as number,
    codigo: item.codigo as string | null,
    nome: item.nome as string,
    unidade: item.unidade as string,
    coeficiente: item.coeficiente as number,
    custoUnitario: item.custo_unitario as number,
    composicaoId: item.composicao_id as string,
    composicaoCodigo: item.composicao_codigo as string | null,
    composicaoNome: item.composicao_nome as string,
     categoria: item.categoria as InsumoCompra["categoria"],
     quantidadeReal: 0,
     valorUnitarioReal: 0,
  })) };
}

export async function buscarComponentesComposicao(composicaoId: string): Promise<Resultado & { componentes?: Array<{ componenteId: string; codigo: string | null; nome: string; categoria: string; unidade: string; quantidade: number; custoUnitario: number; custoTotal: number }> }> {
  const negado = await verificarFinanceiro();
  if (negado) return negado;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("componentes_composicao_para_compra", { p_composicao_id: composicaoId });
  if (error) return { erro: "Erro ao buscar componentes." };
  return { componentes: (data ?? []).map((c: Record<string, unknown>) => ({
    componenteId: c.componente_id as string,
    codigo: c.codigo as string | null,
    nome: c.nome as string,
    categoria: c.categoria as string,
    unidade: c.unidade as string,
    quantidade: c.quantidade as number,
    custoUnitario: c.custo_unitario as number,
    custoTotal: c.custo_total as number,
  })) };
}

export async function criarCompra(dados: unknown): Promise<Resultado> {
  const negado = await verificarFinanceiro();
  if (negado) return negado;
  const entrada = compraSchema.safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Valida orcamento_item pertence a obra
  for (const item of entrada.data.itens) {
    if (item.orcamentoItemId) {
      const { data: oi } = await supabase.from("orcamento_itens").select("id, orcamentos!inner(obra_id)").eq("id", item.orcamentoItemId).single();
      if (!oi || oi.orcamentos?.obra_id !== entrada.data.obraId) return { erro: "Um item do orcamento nao pertence a esta obra." };
    }
    if (item.composicaoId) {
      const { data: co } = await supabase.from("composicoes").select("id").eq("id", item.composicaoId).eq("obra_id", entrada.data.obraId).single();
      if (!co) return { erro: "Uma composicao nao pertence a esta obra." };
    }
  }

  const { data: compra, error } = await supabase.from("compras").insert({
    obra_id: entrada.data.obraId,
    fornecedor: entrada.data.fornecedor ?? null,
    documento: entrada.data.documento ?? null,
    data_compra: entrada.data.dataCompra,
    observacao: entrada.data.observacao ?? null,
    criado_por: user?.id ?? null,
  }).select("id").single();
  if (error || !compra) return { erro: "Nao foi possivel criar a compra." };

  const { error: erroItens } = await supabase.from("compra_itens").insert(entrada.data.itens.map((item) => ({
    compra_id: compra.id,
    orcamento_item_id: item.orcamentoItemId ?? null,
    composicao_id: item.composicaoId ?? null,
    composicao_componente_id: item.composicaoComponenteId ?? null,
    codigo_insumo: item.codigoInsumo ?? null,
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valor_unitario: item.valorUnitario,
    categoria: item.categoria ?? null,
    coeficiente: item.coeficiente ?? null,
  })));
  if (erroItens) {
    await supabase.from("compras").delete().eq("id", compra.id);
    return { erro: "Nao foi possivel gravar os itens da compra." };
  }
  revalidatePath(`/obras/${entrada.data.obraId}/compras`);
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/painel`);
  return {};
}

export async function excluirCompra(compraId: string, obraId: string): Promise<Resultado> {
  const negado = await verificarFinanceiro();
  if (negado) return negado;
  const entrada = z.object({ compraId: z.string().uuid(), obraId: z.string().uuid() }).safeParse({ compraId, obraId });
  if (!entrada.success) return { erro: "Compra invalida." };
  const supabase = await createClient();
  const { error } = await supabase.from("compras").delete().eq("id", compraId).eq("obra_id", obraId);
  if (error) return { erro: "Nao foi possivel excluir a compra." };
  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/obras/${obraId}/orcamentos/painel`);
  return {};
}
