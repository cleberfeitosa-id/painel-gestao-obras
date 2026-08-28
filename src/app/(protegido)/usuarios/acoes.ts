"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { PapelUsuario } from "@/lib/supabase/database.types";

const esquemaPapel = z.enum(["admin", "gestor", "colaborador"]);

type ResultadoUsuario = { erro?: string };

// Revalida no servidor que o chamador e admin antes de qualquer mutacao.
async function verificarAdmin(): Promise<{ erro?: string } | null> {
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

  if (!perfil || perfil.papel !== "admin") {
    return { erro: "Acesso restrito. Somente administradores." };
  }

  return null;
}

export async function atualizarPapel(
  userId: string,
  papel: PapelUsuario,
): Promise<ResultadoUsuario> {
  const negado = await verificarAdmin();
  if (negado) return negado;

  const resultado = esquemaPapel.safeParse(papel);
  if (!resultado.success) {
    return { erro: "Papel invalido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ papel: resultado.data })
    .eq("id", userId);

  if (error) {
    return { erro: "Nao foi possivel atualizar o papel. Tente novamente." };
  }

  revalidatePath("/usuarios");
  return {};
}

export async function alternarAtivo(
  userId: string,
  ativo: boolean,
): Promise<ResultadoUsuario> {
  const negado = await verificarAdmin();
  if (negado) return negado;

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ ativo })
    .eq("id", userId);

  if (error) {
    return { erro: "Nao foi possivel alterar o status. Tente novamente." };
  }

  revalidatePath("/usuarios");
  return {};
}
