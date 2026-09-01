"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  LevantamentoRow,
  PlantaCalibracaoRow,
  PrioridadeTarefa,
  StatusTarefa,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";
import {
  CATEGORIAS_PADRAO,
  CONFIG_LEGENDA_PADRAO,
  NIVEIS_PADRAO,
} from "@/lib/levantamento/tipos";
import { BUCKET_PLANTAS, urlAssinada } from "@/lib/armazenamento";
import {
  obterDadosCompletosTarefasExportacao,
  type TarefaExportacaoCompleta,
} from "@/app/(protegido)/obras/[id]/plantas/acoes";

type ResultadoSalvar = { id: string } | { erro: string };
type ResultadoExcluir = { ok: true } | { erro: string };
type ResultadoCalibracao = { ok: true } | { erro: string };

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
    return { erro: "Voce nao tem permissao para gerenciar levantamentos." };
  }

  return null;
}

const esquemaNovoLevantamento = z.object({
  obraId: z.string().uuid(),
  plantaId: z.string().uuid(),
  pagina: z.coerce.number().int().min(1).default(1),
  nome: z.string().trim().min(1, "Informe o nome do levantamento.").max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  niveis: z.array(z.any()).optional(),
  categorias: z.array(z.any()).optional(),
});

export async function criarNovoLevantamento(
  dados: z.infer<typeof esquemaNovoLevantamento>,
): Promise<ResultadoSalvar> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaNovoLevantamento.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: novo, error } = await supabase
    .from("levantamentos")
    .insert({
      obra_id: resultado.data.obraId,
      planta_id: resultado.data.plantaId,
      pagina: resultado.data.pagina,
      nome: resultado.data.nome,
      descricao: resultado.data.descricao ?? null,
      niveis:
        resultado.data.niveis ?? JSON.parse(JSON.stringify(NIVEIS_PADRAO)),
      categorias:
        resultado.data.categorias ??
        JSON.parse(JSON.stringify(CATEGORIAS_PADRAO)),
      itens: [],
      config_legenda: JSON.parse(JSON.stringify(CONFIG_LEGENDA_PADRAO)),
      criado_por: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !novo) {
    return { erro: "Nao foi possivel criar o levantamento." };
  }

  revalidatePath("/levantamento");
  return { id: novo.id };
}

const esquemaSalvarLevantamento = z.object({
  id: z.string().uuid().optional(),
  obraId: z.string().uuid(),
  plantaId: z.string().uuid(),
  pagina: z.coerce.number().int().min(1),
  nome: z.string().trim().min(1, "Informe o nome do levantamento.").max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  niveis: z.array(z.any()),
  categorias: z.array(z.any()),
  itens: z.array(z.any()),
  configLegenda: z.record(z.string(), z.any()),
});

export async function salvarLevantamento(
  dados: z.infer<typeof esquemaSalvarLevantamento>,
): Promise<ResultadoSalvar> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaSalvarLevantamento.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    obra_id: resultado.data.obraId,
    planta_id: resultado.data.plantaId,
    pagina: resultado.data.pagina,
    nome: resultado.data.nome,
    descricao: resultado.data.descricao ?? null,
    niveis: resultado.data.niveis,
    categorias: resultado.data.categorias,
    itens: resultado.data.itens,
    config_legenda: resultado.data.configLegenda,
    criado_por: user?.id ?? null,
  };

  if (resultado.data.id) {
    const { error } = await supabase
      .from("levantamentos")
      .update(payload)
      .eq("id", resultado.data.id);

    if (error) {
      return { erro: "Nao foi possivel atualizar o levantamento." };
    }
    revalidatePath("/levantamento");
    return { id: resultado.data.id };
  }

  const { data: novo, error } = await supabase
    .from("levantamentos")
    .insert(payload)
    .select("id")
    .single();

  if (error || !novo) {
    return { erro: "Nao foi possivel salvar o novo levantamento." };
  }

  revalidatePath("/levantamento");
  return { id: novo.id };
}

export async function excluirLevantamento(id: string): Promise<ResultadoExcluir> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const supabase = await createClient();
  const { error } = await supabase.from("levantamentos").delete().eq("id", id);
  if (error) {
    return { erro: "Nao foi possivel excluir o levantamento." };
  }

  revalidatePath("/levantamento");
  return { ok: true };
}

export async function obterCalibracoesPlanta(
  plantaId: string,
): Promise<{ calibracoes: PlantaCalibracaoRow[]; erro?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planta_calibracoes")
    .select("*")
    .eq("planta_id", plantaId);

  if (error) {
    return { calibracoes: [], erro: error.message };
  }
  return { calibracoes: (data ?? []) as PlantaCalibracaoRow[] };
}

