"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const criarCompatibilizacaoSchema = z.object({
  obra_id: z.string().uuid(),
  nome: z.string().min(1, "O nome é obrigatório"),
});

export async function criarCompatibilizacao(formData: FormData) {
  const supabase = await createClient();

  const dadosBrutos = {
    obra_id: formData.get("obra_id") as string,
    nome: formData.get("nome") as string,
  };

  const parse = criarCompatibilizacaoSchema.safeParse(dadosBrutos);

  if (!parse.success) {
    return { erro: "Dados inválidos." };
  }

  const { data, error } = await supabase
    .from("compatibilizacoes")
    .insert([
      {
        obra_id: parse.data.obra_id,
        nome: parse.data.nome,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar compatibilização", error);
    return { erro: "Ocorreu um erro ao criar a compatibilização." };
  }

  revalidatePath(`/obras/${parse.data.obra_id}/compatibilizacoes`);
  redirect(`/obras/${parse.data.obra_id}/compatibilizacoes/${data.id}`);
}

const apagarCompatibilizacaoSchema = z.object({
  id: z.string().uuid(),
  obra_id: z.string().uuid(),
});

export async function apagarCompatibilizacao(formData: FormData) {
  const supabase = await createClient();

  const parse = apagarCompatibilizacaoSchema.safeParse({
    id: formData.get("id"),
    obra_id: formData.get("obra_id"),
  });

  if (!parse.success) return { erro: "Dados inválidos." };

  const { error } = await supabase
    .from("compatibilizacoes")
    .delete()
    .eq("id", parse.data.id);

  if (error) {
    return { erro: "Erro ao apagar compatibilização." };
  }

  revalidatePath(`/obras/${parse.data.obra_id}/compatibilizacoes`);
  redirect(`/obras/${parse.data.obra_id}/compatibilizacoes`);
}

export async function adicionarPlantaCompatibilizacao(compatId: string, plantaId: string, pagina: number = 1) {
  const supabase = await createClient();
  
  // Verifica se já tem base
  const { data: base } = await supabase
    .from("compatibilizacao_plantas")
    .select("id")
    .eq("compatibilizacao_id", compatId)
    .eq("e_base", true)
    .single();

  const { error } = await supabase
    .from("compatibilizacao_plantas")
    .insert([
      {
        compatibilizacao_id: compatId,
        planta_id: plantaId,
        pagina,
        e_base: !base, // A primeira é base por padrão
        ref1_x: 0, ref1_y: 0, ref2_x: 0, ref2_y: 0,
        cor_identificacao: !base ? '#3B82F6' : '#EF4444'
      }
    ]);

  if (!error) revalidatePath(`/obras/[id]/compatibilizacoes/${compatId}`, 'page');
  return { error };
}

export async function atualizarPlantaCompatibilizacao(
  id: string,
  dados: {
    visivel?: boolean;
    opacidade?: number;
    cor_identificacao?: string;
    ref1_x?: number;
    ref1_y?: number;
    ref2_x?: number;
    ref2_y?: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compatibilizacao_plantas")
    .update(dados)
    .eq("id", id);
    
  return { error };
}

export async function removerPlantaCompatibilizacao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compatibilizacao_plantas")
    .delete()
    .eq("id", id);
    
  return { error };
}

export async function criarChoqueCompatibilizacao(compatId: string, ponto_x: number, ponto_y: number, descricao: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compatibilizacao_choques")
    .insert([{
      compatibilizacao_id: compatId,
      ponto_x,
      ponto_y,
      descricao
    }]);
  return { error };
}

export async function atualizarCompatibilizacao(estadoAntigo: any, formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const obra_id = formData.get("obra_id") as string;
  const nome = formData.get("nome") as string;
  if (!id || !obra_id || !nome) return { erro: "Dados incompletos." };
  const { error } = await supabase.from("compatibilizacoes").update({ nome }).eq("id", id);
  if (error) return { erro: "Erro ao atualizar compatibilização." };
  revalidatePath(`/obras/${obra_id}/compatibilizacoes`);
  revalidatePath(`/obras/${obra_id}/compatibilizacoes/${id}`);
  return { erro: null };
}

export async function apagarCompatibilizacaoDireto(estadoAntigo: any, formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const obra_id = formData.get("obra_id") as string;
  if (!id || !obra_id) return { erro: "Dados inválidos." };
  const { error } = await supabase.from("compatibilizacoes").delete().eq("id", id);
  if (error) return { erro: "Erro ao apagar compatibilização." };
  revalidatePath(`/obras/${obra_id}/compatibilizacoes`);
  redirect(`/obras/${obra_id}/compatibilizacoes`);
}
