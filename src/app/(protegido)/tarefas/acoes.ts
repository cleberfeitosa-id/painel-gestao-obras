"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarResponsavel } from "@/lib/email";
import { assinarUpload, removerArquivo, BUCKET_ANEXOS } from "@/lib/armazenamento";
import type {
  AprovacaoTarefa,
  Atualizacao,
  MomentoAnexo,
  PrioridadeTarefa,
  StatusTarefa,
  TarefaRow,
  TipoAnexo,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";

type Resultado = { erro?: string };

const esquemaMedicao = z.object({
  catalogo_id: z.string().uuid("Selecione um item do catalogo valido."),
  quantidade: z.coerce.number().min(0, "A quantidade nao pode ser negativa."),
});

const esquemaLocalizacao = z
  .object({
    localizacao_tipo: z.enum(["nenhuma", "ponto", "regiao"]),
    planta_id: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().uuid().nullable().optional()
    ),
    pagina: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.coerce.number().int().positive().nullable().optional()
    ),
    ponto_x: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.coerce.number().nullable().optional()
    ),
    ponto_y: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.coerce.number().nullable().optional()
    ),
    regiao: z.preprocess(
      (val) => {
        if (val === "" || val == null) return undefined;
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return val;
      },
      z
        .object({
          vertices: z
            .array(z.object({ x: z.number(), y: z.number() }))
            .min(3, "A regiao precisa de pelo menos 3 vertices."),
        })
        .nullable()
        .optional()
    ),
  })
  .superRefine((dados, ctx) => {
    // Satisfaz as CHECK constraints do banco: ponto exige x/y, regiao exige
    // vertices, e qualquer localizacao exige planta + pagina.
    if (dados.localizacao_tipo === "ponto") {
      if (dados.ponto_x == null || dados.ponto_y == null) {
        ctx.addIssue({
          code: "custom",
          message: "Localizacao por ponto exige coordenadas x e y.",
        });
      }
    }
    if (dados.localizacao_tipo === "regiao" && !dados.regiao) {
      ctx.addIssue({
        code: "custom",
        message: "Localizacao por regiao exige os vertices da area.",
      });
    }
    if (
      dados.localizacao_tipo !== "nenhuma" &&
      (!dados.planta_id || !dados.pagina)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Localizacao exige uma planta e o numero da pagina.",
      });
    }
  });

const esquemaTarefa = z.object({
  titulo: z.string().trim().min(1, "Informe o titulo da tarefa.").max(200),
  descricao: z.string().trim().max(4000).optional().or(z.literal("")),
  obra_id: z.string().uuid("Selecione uma obra valida."),
  responsavel_id: z.string().uuid().nullable().optional().or(z.literal("")),
  executor_id: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().uuid().nullable().optional()
  ),
  supervisor_id: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().uuid().nullable().optional()
  ),
  status: z.enum(["pendente", "em_execucao", "concluido"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  tag_id: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().uuid().nullable().optional()
  ),
  prazo: z.string().optional().or(z.literal("")),
  data_planejada: z.string().optional().or(z.literal("")),
  data_inicio: z.string().optional().or(z.literal("")),
  data_fim: z.string().optional().or(z.literal("")),
  exige_foto: z.boolean().optional(),
  exige_video: z.boolean().optional(),
  exige_arquivo: z.boolean().optional(),
  medicoes: z.array(esquemaMedicao).optional(),
  ...esquemaLocalizacao.shape,
}).superRefine((dados, ctx) => {
  if (dados.prazo && dados.data_planejada) {
    if (dados.data_planejada > dados.prazo) {
      ctx.addIssue({
        code: "custom",
        message: "A data planejada de inicio nao pode ser posterior ao prazo.",
        path: ["data_planejada"],
      });
    }
  }
  if (dados.data_inicio && dados.data_fim && dados.data_inicio > dados.data_fim) {
    ctx.addIssue({
      code: "custom",
      message: "A data de inicio nao pode ser posterior a data de fim.",
      path: ["data_inicio"],
    });
  }
});

type DadosTarefa = z.infer<typeof esquemaTarefa>;

async function usuarioAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

async function papelDoUsuario(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", userId)
    .single();
  return data?.papel ?? null;
}

function eGestor(papel: string | null) {
  return papel === "admin" || papel === "gestor";
}

async function carregarTarefaComPermissao(tarefaId: string) {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) return { tarefa: null as TarefaRow | null, podeEscrever: false };

  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .eq("id", tarefaId)
    .single();

  const tarefa = data as TarefaRow | null;
  if (!tarefa) return { tarefa: null, podeEscrever: false };

  const papel = await papelDoUsuario(user.id);
  const podeEscrever = eGestor(papel) || tarefa.responsavel_id === user.id;
  return { tarefa, podeEscrever };
}

function normalizar(dados: DadosTarefa) {
  const localizacao = dados.localizacao_tipo;
  return {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    obra_id: dados.obra_id,
    responsavel_id: dados.responsavel_id || null,
    executor_id: dados.executor_id || null,
    supervisor_id: dados.supervisor_id || null,
    status: dados.status as StatusTarefa,
    prioridade: dados.prioridade as PrioridadeTarefa,
    tag_id: dados.tag_id || null,
    prazo: dados.prazo || null,
    data_planejada: dados.data_planejada || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_fim || null,
    exige_foto: dados.exige_foto ?? false,
    exige_video: dados.exige_video ?? false,
    exige_arquivo: dados.exige_arquivo ?? false,
    localizacao_tipo: localizacao as TipoLocalizacao,
    planta_id: localizacao === "nenhuma" ? null : (dados.planta_id ?? null),
    pagina: localizacao === "nenhuma" ? null : (dados.pagina ?? null),
    ponto_x: localizacao === "ponto" ? (dados.ponto_x ?? null) : null,
    ponto_y: localizacao === "ponto" ? (dados.ponto_y ?? null) : null,
    regiao: localizacao === "regiao" ? dados.regiao : null,
  };
}

