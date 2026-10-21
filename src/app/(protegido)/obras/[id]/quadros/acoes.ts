"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { gerarTemplatesPadrao } from "@/lib/quadros/calculos";
import type { CircuitoVinculado, QuadroTemplateItem } from "@/lib/quadros/tipos";
import type { Json } from "@/lib/supabase/database.types";

async function verificarGestor(): Promise<{ erro: string; usuarioId?: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erro: "Sessão expirada. Entre novamente." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor")) {
    return { erro: "Você não tem permissão para gerenciar quadros elétricos." };
  }

  return { erro: "", usuarioId: user.id };
}

const esquemaSalvarQuadro = z.object({
  id: z.string().uuid().optional(),
  obraId: z.string().uuid(),
  plantaId: z.string().uuid().nullable().optional(),
  tag: z.string().trim().min(1, "Informe a tag do quadro (ex: QDC-01).").max(50),
  nome: z.string().trim().max(150).nullable().optional(),
  tipoQuadro: z.string().default("QDC"),
  tensaoNominal: z.string().default("220/380V"),
  correnteNominal: z.number().int().positive().default(63),
  correnteCurtoKa: z.number().positive().default(10),
  grauProtecao: z.string().default("IP54"),
  materialCaixa: z.string().default("Aço tratado com pintura eletrostática"),
  larguraMm: z.number().positive().default(600),
  alturaMm: z.number().positive().default(800),
  profundidadeMm: z.number().positive().default(200),
  larguraUtilMm: z.number().positive().default(540),
  alturaUtilMm: z.number().positive().default(740),
  margemLateralMm: z.number().nonnegative().default(30),
  margemTopoMm: z.number().nonnegative().default(30),
  layout: z.any().superRefine((layout, contexto) => {
    if (layout === null || typeof layout !== "object") {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: "Layout inválido." });
      return;
    }
    if ("elementos" in layout && layout.elementos !== undefined && !Array.isArray(layout.elementos)) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: "Elementos do layout inválidos." });
    }
  }),
  circuitosVinculados: z.any().optional(),
  templateId: z.string().uuid().nullable().optional(),
  levantamentoId: z.string().uuid().nullable().optional(),
});

