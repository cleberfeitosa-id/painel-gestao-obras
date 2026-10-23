"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dataValida } from "@/lib/datas";

const esquema = z.object({
  id: z.string().uuid().optional(),
  obraId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conteudo: z.object({
    turnoTempo: z.string().trim().max(120),
    clima: z.enum(["sol", "nublado", "chuva", "impraticavel"]),
    tarefas: z.object({ manha: z.string().trim().max(300), tarde: z.string().trim().max(300) }),
    observacoes: z.array(z.object({ descricao: z.string().trim().max(120), tipo: z.string().trim().max(80) })).length(3),
    equipe: z.array(z.object({ codigo: z.number(), quantidade: z.string().trim().max(12) })).max(10),
    alimentacao: z.array(z.object({ codigo: z.number(), quantidade: z.string().trim().max(12) })).length(1),
    ajustes: z.record(z.string(), z.object({ x: z.number().min(0).max(744), y: z.number().min(0).max(1052.55), tamanho: z.number().min(4).max(18), fonte: z.enum(["helvetica", "times", "courier"]) })).optional(),
  }),
});

async function verificarGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, erro: "Sessao expirada. Entre novamente." };
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor")) {
    return { supabase, erro: "Voce nao tem permissao para gerenciar RDOs." };
  }
  return { supabase, user };
}

export async function salvarRdo(dados: unknown): Promise<{ id?: string; erro?: string }> {
  const entrada = esquema.safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };
  if (!dataValida(entrada.data.data)) return { erro: "Informe uma data valida." };
  const acesso = await verificarGestor();
  if ("erro" in acesso) return { erro: acesso.erro };
  const payload = { obra_id: entrada.data.obraId, data: entrada.data.data, conteudo: entrada.data.conteudo };
  const query = entrada.data.id
    ? acesso.supabase.from("rdos").update(payload).eq("id", entrada.data.id).eq("obra_id", entrada.data.obraId).is("excluido_em", null).select("id").single()
    : acesso.supabase.from("rdos").insert({ ...payload, criado_por: acesso.user.id }).select("id").single();
  const { data, error } = await query;
  if (error || !data) {
    if (error?.code === "23505") return { erro: "Ja existe um RDO ativo para esta obra e data." };
    return { erro: "Nao foi possivel salvar o RDO." };
  }
  revalidatePath("/rdo");
  revalidatePath(`/rdo/${data.id}`);
  return { id: data.id };
}

export async function excluirRdo(id: string): Promise<{ erro?: string }> {
  const acesso = await verificarGestor();
  if ("erro" in acesso) return { erro: acesso.erro };
  const entrada = z.string().uuid().safeParse(id);
  if (!entrada.success) return { erro: "RDO invalido." };
  const { error } = await acesso.supabase.from("rdos").update({ excluido_em: new Date().toISOString(), excluido_por: acesso.user.id }).eq("id", id).is("excluido_em", null);
  if (error) return { erro: "Nao foi possivel excluir o RDO." };
  revalidatePath("/rdo");
  return {};
}