async function validarExecutorDaObra(
  executorId: string | null | undefined,
  obraId: string,
): Promise<string | null> {
  if (!executorId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("executores")
    .select("id")
    .eq("id", executorId)
    .eq("obra_id", obraId)
    .single();
  if (!data) {
    return "O executor selecionado nao pertence a obra da tarefa.";
  }
  return null;
}

type DadosNotificacao = {
  titulo: string;
  descricao?: string | null;
  obra_id: string;
  prazo?: string | null;
  prioridade: PrioridadeTarefa;
};

async function enviarNotificacao(
  tarefaId: string,
  responsavelId: string,
  dados: DadosNotificacao,
) {
  const supabase = await createClient();
  const [{ data: perfil }, { data: obra }] = await Promise.all([
    supabase.from("perfis").select("nome, email").eq("id", responsavelId).single(),
    supabase.from("obras").select("nome").eq("id", dados.obra_id).single(),
  ]);

  if (!perfil || !obra) return;

  // Nunca deixa uma falha de e-mail derrubar a criacao da tarefa.
  try {
    await notificarResponsavel({
      para: perfil.email,
      nomeResponsavel: perfil.nome,
      tarefaId,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      obra: obra.nome,
      prazo: dados.prazo || null,
      prioridade: dados.prioridade as PrioridadeTarefa,
    });
  } catch (erro) {
    console.error("[tarefas] falha ao notificar responsavel:", erro);
  }
}

export async function criarTarefa(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para criar tarefas." };
  }

  const medicoesRaw = formData.get("medicoes");
  let medicoes: { catalogo_id: string; quantidade: number }[] = [];
  if (medicoesRaw) {
    try {
      medicoes = JSON.parse(String(medicoesRaw));
    } catch {
      medicoes = [];
    }
  }

  const bruto = {
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    obra_id: formData.get("obra_id"),
    responsavel_id: formData.get("responsavel_id"),
    executor_id: formData.get("executor_id"),
    supervisor_id: formData.get("supervisor_id"),
    status: formData.get("status"),
    prioridade: formData.get("prioridade"),
    tag_id: formData.get("tag_id"),
    prazo: formData.get("prazo"),
    data_planejada: formData.get("data_planejada"),
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim"),
    exige_foto: formData.get("exige_foto") === "on",
    exige_video: formData.get("exige_video") === "on",
    exige_arquivo: formData.get("exige_arquivo") === "on",
    localizacao_tipo: formData.get("localizacao_tipo"),
    planta_id: formData.get("planta_id"),
    pagina: formData.get("pagina"),
    ponto_x: formData.get("ponto_x"),
    ponto_y: formData.get("ponto_y"),
    regiao: formData.get("regiao"),
    medicoes,
  };

  const resultado = esquemaTarefa.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const erroExecutor = await validarExecutorDaObra(
    resultado.data.executor_id,
    resultado.data.obra_id,
  );
  if (erroExecutor) return { erro: erroExecutor };

  const { data, error } = await supabase
    .from("tarefas")
    .insert({ ...normalizar(resultado.data), criado_por: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel criar a tarefa. Tente novamente." };
  }

  // Inserir medicoes se houver
  if (resultado.data.medicoes && resultado.data.medicoes.length > 0) {
    const medicoesInsert = resultado.data.medicoes.map((m) => ({
      tarefa_id: data.id,
      catalogo_id: m.catalogo_id,
      quantidade: m.quantidade,
      criado_por: user.id,
    }));

    const { error: erroMedicoes } = await supabase
      .from("tarefa_medicoes")
      .insert(medicoesInsert);

    if (erroMedicoes) {
      console.error("[tarefas] falha ao inserir medicoes:", erroMedicoes);
      // Nao derruba a criacao da tarefa, apenas loga o erro
    }
  }

  if (resultado.data.responsavel_id) {
    await enviarNotificacao(data.id, resultado.data.responsavel_id, resultado.data);
  }

  revalidatePath("/tarefas");
  revalidatePath("/painel");
  redirect(`/tarefas/${data.id}`);
}

const esquemaLocalizacaoLote = z
  .object({
    localizacao_tipo: z.enum(["ponto", "regiao"]),
    planta_id: z.string().uuid(),
    pagina: z.coerce.number().int().positive(),
    ponto_x: z.coerce.number().nullable().optional(),
    ponto_y: z.coerce.number().nullable().optional(),
    regiao: z
      .object({
        vertices: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .min(3, "A regiao precisa de pelo menos 3 vertices."),
      })
      .nullable()
      .optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.localizacao_tipo === "ponto") {
      if (dados.ponto_x == null || dados.ponto_y == null) {
        ctx.addIssue({
          code: "custom",
          message: "Localizacao por ponto exige coordenadas x e y.",
        });
      }
    }
    if (dados.localizacao_tipo === "regiao" && !dados.regiao) {
      ctx.addIssue({
        code: "custom",
        message: "Localizacao por regiao exige os vertices da area.",
      });
    }
  });