export async function salvarQuadroEletrico(
  dadosBrutos: z.infer<typeof esquemaSalvarQuadro>,
): Promise<{ id?: string; erro?: string }> {
  const auth = await verificarGestor();
  if (auth?.erro) return { erro: auth.erro };

  const parsed = esquemaSalvarQuadro.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const dados = parsed.data;
  const supabase = await createClient();

  const layout = dados.layout as { elementos?: unknown[] };
  const destinos = (layout.elementos ?? []).reduce<string[]>((ids, elemento: unknown) => {
    if (typeof elemento !== "object" || elemento === null || !("quadroDestinoId" in elemento)) return ids;
    const destinoId = elemento.quadroDestinoId;
    if (typeof destinoId === "string" && destinoId.length > 0 && !ids.includes(destinoId)) ids.push(destinoId);
    return ids;
  }, []);
  if (dados.id && destinos.includes(dados.id)) {
    return { erro: "Um quadro não pode apontar para ele mesmo." };
  }
  if (destinos.length > 0) {
    const { data: quadrosDestino, error: erroDestinos } = await supabase
      .from("quadros_eletricos")
      .select("id, obra_id")
      .in("id", destinos);
    if (erroDestinos) return { erro: erroDestinos.message };
    const destinosValidos = new Set((quadrosDestino ?? []).filter((destino) => destino.obra_id === dados.obraId).map((destino) => destino.id));
    if (destinosValidos.size !== destinos.length) {
      return { erro: "Um ou mais quadros de destino não pertencem a esta obra." };
    }
  }

  if (dados.id) {
    const { data: quadroOrigem, error: erroOrigem } = await supabase
      .from("quadros_eletricos")
      .select("id")
      .eq("id", dados.id)
      .eq("obra_id", dados.obraId)
      .single();
    if (erroOrigem || !quadroOrigem) return { erro: "O quadro informado não pertence a esta obra." };
  }

  const layoutRecebido = dados.layout as { elementos?: unknown[]; [chave: string]: unknown };
  const layoutNormalizado = {
    ...layoutRecebido,
    elementos: (layoutRecebido.elementos ?? []).map((elemento) => {
      if (typeof elemento !== "object" || elemento === null) return elemento;
      const registro = elemento as Record<string, unknown>;
      if (registro.circuitoReserva !== true) return elemento;
      return Object.fromEntries(Object.entries(registro).filter(([chave]) => ![
        "circuitoAssociadoId",
        "circuitoAssociadoNome",
        "quadroDestinoId",
        "quadroDestinoTag",
      ].includes(chave)));
    }),
  };

  const payload = {
    obra_id: dados.obraId,
    planta_id: dados.plantaId ?? null,
    tag: dados.tag,
    nome: dados.nome ?? null,
    tipo_quadro: dados.tipoQuadro,
    tensao_nominal: dados.tensaoNominal,
    corrente_nominal: dados.correnteNominal,
    corrente_curto_ka: dados.correnteCurtoKa,
    grau_protecao: dados.grauProtecao,
    material_caixa: dados.materialCaixa,
    largura_mm: dados.larguraMm,
    altura_mm: dados.alturaMm,
    profundidade_mm: dados.profundidadeMm,
    largura_util_mm: dados.larguraUtilMm,
    altura_util_mm: dados.alturaUtilMm,
    margem_lateral_mm: dados.margemLateralMm,
    margem_topo_mm: dados.margemTopoMm,
    layout: layoutNormalizado as Json,
    circuitos_vinculados: (dados.circuitosVinculados ?? []) as Json,
    template_id: dados.templateId ?? null,
    levantamento_id: dados.levantamentoId ?? null,
    criado_por: auth?.usuarioId ?? null,
  };

  if (dados.id) {
    const { error } = await supabase
      .from("quadros_eletricos")
      .update(payload)
      .eq("id", dados.id);

    if (error) return { erro: error.message };
    revalidatePath(`/obras/${dados.obraId}/quadros`);
    revalidatePath(`/obras/${dados.obraId}/quadros/${dados.id}`);
    revalidatePath(`/obras/${dados.obraId}`);
    return { id: dados.id };
  }

  const { data, error } = await supabase
    .from("quadros_eletricos")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) return { erro: error?.message ?? "Falha ao criar quadro." };

  revalidatePath(`/obras/${dados.obraId}/quadros`);
  revalidatePath(`/obras/${dados.obraId}`);
  return { id: data.id };
}

export async function excluirQuadroEletrico(
  id: string,
  obraId: string,
): Promise<{ ok?: boolean; erro?: string }> {
  const auth = await verificarGestor();
  if (auth?.erro) return { erro: auth.erro };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quadros_eletricos")
    .delete()
    .eq("id", id)
    .eq("obra_id", obraId);

  if (error) return { erro: error.message };

  revalidatePath(`/obras/${obraId}/quadros`);
  revalidatePath(`/obras/${obraId}`);
  return { ok: true };
}

const esquemaSalvarTemplate = z.object({
  quadroId: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome do template.").max(120),
  descricao: z.string().trim().max(300).nullable().optional(),
});

export async function salvarQuadroComoTemplate(
  dadosBrutos: z.infer<typeof esquemaSalvarTemplate>,
): Promise<{ id?: string; erro?: string }> {
  const auth = await verificarGestor();
  if (auth?.erro) return { erro: auth.erro };

  const parsed = esquemaSalvarTemplate.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { quadroId, nome, descricao } = parsed.data;
  const supabase = await createClient();

  const { data: quadro, error: errQuadro } = await supabase
    .from("quadros_eletricos")
    .select("*")
    .eq("id", quadroId)
    .single();

  if (errQuadro || !quadro) {
    return { erro: "Quadro não encontrado para salvar como template." };
  }

  const { data: novoTemplate, error: errTemplate } = await supabase
    .from("quadro_templates")
    .insert({
      nome,
      descricao: descricao ?? null,
      tipo_quadro: quadro.tipo_quadro,
      largura_mm: quadro.largura_mm,
      altura_mm: quadro.altura_mm,
      profundidade_mm: quadro.profundidade_mm,
      largura_util_mm: quadro.largura_util_mm,
      altura_util_mm: quadro.altura_util_mm,
      margem_lateral_mm: quadro.margem_lateral_mm,
      margem_topo_mm: quadro.margem_topo_mm,
      corrente_nominal: quadro.corrente_nominal,
      tensao_nominal: quadro.tensao_nominal,
      grau_protecao: quadro.grau_protecao,
      material_caixa: quadro.material_caixa,
      layout: quadro.layout,
      publico: true,
      criado_por: auth?.usuarioId ?? null,
    })
    .select("id")
    .single();

  if (errTemplate || !novoTemplate) {
    return { erro: errTemplate?.message ?? "Falha ao salvar template." };
  }

  return { id: novoTemplate.id };
}

