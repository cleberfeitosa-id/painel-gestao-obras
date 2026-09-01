"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_ANEXOS,
  BUCKET_PLANTAS,
  assinarUpload,
  montarCaminho,
  removerArquivo,
  urlAssinada,
  urlsAssinadas,
} from "@/lib/armazenamento";
import type {
  AprovacaoTarefa,
  PrioridadeTarefa,
  RegiaoPdf,
  StatusTarefa,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";
import type { DetalheLocalizacaoLevantamento } from "@/components/plantas/tipos";

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

const esquemaAtualizarPlanta = z.object({
  plantaId: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome da planta.").max(200),
});

export async function atualizarPlanta(dados: { plantaId: string; nome: string }): Promise<{ erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaAtualizarPlanta.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("plantas")
    .update({ nome: resultado.data.nome })
    .eq("id", resultado.data.plantaId);

  if (error) {
    return { erro: "Nao foi possivel atualizar a planta. Tente novamente." };
  }

  const { data: planta } = await supabase.from("plantas").select("obra_id").eq("id", resultado.data.plantaId).single();
  
  if (planta) {
    revalidatePath(`/obras/${planta.obra_id}/plantas/${resultado.data.plantaId}`);
    revalidatePath(`/obras/${planta.obra_id}`);
  }
  revalidatePath("/plantas");
  return {};
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

export interface ItemAnexoExportacao {
  id: string;
  nome: string;
  tipo: string;
  momento: string;
  url: string | null;
  tamanho_bytes: number;
}

export interface ItemComentarioExportacao {
  id: string;
  texto: string;
  criado_em: string;
  autor_nome: string | null;
}

export interface ItemMedicaoExportacao {
  id: string;
  catalogo_id: string;
  nome: string;
  unidade: string;
  valor_unitario: number;
  quantidade: number;
  valor_total_tarefa: number;
  medicao_id: string;
  medicao_titulo: string;
  medicao_valor_contrato: number | null;
  medicao_valor_total_executado: number;
}

export interface TarefaExportacaoCompleta {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  aprovacao: AprovacaoTarefa;
  prazo: string | null;
  criado_em: string;
  pagina: number;
  localizacao_tipo: TipoLocalizacao;
  ponto_x: number | null;
  ponto_y: number | null;
  regiao: RegiaoPdf | null;
  localizacao_detalhe: DetalheLocalizacaoLevantamento | null;
  responsavel_nome: string | null;
  executor_nome: string | null;
  supervisor_nome: string | null;
  tags: string[];
  anexos: ItemAnexoExportacao[];
  comentarios: ItemComentarioExportacao[];
  medicoes: ItemMedicaoExportacao[];
}

export async function obterDadosCompletosTarefasExportacao(
  plantaId: string,
  pagina: number,
  tarefaIdsFiltro?: string[],
): Promise<{
  tarefas: TarefaExportacaoCompleta[];
  erro?: string;
}> {
  const supabase = await createClient();

  let consulta = supabase
    .from("tarefas")
    .select(
      "id, titulo, descricao, status, prioridade, aprovacao, prazo, criado_em, pagina, localizacao_tipo, ponto_x, ponto_y, regiao, localizacao_detalhe, responsavel:perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(nome), supervisor:perfis!tarefas_supervisor_id_fkey(nome), tags_tarefa(id, nome)",
    )
    .eq("planta_id", plantaId)
    .eq("pagina", pagina)
    .order("criado_em", { ascending: true });

  if (tarefaIdsFiltro && tarefaIdsFiltro.length > 0) {
    consulta = consulta.in("id", tarefaIdsFiltro);
  }

  const { data: tarefasDb, error } = await consulta;

  if (error || !tarefasDb) {
    return { tarefas: [], erro: "Não foi possível carregar as tarefas." };
  }

  if (tarefasDb.length === 0) {
    return { tarefas: [] };
  }

  const tarefaIds = tarefasDb.map((t) => t.id);

  const [{ data: anexosDb }, { data: comentariosDb }, { data: medicoesDb }] =
    await Promise.all([
      supabase
        .from("tarefa_anexos")
        .select("id, tarefa_id, nome_arquivo, tipo, momento, caminho, tamanho_bytes, criado_em")
        .in("tarefa_id", tarefaIds)
        .order("criado_em", { ascending: true }),
      supabase
        .from("tarefa_comentarios")
        .select("id, tarefa_id, texto, criado_em, autor:perfis!tarefa_comentarios_autor_id_fkey(nome)")
        .in("tarefa_id", tarefaIds)
        .order("criado_em", { ascending: true }),
      supabase
        .from("tarefa_medicoes")
        .select(
          "id, tarefa_id, quantidade, catalogo_id, catalogo_precos!inner(id, nome, unidade, valor_unitario, medicao_id, medicoes!inner(id, titulo, valor_contrato))",
        )
        .in("tarefa_id", tarefaIds),
    ]);

  const caminhosAnexos = (anexosDb ?? []).map((a) => a.caminho);
  const mapaUrls = caminhosAnexos.length > 0
    ? await urlsAssinadas(BUCKET_ANEXOS, caminhosAnexos)
    : new Map<string, string>();

  const medicaoIdsUnicos = Array.from(
    new Set(
      (medicoesDb ?? [])
        .map((m) => {
          const cp = m.catalogo_precos as unknown as {
            medicao_id: string;
          } | null;
          return cp?.medicao_id;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const totaisMedicao = new Map<string, number>();
  if (medicaoIdsUnicos.length > 0) {
    const { data: todasMedicoesDaObra } = await supabase
      .from("tarefa_medicoes")
      .select("quantidade, catalogo_precos!inner(valor_unitario, medicao_id)")
      .in("catalogo_precos.medicao_id", medicaoIdsUnicos);

    for (const item of todasMedicoesDaObra ?? []) {
      const cp = item.catalogo_precos as unknown as {
        valor_unitario: number;
        medicao_id: string;
      };
      if (cp) {
        const atual = totaisMedicao.get(cp.medicao_id) ?? 0;
        totaisMedicao.set(cp.medicao_id, atual + Number(item.quantidade) * Number(cp.valor_unitario));
      }
    }
  }

  const mapaAnexos = new Map<string, ItemAnexoExportacao[]>();
  for (const anexo of anexosDb ?? []) {
    const lista = mapaAnexos.get(anexo.tarefa_id) ?? [];
    lista.push({
      id: anexo.id,
      nome: anexo.nome_arquivo,
      tipo: anexo.tipo,
      momento: anexo.momento,
      url: mapaUrls.get(anexo.caminho) ?? null,
      tamanho_bytes: anexo.tamanho_bytes ?? 0,
    });
    mapaAnexos.set(anexo.tarefa_id, lista);
  }

  const mapaComentarios = new Map<string, ItemComentarioExportacao[]>();
  for (const c of comentariosDb ?? []) {
    const lista = mapaComentarios.get(c.tarefa_id) ?? [];
    const autor = c.autor as unknown as { nome: string } | null;
    lista.push({
      id: c.id,
      texto: c.texto,
      criado_em: c.criado_em,
      autor_nome: autor?.nome ?? null,
    });
    mapaComentarios.set(c.tarefa_id, lista);
  }

  const mapaMedicoes = new Map<string, ItemMedicaoExportacao[]>();
  for (const m of medicoesDb ?? []) {
    const lista = mapaMedicoes.get(m.tarefa_id) ?? [];
    const cp = m.catalogo_precos as unknown as {
      id: string;
      nome: string;
      unidade: string;
      valor_unitario: number;
      medicao_id: string;
      medicoes: { id: string; titulo: string; valor_contrato: number | null };
    };

    if (cp) {
      const qtd = Number(m.quantidade);
      const vu = Number(cp.valor_unitario);
      lista.push({
        id: m.id,
        catalogo_id: cp.id,
        nome: cp.nome,
        unidade: cp.unidade,
        valor_unitario: vu,
        quantidade: qtd,
        valor_total_tarefa: qtd * vu,
        medicao_id: cp.medicao_id,
        medicao_titulo: cp.medicoes?.titulo ?? "Medição",
        medicao_valor_contrato: cp.medicoes?.valor_contrato ?? null,
        medicao_valor_total_executado: totaisMedicao.get(cp.medicao_id) ?? 0,
      });
    }
    mapaMedicoes.set(m.tarefa_id, lista);
  }

  const tarefasFormatadas: TarefaExportacaoCompleta[] = tarefasDb.map(
    (t, index) => {
      const resp = t.responsavel as unknown as { nome: string } | null;
      const exec = t.executor as unknown as { nome: string } | null;
      const sup = t.supervisor as unknown as { nome: string } | null;
      const tags = (t.tags_tarefa as unknown as { id: string; nome: string }[]) ?? [];

      return {
        id: t.id,
        numero: index + 1,
        titulo: t.titulo,
        descricao: t.descricao,
        status: t.status,
        prioridade: t.prioridade,
        aprovacao: t.aprovacao,
        prazo: t.prazo,
        criado_em: t.criado_em,
        pagina: t.pagina ?? 1,
        localizacao_tipo: t.localizacao_tipo,
        ponto_x: t.ponto_x,
        ponto_y: t.ponto_y,
        regiao: t.regiao as RegiaoPdf | null,
        localizacao_detalhe:
          t.localizacao_detalhe as unknown as DetalheLocalizacaoLevantamento | null,
        responsavel_nome: resp?.nome ?? null,
        executor_nome: exec?.nome ?? null,
        supervisor_nome: sup?.nome ?? null,
        tags: tags.map((tg) => tg.nome),
        anexos: mapaAnexos.get(t.id) ?? [],
        comentarios: mapaComentarios.get(t.id) ?? [],
        medicoes: mapaMedicoes.get(t.id) ?? [],
      };
    },
  );

  return { tarefas: tarefasFormatadas };
}