const esquemaCriarLote = z
  .object({
    titulo: z.string().trim().min(1, "Informe o titulo da tarefa.").max(200),
    descricao: z.string().trim().max(4000).optional().or(z.literal("")),
    obra_id: z.string().uuid("Selecione uma obra valida."),
    responsavel_id: z.string().uuid().nullable().optional().or(z.literal("")),
    executor_id: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().uuid().nullable().optional()
    ),
    supervisor_id: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().uuid().nullable().optional()
    ),
    status: z.enum(["pendente", "em_execucao", "concluido"]),
    prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
    tag_id: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().uuid().nullable().optional()
    ),
    prazo: z.string().optional().or(z.literal("")),
    data_planejada: z.string().optional().or(z.literal("")),
    data_inicio: z.string().optional().or(z.literal("")),
    data_fim: z.string().optional().or(z.literal("")),
    exige_foto: z.boolean().optional(),
    exige_video: z.boolean().optional(),
    exige_arquivo: z.boolean().optional(),
    lote_id: z.string().uuid().optional(),
    localizacoes: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return val;
      },
      z
        .array(esquemaLocalizacaoLote)
        .min(1, "Adicione pelo menos uma localizacao na planta.")
    ),
    medicoes: z.array(esquemaMedicao).optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.prazo && dados.data_planejada) {
      if (dados.data_planejada > dados.prazo) {
        ctx.addIssue({
          code: "custom",
          message: "A data planejada de inicio nao pode ser posterior ao prazo.",
          path: ["data_planejada"],
        });
      }
    }
    if (dados.data_inicio && dados.data_fim && dados.data_inicio > dados.data_fim) {
      ctx.addIssue({
        code: "custom",
        message: "A data de inicio nao pode ser posterior a data de fim.",
        path: ["data_inicio"],
      });
    }
  });

export async function criarTarefasEmLote(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para criar tarefas." };
  }

  const medicoesRaw = formData.get("medicoes");
  let medicoes: { catalogo_id: string; quantidade: number }[] = [];
  if (medicoesRaw) {
    try {
      medicoes = JSON.parse(String(medicoesRaw));
    } catch {
      medicoes = [];
    }
  }

  const bruto = {
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    obra_id: formData.get("obra_id"),
    responsavel_id: formData.get("responsavel_id"),
    executor_id: formData.get("executor_id"),
    supervisor_id: formData.get("supervisor_id"),
    status: formData.get("status"),
    prioridade: formData.get("prioridade"),
    tag_id: formData.get("tag_id"),
    prazo: formData.get("prazo"),
    data_planejada: formData.get("data_planejada"),
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim"),
    exige_foto: formData.get("exige_foto") === "on",
    exige_video: formData.get("exige_video") === "on",
    exige_arquivo: formData.get("exige_arquivo") === "on",
    lote_id: formData.get("lote_id"),
    localizacoes: formData.get("localizacoes"),
    medicoes,
  };

  const resultado = esquemaCriarLote.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const erroExecutor = await validarExecutorDaObra(
    resultado.data.executor_id,
    resultado.data.obra_id,
  );
  if (erroExecutor) return { erro: erroExecutor };

  const dados = resultado.data;
  const linhas = dados.localizacoes.map((localizacao) => ({
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    obra_id: dados.obra_id,
    responsavel_id: dados.responsavel_id || null,
    executor_id: dados.executor_id || null,
    supervisor_id: dados.supervisor_id || null,
    status: dados.status as StatusTarefa,
    prioridade: dados.prioridade as PrioridadeTarefa,
    tag_id: dados.tag_id || null,
    prazo: dados.prazo || null,
    data_planejada: dados.data_planejada || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_fim || null,
    exige_foto: dados.exige_foto ?? false,
    exige_video: dados.exige_video ?? false,
    exige_arquivo: dados.exige_arquivo ?? false,
    localizacao_tipo: localizacao.localizacao_tipo as TipoLocalizacao,
    planta_id: localizacao.planta_id,
    pagina: localizacao.pagina,
    ponto_x:
      localizacao.localizacao_tipo === "ponto"
        ? (localizacao.ponto_x ?? null)
        : null,
    ponto_y:
      localizacao.localizacao_tipo === "ponto"
        ? (localizacao.ponto_y ?? null)
        : null,
    regiao:
      localizacao.localizacao_tipo === "regiao" ? localizacao.regiao : null,
    criado_por: user.id,
  }));

  const { data, error } = await supabase
    .from("tarefas")
    .insert(linhas)
    .select("id, responsavel_id");

  if (error || !data) {
    return {
      erro: "Nao foi possivel criar as tarefas. Tente novamente.",
    };
  }

  // Inserir medicoes em lote para todas as tarefas criadas.
  if (resultado.data.medicoes && resultado.data.medicoes.length > 0) {
    const medicoesInsert = data.flatMap((tarefa) =>
      resultado.data.medicoes!.map((m) => ({
        tarefa_id: tarefa.id,
        catalogo_id: m.catalogo_id,
        quantidade: m.quantidade,
        criado_por: user.id,
      }))
    );

    const { error: erroMedicoes } = await supabase
      .from("tarefa_medicoes")
      .insert(medicoesInsert);

    if (erroMedicoes) {
      console.error("[tarefas] falha ao inserir medicoes em lote:", erroMedicoes);
      // Nao derruba a criacao das tarefas, apenas loga o erro
    }
  }

  const primeiros = new Map<string, string>();
  for (const linha of data) {
    if (linha.responsavel_id && !primeiros.has(linha.responsavel_id)) {
      primeiros.set(linha.responsavel_id, linha.id);
    }
  }

  // Notifica cada responsavel apenas uma vez, usando a primeira tarefa do lote.
  for (const [responsavelId, tarefaId] of primeiros) {
    await enviarNotificacao(tarefaId, responsavelId, {
      titulo: dados.titulo,
      descricao: dados.descricao,
      obra_id: dados.obra_id,
      prazo: dados.prazo,
      prioridade: dados.prioridade as PrioridadeTarefa,
    });
  }

  const obraId = dados.obra_id;
  const plantaId = dados.localizacoes[0]?.planta_id;

  // Consome o rascunho do lote apos criar as tarefas.
  if (dados.lote_id) {
    await supabase
      .from("lote_rascunhos")
      .delete()
      .eq("id", dados.lote_id)
      .eq("criado_por", user.id);
  }

  revalidatePath("/tarefas");
  revalidatePath("/painel");
  if (plantaId) revalidatePath(`/obras/${obraId}/plantas/${plantaId}`);
  redirect(`/obras/${obraId}/plantas/${plantaId}`);
}