export async function buscarTemplatesQuadros(): Promise<QuadroTemplateItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quadro_templates")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error || !data || data.length === 0) {
    const padroes = gerarTemplatesPadrao();
    return padroes.map((p, idx) => ({
      ...p,
      id: `padrao-${idx}`,
      criado_em: new Date().toISOString(),
      criado_por: null,
      atualizado_em: new Date().toISOString(),
    }));
  }

  return (data as unknown) as QuadroTemplateItem[];
}

function normalizarCircuito(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function nomeDaPlanta(relacao: unknown): string | undefined {
  if (Array.isArray(relacao)) return (relacao[0] as { nome?: string } | undefined)?.nome;
  return (relacao as { nome?: string } | null)?.nome;
}

export async function buscarCircuitosObra(obraId: string): Promise<CircuitoVinculado[]> {
  const supabase = await createClient();
  const circuitosPorChave = new Map<string, CircuitoVinculado>();

  const { data: tarefasCircuito } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, localizacao_detalhe, planta_id, levantamento_id, plantas(nome)")
    .eq("obra_id", obraId)
    .eq("localizacao_tipo", "circuito");

  const tarefas = [...(tarefasCircuito ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const levantamentos = (await supabase
    .from("levantamentos")
    .select("id, itens, planta_id, plantas(nome)")
    .eq("obra_id", obraId)).data ?? [];

  for (const lev of levantamentos) {
    const itens = (lev.itens as Array<Record<string, unknown>>) || [];
    for (const item of itens) {
      const meta = item.metadadosCabo as Record<string, unknown> | undefined;
      if (item.tipo !== "tubulacao_cabo" && !meta) continue;
      const tag = String(meta?.circuito || item.nome || "").trim();
      if (!tag) continue;
      const chave = `${lev.planta_id ?? "sem-planta"}::${normalizarCircuito(tag)}`;
      const atual = circuitosPorChave.get(chave);
      if (atual) continue;
      circuitosPorChave.set(chave, {
        id: `lev-${lev.id}-${normalizarCircuito(tag)}`,
        tag,
        descricao: `Circuito levantado em planta: ${meta?.tipoCabo || ""}`,
        origem: "levantamento",
        origemId: lev.id,
        condutor: meta?.tipoCabo as string | undefined,
        plantaId: lev.planta_id ?? undefined,
        plantaNome: nomeDaPlanta(lev.plantas),
      });
    }
  }

  for (const t of tarefas) {
    const detalhe = t.localizacao_detalhe as Record<string, unknown> | null;
    const tagCircuito = String((detalhe?.circuito as string) || t.titulo).trim();
    const chave = `${t.planta_id ?? "sem-planta"}::${normalizarCircuito(tagCircuito)}`;
    const anterior = circuitosPorChave.get(chave);
    const circuitoDaTarefa: CircuitoVinculado = {
      id: t.id,
      tag: tagCircuito,
      descricao: t.descricao || t.titulo,
      origem: "tarefa",
      origemId: t.id,
      condutor: detalhe?.tipoCabo as string | undefined,
      secaoMm2: typeof detalhe?.secaoMm2 === "number" ? detalhe.secaoMm2 : undefined,
      plantaId: t.planta_id ?? undefined,
      plantaNome: nomeDaPlanta(t.plantas),
    };
    if (!anterior) {
      circuitosPorChave.set(chave, circuitoDaTarefa);
    } else if (t.levantamento_id && anterior.id.startsWith(`lev-${t.levantamento_id}-`)) {
      circuitosPorChave.set(chave, { ...anterior, ...circuitoDaTarefa, condutor: circuitoDaTarefa.condutor ?? anterior.condutor });
    }
  }
  return [...circuitosPorChave.values()].sort((a, b) => {
    const plantaA = a.plantaNome ?? "";
    const plantaB = b.plantaNome ?? "";
    return plantaA.localeCompare(plantaB) || a.tag.localeCompare(b.tag, undefined, { numeric: true });
  });
}
