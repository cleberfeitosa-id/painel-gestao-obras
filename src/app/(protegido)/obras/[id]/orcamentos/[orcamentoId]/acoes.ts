"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function verificarGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };
  const { data: perfil } = await supabase.from("perfis").select("papel, pode_editar_financeiro").eq("id", user.id).single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor") || (perfil.papel === "gestor" && perfil.pode_editar_financeiro === false)) {
    return { erro: "Voce nao tem permissao para editar orcamentos." };
  }
  return null;
}

const vinculoSchema = z.object({
  orcamentoId: z.string().uuid(),
  obraId: z.string().uuid(),
  chaveEstavel: z.string().trim().min(1).max(80),
});

const vincularSchema = vinculoSchema.extend({
  composicaoId: z.string().uuid(),
});

const buscaSchema = z.object({
  obraId: z.string().uuid(),
  termo: z.string().trim().max(120),
});

// PostgREST interpreta virgulas e parenteses como sintaxe do filtro `or()`
// e aspas como delimitadores de valor. Removemos esses caracteres do termo
// antes de interpolar no `or()` para nao quebrar a consulta nem permitir
// injecao de operadores.
function escaparTermoBusca(termo: string): string {
  return termo.replace(/[,()"']/g, "");
}

function mapearErroRpc(mensagem: string | undefined): string {
  switch (mensagem) {
    case "Item sem composicao vinculada":
      return "Este item não possui uma composição vinculada. Vincule uma composição antes de aplicar o custo calculado.";
    case "Coluna de valor unitario nao mapeada":
      return "Mapeie a coluna de valor unitário antes de aplicar o custo calculado.";
    case "Composicao sem custo calculado":
      return "A composição vinculada não possui custo calculado.";
    case "Linha nao encontrada":
      return "Linha não encontrada no orçamento. Atualize a página e tente novamente.";
    case "Item sem valor original para reverter":
      return "Este item não possui valor original para reverter.";
    case "Orcamento nao encontrado":
      return "Orçamento não encontrado.";
    case "Composicao nao encontrada na obra":
      return "Composição não encontrada nesta obra.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}

export async function vincularComposicao(dados: {
  orcamentoId: string;
  obraId: string;
  chaveEstavel: string;
  composicaoId: string;
}): Promise<{ versao?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = vincularSchema.safeParse(dados);
  if (!entrada.success) return { erro: "Dados inválidos." };

  const supabase = await createClient();
  const { data: usuario } = await supabase.auth.getUser();
  const { data: versao, error } = await supabase.rpc("vincular_composicao_item", {
    p_orcamento_id: entrada.data.orcamentoId,
    p_chave_estavel: entrada.data.chaveEstavel,
    p_composicao_id: entrada.data.composicaoId,
    p_autor: usuario.user?.id ?? undefined,
  });
  if (error) return { erro: mapearErroRpc(error.message) };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/${entrada.data.orcamentoId}`);
  return { versao: versao ?? undefined };
}

export async function aplicarCustoCalculado(dados: {
  orcamentoId: string;
  obraId: string;
  chaveEstavel: string;
}): Promise<{ versao?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = vinculoSchema.safeParse(dados);
  if (!entrada.success) return { erro: "Dados inválidos." };

  const supabase = await createClient();
  const { data: usuario } = await supabase.auth.getUser();
  const { data: versao, error } = await supabase.rpc("aplicar_custo_composicao", {
    p_orcamento_id: entrada.data.orcamentoId,
    p_chave_estavel: entrada.data.chaveEstavel,
    p_autor: usuario.user?.id ?? undefined,
  });
  if (error) return { erro: mapearErroRpc(error.message) };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/${entrada.data.orcamentoId}`);
  return { versao: versao ?? undefined };
}

export async function reverterCustoCalculado(dados: {
  orcamentoId: string;
  obraId: string;
  chaveEstavel: string;
}): Promise<{ versao?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = vinculoSchema.safeParse(dados);
  if (!entrada.success) return { erro: "Dados inválidos." };

  const supabase = await createClient();
  const { data: usuario } = await supabase.auth.getUser();
  const { data: versao, error } = await supabase.rpc("reverter_custo_composicao", {
    p_orcamento_id: entrada.data.orcamentoId,
    p_chave_estavel: entrada.data.chaveEstavel,
    p_autor: usuario.user?.id ?? undefined,
  });
  if (error) return { erro: mapearErroRpc(error.message) };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/${entrada.data.orcamentoId}`);
  return { versao: versao ?? undefined };
}

export async function buscarComposicoesParaVinculo(dados: {
  obraId: string;
  termo: string;
}): Promise<{
  composicoes?: Array<{ id: string; codigo: string | null; nome: string; unidade: string; custo_unitario: number }>;
  erro?: string;
}> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = buscaSchema.safeParse(dados);
  if (!entrada.success) return { erro: "Termo de busca inválido." };

  const supabase = await createClient();
  const termo = escaparTermoBusca(entrada.data.termo);
  let query = supabase
    .from("composicoes")
    .select("id, codigo, nome, unidade, custo_unitario")
    .eq("obra_id", entrada.data.obraId)
    .order("codigo", { ascending: true, nullsFirst: true })
    .limit(20);
  if (termo) {
    query = query.or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%`);
  }
  const { data, error } = await query;
  if (error) return { erro: "Não foi possível buscar as composições." };
  return { composicoes: data ?? [] };
}
