"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assinarUpload, montarCaminho } from "@/lib/armazenamento";

const colunaSchema = z.object({
  id: z.string().min(1).max(80),
  nome: z.string().trim().min(1).max(120),
  tipo: z.enum(["texto", "numero", "moeda"]),
  selecionada: z.boolean(),
  funcao: z.enum(["codigo", "descricao", "unidade", "quantidade", "valor_unitario", "valor_total", "valor_bdi", "custo_real", "grupo", "fonte", "categoria", "composicao", "bdi", "quantidade_executada"]).optional(),
  formula: z.string().max(500).optional(),
});

const linhaSchema = z.record(z.string().max(80), z.union([z.string().max(5000), z.number().finite(), z.null()]));

async function verificarGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };
  const { data: perfil } = await supabase.from("perfis").select("papel, pode_editar_financeiro").eq("id", user.id).single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor") || (perfil.papel === "gestor" && perfil.pode_editar_financeiro === false)) {
    return { erro: "Voce nao tem permissao para editar orcamentos." };
  }
  return null;
}

function numeroBanco(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0 || valor > 9999999999.9999) {
    throw new Error(`valor numerico fora do limite: ${String(valor)}`);
  }
  return Math.round(valor * 10000) / 10000;
}

export async function criarOrcamento(dados: {
  obraId: string;
  nome: string;
  colunas: unknown;
  linhas: unknown;
  arquivoNome?: string;
}): Promise<{ id?: string; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const entrada = z.object({
    obraId: z.string().uuid(),
    nome: z.string().trim().min(1).max(160),
    colunas: z.array(colunaSchema).max(100),
    linhas: z.array(linhaSchema).max(3000, "A planilha deve ter no maximo 3.000 linhas."),
    arquivoNome: z.string().max(255).optional(),
  }).safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("orcamentos").insert({
    obra_id: entrada.data.obraId,
    nome: entrada.data.nome,
    arquivo_nome: entrada.data.arquivoNome ?? null,
    colunas: entrada.data.colunas,
    linhas: entrada.data.linhas,
    criado_por: user.user?.id ?? null,
  }).select("id").single();
  if (error) return { erro: "Nao foi possivel salvar o orcamento." };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  return { id: data.id };
}

