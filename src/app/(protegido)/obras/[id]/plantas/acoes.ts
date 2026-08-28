"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_PLANTAS,
  assinarUpload,
  montarCaminho,
  removerArquivo,
  urlAssinada,
} from "@/lib/armazenamento";

const LIMITE_BYTES = 100 * 1024 * 1024;

type ResultadoAssinar = { caminho: string; url: string } | { erro: string };
type ResultadoRegistrar = { id: string } | { erro: string };
type ResultadoCalibracao = { ok: true } | { erro: string };
type ResultadoExcluir = { ok: true } | { erro: string };
type ResultadoRenovar = { url: string } | { erro: string };

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
    return { erro: "Voce nao tem permissao para gerenciar plantas." };
  }

  return null;
}

const esquemaAssinar = z.object({
  obraId: z.string().uuid(),
  nomeArquivo: z.string().trim().min(1, "Informe o nome do arquivo.").max(255),
});

export async function assinarUploadPlanta(
  obraId: string,
  nomeArquivo: string,
): Promise<ResultadoAssinar> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaAssinar.safeParse({ obraId, nomeArquivo });
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .single();
  if (!obra) return { erro: "Obra nao encontrada." };

  const caminho = montarCaminho(obraId, nomeArquivo);
  const { url } = await assinarUpload(BUCKET_PLANTAS, caminho);
  return { caminho, url };
}

const esquemaRegistrar = z.object({
  obraId: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome da planta.").max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  arquivoPath: z.string().trim().min(1).max(500),
  arquivoNome: z.string().trim().min(1).max(255),
  tamanhoBytes: z.coerce.number().int().positive().max(LIMITE_BYTES),
  totalPaginas: z.coerce.number().int().min(1).max(10000),
});

export async function registrarPlanta(
  dados: z.infer<typeof esquemaRegistrar>,
): Promise<ResultadoRegistrar> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaRegistrar.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: planta, error } = await supabase
    .from("plantas")
    .insert({
      obra_id: resultado.data.obraId,
      nome: resultado.data.nome,
      descricao: resultado.data.descricao || null,
      arquivo_path: resultado.data.arquivoPath,
      arquivo_nome: resultado.data.arquivoNome,
      tamanho_bytes: resultado.data.tamanhoBytes,
      total_paginas: resultado.data.totalPaginas,
      criado_por: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !planta) {
    return { erro: "Nao foi possivel registrar a planta. Tente novamente." };
  }

  revalidatePath("/plantas");
  revalidatePath(`/obras/${resultado.data.obraId}`);
  return { id: planta.id };
}

const esquemaCalibracao = z.object({
  plantaId: z.string().uuid(),
  pagina: z.coerce.number().int().min(1),
  unidadesPorPonto: z.coerce.number().positive(),
  unidade: z.enum(["m", "cm"]),
  refP1: z.object({ x: z.number(), y: z.number() }),
  refP2: z.object({ x: z.number(), y: z.number() }),
  distanciaReal: z.coerce.number().positive(),
});

export async function salvarCalibracao(
  dados: z.infer<typeof esquemaCalibracao>,
): Promise<ResultadoCalibracao> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaCalibracao.safeParse(dados);
  if (!resultado.success) {
    return {
      erro: resultado.error.issues[0]?.message ?? "Dados de calibracao invalidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("planta_calibracoes")
    .upsert(
      {
        planta_id: resultado.data.plantaId,
        pagina: resultado.data.pagina,
        unidades_por_ponto: resultado.data.unidadesPorPonto,
        unidade: resultado.data.unidade,
        ref_p1: resultado.data.refP1,
        ref_p2: resultado.data.refP2,
        distancia_real: resultado.data.distanciaReal,
        calibrado_por: user?.id ?? null,
      },
      { onConflict: "planta_id,pagina" },
    );

  if (error) {
    return { erro: "Nao foi possivel salvar a calibracao. Tente novamente." };
  }

  revalidatePath("/obras/[id]/plantas/[plantaId]", "page");
  return { ok: true };
}

export async function excluirPlanta(plantaId: string): Promise<ResultadoExcluir> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const supabase = await createClient();
  const { data: planta } = await supabase
    .from("plantas")
    .select("arquivo_path, obra_id")
    .eq("id", plantaId)
    .single();
  if (!planta) return { erro: "Planta nao encontrada." };

  try {
    await removerArquivo(BUCKET_PLANTAS, planta.arquivo_path);
  } catch {
    // Objeto pode ja nao existir no storage; segue para remover o registro.
  }

  const { error } = await supabase.from("plantas").delete().eq("id", plantaId);
  if (error) {
    return { erro: "Nao foi possivel excluir a planta. Tente novamente." };
  }

  revalidatePath("/plantas");
  revalidatePath(`/obras/${planta.obra_id}`);
  return { ok: true };
}

export async function renovarUrlPlanta(plantaId: string): Promise<ResultadoRenovar> {
  const supabase = await createClient();
  const { data: planta } = await supabase
    .from("plantas")
    .select("arquivo_path")
    .eq("id", plantaId)
    .single();
  if (!planta) return { erro: "Planta nao encontrada." };

  const url = await urlAssinada(BUCKET_PLANTAS, planta.arquivo_path);
  if (!url) return { erro: "Nao foi possivel renovar o link do PDF." };
  return { url };
}