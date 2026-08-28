"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chaveDia, paraData } from "@/lib/datas";
import type { PapelUsuario, TarefaRow } from "@/lib/supabase/database.types";

export type ResultadoReagendamento = { erro?: string };

const esquemaReagendar = z.object({
  tarefaId: z.string().uuid("Tarefa invalida."),
  novaData: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida (AAAA-MM-DD)."),
});

async function papelDoUsuario(userId: string): Promise<PapelUsuario | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", userId)
    .single();
  return data?.papel ?? null;
}

export async function reagendarTarefa(
  tarefaId: string,
  novaData: string,
): Promise<ResultadoReagendamento> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const resultado = esquemaReagendar.safeParse({ tarefaId, novaData });
  if (!resultado.success) {
    return {
      erro: resultado.error.issues[0]?.message ?? "Dados de reagendamento invalidos.",
    };
  }

  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("*")
    .eq("id", resultado.data.tarefaId)
    .single();
  if (!tarefa) return { erro: "Tarefa nao encontrada." };

  const papel = await papelDoUsuario(user.id);
  const podeEscrever =
    papel === "admin" || papel === "gestor" || tarefa.responsavel_id === user.id;
  if (!podeEscrever) {
    return { erro: "Voce nao tem permissao para reagendar esta tarefa." };
  }

  const dia = paraData(resultado.data.novaData);
  const chave = chaveDia(dia);
  if (chave !== resultado.data.novaData) {
    return { erro: "Data invalida." };
  }

  const { error } = await supabase
    .from("tarefas")
    .update({ data_planejada: chave })
    .eq("id", resultado.data.tarefaId);

  if (error) {
    return { erro: "Nao foi possivel reagendar a tarefa. Tente novamente." };
  }

  revalidatePath("/calendario");
  revalidatePath(`/calendario/${chave}`);
  revalidatePath("/tarefas");
  return {};
}
