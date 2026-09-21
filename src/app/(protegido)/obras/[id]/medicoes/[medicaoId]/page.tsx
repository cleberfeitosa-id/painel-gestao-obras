import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn, formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FiltrosMedicao } from "@/components/medicao/filtros-medicao";
import { TabelaMedicao } from "@/components/medicao/tabela-medicao";
import { ValorContrato } from "@/components/medicao/valor-contrato";
import { EditarMedicaoModal } from "@/components/medicao/editar-medicao-modal";
import { ListaPagamentos, type ItemPagamento } from "@/components/medicao/lista-pagamentos";
import { GraficosProgressoMedicao } from "@/components/medicao/graficos-progresso-medicao";
import type {
  CatalogoPrecoRow,
  AprovacaoTarefa,
  MedicaoRow,
  PlantaRow,
  PerfilRow,
  StatusTarefa,
  TarefaMedicaoRow,
  ComposicaoComponenteRow,
} from "@/lib/supabase/database.types";
import type { ItemOrcamentoParaCatalogo } from "@/app/(protegido)/obras/[id]/medicoes/acoes";
import { buscarResumoDaMedicao } from "@/lib/medicoes/resumo-da-medicao";
import { classificarCategoria } from "@/lib/orcamento/classificar-categoria";

export interface TarefaMedicao {
  id: string;
  titulo: string;
  quantidade: number | null;
  status: StatusTarefa;
  aprovacao: AprovacaoTarefa;
  prazo: string | null;
  planta: { nome: string } | null;
  responsavel: { nome: string } | null;
  executor: { nome: string } | null;
  catalogoId: string | null;
}

export interface ItemMedicao {
  catalogoId: string;
  nome: string;
  unidade: string;
  valorUnitario: number;
  valorUnitarioOrcamento: number;
  valorUnitarioComposicao: number;
  quantidadeTotal: number;
  quantidadeExecutada: number;
  quantidadePendente: number;
  valorTotal: number;
  valorExecutado: number;
  valorContabilizado: number;
  valorConstrutoraTotal: number;
  valorConstrutoraExecutado: number;
  valorConstrutoraPendente: number;
  valorExecutorTotal: number;
  valorExecutorExecutado: number;
  valorExecutorPendente: number;
  valorUnitarioMaoObra: number;
  valorPendente: number;
  pesoPercentual: number;
  progressoPercentual: number;
  contribuicaoProgresso: number;
  orcamentoItens: ItemOrcamentoParaCatalogo[];
  tarefas: TarefaMedicao[];
  /** Custo por categoria (mao_de_obra, equipamento) da composicao vinculada */
  composicaoCustos: Record<string, number>;
  composicaoComponentes: ComponenteComposicao[];
  temBaseMaoObra: boolean;
}

export interface ComponenteComposicao {
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorContribuicao: number;
}

interface TarefaComRelacoes {
  id: string;
  titulo: string;
  status: StatusTarefa;
  aprovacao: AprovacaoTarefa;
  prazo: string | null;
  planta_id: string | null;
  responsavel_id: string | null;
  plantas: { nome: string } | null;
   perfis: { nome: string } | null;
  executor: { nome: string } | null;
  localizacao_detalhe: Record<string, unknown> | null;
  tarefa_medicoes: (TarefaMedicaoRow & { catalogo_precos: CatalogoPrecoRow })[];
}

function temFiltrosAtivos(filtros: { planta?: string; responsavel?: string; de?: string; ate?: string }) {
  return Boolean(filtros.planta || filtros.responsavel || filtros.de || filtros.ate);
}

function agregarComposicaoCustos(
  itensOrc: ItemOrcamentoParaCatalogo[],
  mapCustosPorItem: Map<string, Record<string, number>>,
): Record<string, number> {
  const total: Record<string, number> = {};
  const itensUnicos = [...new Map(itensOrc.map((item) => [item.id, item])).values()];
  for (const item of itensUnicos) {
    const custos = item.id ? mapCustosPorItem.get(item.id) : undefined;
    if (!custos) continue;
    for (const [cat, val] of Object.entries(custos)) {
      const quantidade = Number(item.quantidade);
      total[cat] = (total[cat] ?? 0) + val * quantidade;
    }
  }
  return total;
}

function valorUnitarioMaoObraDoItem(
  itensOrc: ItemOrcamentoParaCatalogo[],
  mapCustosPorItem: Map<string, Record<string, number>>,
): number {
  const itensUnicos = [...new Map(itensOrc.map((item) => [item.id, item])).values()];
  const itensComComposicao = itensUnicos.filter((item) => {
    const custos = item.id ? mapCustosPorItem.get(item.id) : undefined;
    return Boolean(item.composicao_id && custos && Object.keys(custos).length > 0);
  });
  // Sem composição não existe uma base confiável para separar mão de obra
  // do preço total do catálogo. Não atribuir o valor integral como mão de obra.
  if (itensComComposicao.length === 0) return 0;

  const quantidadeTotal = itensComComposicao.reduce(
    (total, item) => total + Number(item.quantidade),
    0,
  );
  const valor = quantidadeTotal > 0
    ? itensComComposicao.reduce(
        (total, item) =>
          total + (mapCustosPorItem.get(item.id)?.mao_de_obra ?? 0) * Number(item.quantidade),
        0,
      ) / quantidadeTotal
    : itensComComposicao.reduce(
        (total, item) => total + (mapCustosPorItem.get(item.id)?.mao_de_obra ?? 0),
        0,
      );

  return Math.round(valor * 100) / 100;
}