const esquemaAssociar = z.object({
  localizacao_tipo: z.enum(["ponto", "regiao"]),
  planta_id: z.string().uuid(),
  pagina: z.coerce.number().int().positive(),
  ponto_x: z.coerce.number().nullable().optional(),
  ponto_y: z.coerce.number().nullable().optional(),
  regiao: z
    .object({
      vertices: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(3, "A regiao precisa de pelo menos 3 vertices."),
    })
    .nullable()
    .optional(),
});

export async function associarLocalizacao(
  tarefaId: string,
  dados: z.infer<typeof esquemaAssociar>,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const { tarefa, podeEscrever } = await carregarTarefaComPermissao(tarefaId);
  if (!tarefa) return { erro: "Tarefa nao encontrada." };
  if (!podeEscrever) {
    return { erro: "Voce nao tem permissao para editar a localizacao desta tarefa." };
  }

  const resultado = esquemaAssociar.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Localizacao invalida." };
  }

  const { localizacao_tipo, planta_id, pagina, ponto_x, ponto_y, regiao } =
    resultado.data;

  const supabase = await createClient();

  const { data: planta } = await supabase
    .from("plantas")
    .select("obra_id")
    .eq("id", planta_id)
    .maybeSingle();
  if (!planta) {
    return { erro: "Planta nao encontrada." };
  }

  if (tarefa.obra_id !== planta.obra_id) {
    return {
      erro: "Tarefa e planta precisam pertencer a mesma obra.",
    };
  }

  const atualizacao =
    localizacao_tipo === "ponto"
      ? {
          localizacao_tipo: "ponto" as const,
          planta_id,
          pagina,
          ponto_x: ponto_x ?? null,
          ponto_y: ponto_y ?? null,
          regiao: null,
        }
      : {
          localizacao_tipo: "regiao" as const,
          planta_id,
          pagina,
          ponto_x: null,
          ponto_y: null,
          regiao: regiao ?? null,
        };

  const { error } = await supabase.from("tarefas").update(atualizacao).eq("id", tarefaId);

  if (error) {
    return { erro: "Nao foi possivel salvar a localizacao. Tente novamente." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  if (tarefa.obra_id) {
    revalidatePath(`/obras/${tarefa.obra_id}`);
    revalidatePath(`/obras/${tarefa.obra_id}/plantas/${planta_id}`);
  }
  return {};
}

export async function atualizarTarefasEmLote(
  ids: string[],
  formData: FormData,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  if (ids.length === 0) return { erro: "Nenhuma tarefa selecionada." };

  const papel = await papelDoUsuario(user.id);
  const gestor = eGestor(papel);

  let idsPermitidos = ids;
  if (!gestor) {
    // Colaborador so pode editar suas proprias tarefas
    const supabase = await createClient();
    const { data } = await supabase
      .from("tarefas")
      .select("id")
      .in("id", ids)
      .eq("responsavel_id", user.id);
    idsPermitidos = (data ?? []).map((t) => t.id);
    
    if (idsPermitidos.length === 0) {
      return { erro: "Voce nao tem permissao para editar as tarefas selecionadas." };
    }
  }

  const updates: Atualizacao<"tarefas"> = {};
  
  const titulo = formData.get("titulo");
  if (titulo && String(titulo).trim()) updates.titulo = String(titulo).trim();
  
  const status = formData.get("status") ? (String(formData.get("status")) as StatusTarefa) : null;
  if (status) {
    updates.status = status;
    if (status !== "concluido") {
      updates.aprovacao = "pendente";
      updates.avaliado_por = null;
      updates.avaliado_em = null;
      updates.motivo_reprovacao = null;
    }
  }
  
  const prioridade = formData.get("prioridade")
    ? (String(formData.get("prioridade")) as PrioridadeTarefa)
    : null;
  if (prioridade) updates.prioridade = prioridade;
  
  const responsavel_id = formData.get("responsavel_id") ? String(formData.get("responsavel_id")) : null;
  if (responsavel_id) updates.responsavel_id = responsavel_id === "remover" ? null : responsavel_id;
  
  const executor_id = formData.get("executor_id") ? String(formData.get("executor_id")) : null;
  if (executor_id) updates.executor_id = executor_id === "remover" ? null : executor_id;
  
  const supervisor_id = formData.get("supervisor_id") ? String(formData.get("supervisor_id")) : null;
  if (supervisor_id) updates.supervisor_id = supervisor_id === "remover" ? null : supervisor_id;
  
  const tag_id = formData.get("tag_id") ? String(formData.get("tag_id")) : null;
  if (tag_id) updates.tag_id = tag_id === "remover" ? null : tag_id;
  
  const prazo = formData.get("prazo") ? String(formData.get("prazo")) : null;
  if (prazo) updates.prazo = prazo;
  
  const data_planejada = formData.get("data_planejada") ? String(formData.get("data_planejada")) : null;
  if (data_planejada) updates.data_planejada = data_planejada;

  const data_inicio = formData.get("data_inicio") ? String(formData.get("data_inicio")) : null;
  if (data_inicio) updates.data_inicio = data_inicio;

  const data_fim = formData.get("data_fim") ? String(formData.get("data_fim")) : null;
  if (data_fim) updates.data_fim = data_fim;

  const medicoesRaw = formData.get("medicoes");
  let medicoes: { catalogo_id: string; quantidade: number }[] = [];
  if (medicoesRaw) {
    try {
      medicoes = JSON.parse(String(medicoesRaw));
    } catch {
      medicoes = [];
    }
  }

  if (Object.keys(updates).length === 0 && medicoes.length === 0) {
    return { erro: "Nenhuma alteracao informada." };
  }

  const supabaseAdmin = await createAdminClient();
  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from("tarefas")
      .update(updates)
      .in("id", idsPermitidos);

    if (error) {
      console.error("[tarefas] erro ao atualizar em lote:", error);
      return { erro: "Falha ao atualizar as tarefas." };
    }
  }

  if (medicoesRaw !== null) {
    const { error: erroDeleteMedicoes } = await supabaseAdmin
      .from("tarefa_medicoes")
      .delete()
      .in("tarefa_id", idsPermitidos);

    if (erroDeleteMedicoes) {
      console.error("[tarefas] falha ao deletar medições antigas:", erroDeleteMedicoes);
    }

    if (medicoes.length > 0) {
      const medicoesInsert = idsPermitidos.flatMap((tarefaId) =>
        medicoes.map((m) => ({
          tarefa_id: tarefaId,
          catalogo_id: m.catalogo_id,
          quantidade: m.quantidade,
          criado_por: user.id,
        }))
      );

      const { error: erroMedicoes } = await supabaseAdmin
        .from("tarefa_medicoes")
        .insert(medicoesInsert);

      if (erroMedicoes) {
        console.error("[tarefas] falha ao inserir medições em lote:", erroMedicoes);
      }
    }
  }

  revalidatePath("/tarefas");
  revalidatePath("/painel");
  return {};
}