export async function atualizarOrcamento(dados: {
  id: string;
  obraId: string;
  nome: string;
  colunas: unknown;
  linhas: unknown;
  versao?: number;
}): Promise<{ versao?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = z.object({
    id: z.string().uuid(),
    obraId: z.string().uuid(),
    nome: z.string().trim().min(1).max(160),
    colunas: z.array(colunaSchema).max(100),
    linhas: z.array(linhaSchema).max(3000, "A planilha deve ter no maximo 3.000 linhas."),
    versao: z.number().int().positive().optional(),
  }).safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };

  const supabase = await createClient();
  const { data: novaVersao, error } = await supabase.rpc("salvar_orcamento_atomico", {
    p_orcamento_id: entrada.data.id,
    p_obra_id: entrada.data.obraId,
    p_nome: entrada.data.nome,
    p_colunas: entrada.data.colunas,
    p_linhas: entrada.data.linhas,
    p_versao_esperada: entrada.data.versao ?? null,
  });
  if (error) {
    if (error.message.includes("Orcamento foi alterado por outro usuario")) {
      return { erro: "Este orçamento foi alterado por outro usuário. Recarregue a página para ver a versão mais recente." };
    }
    return { erro: "Nao foi possivel atualizar o orcamento." };
  }
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/${entrada.data.id}`);
  return { versao: typeof novaVersao === "number" ? novaVersao : undefined };
}

export async function assinarUploadOrcamento(dados: {
  obraId: string;
  orcamentoId?: string;
  nomeArquivo: string;
}): Promise<{ caminho?: string; token?: string; url?: string; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = z.object({
    obraId: z.string().uuid(),
    orcamentoId: z.string().uuid().optional(),
    nomeArquivo: z.string().trim().min(1).max(255),
  }).safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Arquivo invalido." };
  try {
    const prefixo = `orcamentos/${entrada.data.obraId}/${entrada.data.orcamentoId ?? "novo"}`;
    return await assinarUpload("orcamentos", montarCaminho(prefixo, entrada.data.nomeArquivo));
  } catch {
    return { erro: "Nao foi possivel preparar o upload da planilha." };
  }
}

export async function excluirOrcamento(id: string, obraId: string): Promise<{ erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = z.object({ id: z.string().uuid(), obraId: z.string().uuid() }).safeParse({ id, obraId });
  if (!entrada.success) return { erro: "Orcamento invalido." };
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .from("orcamentos")
    .select("nome, versao")
    .eq("id", id)
    .eq("obra_id", obraId)
    .single();
  if (!orcamento) return { erro: "Orcamento nao encontrado." };

  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("id")
    .eq("orcamento_id", id);
  const itemIds = (itens ?? []).map((item) => item.id);
  let vinculados = false;
  for (let i = 0; i < itemIds.length && !vinculados; i += 200) {
    const { data: catalogo } = await supabase
      .from("catalogo_precos")
      .select("id")
      .in("orcamento_item_id", itemIds.slice(i, i + 200))
      .limit(1);
    vinculados = (catalogo ?? []).length > 0;
  }
  for (let i = 0; i < itemIds.length && !vinculados; i += 200) {
    const { data: vinculos } = await supabase
      .from("catalogo_precos_orcamento_itens")
      .select("orcamento_item_id")
      .in("orcamento_item_id", itemIds.slice(i, i + 200))
      .limit(1);
    vinculados = (vinculos ?? []).length > 0;
  }
  if (vinculados) {
    return { erro: "Este orçamento possui itens vinculados a medições. Desvincule-os antes de excluir." };
  }

  const { error } = await supabase.from("orcamentos").delete().eq("id", id).eq("obra_id", obraId);
  if (error) return { erro: "Nao foi possivel excluir o orcamento." };

  try {
    const { data: usuario } = await supabase.auth.getUser();
    const { error: erroAuditoria } = await supabase.from("orcamento_auditoria").insert({
      orcamento_id: null,
      entidade: "orcamento",
      entidade_id: id,
      operacao: "delete",
      antes: { nome: orcamento.nome, versao: orcamento.versao },
      depois: null,
      autor_id: usuario.user?.id ?? null,
    });
    if (erroAuditoria) console.error("[orcamentos] falha ao registrar auditoria de exclusao:", erroAuditoria.message);
  } catch (erro) {
    console.error("[orcamentos] falha ao registrar auditoria de exclusao:", erro);
  }

  revalidatePath(`/obras/${obraId}/orcamentos`);
  return {};
}

export async function salvarComposicao(dados: {
  id?: string;
  obraId: string;
  codigo?: string;
  nome: string;
  unidade: string;
  componentes: Array<{ codigo?: string; nome: string; categoria: string; unidade: string; quantidade: number; custoUnitario: number }>;
}): Promise<{ id?: string; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;
  const entrada = z.object({
    id: z.string().uuid().optional(), obraId: z.string().uuid(), codigo: z.string().max(80).optional(),
    nome: z.string().trim().min(1).max(160), unidade: z.string().trim().min(1).max(20),
    componentes: z.array(z.object({ codigo: z.string().trim().max(80).optional(), nome: z.string().trim().min(1).max(160), categoria: z.enum(["mao_de_obra", "material", "equipamento", "outro"]), unidade: z.string().max(20), quantidade: z.number().min(0), custoUnitario: z.number().min(0) })).max(500),
  }).safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };
  const supabase = await createClient();
  const custo = entrada.data.componentes.reduce((soma, item) => soma + item.quantidade * item.custoUnitario, 0);
  const { data: usuario } = await supabase.auth.getUser();
  const { data: composicao, error } = entrada.data.id
    ? await supabase.from("composicoes").update({ codigo: entrada.data.codigo ?? null, nome: entrada.data.nome, unidade: entrada.data.unidade, custo_unitario: custo }).eq("id", entrada.data.id).eq("obra_id", entrada.data.obraId).select("id").single()
    : await supabase.from("composicoes").insert({ obra_id: entrada.data.obraId, codigo: entrada.data.codigo ?? null, nome: entrada.data.nome, unidade: entrada.data.unidade, custo_unitario: custo, criado_por: usuario.user?.id ?? null }).select("id").single();
  if (error || !composicao) return { erro: "Nao foi possivel salvar a composicao." };
  const { error: erroComponentes } = await supabase.rpc("substituir_componentes_composicao", {
    p_composicao_id: composicao.id,
     p_componentes: entrada.data.componentes.map((item) => ({ codigo: item.codigo ?? null, nome: item.nome, categoria: item.categoria, unidade: item.unidade, quantidade: item.quantidade, custo_unitario: item.custoUnitario })),
  });
  if (erroComponentes) return { erro: "A composicao foi salva, mas seus componentes nao puderam ser gravados." };
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  return { id: composicao.id };
}

export async function importarComposicoes(dados: {
  obraId: string;
  composicoes: Array<{
    codigo: string;
    nome: string;
    unidade: string;
    componentes: Array<{
      codigo?: string;
      nome: string;
      categoria: "mao_de_obra" | "material" | "equipamento" | "outro";
      unidade: string;
      quantidade: number;
      custoUnitario: number;
    }>;
  }>;
}): Promise<{ quantidade?: number; erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const entrada = z.object({
    obraId: z.string().uuid(),
    composicoes: z.array(z.object({
      codigo: z.string().trim().min(1).max(80),
      nome: z.string().trim().min(1).max(5000),
      unidade: z.string().trim().min(1).max(20),
      componentes: z.array(z.object({
        codigo: z.string().trim().max(80).optional(),
        nome: z.string().trim().min(1).max(5000),
        categoria: z.enum(["mao_de_obra", "material", "equipamento", "outro"]),
        unidade: z.string().trim().max(20),
        quantidade: z.number().finite().min(0).max(9999999999.9999),
        custoUnitario: z.number().finite().min(0).max(9999999999.9999),
      })).max(500),
    })).min(1).max(5000),
  }).safeParse(dados);
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados invalidos." };

  const supabase = await createClient();
  const { data: usuario } = await supabase.auth.getUser();
  let quantidade = 0;
  for (const item of entrada.data.composicoes) {
    let componentesNormalizados: Array<{
      codigo?: string;
      nome: string;
      categoria: "mao_de_obra" | "material" | "equipamento" | "outro";
      unidade: string;
      quantidade: number;
      custo_unitario: number;
    }>;
    let custo: number;
    try {
      componentesNormalizados = item.componentes.map((componente) => ({
        codigo: componente.codigo,
         nome: componente.nome,
        categoria: componente.categoria,
        unidade: componente.unidade,
        quantidade: numeroBanco(componente.quantidade),
        custo_unitario: numeroBanco(componente.custoUnitario),
      }));
      custo = numeroBanco(componentesNormalizados.reduce((soma, componente) => soma + componente.quantidade * componente.custo_unitario, 0));
    } catch (erro) {
      return { erro: `Valores numericos invalidos na composicao ${item.codigo}: ${erro instanceof Error ? erro.message : "erro desconhecido"}` };
    }
    const { data: existentes, error: erroBusca } = await supabase
      .from("composicoes")
      .select("id")
      .eq("obra_id", entrada.data.obraId)
      .eq("codigo", item.codigo)
      .order("criado_em", { ascending: true })
      .limit(1);
    if (erroBusca) return { erro: `Nao foi possivel localizar a composicao ${item.codigo}: ${erroBusca.message}` };
    const existente = existentes?.[0] ?? null;
    const novaComposicao = !existente;
    const { data: composicao, error } = existente
      ? await supabase.from("composicoes").update({ nome: item.nome, unidade: item.unidade, custo_unitario: custo }).eq("id", existente.id).select("id").single()
      : await supabase.from("composicoes").insert({ obra_id: entrada.data.obraId, codigo: item.codigo, nome: item.nome, unidade: item.unidade, custo_unitario: custo, criado_por: usuario.user?.id ?? null }).select("id").single();
    if (error || !composicao) return { erro: `Nao foi possivel importar a composicao ${item.codigo}: ${error?.message ?? "registro nao retornado"}` };
    if (existente) {
      const { error: erroLimpeza } = await supabase.from("composicao_componentes").delete().eq("composicao_id", composicao.id);
      if (erroLimpeza) return { erro: `Nao foi possivel atualizar os componentes da composicao ${item.codigo}: ${erroLimpeza.message}` };
    }
    const { error: erroComponentes } = await supabase.from("composicao_componentes").insert(componentesNormalizados.map((componente) => ({
         composicao_id: composicao.id,
          codigo: componente.codigo ?? null,
      nome: componente.nome,
      categoria: componente.categoria,
      unidade: componente.unidade,
      quantidade: componente.quantidade,
      custo_unitario: componente.custo_unitario,
    })));
    if (erroComponentes) {
      if (novaComposicao) {
        await supabase.from("composicoes").delete().eq("id", composicao.id).eq("obra_id", entrada.data.obraId);
      }
      return { erro: `A composicao ${item.codigo} nao pode ter seus componentes gravados: ${erroComponentes.message}` };
    }
    quantidade += 1;
  }
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  return { quantidade };
}

export async function excluirTodosOrcamentosEComposicoes(dados: {
  obraId?: string;
}): Promise<{ erro?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const supabase = await createClient();

  if (!dados.obraId) return { erro: "Informe a obra para limpar os dados importados." };
  const entrada = z.object({ obraId: z.string().uuid() }).safeParse(dados);
  if (!entrada.success) return { erro: "Obra invalida." };

  const { error } = await supabase.rpc("limpar_dados_importados_obra", {
    p_obra_id: entrada.data.obraId,
  });
  if (error) return { erro: "Nao foi possivel limpar os dados importados." };

  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos`);
  revalidatePath(`/obras/${entrada.data.obraId}/compras`);
  revalidatePath(`/obras/${entrada.data.obraId}/orcamentos/painel`);
  return {};
}
