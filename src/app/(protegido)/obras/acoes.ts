"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { StatusObra } from "@/lib/supabase/database.types";

const esquemaObra = z.object({
  nome: z.string().trim().min(1, "Informe o nome da obra.").max(200),
  codigo: z
    .string()
    .trim()
    .max(50, "O codigo deve ter no maximo 50 caracteres.")
    .optional()
    .or(z.literal("")),
  cliente: z
    .string()
    .trim()
    .max(200, "O cliente deve ter no maximo 200 caracteres.")
    .optional()
    .or(z.literal("")),
  endereco: z
    .string()
    .trim()
    .max(300, "O endereco deve ter no maximo 300 caracteres.")
    .optional()
    .or(z.literal("")),
  cidade: z
    .string()
    .trim()
    .max(100, "A cidade deve ter no maximo 100 caracteres.")
    .optional()
    .or(z.literal("")),
  estado: z
    .string()
    .trim()
    .max(2, "Use a sigla do estado (ex.: CE).")
    .optional()
    .or(z.literal("")),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres.")
    .optional()
    .or(z.literal("")),
  status: z.enum(["planejamento", "em_andamento", "pausada", "concluida"]),
  data_inicio: z.string().optional().or(z.literal("")),
  data_prevista_fim: z.string().optional().or(z.literal("")),
  responsavel_id: z.string().uuid().optional().or(z.literal("")),
});

type ResultadoObra = { erro?: string };

// Revalida a permissao no servidor: apenas admin/gestor podem escrever obras.
async function verificarGestor(): Promise<{ erro?: string } | null> {
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
    return { erro: "Voce nao tem permissao para gerenciar obras." };
  }

  return null;
}

function normalizar(dados: z.infer<typeof esquemaObra>) {
  return {
    nome: dados.nome,
    codigo: dados.codigo || null,
    cliente: dados.cliente || null,
    endereco: dados.endereco || null,
    cidade: dados.cidade || null,
    estado: dados.estado || null,
    descricao: dados.descricao || null,
    status: dados.status as StatusObra,
    data_inicio: dados.data_inicio || null,
    data_prevista_fim: dados.data_prevista_fim || null,
    responsavel_id: dados.responsavel_id || null,
  };
}

export async function criarObra(
  _estadoAnterior: ResultadoObra,
  formData: FormData,
): Promise<ResultadoObra> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const bruto = {
    nome: formData.get("nome"),
    codigo: formData.get("codigo"),
    cliente: formData.get("cliente"),
    endereco: formData.get("endereco"),
    cidade: formData.get("cidade"),
    estado: formData.get("estado"),
    descricao: formData.get("descricao"),
    status: formData.get("status"),
    data_inicio: formData.get("data_inicio"),
    data_prevista_fim: formData.get("data_prevista_fim"),
    responsavel_id: formData.get("responsavel_id"),
  };

  const resultado = esquemaObra.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("obras").insert({
    ...normalizar(resultado.data),
    criado_por: user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { erro: "Ja existe uma obra com este codigo." };
    }
    return { erro: "Nao foi possivel criar a obra. Tente novamente." };
  }

  revalidatePath("/obras");
  revalidatePath("/painel");
  redirect("/obras");
}

export async function atualizarObra(
  _estadoAnterior: ResultadoObra,
  formData: FormData,
): Promise<ResultadoObra> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Obra invalida." };

  const bruto = {
    nome: formData.get("nome"),
    codigo: formData.get("codigo"),
    cliente: formData.get("cliente"),
    endereco: formData.get("endereco"),
    cidade: formData.get("cidade"),
    estado: formData.get("estado"),
    descricao: formData.get("descricao"),
    status: formData.get("status"),
    data_inicio: formData.get("data_inicio"),
    data_prevista_fim: formData.get("data_prevista_fim"),
    responsavel_id: formData.get("responsavel_id"),
  };

  const resultado = esquemaObra.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("obras")
    .update(normalizar(resultado.data))
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { erro: "Ja existe uma obra com este codigo." };
    }
    return { erro: "Nao foi possivel salvar a obra. Tente novamente." };
  }

  revalidatePath("/obras");
  revalidatePath(`/obras/${id}`);
  revalidatePath("/painel");
  redirect(`/obras/${id}`);
}

export async function excluirObra(
  _estadoAnterior: ResultadoObra,
  formData: FormData,
): Promise<ResultadoObra> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Obra invalida." };

  const supabase = await createClient();
  const { error } = await supabase.from("obras").delete().eq("id", id);

  if (error) {
    return { erro: "Nao foi possivel excluir a obra. Tente novamente." };
  }

  revalidatePath("/obras");
  revalidatePath("/painel");
  redirect("/obras");
}
