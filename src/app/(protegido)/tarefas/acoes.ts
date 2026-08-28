"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notificarResponsavel } from "@/lib/email";
import { assinarUpload, removerArquivo, BUCKET_ANEXOS } from "@/lib/armazenamento";
import type {
  MomentoAnexo,
  PrioridadeTarefa,
  StatusTarefa,
  TarefaRow,
  TipoAnexo,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";

type Resultado = { erro?: string };

const esquemaLocalizacao = z
  .object({
    localizacao_tipo: z.enum(["nenhuma", "ponto", "regiao"]),
    planta_id: z.string().uuid().nullable().optional(),
    pagina: z.coerce.number().int().positive().nullable().optional(),
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
  status: z.enum(["pendente", "em_execucao", "concluido"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  prazo: z.string().optional().or(z.literal("")),
  data_planejada: z.string().optional().or(z.literal("")),
  exige_foto: z.boolean().optional(),
  exige_video: z.boolean().optional(),
  exige_arquivo: z.boolean().optional(),
  ...esquemaLocalizacao.shape,
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
    status: dados.status as StatusTarefa,
    prioridade: dados.prioridade as PrioridadeTarefa,
    prazo: dados.prazo || null,
    data_planejada: dados.data_planejada || null,
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

async function enviarNotificacao(
  tarefaId: string,
  responsavelId: string,
  dados: DadosTarefa,
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

  const bruto = {
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    obra_id: formData.get("obra_id"),
    responsavel_id: formData.get("responsavel_id"),
    status: formData.get("status"),
    prioridade: formData.get("prioridade"),
    prazo: formData.get("prazo"),
    data_planejada: formData.get("data_planejada"),
    exige_foto: formData.get("exige_foto") === "on",
    exige_video: formData.get("exige_video") === "on",
    exige_arquivo: formData.get("exige_arquivo") === "on",
    localizacao_tipo: formData.get("localizacao_tipo"),
    planta_id: formData.get("planta_id"),
    pagina: formData.get("pagina"),
    ponto_x: formData.get("ponto_x"),
    ponto_y: formData.get("ponto_y"),
    regiao: formData.get("regiao"),
  };

  const resultado = esquemaTarefa.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarefas")
    .insert({ ...normalizar(resultado.data), criado_por: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { erro: "Nao foi possivel criar a tarefa. Tente novamente." };
  }

  if (resultado.data.responsavel_id) {
    await enviarNotificacao(data.id, resultado.data.responsavel_id, resultado.data);
  }

  revalidatePath("/tarefas");
  revalidatePath("/painel");
  redirect(`/tarefas/${data.id}`);
}

export async function atualizarTarefa(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Tarefa invalida." };

  const { tarefa, podeEscrever } = await carregarTarefaComPermissao(id);
  if (!tarefa) return { erro: "Tarefa nao encontrada." };
  if (!podeEscrever) {
    return { erro: "Voce nao tem permissao para editar esta tarefa." };
  }

  const bruto = {
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    obra_id: formData.get("obra_id"),
    responsavel_id: formData.get("responsavel_id"),
    status: formData.get("status"),
    prioridade: formData.get("prioridade"),
    prazo: formData.get("prazo"),
    data_planejada: formData.get("data_planejada"),
    exige_foto: formData.get("exige_foto") === "on",
    exige_video: formData.get("exige_video") === "on",
    exige_arquivo: formData.get("exige_arquivo") === "on",
    localizacao_tipo: formData.get("localizacao_tipo"),
    planta_id: formData.get("planta_id"),
    pagina: formData.get("pagina"),
    ponto_x: formData.get("ponto_x"),
    ponto_y: formData.get("ponto_y"),
    regiao: formData.get("regiao"),
  };

  const resultado = esquemaTarefa.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tarefas")
    .update(normalizar(resultado.data))
    .eq("id", id);

  if (error) {
    return { erro: "Nao foi possivel salvar a tarefa. Tente novamente." };
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
  const { error } = await supabase
    .from("tarefas")
    .update({ status: novoStatus })
    .eq("id", tarefaId);

  if (error) {
    return { erro: "Nao foi possivel alterar o status. Tente novamente." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath("/painel");
  return {};
}

export async function excluirTarefa(
  _estadoAnterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessao expirada. Entre novamente." };

  const papel = await papelDoUsuario(user.id);
  if (!eGestor(papel)) {
    return { erro: "Voce nao tem permissao para excluir tarefas." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Tarefa invalida." };

  const supabase = await createClient();
  const { error } = await supabase.from("tarefas").delete().eq("id", id);

  if (error) {
    return { erro: "Nao foi possivel excluir a tarefa. Tente novamente." };
  }

  revalidatePath("/tarefas");
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

  const papel = await papelDoUsuario(user.id);
  const podeExcluir = eGestor(papel);

  const supabase = await createClient();
  let query = supabase.from("tarefa_anexos").select("*").eq("id", anexoId);
  if (!podeExcluir) {
    query = query.eq("enviado_por", user.id);
  }
  const { data: anexo } = await query.single();

  if (!anexo) {
    return { erro: "Anexo nao encontrado ou sem permissao." };
  }

  // Remove o objeto do Storage e depois a linha do banco.
  try {
    await removerArquivo(BUCKET_ANEXOS, anexo.caminho);
  } catch (erro) {
    console.error("[tarefas] falha ao remover arquivo do storage:", erro);
  }

  const { error } = await supabase.from("tarefa_anexos").delete().eq("id", anexoId);
  if (error) {
    return { erro: "Nao foi possivel excluir o anexo. Tente novamente." };
  }

  revalidatePath(`/tarefas/${tarefaId}`);
  return {};
}
