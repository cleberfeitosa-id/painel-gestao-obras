import { createClient } from "@/lib/supabase/server";

export interface ResumoDaMedicao {
  executorMedido: number;
  executorExecutado: number;
  executorPendente: number;
  construtoraExecutado: number;
  construtoraPendente: number;
  pago: number;
}

export async function buscarResumoDaMedicao(
  medicaoId: string,
  obraId: string,
): Promise<ResumoDaMedicao> {
  const supabase = await createClient();
  const { data: catalogo } = await supabase
    .from("catalogo_precos")
    .select("id, valor_unitario, orcamento_item_id")
    .eq("medicao_id", medicaoId);
  const catalogoIds = (catalogo ?? []).map((item) => item.id);
  const { data: pagamentos } = await supabase
    .from("medicao_pagamentos")
    .select("valor")
    .eq("medicao_id", medicaoId);
  const pago = (pagamentos ?? []).reduce((total, pagamento) => total + Number(pagamento.valor), 0);
  if (catalogoIds.length === 0) {
    return { executorMedido: 0, executorExecutado: 0, executorPendente: 0, construtoraExecutado: 0, construtoraPendente: 0, pago };
  }

  const [{ data: vinculos }, { data: tarefasDaObra }] = await Promise.all([
    supabase
      .from("catalogo_precos_orcamento_itens")
      .select("catalogo_id, orcamento_item_id")
      .in("catalogo_id", catalogoIds),
    supabase
      .from("tarefas")
      .select("id, status, aprovacao, obra_id, tarefa_medicoes(id, criado_em, catalogo_id, quantidade, catalogo_precos!inner(id, medicao_id))")
      .eq("obra_id", obraId),
  ]);

  const tarefasMedidas = (tarefasDaObra ?? []).flatMap((tarefa) =>
    (tarefa.tarefa_medicoes ?? [])
      .filter((medicao) => medicao.catalogo_precos?.medicao_id === medicaoId)
      .map((medicao) => ({
        id: medicao.id,
        criado_em: medicao.criado_em,
        tarefa_id: tarefa.id,
        catalogo_id: medicao.catalogo_id,
        quantidade: medicao.quantidade,
        status: tarefa.status,
        aprovacao: tarefa.aprovacao,
      })),
  );

  const links = [...(vinculos ?? [])];
  for (const item of catalogo ?? []) {
    if (item.orcamento_item_id && !links.some((link) =>
      link.catalogo_id === item.id && link.orcamento_item_id === item.orcamento_item_id,
    )) {
      links.push({ catalogo_id: item.id, orcamento_item_id: item.orcamento_item_id });
    }
  }

  const linksUnicos = [...new Map(
    links.map((link) => [`${link.catalogo_id}:${link.orcamento_item_id}`, link]),
  ).values()];

  const orcamentoIds = [...new Set(linksUnicos.map((link) => link.orcamento_item_id))];
  const { data: itensOrcamento } = orcamentoIds.length > 0
    ? await supabase
        .from("orcamento_itens")
        .select("id, valor_unitario, ativo, tipo, orcamentos!inner(obra_id)")
        .in("id", orcamentoIds)
        .eq("orcamentos.obra_id", obraId)
    : { data: [] };

  const valoresPorCatalogo = new Map<string, number>();
  const precosExecutorPorCatalogo = new Map(
    (catalogo ?? []).map((item) => [item.id, Number(item.valor_unitario ?? 0)]),
  );
  for (const catalogoId of catalogoIds) {
    const valores = linksUnicos
      .filter((link) => link.catalogo_id === catalogoId)
      .map((link) => itensOrcamento?.find((item) => item.id === link.orcamento_item_id))
      .filter((item) => item?.ativo && item.tipo === "item")
      .map((item) => Number(item?.valor_unitario ?? 0));
    valoresPorCatalogo.set(
      catalogoId,
      valores.length > 0 ? valores.reduce((total, valor) => total + valor, 0) / valores.length : 0,
    );
  }

  let executorMedido = 0;
  let executorExecutado = 0;
  let executorPendente = 0;
  let construtoraExecutado = 0;
  let construtoraPendente = 0;
  const linhasUnicas = new Map<string, (typeof tarefasMedidas)[number]>();
  for (const medicao of tarefasMedidas) {
    const chave = `${medicao.tarefa_id}:${medicao.catalogo_id}`;
    const anterior = linhasUnicas.get(chave);
    if (!anterior || medicao.criado_em > anterior.criado_em || (medicao.criado_em === anterior.criado_em && medicao.id > anterior.id)) {
      linhasUnicas.set(chave, medicao);
    }
  }
  for (const medicao of linhasUnicas.values()) {
    const quantidade = Number(medicao.quantidade ?? 0);
    const valorExecutor = quantidade * (precosExecutorPorCatalogo.get(medicao.catalogo_id) ?? 0);
    const valorConstrutora = quantidade * (valoresPorCatalogo.get(medicao.catalogo_id) ?? 0);
    const executada = medicao.status === "concluido" && medicao.aprovacao === "aprovado";
    executorMedido += valorExecutor;
    if (executada) {
      executorExecutado += valorExecutor;
      construtoraExecutado += valorConstrutora;
    } else {
      executorPendente += valorExecutor;
      construtoraPendente += valorConstrutora;
    }
  }
  return { executorMedido, executorExecutado, executorPendente, construtoraExecutado, construtoraPendente, pago };
}