const esquemaSalvarCalibracao = z.object({
  plantaId: z.string().uuid(),
  pagina: z.coerce.number().int().min(1),
  unidadesPorPonto: z.coerce.number().positive(),
  unidade: z.enum(["m", "cm"]),
  refP1: z.object({ x: z.number(), y: z.number() }),
  refP2: z.object({ x: z.number(), y: z.number() }),
  distanciaReal: z.coerce.number().positive(),
});

export async function salvarCalibracaoDireta(
  dados: z.infer<typeof esquemaSalvarCalibracao>,
): Promise<ResultadoCalibracao> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaSalvarCalibracao.safeParse(dados);
  if (!resultado.success) {
    return {
      erro:
        resultado.error.issues[0]?.message ?? "Dados de calibracao invalidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("planta_calibracoes").upsert(
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
    return { erro: "Nao foi possivel salvar a calibracao da planta." };
  }

  revalidatePath("/levantamento");
  return { ok: true };
}

const esquemaItemLoteLevantamento = z.object({
  idOriginal: z.string(),
  tipo: z.enum([
    "nenhuma",
    "ponto",
    "regiao",
    "distancia",
    "circuito",
    "area",
    "descida",
  ]),
  nome: z.string(),
  subtipo: z.string(),
  categoria: z.string().optional(),
  titulo: z.string().min(1),
  descricao: z.string(),
  ponto_x: z.number().nullable().optional(),
  ponto_y: z.number().nullable().optional(),
  detalhe: z.record(z.string(), z.any()),
});

const esquemaCriarLoteLevantamento = z.object({
  obraId: z.string().uuid(),
  plantaId: z.string().uuid(),
  pagina: z.coerce.number().int().min(1),
  levantamentoId: z.string().uuid().optional().nullable(),
  itens: z.array(esquemaItemLoteLevantamento).min(1, "Selecione ao menos um item."),
});

export type DadosCriarLoteLevantamento = z.infer<
  typeof esquemaCriarLoteLevantamento
>;

export async function criarTarefasEmLoteLevantamento(
  dados: DadosCriarLoteLevantamento,
): Promise<{ ok: true; quantidade: number } | { erro: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaCriarLoteLevantamento.safeParse(dados);
  if (!resultado.success) {
    return {
      erro: resultado.error.issues[0]?.message ?? "Dados do lote invalidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const { obraId, plantaId, pagina, levantamentoId, itens } = resultado.data;

  const linhas = itens.map((item) => ({
    titulo: item.titulo,
    descricao: item.descricao || null,
    obra_id: obraId,
    status: "pendente" as StatusTarefa,
    prioridade: "media" as PrioridadeTarefa,
    localizacao_tipo: item.tipo as TipoLocalizacao,
    planta_id: plantaId,
    pagina,
    ponto_x: item.ponto_x ?? null,
    ponto_y: item.ponto_y ?? null,
    localizacao_detalhe: item.detalhe,
    levantamento_id: levantamentoId ?? null,
    criado_por: user.id,
  }));

  const { data, error } = await supabase
    .from("tarefas")
    .insert(linhas)
    .select("id");

  if (error || !data) {
    return { erro: "Nao foi possivel criar as tarefas em lote." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/obras/${obraId}/plantas/${plantaId}`);
  if (levantamentoId) {
    revalidatePath(`/levantamento/${levantamentoId}`);
  }

  return { ok: true, quantidade: data.length };
}

export async function obterDadosExportacaoLevantamento(levantamentoId: string): Promise<{
  levantamento: LevantamentoRow | null;
  obraNome: string | null;
  plantaNome: string | null;
  urlPdf: string | null;
  calibracoes: PlantaCalibracaoRow[];
  tarefas: TarefaExportacaoCompleta[];
  erro?: string;
}> {
  const supabase = await createClient();
  const { data: lev, error } = await supabase
    .from("levantamentos")
    .select("*, obras(id, nome), plantas(*)")
    .eq("id", levantamentoId)
    .single();

  if (error || !lev) {
    return {
      levantamento: null,
      obraNome: null,
      plantaNome: null,
      urlPdf: null,
      calibracoes: [],
      tarefas: [],
      erro: "Levantamento não encontrado.",
    };
  }

  const planta = lev.plantas as unknown as { arquivo_path: string; nome: string; id: string } | null;
  const obra = lev.obras as unknown as { nome: string; id: string } | null;

  const [{ data: calibs }, urlPdf] = await Promise.all([
    supabase.from("planta_calibracoes").select("*").eq("planta_id", lev.planta_id),
    planta ? urlAssinada(BUCKET_PLANTAS, planta.arquivo_path) : Promise.resolve(null),
  ]);

  const { tarefas } = await obterDadosCompletosTarefasExportacao(
    lev.planta_id,
    lev.pagina,
  );

  return {
    levantamento: lev as unknown as LevantamentoRow,
    obraNome: obra?.nome ?? "Obra",
    plantaNome: planta?.nome ?? "Planta",
    urlPdf,
    calibracoes: (calibs ?? []) as PlantaCalibracaoRow[],
    tarefas,
  };
}
