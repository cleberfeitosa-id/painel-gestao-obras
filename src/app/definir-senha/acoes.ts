"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const esquemaSenha = z
  .object({
    senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmar: z.string().min(1, "Confirme a senha."),
  })
  .refine((dados) => dados.senha === dados.confirmar, {
    message: "As senhas nao coincidem.",
    path: ["confirmar"],
  });

export async function definirSenha(
  _estadoAnterior: { erro?: string },
  formData: FormData,
): Promise<{ erro?: string }> {
  const resultado = esquemaSenha.safeParse({
    senha: String(formData.get("senha") ?? ""),
    confirmar: String(formData.get("confirmar_senha") ?? ""),
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Senha invalida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: resultado.data.senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes("session")) {
      return { erro: "Sessao expirada. Abra o link do convite novamente." };
    }
    return { erro: "Nao foi possivel definir a senha. Tente novamente." };
  }

  revalidatePath("/", "layout");
  redirect("/painel");
}