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
    return { erro: "Voce nao tem permissao para gerenciar composicoes." };
  }
  return null;
}

export async function buscarComposicao(id: string, obraId: string): Promise<{
  composicao?: {
    id: string;
    codigo: string | null;
    nome: string;
    unidade: string;
    custo_unitario: number;
    componentes: Array<{
      id: string;
      nome: string;
      categoria: string;
      unidade: string;
      quantidade: number;
      custo_unitario: number;
      codigo: string | null;
      composicao_referencia_id: string | null;
    }>;
  };
  erro?: string;
}> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const entrada = z.object({ id: z.string().uuid(), obraId: z.string().uuid() }).safeParse({ id, obraId });
  if (!entrada.success) return { erro: "Composicao invalida." };

  const supabase = await createClient();

  const { data: composicao, error } = await supabase
    .from("composicoes")
    .select("*")
    .eq("id", entrada.data.id)
    .eq("obra_id", entrada.data.obraId)
    .single();

  if (error || !composicao) return { erro: "Composicao nao encontrada." };

  const { data: componentes, error: erroComponentes } = await supabase
    .from("composicao_componentes")
    .select("*")
    .eq("composicao_id", entrada.data.id)
    .order("criado_em", { ascending: true });

  if (erroComponentes) return { erro: "Nao foi possivel carregar os componentes." };

  return {
    composicao: {
      id: composicao.id,
      codigo: composicao.codigo,
      nome: composicao.nome,
      unidade: composicao.unidade,
      custo_unitario: composicao.custo_unitario,
      componentes: (componentes ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        categoria: c.categoria,
        unidade: c.unidade,
        quantidade: c.quantidade,
        custo_unitario: c.custo_unitario,
        codigo: c.codigo,
        composicao_referencia_id: c.composicao_referencia_id,
      })),
    },
  };
}

export async function excluirComposicao(id: string, obraId: string): Promise<{ erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const entrada = z.object({ id: z.string().uuid(), obraId: z.string().uuid() }).safeParse({ id, obraId });
  if (!entrada.success) return { erro: "Composicao invalida." };

  const supabase = await createClient();

  const { data: referencias, error: erroRef } = await supabase
    .from("composicao_componentes")
    .select("id")
    .eq("composicao_referencia_id", entrada.data.id)
    .limit(1);

  if (erroRef) return { erro: "Nao foi possivel verificar referencias." };

  if (referencias && referencias.length > 0) {
    return { erro: "Esta composição é usada por outras composições. Remova as referências antes de excluir." };
  }

  const { error } = await supabase
    .from("composicoes")
    .delete()
    .eq("id", entrada.data.id)
    .eq("obra_id", entrada.data.obraId);

  if (error) return { erro: "Nao foi possivel excluir a composicao." };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/composicoes`);
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  return {};
}

export async function excluirComposicoesEmLote(ids: string[], obraId: string): Promise<{ quantidade?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const entrada = z.object({ obraId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1).max(500) }).safeParse({ ids, obraId });
  if (!entrada.success) return { erro: "Selecao de composicoes invalida." };

  const supabase = await createClient();
  const { data: referencias, error: erroReferencias } = await supabase
    .from("composicao_componentes")
    .select("composicao_referencia_id")
    .in("composicao_referencia_id", entrada.data.ids)
    .limit(1);
  if (erroReferencias) return { erro: "Nao foi possivel verificar referencias." };
  if ((referencias ?? []).length > 0) return { erro: "Uma ou mais composicoes selecionadas sao usadas por outras composicoes. Remova as referencias antes de excluir." };

  const { data: removidas, error } = await supabase
    .from("composicoes")
    .delete()
    .eq("obra_id", entrada.data.obraId)
    .in("id", entrada.data.ids)
    .select("id");
  if (error) return { erro: "Nao foi possivel excluir as composicoes selecionadas." };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/composicoes`);
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  return { quantidade: removidas?.length ?? 0 };
}
