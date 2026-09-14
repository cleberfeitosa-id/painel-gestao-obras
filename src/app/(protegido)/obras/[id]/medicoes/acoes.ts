"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Resultado = { erro?: string };

// Guard duplicado por arquivo (convencao do repo): o modulo de medicoes e
// restrito a gestores e administradores.
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
    return { erro: "Voce nao tem permissao para acessar o modulo de medicoes." };
  }

  return null;
}

const esquemaPrecoCatalogo = z.object({
  medicaoId: z.string().uuid("Medicao invalida."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do item do catalogo.")
    .max(200, "O nome deve ter no maximo 200 caracteres."),
  valorUnitario: z
    .number("Informe o valor unitario.")
    .min(0, "O valor unitario nao pode ser negativo.")
    .max(1_000_000_000, "Valor unitario acima do limite."),
  unidade: z
    .string()
    .trim()
    .min(1, "Informe a unidade.")
    .max(20, "A unidade deve ter no maximo 20 caracteres."),
  orcamentoItemId: z
    .array(z.string().uuid("Item do orcamento invalido."))
    .max(100)
    .optional(),
});

const esquemaPrecoCatalogoUpdate = z.object({
  catalogoId: z.string().uuid("Item do catalogo invalido."),
  medicaoId: z.string().uuid("Medicao invalida."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do item do catalogo.")
    .max(200, "O nome deve ter no maximo 200 caracteres."),
  valorUnitario: z
    .number("Informe o valor unitario.")
    .min(0, "O valor unitario nao pode ser negativo.")
    .max(1_000_000_000, "Valor unitario acima do limite."),
  unidade: z
    .string()
    .trim()
    .min(1, "Informe a unidade.")
    .max(20, "A unidade deve ter no maximo 20 caracteres."),
  orcamentoItemId: z
    .array(z.string().uuid("Item do orcamento invalido."))
    .max(100)
    .optional(),
});

// Atualiza a entrada do catalogo de precos da medicao.
export async function atualizarPrecoCatalogo(dados: {
  catalogoId: string;
  medicaoId: string;
  nome: string;
  valorUnitario: number;
  unidade: string;
  orcamentoItemId?: string[];
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaPrecoCatalogoUpdate.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();

  // Valida que o item do orcamento pertence a mesma obra da medicao.
  const { data: medicao } = await supabase
    .from("medicoes")
    .select("obra_id")
    .eq("id", resultado.data.medicaoId)
    .single();
  if (!medicao) return { erro: "Medicao nao encontrada." };

  const ids = [...new Set(resultado.data.orcamentoItemId ?? [])];
  if (ids.length > 0) {
    const { data: itensOrcamento, error: erroItens } = await supabase
      .from("orcamento_itens")
      .select("orcamentos!inner(obra_id)")
      .in("id", ids);
    if (erroItens || (itensOrcamento ?? []).some((item) => item.orcamentos?.obra_id !== medicao.obra_id)) {
      return { erro: "Um item do orçamento não pertence a esta obra." };
    }
  }

  const { error } = await supabase.from("catalogo_precos").update({
    nome: resultado.data.nome,
    valor_unitario: resultado.data.valorUnitario,
    unidade: resultado.data.unidade,
  }).eq("id", resultado.data.catalogoId);

  if (error) {
    if (error.code === "23505") {
      return { erro: "Ja existe um item com esse nome nesta medicao." };
    }
    return { erro: "Nao foi possivel atualizar o preco do catalogo. Tente novamente." };
  }

  await supabase.from("catalogo_precos_orcamento_itens").delete().eq("catalogo_id", resultado.data.catalogoId);
  if (ids.length > 0) {
    await supabase.from("catalogo_precos_orcamento_itens").insert(
      ids.map((orcamentoItemId) => ({ catalogo_id: resultado.data.catalogoId, orcamento_item_id: orcamentoItemId })),
    );
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  return {};
}

// Cria um novo item no catalogo de precos da medicao.
export async function criarPrecoCatalogo(dados: {
  medicaoId: string;
  nome: string;
  valorUnitario: number;
  unidade: string;
  orcamentoItemId?: string[];
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaPrecoCatalogo.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: medicao } = await supabase
    .from("medicoes")
    .select("obra_id")
    .eq("id", resultado.data.medicaoId)
    .single();
  if (!medicao) return { erro: "Medicao nao encontrada." };

  const ids = [...new Set(resultado.data.orcamentoItemId ?? [])];
  if (ids.length > 0) {
    const { data: itensOrcamento, error: erroItens } = await supabase
      .from("orcamento_itens")
      .select("orcamentos!inner(obra_id)")
      .in("id", ids);
    if (erroItens || (itensOrcamento ?? []).some((item) => item.orcamentos?.obra_id !== medicao.obra_id)) {
      return { erro: "Um item do orçamento não pertence a esta obra." };
    }
  }

  const { error: erroInsert, data: catalogo } = await supabase.from("catalogo_precos").insert({
    medicao_id: resultado.data.medicaoId,
    nome: resultado.data.nome,
    valor_unitario: resultado.data.valorUnitario,
    unidade: resultado.data.unidade,
    criado_por: user?.id ?? null,
  }).select("id").single();

  if (erroInsert || !catalogo) {
    return { erro: "Nao foi possivel criar o item do catalogo. Verifique se o nome ja existe." };
  }

  if (ids.length > 0) {
    await supabase.from("catalogo_precos_orcamento_itens").insert(
      ids.map((orcamentoItemId) => ({ catalogo_id: catalogo.id, orcamento_item_id: orcamentoItemId })),
    );
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  return {};
}

const esquemaMedicao = z.object({
  tarefaId: z.string().uuid("Tarefa invalida."),
  catalogoId: z.string().uuid("Item do catalogo invalido."),
  quantidade: z
    .number("Informe a quantidade.")
    .min(0, "A quantidade nao pode ser negativa.")
    .max(1_000_000_000, "Quantidade acima do limite.")
    .nullable(),
});

// Salva (upsert) ou remove uma medicao de tarefa.
// Se quantidade for null ou 0, remove a medicao.
// Caso contrario, faz upsert na tabela tarefa_medicoes.
// Nota: nao ha constraint unique em (tarefa_id, catalogo_id), entao
// verificamos manualmente se ja existe para decidir entre insert/update.
export async function salvarMedicaoTarefa(dados: {
  tarefaId: string;
  catalogoId: string;
  quantidade: number | null;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaMedicao.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tarefaId, catalogoId, quantidade } = resultado.data;

  // Buscar medicao_id do catalogo para revalidacao
  const { data: catalogo } = await supabase
    .from("catalogo_precos")
    .select("medicao_id")
    .eq("id", catalogoId)
    .single();

  if (!catalogo) return { erro: "Item do catalogo nao encontrado." };

  // Se quantidade e null ou 0, deletar a medicao
  if (quantidade == null || quantidade === 0) {
    const { error } = await supabase
      .from("tarefa_medicoes")
      .delete()
      .eq("tarefa_id", tarefaId)
      .eq("catalogo_id", catalogoId);

    if (error) {
      return { erro: "Nao foi possivel remover a medicao. Tente novamente." };
    }

    revalidatePath(`/obras/[id]/medicoes/${catalogo.medicao_id}`);
    return {};
  }

  // Verificar se ja existe medicao para esta tarefa + catalogo
  const { data: existente } = await supabase
    .from("tarefa_medicoes")
    .select("id")
    .eq("tarefa_id", tarefaId)
    .eq("catalogo_id", catalogoId)
    .maybeSingle();

  let error;
  if (existente) {
    // Atualizar
    const { error: updateError } = await supabase
      .from("tarefa_medicoes")
      .update({ quantidade, criado_por: user?.id ?? null })
      .eq("id", existente.id);
    error = updateError;
  } else {
    // Inserir
    const { error: insertError } = await supabase.from("tarefa_medicoes").insert({
      tarefa_id: tarefaId,
      catalogo_id: catalogoId,
      quantidade,
      criado_por: user?.id ?? null,
    });
    error = insertError;
  }

  if (error) {
    return { erro: "Nao foi possivel salvar a medicao. Tente novamente." };
  }

  revalidatePath(`/obras/[id]/medicoes/${catalogo.medicao_id}`);
  return {};
}

const esquemaValorContrato = z.object({
  medicaoId: z.string().uuid("Medicao invalida."),
  valorContrato: z
    .number("Informe o valor do contrato.")
    .min(0, "O valor do contrato nao pode ser negativo.")
    .max(1_000_000_000_000, "Valor acima do limite.")
    .nullable(),
});

// Registra o valor total do contrato da medicao. null limpa o valor.
export async function atualizarValorContrato(dados: {
  medicaoId: string;
  valorContrato: number | null;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaValorContrato.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("medicoes")
    .update({ valor_contrato: resultado.data.valorContrato })
    .eq("id", resultado.data.medicaoId);

  if (error) {
    return { erro: "Nao foi possivel salvar o valor do contrato. Tente novamente." };
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  return {};
}

const esquemaCriarMedicao = z.object({
  obraId: z.string().uuid("Obra invalida."),
  titulo: z
    .string()
    .trim()
    .min(1, "Informe o titulo da medicao.")
    .max(200, "O titulo deve ter no maximo 200 caracteres."),
  valorContrato: z
    .number("Informe o valor do contrato.")
    .min(0, "O valor do contrato nao pode ser negativo.")
    .max(1_000_000_000_000, "Valor acima do limite.")
    .nullable(),
});

const esquemaAtualizarMedicao = z.object({
  medicaoId: z.string().uuid("Medicao invalida."),
  titulo: z
    .string()
    .trim()
    .min(1, "Informe o titulo da medicao.")
    .max(200, "O titulo deve ter no maximo 200 caracteres."),
});

// Atualiza o titulo de uma medicao existente.
export async function atualizarMedicao(dados: {
  medicaoId: string;
  titulo: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaAtualizarMedicao.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("medicoes")
    .update({ titulo: resultado.data.titulo })
    .eq("id", resultado.data.medicaoId);

  if (error) {
    return { erro: "Nao foi possivel atualizar a medicao. Tente novamente." };
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  revalidatePath(`/obras/[id]/medicoes`);
  return {};
}

// Cria um novo contrato de medicao para a obra.
export async function criarMedicao(dados: {
  obraId: string;
  titulo: string;
  valorContrato: number | null;
}): Promise<Resultado & { medicaoId?: string }> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaCriarMedicao.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("medicoes")
    .insert({
      obra_id: resultado.data.obraId,
      titulo: resultado.data.titulo,
      valor_contrato: resultado.data.valorContrato,
      criado_por: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel criar a medicao. Tente novamente." };
  }

  revalidatePath(`/obras/${resultado.data.obraId}/medicoes`);
  revalidatePath(`/obras/${resultado.data.obraId}`);
  return { medicaoId: data.id };
}

const esquemaRegistrarPagamento = z.object({
  medicaoId: z.string().uuid("Medicao invalida."),
  valor: z
    .number("Informe o valor pago.")
    .positive("O valor pago deve ser maior que zero.")
    .max(1_000_000_000_000, "Valor acima do limite."),
  dataPagamento: z
    .string()
    .trim()
    .min(1, "Informe a data do pagamento.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data em formato invalido."),
  descricao: z
    .string()
    .trim()
    .min(1, "Informe a descricao do pagamento.")
    .max(500, "A descricao deve ter no maximo 500 caracteres."),
});

export async function registrarPagamento(dados: {
  medicaoId: string;
  valor: number;
  dataPagamento: string;
  descricao: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaRegistrarPagamento.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("medicao_pagamentos").insert({
    medicao_id: resultado.data.medicaoId,
    valor: resultado.data.valor,
    data_pagamento: resultado.data.dataPagamento,
    descricao: resultado.data.descricao,
    criado_por: user?.id ?? null,
  });

  if (error) {
    return { erro: "Nao foi possivel registrar o pagamento. Tente novamente." };
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  revalidatePath(`/obras/[id]/medicoes`);
  return {};
}

const esquemaExcluirPagamento = z.object({
  pagamentoId: z.string().uuid("Pagamento invalido."),
  medicaoId: z.string().uuid("Medicao invalida."),
});

export async function excluirPagamento(dados: {
  pagamentoId: string;
  medicaoId: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaExcluirPagamento.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("medicao_pagamentos")
    .delete()
    .eq("id", resultado.data.pagamentoId)
    .eq("medicao_id", resultado.data.medicaoId);

  if (error) {
    return { erro: "Nao foi possivel excluir o pagamento. Tente novamente." };
  }

  revalidatePath(`/obras/[id]/medicoes/${resultado.data.medicaoId}`);
  revalidatePath(`/obras/[id]/medicoes`);
  return {};
}

export type ItemOrcamentoParaCatalogo = {
  id: string;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  composicao_id: string | null;
  valor_mao_obra: number;
  valor_equipamento: number;
  valor_composicao: number;
};

export type ResultadoBuscaItensOrcamento =
  | { itens: ItemOrcamentoParaCatalogo[] }
  | { erro: string };

const esquemaBuscarItensOrcamento = z.object({
  obraId: z.string().uuid("Obra invalida."),
  termo: z.string().trim().max(100, "Termo de busca muito longo."),
});

// Busca itens do orcamento da obra para vincular ao catalogo de precos.
export async function buscarItensOrcamento(dados: {
  obraId: string;
  termo: string;
}): Promise<ResultadoBuscaItensOrcamento> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaBuscarItensOrcamento.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  // Remove caracteres que quebram a sintaxe do filtro .or() do PostgREST.
  const termo = resultado.data.termo.replace(/[,()"]/g, "");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamento_itens")
    .select(
      "id, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, composicao_id, orcamentos!inner(obra_id)",
    )
    .eq("orcamentos.obra_id", resultado.data.obraId)
    .eq("ativo", true)
    .eq("tipo", "item")
    .or(`codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`)
    .limit(100);

  if (error) {
    return { erro: "Nao foi possivel buscar os itens do orcamento." };
  }

  const todosItens = data ?? [];
  const codigosPais = new Set(
    todosItens
      .map((item) => item.codigo?.trim())
      .filter((codigo): codigo is string => Boolean(codigo))
      .filter((codigo, indice, codigos) => codigos.some((outro, outroIndice) => outroIndice !== indice && outro.startsWith(`${codigo}.`))),
  );
  const itens = todosItens.filter((item) => {
    const codigo = item.codigo?.trim();
    return !codigo || !codigosPais.has(codigo);
  }).map((item) => ({
    id: item.id,
    codigo: item.codigo,
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario,
    valor_total: item.valor_total,
    composicao_id: item.composicao_id,
    valor_mao_obra: 0,
    valor_equipamento: 0,
    valor_composicao: item.valor_unitario > 0
      ? item.valor_unitario
      : item.quantidade > 0
        ? item.valor_total / item.quantidade
        : item.valor_total,
  })).slice(0, 20);

  // Enriquecer com valor de mao de obra via custo_composicoes RPC
  const composicaoIds = [...new Set(itens.map((i) => i.composicao_id).filter((id): id is string => Boolean(id)))];
  if (composicaoIds.length > 0) {
    const { data: custos } = await supabase.rpc("custo_composicoes", {
      p_obra_id: resultado.data.obraId,
    });
    const custosPorComposicao = new Map<string, Record<string, number>>();
    for (const row of custos ?? []) {
      const atual = custosPorComposicao.get(row.composicao_id) ?? {};
      atual[row.categoria] = (atual[row.categoria] ?? 0) + row.total;
      custosPorComposicao.set(row.composicao_id, atual);
    }
    for (const item of itens) {
      if (item.composicao_id) {
        const custos = custosPorComposicao.get(item.composicao_id) ?? {};
        item.valor_mao_obra = custos.mao_de_obra ?? 0;
        item.valor_equipamento = custos.equipamento ?? 0;
        const valorComposicao = item.valor_mao_obra + item.valor_equipamento;
        item.valor_composicao = valorComposicao > 0 ? valorComposicao : item.valor_unitario;
      }
    }
  }

  return { itens };
}
