"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlPublicaApp } from "@/lib/url-app";
import type { PapelUsuario } from "@/lib/supabase/database.types";

const esquemaPapel = z.enum(["admin", "gestor", "colaborador"]);

const esquemaConvite = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalido."),
  nome: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres."),
  papel: z.enum(["admin", "gestor", "colaborador"]),
  cargo: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
});

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

export async function convidarUsuario(
  dados: unknown,
): Promise<ResultadoUsuario> {
  const negado = await verificarAdmin();
  if (negado) return negado;

  const resultado = esquemaConvite.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const { email, nome, papel, cargo, telefone } = resultado.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const admin = createAdminClient();

  let urlConvite: string;
  try {
    urlConvite = await urlPublicaApp();
  } catch {
    return {
      erro: "URL publica da aplicacao nao configurada (NEXT_PUBLIC_APP_URL).",
    };
  }

  const { data: convidado, error } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        nome,
        papel,
        cargo: cargo || undefined,
        telefone: telefone || undefined,
      },
      redirectTo: `${urlConvite}/auth/confirmar`,
    },
  );

  if (error) {
    if (
      error.message.includes("already been registered") ||
      error.message.includes("already registered")
    ) {
      return { erro: "Este e-mail ja esta cadastrado." };
    }
    return { erro: "Nao foi possivel enviar o convite. Tente novamente." };
  }

  if (!convidado.user) {
    return { erro: "Nao foi possivel enviar o convite. Tente novamente." };
  }

  // O trigger handle_new_user ja criou a linha em perfis; registramos quem convidou.
  const { error: erroConvidante } = await admin
    .from("perfis")
    .update({ convidado_por: user.id })
    .eq("id", convidado.user.id);

  if (erroConvidante) {
    return {
      erro: "Convite enviado, mas nao foi possivel registrar quem convidou.",
    };
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