export async function atualizarTarefa(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Tarefa invalida." };

  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const { tarefa, podeEscrever } = await carregarTarefaComPermissao(id);
  if (!tarefa) return { erro: "Tarefa nao encontrada." };
  if (!podeEscrever) {
    return { erro: "Voce nao tem permissao para editar esta tarefa." };
  }

  const medicoesRaw = formData.get("medicoes");
  let medicoes: { catalogo_id: string; quantidade: number }[] = [];
  if (medicoesRaw) {
    try {
      medicoes = JSON.parse(String(medicoesRaw));
    } catch {
      medicoes = [];
    }
  }

  const bruto = {
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    obra_id: formData.get("obra_id"),
    responsavel_id: formData.get("responsavel_id"),
    executor_id: formData.get("executor_id"),
    supervisor_id: formData.get("supervisor_id"),
    status: formData.get("status"),
    prioridade: formData.get("prioridade"),
    tag_id: formData.get("tag_id"),
    prazo: formData.get("prazo"),
    data_planejada: formData.get("data_planejada"),
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim"),
    exige_foto: formData.get("exige_foto") === "on",
    exige_video: formData.get("exige_video") === "on",
    exige_arquivo: formData.get("exige_arquivo") === "on",
    localizacao_tipo: formData.get("localizacao_tipo"),
    planta_id: formData.get("planta_id"),
    pagina: formData.get("pagina"),
    ponto_x: formData.get("ponto_x"),
    ponto_y: formData.get("ponto_y"),
    regiao: formData.get("regiao"),
    medicoes,
  };

  const resultado = esquemaTarefa.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const erroExecutor = await validarExecutorDaObra(
    resultado.data.executor_id,
    resultado.data.obra_id,
  );
  if (erroExecutor) return { erro: erroExecutor };

  const dadosNormalizados = normalizar(resultado.data);
  const dadosAtualizacao: Atualizacao<"tarefas"> = { ...dadosNormalizados };
  if (resultado.data.status !== "concluido" && tarefa.aprovacao !== "pendente") {
    dadosAtualizacao.aprovacao = "pendente";
    dadosAtualizacao.avaliado_por = null;
    dadosAtualizacao.avaliado_em = null;
    dadosAtualizacao.motivo_reprovacao = null;
  }

  const { error } = await supabase
    .from("tarefas")
    .update(dadosAtualizacao)
    .eq("id", id);

  if (error) {
    return { erro: "Nao foi possivel salvar a tarefa. Tente novamente." };
  }

  // Atualizar medicoes: deletar existentes e inserir novas
  const { error: erroDeleteMedicoes } = await supabase
    .from("tarefa_medicoes")
    .delete()
    .eq("tarefa_id", id);

  if (erroDeleteMedicoes) {
    console.error("[tarefas] falha ao deletar medicoes antigas:", erroDeleteMedicoes);
  }

  if (resultado.data.medicoes && resultado.data.medicoes.length > 0) {
    const medicoesInsert = resultado.data.medicoes.map((m) => ({
      tarefa_id: id,
      catalogo_id: m.catalogo_id,
      quantidade: m.quantidade,
      criado_por: user.id,
    }));

    const { error: erroMedicoes } = await supabase
      .from("tarefa_medicoes")
      .insert(medicoesInsert);

    if (erroMedicoes) {
      console.error("[tarefas] falha ao inserir medicoes:", erroMedicoes);
    }
  }

  const novoResponsavel = resultado.data.responsavel_id;
  if (novoResponsavel && novoResponsavel !== tarefa.responsavel_id) {
    await enviarNotificacao(id, novoResponsavel, resultado.data);
  }
  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${id}`);
  revalidatePath("/painel");
  redirect(`/tarefas/${id}`);
}

function requisitosFaltantes(
  tarefa: TarefaRow,
  anexos: { tipo: TipoAnexo }[],
): string[] {
  const tiposPresentes = new Set(anexos.map((a) => a.tipo));
  const faltando: string[] = [];
  if (tarefa.exige_foto && !tiposPresentes.has("imagem")) {
    faltando.push("uma foto");
  }
  if (tarefa.exige_video && !tiposPresentes.has("video")) {
    faltando.push("um video");
  }
  if (tarefa.exige_arquivo && !tiposPresentes.has("arquivo")) {
    faltando.push("um arquivo");
  }
  return faltando;
}

export async function alterarStatus(
  tarefaId: string,
  novoStatus: StatusTarefa,
): Promise<Resultado> {
  const { tarefa, podeEscrever } = await carregarTarefaComPermissao(tarefaId);
  if (!tarefa) return { erro: "Tarefa nao encontrada." };
  if (!podeEscrever) {
    return { erro: "Voce nao tem permissao para alterar esta tarefa." };
  }

  const statusValido: StatusTarefa[] = ["pendente", "em_execucao", "concluido"];
  if (!statusValido.includes(novoStatus)) {
    return { erro: "Status invalido." };
  }

  // Gate de conclusao: exige a comprovacao cadastrada antes de concluir.
  if (novoStatus === "concluido" && tarefa.status !== "concluido") {
    const supabase = await createClient();
    const { data: anexos } = await supabase
      .from("tarefa_anexos")
      .select("tipo")
      .eq("tarefa_id", tarefaId);

    const faltando = requisitosFaltantes(tarefa, (anexos ?? []) as { tipo: TipoAnexo }[]);
    if (faltando.length > 0) {
      return {
        erro: `Para concluir esta tarefa e obrigatorio anexar ${faltando.join(", ")}.`,
      };
    }
  }

  const supabase = await createClient();
  const dadosUpdate: {
    status: StatusTarefa;
    aprovacao?: AprovacaoTarefa;
    avaliado_por?: string | null;
    avaliado_em?: string | null;
    motivo_reprovacao?: string | null;
  } = { status: novoStatus };

  if (novoStatus !== "concluido" && tarefa.aprovacao !== "pendente") {
    dadosUpdate.aprovacao = "pendente";
    dadosUpdate.avaliado_por = null;
    dadosUpdate.avaliado_em = null;
    dadosUpdate.motivo_reprovacao = null;
  }

  const { error } = await supabase
    .from("tarefas")
    .update(dadosUpdate)
    .eq("id", tarefaId);

  if (error) {
    return { erro: "Nao foi possivel alterar o status. Tente novamente." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  revalidatePath("/calendario");
  if (tarefa.obra_id) {
    revalidatePath(`/obras/${tarefa.obra_id}`);
    if (tarefa.planta_id) {
      revalidatePath(`/obras/${tarefa.obra_id}/plantas/${tarefa.planta_id}`);
    }
  }
  return {};
}

export async function avaliarTarefa(
  tarefaId: string,
  decisao: "aprovado" | "reprovado",
  motivo?: string,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .eq("id", tarefaId)
    .single();
  const tarefa = data as TarefaRow | null;
  if (!tarefa) return { erro: "Tarefa nao encontrada." };

  if (tarefa.supervisor_id !== user.id) {
    return { erro: "Voce nao tem permissao para avaliar esta tarefa." };
  }

  if (tarefa.status !== "concluido") {
    return { erro: "Somente tarefas concluidas podem ser avaliadas." };
  }
  // Reprovada e refeita volta a ser avaliavel; so a aprovacao e terminal.
  if (tarefa.aprovacao === "aprovado") {
    return { erro: "Esta tarefa ja foi aprovada." };
  }
  if (decisao !== "aprovado" && decisao !== "reprovado") {
    return { erro: "Decisao invalida." };
  }

  const motivoLimpo = motivo?.trim() ?? "";
  if (decisao === "reprovado" && !motivoLimpo) {
    return { erro: "Informe o motivo da reprovacao." };
  }

  // RLS em `tarefas` so permite escrita a gestores e ao responsavel. Um
  // supervisor colaborador nao pode atualizar a linha pelo client normal;
  // a permissao ja foi conferida acima, entao o UPDATE passa pelo client
  // admin (bypassa RLS) de forma deliberada.
  const admin = createAdminClient();
  const atualizacao: {
    aprovacao: AprovacaoTarefa;
    avaliado_por: string;
    avaliado_em: string;
    motivo_reprovacao: string | null;
    status?: StatusTarefa;
  } =
    decisao === "aprovado"
      ? {
          aprovacao: "aprovado",
          avaliado_por: user.id,
          avaliado_em: new Date().toISOString(),
          motivo_reprovacao: null,
        }
      : {
          aprovacao: "reprovado",
          avaliado_por: user.id,
          avaliado_em: new Date().toISOString(),
          motivo_reprovacao: motivoLimpo,
          status: "em_execucao",
        };

  const { error: erroTarefa } = await admin
    .from("tarefas")
    .update(atualizacao)
    .eq("id", tarefaId);
  if (erroTarefa) {
    return { erro: "Nao foi possivel registrar a avaliacao. Tente novamente." };
  }

  const { error: erroHistorico } = await admin
    .from("tarefa_aprovacoes")
    .insert({
      tarefa_id: tarefaId,
      supervisor_id: user.id,
      decisao,
      motivo: decisao === "reprovado" ? motivoLimpo : null,
    });
  if (erroHistorico) {
    return { erro: "Nao foi possivel registrar o historico da avaliacao." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  return {};
}

export async function reverterAprovacao(
  tarefaId: string,
  motivo?: string,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .eq("id", tarefaId)
    .single();
  const tarefa = data as TarefaRow | null;
  if (!tarefa) return { erro: "Tarefa nao encontrada." };

  const papel = await papelDoUsuario(user.id);
  if (tarefa.supervisor_id !== user.id && !eGestor(papel)) {
    return { erro: "Voce nao tem permissao para reverter esta aprovacao." };
  }

  if (tarefa.aprovacao !== "aprovado") {
    return { erro: "Somente tarefas aprovadas podem ser revertidas." };
  }

  const motivoLimpo = motivo?.trim() ?? "";

  // RLS em `tarefas` so permite escrita a gestores e ao responsavel. Um
  // supervisor colaborador nao pode atualizar a linha pelo client normal;
  // a permissao ja foi conferida acima, entao o UPDATE passa pelo client
  // admin (bypassa RLS) de forma deliberada.
  const admin = createAdminClient();
  const { error: erroTarefa } = await admin
    .from("tarefas")
    .update({
      aprovacao: "pendente",
      avaliado_por: null,
      avaliado_em: null,
      motivo_reprovacao: null,
    })
    .eq("id", tarefaId);
  if (erroTarefa) {
    return { erro: "Nao foi possivel reverter a aprovacao. Tente novamente." };
  }

  const { error: erroHistorico } = await admin
    .from("tarefa_aprovacoes")
    .insert({
      tarefa_id: tarefaId,
      supervisor_id: user.id,
      decisao: "pendente",
      motivo: motivoLimpo || null,
    });
  if (erroHistorico) {
    return { erro: "Nao foi possivel registrar a reversao da aprovacao." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  return {};
}

export async function duplicarTarefa(
  tarefaId: string,
): Promise<Resultado & { id?: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para duplicar tarefas." };
  }

  if (!tarefaId) return { erro: "Tarefa invalida." };

  const supabase = await createClient();
  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("*")
    .eq("id", tarefaId)
    .single();

  if (!tarefa) return { erro: "Tarefa nao encontrada." };

  // Duplica como tarefa de mesmo tipo: status e aprovacao voltam a pendente e
  // timestamps de conclusao/avaliacao nao sao copiados.
  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      titulo: `${tarefa.titulo} (copia)`,
      descricao: tarefa.descricao,
      obra_id: tarefa.obra_id,
      responsavel_id: tarefa.responsavel_id,
      executor_id: tarefa.executor_id,
      supervisor_id: tarefa.supervisor_id,
      status: "pendente",
      prioridade: tarefa.prioridade,
      tag_id: tarefa.tag_id,
      prazo: tarefa.prazo,
      data_planejada: tarefa.data_planejada,
      exige_foto: tarefa.exige_foto,
      exige_video: tarefa.exige_video,
      exige_arquivo: tarefa.exige_arquivo,
      localizacao_tipo: tarefa.localizacao_tipo,
      planta_id: tarefa.planta_id,
      pagina: tarefa.pagina,
      ponto_x: tarefa.ponto_x,
      ponto_y: tarefa.ponto_y,
      regiao: tarefa.regiao,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel duplicar a tarefa. Tente novamente." };
  }

  if (tarefa.responsavel_id) {
    await enviarNotificacao(data.id, tarefa.responsavel_id, {
      titulo: `${tarefa.titulo} (copia)`,
      descricao: tarefa.descricao,
      obra_id: tarefa.obra_id,
      prazo: tarefa.prazo,
      prioridade: tarefa.prioridade as PrioridadeTarefa,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath("/painel");
  return { id: data.id };
}

export async function excluirTarefa(tarefaId: string): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para excluir tarefas." };
  }

  if (!tarefaId) return { erro: "Tarefa invalida." };

  const supabase = await createClient();
  const { data: anexos } = await supabase
    .from("tarefa_anexos")
    .select("caminho")
    .eq("tarefa_id", tarefaId);

  for (const anexo of anexos ?? []) {
    try {
      await removerArquivo(BUCKET_ANEXOS, anexo.caminho);
    } catch (erro) {
      console.error("[tarefas] falha ao remover arquivo do storage:", erro);
    }
  }

  const { error } = await supabase.from("tarefas").delete().eq("id", tarefaId);
  if (error) {
    return { erro: "Nao foi possivel excluir a tarefa. Tente novamente." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  return {};
}

const esquemaComentario = z.object({
  texto: z.string().trim().min(1, "Escreva um comentario.").max(2000),
});

export async function adicionarComentario(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const tarefaId = String(formData.get("tarefa_id") ?? "");
  const texto = String(formData.get("texto") ?? "");

  const resultado = esquemaComentario.safeParse({ texto });
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Comentario invalido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tarefa_comentarios").insert({
    tarefa_id: tarefaId,
    autor_id: user.id,
    texto: resultado.data.texto,
  });

  if (error) {
    return { erro: "Nao foi possivel adicionar o comentario. Tente novamente." };
  }

  revalidatePath(`/tarefas/${tarefaId}`);
  return {};
}

export async function excluirComentario(
  comentarioId: string,
  tarefaId: string,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  const podeExcluir = papel === "admin";

  const supabase = await createClient();
  let query = supabase.from("tarefa_comentarios").delete().eq("id", comentarioId);
  if (!podeExcluir) {
    query = query.eq("autor_id", user.id);
  }

  const { error } = await query;
  if (error) {
    return { erro: "Nao foi possivel excluir o comentario. Tente novamente." };
  }

  revalidatePath(`/tarefas/${tarefaId}`);
  return {};
}

const esquemaAssinar = z.object({
  tarefaId: z.string().uuid(),
  nomeArquivo: z.string().trim().min(1).max(200),
});

export async function assinarUploadAnexo(
  tarefaId: string,
  nomeArquivo: string,
): Promise<{ url?: string; caminho?: string; erro?: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const resultado = esquemaAssinar.safeParse({ tarefaId, nomeArquivo });
  if (!resultado.success) {
    return { erro: "Arquivo invalido." };
  }

  // O upload nunca passa pela funcao serverless (limite de 4,5 MB na Vercel):
  // apenas assinamos a URL e o navegador envia os bytes direto ao Storage.
  try {
    const caminho = `tarefas/${resultado.data.tarefaId}/${crypto.randomUUID()}-${resultado.data.nomeArquivo}`;
    const assinatura = await assinarUpload(BUCKET_ANEXOS, caminho);
    return { url: assinatura.url, caminho: assinatura.caminho };
  } catch (erro) {
    console.error("[tarefas] falha ao assinar upload:", erro);
    return { erro: "Nao foi possivel preparar o upload. Tente novamente." };
  }
}

const esquemaRegistrar = z.object({
  tarefaId: z.string().uuid(),
  tipo: z.enum(["imagem", "video", "arquivo"]),
  momento: z.enum(["criacao", "andamento", "conclusao"]),
  caminho: z.string().trim().min(1),
  nomeArquivo: z.string().trim().min(1).max(200),
  mime: z.string().trim().max(200).nullable().optional(),
  tamanhoBytes: z.number().int().nonnegative().nullable().optional(),
});

export async function registrarAnexo(
  dados: z.infer<typeof esquemaRegistrar>,
): Promise<{ id?: string; erro?: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const resultado = esquemaRegistrar.safeParse(dados);
  if (!resultado.success) {
    return { erro: "Dados do anexo invalidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarefa_anexos")
    .insert({
      tarefa_id: resultado.data.tarefaId,
      tipo: resultado.data.tipo as TipoAnexo,
      momento: resultado.data.momento as MomentoAnexo,
      caminho: resultado.data.caminho,
      nome_arquivo: resultado.data.nomeArquivo,
      mime: resultado.data.mime ?? null,
      tamanho_bytes: resultado.data.tamanhoBytes ?? null,
      enviado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel registrar o anexo. Tente novamente." };
  }

  revalidatePath(`/tarefas/${resultado.data.tarefaId}`);
  return { id: data.id };
}

export async function excluirAnexo(
  anexoId: string,
  tarefaId: string,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const { tarefa, podeEscrever } = await carregarTarefaComPermissao(tarefaId);
  if (!tarefa) return { erro: "Tarefa nao encontrada." };

  const papel = await papelDoUsuario(user.id);
  const supabase = await createClient();
  const { data: anexo } = await supabase
    .from("tarefa_anexos")
    .select("*")
    .eq("id", anexoId)
    .eq("tarefa_id", tarefaId)
    .maybeSingle();

  if (!anexo) {
    return { erro: "Anexo nao encontrado." };
  }

  const autorizado = eGestor(papel) || podeEscrever || anexo.enviado_por === user.id;
  if (!autorizado) {
    return { erro: "Voce nao tem permissao para excluir este anexo." };
  }

  // Remove o objeto do Storage e depois a linha do banco.
  try {
    await removerArquivo(BUCKET_ANEXOS, anexo.caminho);
  } catch (erro) {
    console.error("[tarefas] falha ao remover arquivo do storage:", erro);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("tarefa_anexos").delete().eq("id", anexoId);
  if (error) {
    return { erro: "Nao foi possivel excluir o anexo. Tente novamente." };
  }

  // Tarefa que exige foto e foi aprovada: se nao restar nenhuma imagem, a
  // aprovacao e revertida para pendente (exige nova aprovacao) e o evento
  // fica registrado no historico de aprovacoes.
  if (
    anexo.tipo === "imagem" &&
    tarefa.exige_foto &&
    tarefa.aprovacao === "aprovado"
  ) {
    const { data: restantes } = await admin
      .from("tarefa_anexos")
      .select("id")
      .eq("tarefa_id", tarefaId)
      .eq("tipo", "imagem");

    if (!restantes || restantes.length === 0) {
      const { error: erroTarefa } = await admin
        .from("tarefas")
        .update({
          aprovacao: "pendente",
          avaliado_por: null,
          avaliado_em: null,
          motivo_reprovacao: null,
        })
        .eq("id", tarefaId);
      if (!erroTarefa) {
        await admin.from("tarefa_aprovacoes").insert({
          tarefa_id: tarefaId,
          supervisor_id: user.id,
          decisao: "pendente",
        });
      }
    }
  }

  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/tarefas");
  return {};
}

const esquemaRascunhoLote = z.object({
  obra_id: z.string().uuid(),
  planta_id: z.string().uuid(),
  pagina: z.coerce.number().int().positive(),
  localizacoes: z
    .array(esquemaLocalizacaoLote)
    .min(1, "Adicione pelo menos uma localizacao na planta."),
});

export async function salvarRascunhoLote(
  dados: unknown,
): Promise<{ id: string } | { erro: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para criar tarefas." };
  }

  const resultado = esquemaRascunhoLote.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lote_rascunhos")
    .insert({
      criado_por: user.id,
      obra_id: resultado.data.obra_id,
      planta_id: resultado.data.planta_id,
      pagina: resultado.data.pagina,
      localizacoes: resultado.data.localizacoes,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel salvar o lote. Tente novamente." };
  }

  // Limpeza lazy: rascunhos abandonados do proprio usuario, exceto o criado
  // agora. Nunca deixa uma falha de limpeza derrubar o salvamento.
  try {
    const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("lote_rascunhos")
      .delete()
      .eq("criado_por", user.id)
      .lt("criado_em", limite)
      .neq("id", data.id);
  } catch (erro) {
    console.error("[tarefas] falha ao limpar rascunhos antigos:", erro);
  }

  return { id: data.id };
}

export async function listarTags(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags_tarefa")
    .select("id, nome")
    .order("nome");
  return data ?? [];
}

export async function criarTag(nome: string): Promise<{ id: string; nome: string } | { erro: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const schema = z.string().trim().min(1, "O nome da tag é obrigatório.").max(60, "O nome da tag é muito longo.");
  const resultado = schema.safeParse(nome);
  
  if (!resultado.success) {
    return { erro: resultado.error.issues[0].message };
  }

  const supabase = await createClient();
  const nomeValidado = resultado.data;

  const { data, error } = await supabase
    .from("tags_tarefa")
    .insert({ nome: nomeValidado, criado_por: user.id })
    .select("id, nome")
    .single();

  if (error) {
    if (error.code === "23505") { // unique_violation
      return { erro: "Esta tag já existe." };
    }
    return { erro: "Falha ao criar tag." };
  }

  return { id: data.id, nome: data.nome };
}

export async function excluirTag(tagId: string): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Apenas administradores e gestores podem remover tags globais." };
  }

  const supabaseAdmin = await createAdminClient();
  const { error } = await supabaseAdmin.from("tags_tarefa").delete().eq("id", tagId);

  if (error) {
    console.error("[tags] falha ao excluir tag:", error);
    return { erro: "Falha ao excluir a tag. Pode estar em uso." };
  }

  revalidatePath("/tarefas");
  return {};
}