function precoEfetivoDoCatalogo(
  valorUnitario: number | string | null | undefined,
): number {
  return Number(valorUnitario ?? 0);
}

function precoDoOrcamento(itensOrcamento: ItemOrcamentoParaCatalogo[]): number {
  const itensAtivos = itensOrcamento
    .filter((item) => item.ativo && item.tipo === "item")
  if (itensAtivos.length === 0) return 0;
  // Um contrato executor pode representar mais de uma linha do orçamento.
  // O painel financeiro rateia a quantidade igualmente entre os vínculos;
  // a taxa equivalente é, portanto, a média dos valores unitários vinculados.
  return itensAtivos.reduce((total, item) => total + Number(item.valor_unitario), 0) / itensAtivos.length;
}

function precoDaComposicao(itensOrcamento: ItemOrcamentoParaCatalogo[]): number {
  const itensAtivos = itensOrcamento.filter((item) => item.ativo && item.tipo === "item");
  if (itensAtivos.length === 0) return 0;
  return itensAtivos.reduce((total, item) => total + Number(item.valor_composicao), 0) / itensAtivos.length;
}

async function buscarDados(
  obraId: string,
  medicaoId: string,
  filtros: { planta?: string; responsavel?: string; de?: string; ate?: string },
) {
  const supabase = await createClient();

  let consulta = supabase
    .from("tarefas")
    .select(
        `id, titulo, status, aprovacao, prazo, planta_id, responsavel_id, localizacao_detalhe, plantas(nome), perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(nome),
        tarefa_medicoes(id, criado_em, catalogo_id, quantidade, catalogo_precos!inner(id, nome, unidade, valor_unitario, medicao_id, orcamento_item_id))`,
    )
    .eq("obra_id", obraId);

  if (filtros.planta) consulta = consulta.eq("planta_id", filtros.planta);
  if (filtros.responsavel) {
    consulta = consulta.eq("responsavel_id", filtros.responsavel);
  }
  if (filtros.de) consulta = consulta.gte("prazo", filtros.de);
  if (filtros.ate) consulta = consulta.lte("prazo", filtros.ate);

  const [{ data: medicao }, { data: catalogo }, { data: tarefas }, { data: tarefasGlobais }, { data: plantas }, { data: perfis }, { data: pagamentos }] =
    await Promise.all([
      supabase
        .from("medicoes")
        .select("id, obra_id, titulo, valor_contrato")
        .eq("id", medicaoId)
        .eq("obra_id", obraId)
        .single(),
      supabase
        .from("catalogo_precos")
        .select("*")
        .eq("medicao_id", medicaoId)
        .order("nome"),
      consulta.order("titulo"),
      supabase
        .from("tarefas")
        .select(
          `id, titulo, status, aprovacao, prazo, planta_id, responsavel_id, localizacao_detalhe, plantas(nome), perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(nome),
            tarefa_medicoes(id, criado_em, catalogo_id, quantidade, catalogo_precos!inner(id, nome, unidade, valor_unitario, medicao_id, orcamento_item_id))`,
        )
        .eq("obra_id", obraId)
        .order("titulo"),
      supabase.from("plantas").select("id, nome").eq("obra_id", obraId).order("nome"),
      supabase.from("perfis").select("id, nome").order("nome"),
      supabase
        .from("medicao_pagamentos")
        .select("id, valor, data_pagamento, descricao")
        .eq("medicao_id", medicaoId)
        .order("data_pagamento", { ascending: false }),
     ]);

  const catalogoIdsDaMedicao = (catalogo ?? []).map((item) => item.id);
  const { data: vinculosDiretos } = catalogoIdsDaMedicao.length > 0
    ? await supabase
        .from("tarefa_medicoes")
        .select(
           "id, criado_em, tarefa_id, catalogo_id, quantidade, tarefas!inner(id, obra_id, titulo, status, aprovacao, prazo, planta_id, responsavel_id, localizacao_detalhe, plantas(nome), perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(nome)), catalogo_precos!inner(id, nome, unidade, valor_unitario, medicao_id, orcamento_item_id)",
        )
        .in("catalogo_id", catalogoIdsDaMedicao)
        .eq("tarefas.obra_id", obraId)
    : { data: [] };

  const anexarVinculosDiretos = (lista: TarefaComRelacoes[]): TarefaComRelacoes[] => {
    const porId = new Map(lista.map((tarefa) => [tarefa.id, tarefa]));
    for (const vinculo of vinculosDiretos ?? []) {
      const tarefa = vinculo.tarefas;
      if (!tarefa) continue;
      const existente = porId.get(tarefa.id);
       const medicao = {
         id: vinculo.id,
         tarefa_id: vinculo.tarefa_id,
         catalogo_id: vinculo.catalogo_id,
         quantidade: vinculo.quantidade,
         criado_por: null,
         criado_em: vinculo.criado_em,
         catalogo_precos: vinculo.catalogo_precos,
       } as TarefaMedicaoRow & { catalogo_precos: CatalogoPrecoRow };
       if (existente) {
         const indice = existente.tarefa_medicoes.findIndex((item) => item.catalogo_id === medicao.catalogo_id);
         if (indice === -1) {
           existente.tarefa_medicoes.push(medicao);
         } else {
           const atual = existente.tarefa_medicoes[indice];
           if (medicao.criado_em > atual.criado_em || (medicao.criado_em === atual.criado_em && medicao.id > atual.id)) {
             existente.tarefa_medicoes[indice] = medicao;
           }
         }
      } else {
        porId.set(tarefa.id, { ...tarefa, tarefa_medicoes: [medicao] } as TarefaComRelacoes);
      }
    }
    return [...porId.values()];
  };

  const tarefasComVinculosDiretos = anexarVinculosDiretos((tarefas ?? []) as TarefaComRelacoes[]);
  const tarefasGlobaisComVinculosDiretos = anexarVinculosDiretos((tarefasGlobais ?? []) as TarefaComRelacoes[]);

  const catalogoIds = (catalogo ?? []).map((c) => c.id);
  let vinculosCatalogo: { catalogo_id: string; orcamento_item_id: string }[] = [];
  if (catalogoIds.length > 0) {
    const { data: vinculos } = await supabase
      .from("catalogo_precos_orcamento_itens")
      .select("catalogo_id, orcamento_item_id")
      .in("catalogo_id", catalogoIds);
    vinculosCatalogo = vinculos ?? [];
    for (const item of catalogo ?? []) {
      if (
        item.orcamento_item_id &&
        !vinculosCatalogo.some(
          (vinculo) =>
            vinculo.catalogo_id === item.id &&
            vinculo.orcamento_item_id === item.orcamento_item_id,
        )
      ) {
        vinculosCatalogo.push({
          catalogo_id: item.id,
          orcamento_item_id: item.orcamento_item_id,
        });
      }
    }
  }

  const idsOrcamentoDoCatalogo = [...new Set(vinculosCatalogo.map((v) => v.orcamento_item_id))];

  const mapaItens = new Map<string, ItemOrcamentoParaCatalogo>();
  const mapaItensPorCatalogo = new Map<string, ItemOrcamentoParaCatalogo[]>();
  const mapCustosPorItem = new Map<string, Record<string, number>>();
  const mapComponentesPorItem = new Map<string, ComponenteComposicao[]>();

  if (idsOrcamentoDoCatalogo.length > 0) {
     const { data: dadosItens } = await supabase
      .from("orcamento_itens")
       .select("id, item, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, composicao_id, ativo, tipo, orcamentos!inner(obra_id)")
      .in("id", idsOrcamentoDoCatalogo);
     const itensOrcamento: ItemOrcamentoParaCatalogo[] = (dadosItens ?? [])
       .filter((item) => item.orcamentos?.obra_id === medicao?.obra_id)
       .map((item) => ({
       id: item.id,
       item: item.item,
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
      ativo: item.ativo,
      tipo: item.tipo,
       }));

    for (const item of itensOrcamento) mapaItens.set(item.id, item);

    for (const v of vinculosCatalogo) {
      const item = mapaItens.get(v.orcamento_item_id);
      if (!item) continue;
      const atual = mapaItensPorCatalogo.get(v.catalogo_id) ?? [];
       if (atual.some((itemVinculado) => itemVinculado.id === item.id)) continue;
       atual.push(item);
      mapaItensPorCatalogo.set(v.catalogo_id, atual);
    }

      const { data: composicoes } = await supabase
        .from("composicoes")
        .select("id, obra_id, codigo, nome, unidade, custo_unitario")
        .eq("obra_id", obraId);
     const composicoesPorCodigo = new Map<string, string[]>();
     for (const composicao of composicoes ?? []) {
       const codigo = composicao.codigo?.trim();
       if (!codigo) continue;
       const ids = composicoesPorCodigo.get(codigo) ?? [];
       ids.push(composicao.id);
       composicoesPorCodigo.set(codigo, ids);
     }

     // Alguns itens antigos foram vinculados apenas pelo codigo. Recuperar a
     // composicao aqui evita que a tela de medicao dependa de uma coluna
     // relacional que pode estar desatualizada.
       const composicaoPorId = new Map((composicoes ?? []).map((composicao) => [composicao.id, composicao]));
       const composicaoIdsDosItens = new Set(
         itensOrcamento
           .map((item) => item.composicao_id)
           .filter((id): id is string => Boolean(id)),
       );
       const codigosDosItens = new Set(
         itensOrcamento
           .map((item) => item.codigo?.trim())
           .filter((codigo): codigo is string => Boolean(codigo)),
       );
       const idsComposicoesDaObra = (composicoes ?? [])
         .filter((composicao) => codigosDosItens.has(composicao.codigo?.trim() ?? ""))
         .map((composicao) => composicao.id);
        // Carregar todas as composicoes da obra preserva as referencias
        // internas de segundo nivel. Buscar apenas as composicoes vinculadas
        // diretamente faria a recursao descartar silenciosamente os filhos.
        const idsComposicoesParaComponentes = [...new Set([
          ...composicaoIdsDosItens,
          ...idsComposicoesDaObra,
          ...(composicoes ?? []).map((composicao) => composicao.id),
        ])];
        let componentes: ComposicaoComponenteRow[] = [];
        if (idsComposicoesParaComponentes.length > 0) {
         const tamanhoLote = 100;
         const lotes = <T,>(ids: string[]): T[][] => {
           const resultado: T[][] = [];
           for (let indice = 0; indice < ids.length; indice += tamanhoLote) {
             resultado.push(ids.slice(indice, indice + tamanhoLote) as T[]);
           }
           return resultado;
         };
         const componentesModernos: ComposicaoComponenteRow[] = [];
         let erroComponentes: { code?: string; message?: string; details?: string; hint?: string } | null = null;
         for (const lote of lotes<string>(idsComposicoesParaComponentes)) {
           const resultadoComponentes = await supabase
             .from("composicao_componentes")
             .select("id, composicao_id, nome, categoria, unidade, quantidade, custo_unitario, codigo, composicao_referencia_id, criado_em")
             .in("composicao_id", lote);
           if (resultadoComponentes.error) {
             erroComponentes = resultadoComponentes.error;
             break;
           }
           componentesModernos.push(...(resultadoComponentes.data ?? []));
         }

         if (!erroComponentes) {
           componentes = componentesModernos;
         } else {
           // Bases antigas podem ainda nao ter as colunas de referencias
           // adicionadas na migracao 0020. Os componentes basicos continuam
           // validos para a decomposicao da medicao.
           const componentesLegados: ComposicaoComponenteRow[] = [];
           let erroLegado: { code?: string; message?: string; details?: string; hint?: string } | null = null;
           for (const lote of lotes<string>(idsComposicoesParaComponentes)) {
             const resultadoLegado = await supabase
               .from("composicao_componentes")
               .select("id, composicao_id, nome, categoria, unidade, quantidade, custo_unitario, criado_em")
               .in("composicao_id", lote);
             if (resultadoLegado.error) {
               erroLegado = resultadoLegado.error;
               break;
             }
             componentesLegados.push(...(resultadoLegado.data ?? []).map((componente) => ({
               ...componente,
               codigo: null,
               composicao_referencia_id: null,
             })));
           }
           if (erroLegado) {
              console.error(
                "Erro ao buscar componentes das composicoes:",
                JSON.stringify({
                  code: erroLegado.code,
                  message: erroLegado.message,
                  details: erroLegado.details,
                  hint: erroLegado.hint,
                }),
              );
           } else {
             componentes = componentesLegados;
           }
         }
      }

      const componentesPorComposicao = new Map<string, ComposicaoComponenteRow[]>();
      for (const componente of componentes ?? []) {
         const categoriaCorrigida = classificarCategoria(componente.categoria, "", componente.nome);
        const lista = componentesPorComposicao.get(componente.composicao_id) ?? [];
        lista.push({ ...componente, categoria: categoriaCorrigida });
        componentesPorComposicao.set(componente.composicao_id, lista);
      }

      for (const item of itensOrcamento) {
        const ids = item.codigo ? composicoesPorCodigo.get(item.codigo.trim()) : undefined;
        const composicaoAtual = item.composicao_id ? composicaoPorId.get(item.composicao_id) : undefined;
        const atualTemComponentes = item.composicao_id
          ? (componentesPorComposicao.get(item.composicao_id)?.length ?? 0) > 0
          : false;
        const candidatasComComponentes = (ids ?? []).filter(
          (id) => (componentesPorComposicao.get(id)?.length ?? 0) > 0,
        );
        if (composicaoAtual?.codigo?.trim() === item.codigo?.trim() && atualTemComponentes) continue;
        item.composicao_id = candidatasComComponentes.length === 1
          ? candidatasComComponentes[0]
          : ids?.length === 1
            ? ids[0]
            : null;
      }

      const composicaoIds = [...new Set(itensOrcamento.map((i) => i.composicao_id).filter((id): id is string => Boolean(id)))];
      if (composicaoIds.length > 0) {

      const composicaoIdsConhecidas = new Set((composicoes ?? []).map((composicao) => composicao.id));
      const custosPorComposicao = new Map<string, Record<string, number>>();
      const calcularCustos = (composicaoId: string, fator = 1, visitados = new Set<string>()): Record<string, number> => {
        if (visitados.has(composicaoId)) return {};
        const proximosVisitados = new Set(visitados).add(composicaoId);
        const custos: Record<string, number> = {};
        for (const componente of componentesPorComposicao.get(composicaoId) ?? []) {
          const quantidade = fator * Number(componente.quantidade);
          if (componente.composicao_referencia_id && composicaoIdsConhecidas.has(componente.composicao_referencia_id)) {
            const aninhados = calcularCustos(componente.composicao_referencia_id, quantidade, proximosVisitados);
            for (const [categoria, valor] of Object.entries(aninhados)) {
              custos[categoria] = (custos[categoria] ?? 0) + valor;
            }
          } else {
            custos[componente.categoria] = (custos[componente.categoria] ?? 0) + quantidade * Number(componente.custo_unitario);
          }
        }
        return custos;
      };
      for (const composicaoId of composicaoIds) {
        custosPorComposicao.set(composicaoId, calcularCustos(composicaoId));
      }
       for (const item of itensOrcamento) {
         if (item.composicao_id) {
            const custos = custosPorComposicao.get(item.composicao_id) ?? {};
           mapCustosPorItem.set(item.id, custos);
          item.valor_mao_obra = custos.mao_de_obra ?? 0;
          item.valor_equipamento = custos.equipamento ?? 0;
           const valorComposicao = Object.values(custos).reduce((total, valor) => total + valor, 0);
          item.valor_composicao = valorComposicao > 0 ? valorComposicao : item.valor_composicao;
        }
      }

      function expandirComposicao(composicaoId: string, fator = 1, visitados = new Set<string>()): ComponenteComposicao[] {
        if (visitados.has(composicaoId)) return [];
        const proximosVisitados = new Set(visitados).add(composicaoId);
        const folhas: ComponenteComposicao[] = [];
        for (const componente of componentesPorComposicao.get(composicaoId) ?? []) {
          const quantidade = fator * Number(componente.quantidade);
          if (componente.composicao_referencia_id && composicaoIdsConhecidas.has(componente.composicao_referencia_id)) {
            folhas.push(...expandirComposicao(componente.composicao_referencia_id, quantidade, proximosVisitados));
          } else {
            folhas.push({
              nome: componente.nome,
              categoria: componente.categoria,
              unidade: componente.unidade,
              quantidade,
              valorUnitario: Number(componente.custo_unitario),
              valorContribuicao: quantidade * Number(componente.custo_unitario),
            });
          }
        }
        return folhas;
      }

      for (const item of itensOrcamento) {
        if (item.composicao_id) mapComponentesPorItem.set(item.id, expandirComposicao(item.composicao_id));
      }
    }

  }

  return {
    medicao: (medicao ?? null) as Pick<MedicaoRow, "id" | "obra_id" | "titulo" | "valor_contrato"> | null,
    catalogo: (catalogo ?? []) as CatalogoPrecoRow[],
     tarefas: tarefasComVinculosDiretos,
     tarefasGlobais: tarefasGlobaisComVinculosDiretos,
    plantas: (plantas ?? []) as Pick<PlantaRow, "id" | "nome">[],
    perfis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    pagamentos: (pagamentos ?? []) as ItemPagamento[],
    mapaItensPorCatalogo,
    mapCustosPorItem,
    mapComponentesPorItem,
  };
}

