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
});

// Atualiza (ou cria) a entrada do catalogo de precos da medicao. Como a tabela
// tem UNIQUE (medicao_id, nome), o upsert garante que itens com o mesmo nome
// compartilham o mesmo valor unitario e unidade.
export async function atualizarPrecoCatalogo(dados: {
  medicaoId: string;
  nome: string;
  valorUnitario: number;
  unidade: string;
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaPrecoCatalogo.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("catalogo_precos").upsert(
    {
      medicao_id: resultado.data.medicaoId,
      nome: resultado.data.nome,
      valor_unitario: resultado.data.valorUnitario,
      unidade: resultado.data.unidade,
      criado_por: user?.id ?? null,
    },
    { onConflict: "medicao_id,nome" },
  );

  if (error) {
    return { erro: "Nao foi possivel salvar o preco do catalogo. Tente novamente." };
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
}): Promise<Resultado> {
  const negado = await verificarGestor();
  if (negado) return negado;

  const resultado = esquemaPrecoCatalogo.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("catalogo_precos").insert({
    medicao_id: resultado.data.medicaoId,
    nome: resultado.data.nome,
    valor_unitario: resultado.data.valorUnitario,
    unidade: resultado.data.unidade,
    criado_por: user?.id ?? null,
  });

  if (error) {
    // Se ja existe um item com esse nome na medicao, o upsert seria mais
    // apropriado, mas mantemos insert para forcar nomes unicos por medicao.
    return { erro: "Nao foi possivel criar o item do catalogo. Verifique se o nome ja existe." };
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
