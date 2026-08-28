"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Resultado = { erro?: string };

// Guard duplicado por arquivo (convencao do repo): apenas admin/gestor
// podem cadastrar, editar ou desativar executores.
async function verificarGestor(): Promise<{ erro: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor")) {
    return { erro: "Voce nao tem permissao para gerenciar executores." };
  }

  return null;
}

const esquemaCriar = z.object({
  obraId: z.string().uuid("Obra invalida."),
  nome: z.string().trim().min(1, "Informe o nome do executor.").max(200),
  contato: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function criarExecutor(dados: {
  obraId: string;
  nome: string;
  contato?: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaCriar.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("executores").insert({
    obra_id: resultado.data.obraId,
    nome: resultado.data.nome,
    contato: resultado.data.contato || null,
    criado_por: user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { erro: "Ja existe um executor com este nome nesta obra." };
    }
    return { erro: "Nao foi possivel cadastrar o executor. Tente novamente." };
  }

  revalidatePath(`/obras/${resultado.data.obraId}/executores`);
  return {};
}

const esquemaAtualizar = z.object({
  id: z.string().uuid("Executor invalido."),
  nome: z.string().trim().min(1, "Informe o nome do executor.").max(200),
  contato: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function atualizarExecutor(dados: {
  id: string;
  nome: string;
  contato?: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaAtualizar.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { data: executor } = await supabase
    .from("executores")
    .select("obra_id")
    .eq("id", resultado.data.id)
    .single();
  if (!executor) return { erro: "Executor nao encontrado." };

  const { error } = await supabase
    .from("executores")
    .update({
      nome: resultado.data.nome,
      contato: resultado.data.contato || null,
    })
    .eq("id", resultado.data.id);

  if (error) {
    if (error.code === "23505") {
      return { erro: "Ja existe um executor com este nome nesta obra." };
    }
    return { erro: "Nao foi possivel salvar o executor. Tente novamente." };
  }

  revalidatePath(`/obras/${executor.obra_id}/executores`);
  return {};
}

// Desativar/reativar: o novo estado e decidido no servidor a partir do valor
// atual, nunca confiando no argumento enviado pelo cliente.
export async function alternarAtivoExecutor(id: string): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const supabase = await createClient();
  const { data: executor } = await supabase
    .from("executores")
    .select("obra_id, ativo")
    .eq("id", id)
    .single();
  if (!executor) return { erro: "Executor nao encontrado." };

  const { error } = await supabase
    .from("executores")
    .update({ ativo: !executor.ativo })
    .eq("id", id);

  if (error) {
    return { erro: "Nao foi possivel atualizar o executor. Tente novamente." };
  }

  revalidatePath(`/obras/${executor.obra_id}/executores`);
  return {};
}