export default async function MedicaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; medicaoId: string }>;
  searchParams: Promise<{ planta?: string; responsavel?: string; de?: string; ate?: string }>;
}) {
  const { id, medicaoId } = await params;
  const filtros = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor")) {
    redirect(`/obras/${id}`);
  }

  const { medicao, catalogo, tarefas, tarefasGlobais, plantas, perfis, pagamentos, mapaItensPorCatalogo, mapCustosPorItem, mapComponentesPorItem } =
    await buscarDados(id, medicaoId, filtros);
  if (!medicao) notFound();

  function criarItens(tarefasParaAgregar: TarefaComRelacoes[]) {
    const itens = new Map<string, ItemMedicao>();
    for (const c of catalogo) {
      const itensOrc = mapaItensPorCatalogo.get(c.id) ?? [];
      const valorUnitarioEfetivo = precoEfetivoDoCatalogo(c.valor_unitario);
      const valorUnitarioOrcamento = precoDoOrcamento(itensOrc);
      const valorUnitarioComposicao = precoDaComposicao(itensOrc);
    const valorUnitarioMaoObra = valorUnitarioMaoObraDoItem(
      itensOrc,
      mapCustosPorItem,
    );
    const temBaseMaoObra = itensOrc.some((item) => {
      const custos = item.id ? mapCustosPorItem.get(item.id) : undefined;
      return Boolean(item.composicao_id && custos && Object.keys(custos).length > 0);
    });
      itens.set(c.id, {
      catalogoId: c.id,
      nome: c.nome,
      unidade: c.unidade,
       valorUnitario: valorUnitarioEfetivo,
       valorUnitarioOrcamento,
       valorUnitarioComposicao,
      quantidadeTotal: 0,
      quantidadeExecutada: 0,
      quantidadePendente: 0,
       valorTotal: 0,
       valorExecutado: 0,
       valorContabilizado: 0,
       valorConstrutoraTotal: 0,
       valorConstrutoraExecutado: 0,
       valorConstrutoraPendente: 0,
       valorExecutorTotal: 0,
       valorExecutorExecutado: 0,
       valorExecutorPendente: 0,
      valorUnitarioMaoObra,
      valorPendente: 0,
      pesoPercentual: 0,
      progressoPercentual: 0,
      contribuicaoProgresso: 0,
      orcamentoItens: itensOrc,
      tarefas: [],
       composicaoCustos: agregarComposicaoCustos(itensOrc, mapCustosPorItem),
       composicaoComponentes: itensOrc.flatMap((item) => mapComponentesPorItem.get(item.id) ?? []),
       temBaseMaoObra,
      });
    }

    let valorExecutado = 0;
    let valorPendente = 0;
    let valorTotalCadastrado = 0;
    let valorConstrutoraExecutado = 0;
    let valorConstrutoraPendente = 0;
    let valorConstrutoraTotal = 0;

    for (const tarefa of tarefasParaAgregar) {
     const medicoesDaTarefa = new Map(
       tarefa.tarefa_medicoes.map((medicaoTarefa) => [medicaoTarefa.catalogo_id, medicaoTarefa]),
     );
     for (const medicaoTarefa of medicoesDaTarefa.values()) {
      const catalogoItem = medicaoTarefa.catalogo_precos;
      if (!catalogoItem) continue;
      // Uma tarefa pode estar vinculada a mais de um boletim. O filtro
      // aninhado seleciona tarefas, mas nao e o filtro definitivo da relacao.
      if (catalogoItem.medicao_id !== medicaoId) continue;

      const item = itens.get(catalogoItem.id) ?? {
        catalogoId: catalogoItem.id,
        nome: catalogoItem.nome,
        unidade: catalogoItem.unidade,
          valorUnitario: precoEfetivoDoCatalogo(catalogoItem.valor_unitario),
          valorUnitarioOrcamento: 0,
          valorUnitarioComposicao: 0,
        quantidadeTotal: 0,
        quantidadeExecutada: 0,
        quantidadePendente: 0,
         valorTotal: 0,
         valorExecutado: 0,
         valorContabilizado: 0,
         valorConstrutoraTotal: 0,
         valorConstrutoraExecutado: 0,
         valorConstrutoraPendente: 0,
         valorExecutorTotal: 0,
         valorExecutorExecutado: 0,
         valorExecutorPendente: 0,
        valorUnitarioMaoObra: 0,
        valorPendente: 0,
        pesoPercentual: 0,
        progressoPercentual: 0,
        contribuicaoProgresso: 0,
        orcamentoItens: [],
        tarefas: [],
        composicaoCustos: {},
        composicaoComponentes: [],
        temBaseMaoObra: false,
      };

      item.tarefas.push({
        id: tarefa.id,
         titulo: tarefa.titulo,
         quantidade: medicaoTarefa.quantidade,
         status: tarefa.status,
         aprovacao: tarefa.aprovacao,
         prazo: tarefa.prazo,
        planta: tarefa.plantas,
         responsavel: tarefa.perfis,
         executor: tarefa.executor,
        catalogoId: catalogoItem.id,
      });

      const qtd = Number(medicaoTarefa.quantidade ?? 0);
      const valor = qtd * item.valorUnitario;
      const valorOrcamento = qtd * item.valorUnitarioOrcamento;
      item.quantidadeTotal += qtd;
      item.valorTotal += valor;
      item.valorConstrutoraTotal += valorOrcamento;
      item.valorExecutorTotal += valor;
      valorTotalCadastrado += valor;
      valorConstrutoraTotal += valorOrcamento;

       if (tarefa.status === "concluido" && tarefa.aprovacao === "aprovado") {
        item.quantidadeExecutada += qtd;
        item.valorExecutado += valor;
        item.valorConstrutoraExecutado += valorOrcamento;
        item.valorExecutorExecutado += valor;
        item.valorContabilizado += qtd * item.valorUnitarioMaoObra;
        valorExecutado += valor;
        valorConstrutoraExecutado += valorOrcamento;
      } else {
        item.quantidadePendente += qtd;
        item.valorPendente += valor;
        item.valorConstrutoraPendente += valorOrcamento;
        item.valorExecutorPendente += valor;
        valorPendente += valor;
        valorConstrutoraPendente += valorOrcamento;
      }

      itens.set(catalogoItem.id, item);
    }
    }

    for (const item of itens.values()) {
    item.pesoPercentual =
      valorConstrutoraTotal > 0 ? (item.valorConstrutoraTotal / valorConstrutoraTotal) * 100 : 0;
    item.progressoPercentual =
      item.valorConstrutoraTotal > 0
        ? (item.valorConstrutoraExecutado / item.valorConstrutoraTotal) * 100
        : 0;
    item.contribuicaoProgresso =
      valorConstrutoraTotal > 0
        ? (item.valorConstrutoraExecutado / valorConstrutoraTotal) * 100
        : 0;
    }

    return {
      itens: [...itens.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      valorExecutado,
      valorPendente,
      valorTotalCadastrado,
      valorConstrutoraTotal,
      valorConstrutoraExecutado,
      valorConstrutoraPendente,
      valorExecutorExecutado: [...itens.values()].reduce((total, item) => total + item.valorExecutorExecutado, 0),
      valorExecutorPendente: [...itens.values()].reduce((total, item) => total + item.valorExecutorPendente, 0),
    };
  }

  const agregadoGlobal = criarItens(tarefasGlobais);
  const agregadoFiltrado = criarItens(tarefas);
  const listaItens = temFiltrosAtivos(filtros)
    ? agregadoFiltrado.itens.filter((item) => item.tarefas.length > 0)
    : agregadoGlobal.itens;

  const temFiltros = temFiltrosAtivos(filtros);

  const resumoFonteDaVerdade = await buscarResumoDaMedicao(medicao.id, medicao.obra_id);
  const valorPago = resumoFonteDaVerdade.pago;
  const saldoExecutor = agregadoGlobal.valorExecutorExecutado - valorPago;
  const maoDeObraExecutada = agregadoGlobal.itens.reduce(
    (total, item) => total + item.valorContabilizado,
    0,
  );
  const saldoMaoDeObra = maoDeObraExecutada - valorPago;
  const custosOrcamento = [...agregadoGlobal.itens].reduce<Record<string, number>>((total, item) => {
    for (const [categoria, valor] of Object.entries(item.composicaoCustos)) {
      total[categoria] = (total[categoria] ?? 0) + valor;
    }
    return total;
  }, {});
  const itensOrcamentoUnicos = new Map<string, ItemOrcamentoParaCatalogo>();
  for (const item of agregadoGlobal.itens) {
    for (const orcamentoItem of item.orcamentoItens) {
      if (orcamentoItem.ativo && orcamentoItem.tipo === "item") {
        itensOrcamentoUnicos.set(orcamentoItem.id, orcamentoItem);
      }
    }
  }
  const orcamentoClienteTotal = [...itensOrcamentoUnicos.values()].reduce(
    (total, orcamentoItem) => total + Number(orcamentoItem.quantidade) * Number(orcamentoItem.valor_unitario),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${medicao.obra_id}/medicoes`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para as medições
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-superficie-900">{medicao.titulo}</h1>
          <EditarMedicaoModal medicaoId={medicao.id} titulo={medicao.titulo} />
          <span className="text-sm text-superficie-500">Medição</span>
        </div>
        <p className="mt-1 text-sm text-superficie-500">
           Acompanhe separadamente o orçamento do cliente, o valor medido pela construtora
           e a remuneração do contrato executor definida no item de medição.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Filtros da visualização</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FiltrosMedicao plantas={plantas} responsaveis={perfis} ativos={filtros} />
        </CartaoConteudo>
      </Cartao>

      <Cartao className="border-amber-200 bg-amber-50/40">
        <CartaoCabecalho>
          <CartaoTitulo>Como interpretar esta medição</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-3 text-sm text-superficie-700 md:grid-cols-3">
          <div>
           <p className="font-semibold text-superficie-900">Orçamento previsto da construtora</p>
            <p className="mt-1 text-xs">Quantidade e composição previstas, com mão de obra, materiais e equipamentos.</p>
          </div>
          <div>
            <p className="font-semibold text-superficie-900">Medição da construtora</p>
            <p className="mt-1 text-xs">Quantidade medida × valor unitário do orçamento/composição vinculado.</p>
          </div>
          <div>
            <p className="font-semibold text-superficie-900">Contrato executor</p>
            <p className="mt-1 text-xs">Quantidade executada × preço negociado no item de medição. O executor identificado na tarefa é apenas uma referência operacional.</p>
          </div>
        </CartaoConteudo>
      </Cartao>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="col-span-full rounded-lg border border-azul-100 bg-azul-50/40 px-4 py-3 text-sm font-semibold text-azul-700">
          Contrato executor
          <p className="mt-0.5 text-xs font-normal text-superficie-500">
            Valores acordados, pagos e medidos no contrato do executor.
          </p>
        </div>
        <ValorContrato medicaoId={medicao.id} valorContrato={medicao.valor_contrato} />
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Total pago ao executor</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-emerald-600">
              {formatarMoeda(valorPago)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Pagamentos registrados para o contrato executor
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Saldo do executor</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p
              className={cn(
                "text-2xl font-bold",
                saldoExecutor < 0
                    ? "text-perigo"
                    : "text-azul-600",
              )}
            >
              {formatarMoeda(saldoExecutor)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Medição do executor menos pagamentos registrados
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Executor — medido executado</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-azul-600">
              {formatarMoeda(agregadoGlobal.valorExecutorExecutado)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Quantidade concluída e aprovada × preço do contrato executor
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Executor — a medir</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-amber-600">
              {formatarMoeda(agregadoGlobal.valorExecutorPendente)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Quantidade ainda não concluída × preço do contrato executor
            </p>
          </CartaoConteudo>
        </Cartao>
        <div className="col-span-full mt-2 rounded-lg border border-superficie-200 bg-superficie-50 px-4 py-3 text-sm font-semibold text-superficie-700">
          Orçamento e medição da construtora
          <p className="mt-0.5 text-xs font-normal text-superficie-500">
            Valores do orçamento da obra e das quantidades medidas nas tarefas.
          </p>
        </div>
        <Cartao>
          <CartaoCabecalho>
             <CartaoTitulo>Orçamento previsto da construtora</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-superficie-900">
              {formatarMoeda(orcamentoClienteTotal)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Soma dos valores orçamentários × quantidades previstas
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Mão de obra prevista nos itens executados</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-violeta-700">
              {formatarMoeda(maoDeObraExecutada)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Custo da mão de obra da composição nos itens concluídos e aprovados
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Saldo da mão de obra</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className={cn("text-2xl font-bold", saldoMaoDeObra < 0 ? "text-perigo" : "text-violeta-700")}>
              {formatarMoeda(saldoMaoDeObra)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Mão de obra dos itens executados menos pagamentos ao executor
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
             <CartaoTitulo>Construtora — medido executado</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-emerald-600">
               {formatarMoeda(agregadoGlobal.valorConstrutoraExecutado)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Valor do orçamento × quantidade de tarefas concluídas
            </p>
          </CartaoConteudo>
        </Cartao>
        {(["mao_de_obra", "material", "equipamento"] as const).map((categoria) => (
          <Cartao key={categoria}>
            <CartaoCabecalho>
              <CartaoTitulo>{categoria === "mao_de_obra" ? "Mão de obra prevista" : categoria === "material" ? "Material previsto" : "Equipamento previsto"}</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <p className="text-2xl font-bold text-superficie-900">
                {formatarMoeda(custosOrcamento[categoria] ?? 0)}
              </p>
              <p className="mt-1 text-xs text-superficie-500">
                Custo previsto nas composições do orçamento
              </p>
            </CartaoConteudo>
          </Cartao>
        ))}
        <Cartao>
          <CartaoCabecalho>
             <CartaoTitulo>Construtora — a medir</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-amber-600">
               {formatarMoeda(agregadoGlobal.valorConstrutoraPendente)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Valor do orçamento × quantidade ainda não concluída
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
             <CartaoTitulo>Construtora — total medido</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-superficie-900">
               {formatarMoeda(agregadoGlobal.valorConstrutoraExecutado + agregadoGlobal.valorConstrutoraPendente)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Soma dos itens do orçamento para as quantidades cadastradas
            </p>
          </CartaoConteudo>
        </Cartao>
      </div>

      <GraficosProgressoMedicao
        itens={agregadoGlobal.itens}
         valorExecutado={agregadoGlobal.valorConstrutoraExecutado}
         valorPendente={agregadoGlobal.valorConstrutoraPendente}
         valorTotalCadastrado={agregadoGlobal.valorConstrutoraExecutado + agregadoGlobal.valorConstrutoraPendente}
        valorContrato={medicao.valor_contrato}
         valorExecutorExecutado={agregadoGlobal.valorExecutorExecutado}
      />

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo>Pagamentos</CartaoTitulo>
            <span className="text-xs text-superficie-500">
              {pagamentos.length}{" "}
              {pagamentos.length === 1 ? "pagamento registrado" : "pagamentos registrados"}
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <ListaPagamentos
            medicaoId={medicao.id}
            pagamentos={pagamentos}
          />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo>Itens de medição</CartaoTitulo>
            <span className="text-xs text-superficie-500">
              {listaItens.length}{" "}
              {listaItens.length === 1 ? "item" : "itens"}
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <TabelaMedicao
            key={`${medicao.id}-${filtros.planta ?? ""}-${filtros.responsavel ?? ""}-${filtros.de ?? ""}-${filtros.ate ?? ""}`}
            medicaoId={medicao.id}
            obraId={medicao.obra_id}
            itens={listaItens}
            catalogo={catalogo}
            temFiltros={temFiltros}
            mapCustosPorItem={mapCustosPorItem}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
