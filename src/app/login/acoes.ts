"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function traduzirErro(mensagem: string): string {
  if (mensagem.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (mensagem.includes("User already registered"))
    return "Este e-mail ja esta cadastrado.";
  if (mensagem.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (mensagem.includes("Password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (mensagem.includes("Unable to validate email address"))
    return "Endereco de e-mail invalido.";
  return "Ocorreu um erro. Tente novamente.";
}

export async function entrar(
  _estadoAnterior: { erro?: string },
  formData: FormData,
): Promise<{ erro?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const redirecionar = String(formData.get("redirecionar") ?? "/painel");

  if (!email || !senha) {
    return { erro: "Preencha todos os campos obrigatorios." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { erro: traduzirErro(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(redirecionar);
}

export async function cadastrar(
  _estadoAnterior: { erro?: string; sucesso?: boolean },
  formData: FormData,
): Promise<{ erro?: string; sucesso?: boolean }> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar_senha") ?? "");

  if (!nome || !email || !senha) {
    return { erro: "Preencha todos os campos obrigatorios." };
  }
  if (senha !== confirmar) {
    return { erro: "As senhas nao coincidem." };
  }
  if (senha.length < 6) {
    return { erro: "A senha deve ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome,
        telefone: telefone || undefined,
        cargo: cargo || undefined,
      },
    },
  });

  if (error) {
    return { erro: traduzirErro(error.message) };
  }

  if (!data.session) {
    return {
      sucesso: true,
    };
  }

  revalidatePath("/", "layout");
  redirect("/painel");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
