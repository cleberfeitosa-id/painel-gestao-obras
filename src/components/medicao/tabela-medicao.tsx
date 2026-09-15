"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Save, Plus, Trash2 } from "lucide-react";
import {
  Botao,
  Etiqueta,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
  Modal,
  Campo,
  EstadoVazio,
} from "@/components/ui";
import { Ruler } from "lucide-react";
import { formatarMoeda, formatarQuantidade } from "@/lib/utils";
import { formatarData } from "@/lib/datas";
import { STATUS_TAREFA } from "@/lib/domain/rotulos";
import {
  atualizarPrecoCatalogo,
  buscarItensOrcamento,
  criarPrecoCatalogo,
  excluirPrecoCatalogo,
  salvarMedicaoTarefa,
} from "@/app/(protegido)/obras/[id]/medicoes/acoes";
import type { ItemOrcamentoParaCatalogo } from "@/app/(protegido)/obras/[id]/medicoes/acoes";
import type { ItemMedicao, TarefaMedicao } from "@/app/(protegido)/obras/[id]/medicoes/[medicaoId]/page";

import { CATEGORIA_COMPOSICAO } from "@/lib/domain/rotulos";

interface TabelaMedicaoProps {
  medicaoId: string;
  obraId: string;
  itens: ItemMedicao[];
  temFiltros?: boolean;
  catalogo?: unknown[];
  mapCustosPorItem?: Map<string, Record<string, number>>;
}

function parsearNumero(valor: string): number | null {
  const bruto = valor.trim().replace(",", ".");
  if (bruto === "") return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}

function valorPrevistoDoItem(item: ItemOrcamentoParaCatalogo): number {
  return item.valor_composicao * Number(item.quantidade);
}

function valorUnitarioComposicao(item: ItemOrcamentoParaCatalogo): number {
  return item.valor_composicao;
}

function somarPrevisto(itens: ItemOrcamentoParaCatalogo[]): number {
  return itens.reduce((acc, item) => acc + valorPrevistoDoItem(item), 0);
}

function escaparCsv(valor: string | number | boolean | null | undefined): string {
  return `"${String(valor ?? "").replaceAll('"', '""')}"`;
}

function numeroCsv(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

function diagnosticoComposicao(item: ItemMedicao): string {
  if (item.orcamentoItens.length === 0) return "Nenhum item orcamentario vinculado";
  const semComposicao = item.orcamentoItens.filter((orcamento) => !orcamento.composicao_id);
  if (semComposicao.length === item.orcamentoItens.length) {
    return "Itens orcamentarios vinculados sem composicao_id";
  }
  if (item.composicaoComponentes.length === 0) {
    return "Composicao vinculada sem componentes detalhados";
  }
  if (Object.keys(item.composicaoCustos).length === 0) {
    return "Composicao sem custos agregados por categoria";
  }
  return "Decomposicao disponivel";
}

function baixarCsv(itens: ItemMedicao[], medicaoId: string) {
  const linhas: string[][] = [
    ["BLOCO", "ITENS"],
    [
      "catalogo_id",
      "item",
      "unidade",
      "preco_executor_unitario",
      "preco_orcamento_unitario",
      "custo_composicao_unitario",
      "valor_composicao_item_unitario",
      "valor_composicao_item_total",
      "composicao_ids",
      "composicao_codigos",
      "composicao_nomes",
      "categorias_composicao",
      "componentes_composicao",
      "diagnostico_composicao",
      "quantidade_total",
      "quantidade_executada",
      "quantidade_a_executar",
      "valor_construtora_medido",
      "valor_construtora_executado",
      "valor_construtora_a_medir",
      "valor_executor_medido",
      "valor_executor_executado",
      "valor_executor_a_medir",
      "custo_mao_de_obra_previsto",
      "custo_material_previsto",
      "custo_equipamento_previsto",
      "itens_orcamento",
    ],
    ...itens.map((item) => [
      item.catalogoId,
      item.nome,
      item.unidade,
      numeroCsv(item.valorUnitario),
      numeroCsv(item.valorUnitarioOrcamento),
      numeroCsv(item.valorUnitarioComposicao),
      item.orcamentoItens.map((orcamento) => numeroCsv(Number(orcamento.valor_composicao))).join(" | "),
      item.orcamentoItens.map((orcamento) => numeroCsv(valorPrevistoDoItem(orcamento))).join(" | "),
      item.orcamentoItens.map((orcamento) => orcamento.composicao_id ?? "").join(" | "),
      item.orcamentoItens.map((orcamento) => orcamento.codigo ?? "").join(" | "),
      item.orcamentoItens.map((orcamento) => orcamento.descricao ?? "").join(" | "),
      Object.entries(item.composicaoCustos)
        .map(([categoria, valor]) => `${categoria}: ${numeroCsv(valor)}`)
        .join(" | "),
      item.composicaoComponentes
        .map((componente) => `${componente.nome} [${componente.categoria}] qtd=${numeroCsv(componente.quantidade)} unit=${numeroCsv(componente.valorUnitario)} total=${numeroCsv(componente.valorContribuicao)}`)
        .join(" | "),
      diagnosticoComposicao(item),
      numeroCsv(item.quantidadeTotal),
      numeroCsv(item.quantidadeExecutada),
      numeroCsv(item.quantidadePendente),
      numeroCsv(item.valorConstrutoraTotal),
      numeroCsv(item.valorConstrutoraExecutado),
      numeroCsv(item.valorConstrutoraPendente),
      numeroCsv(item.valorExecutorTotal),
      numeroCsv(item.valorExecutorExecutado),
      numeroCsv(item.valorExecutorPendente),
      numeroCsv(item.composicaoCustos.mao_de_obra ?? 0),
      numeroCsv(item.composicaoCustos.material ?? 0),
      numeroCsv(item.composicaoCustos.equipamento ?? 0),
      item.orcamentoItens.map((orcamento) => `${orcamento.codigo ?? ""} - ${orcamento.descricao ?? ""}`).join(" | "),
    ]),
    ["", ""],
    ["BLOCO", "TAREFAS"],
    [
      "catalogo_id",
      "item",
      "tarefa_id",
      "tarefa",
      "quantidade",
      "status",
      "aprovacao",
      "preco_executor_unitario",
      "preco_orcamento_unitario",
      "valor_executor",
      "valor_construtora",
      "valor_mao_de_obra_previsto",
      "executor_identificado",
      "responsavel",
      "planta",
    ],
    ...itens.flatMap((item) => item.tarefas.map((tarefa) => [
      item.catalogoId,
      item.nome,
      tarefa.id,
      tarefa.titulo,
      numeroCsv(Number(tarefa.quantidade ?? 0)),
      tarefa.status,
      tarefa.aprovacao,
      numeroCsv(item.valorUnitario),
      numeroCsv(item.valorUnitarioOrcamento),
      numeroCsv(Number(tarefa.quantidade ?? 0) * item.valorUnitario),
      numeroCsv(Number(tarefa.quantidade ?? 0) * item.valorUnitarioOrcamento),
      numeroCsv(Number(tarefa.quantidade ?? 0) * item.valorUnitarioMaoObra),
      tarefa.executor?.nome ?? "",
      tarefa.responsavel?.nome ?? "",
      tarefa.planta?.nome ?? "",
    ])),
  ];

  const conteudo = "\uFEFF" + linhas.map((linha) => linha.map(escaparCsv).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `medicao-${medicaoId}-itens.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SeletorItemOrcamento({
  obraId,
  medicaoId,
  selecionados,
  aoAdicionar,
  aoRemover,
}: {
  obraId: string;
  medicaoId: string;
  selecionados: ItemOrcamentoParaCatalogo[];
  aoAdicionar: (item: ItemOrcamentoParaCatalogo) => void;
  aoRemover: (itemId: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ItemOrcamentoParaCatalogo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const idsSelecionados = new Set(selecionados.map((s) => s.id));

  async function buscar() {
    const termoLimpo = termo.trim();
    if (!termoLimpo) return;
    setBuscando(true);
    setErroBusca(null);
    const resultado = await buscarItensOrcamento({ medicaoId, obraId, termo: termoLimpo });
    if ("erro" in resultado) {
      setErroBusca(resultado.erro);
      setResultados([]);
    } else {
      setResultados(resultado.itens);
    }
    setMostrarResultados(true);
    setBuscando(false);
  }

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-superficie-500">
        Itens do orçamento
      </p>
      {selecionados.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full border border-azul-200 bg-azul-50/50 px-2.5 py-1 text-xs"
            >
              <span className="max-w-[200px] truncate font-medium text-superficie-900">
                {item.codigo ?? "—"} · {item.descricao ?? "Sem descrição"}
              </span>
              <span className="text-[10px] text-superficie-500">
                {formatarMoeda(valorUnitarioComposicao(item))}/un · qtd. {formatarQuantidade(Number(item.quantidade))} · total {formatarMoeda(valorPrevistoDoItem(item))}
              </span>
              <button
                type="button"
                onClick={() => aoRemover(item.id)}
                className="ml-0.5 shrink-0 text-xs leading-none text-perigo hover:text-perigo/80"
                aria-label={`Remover ${item.codigo ?? item.descricao ?? "item"}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-superficie-400">Nenhum item vinculado</p>
      )}
      <div className="flex gap-1.5">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Buscar por código ou descrição"
          className="min-w-0 flex-1 rounded-lg border border-borda px-2.5 py-1.5 text-xs text-superficie-900 placeholder:text-superficie-400 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
        />
        <Botao
          type="button"
          variante="contorno"
          tamanho="sm"
          onClick={buscar}
          disabled={buscando}
        >
          {buscando ? "Buscando..." : "Buscar"}
        </Botao>
      </div>
      {mostrarResultados && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-borda bg-white">
          {resultados.length === 0 && !buscando ? (
            <p className="px-2.5 py-2 text-xs text-superficie-500">
              Nenhum item encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-superficie-100">
              {resultados.map((item) => {
                const jaVinculado = idsSelecionados.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!jaVinculado) aoAdicionar(item);
                        setMostrarResultados(false);
                        setTermo("");
                      }}
                      disabled={jaVinculado}
                      className="w-full px-2.5 py-2 text-left hover:bg-superficie-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <p className="text-xs font-medium text-superficie-900">
                        {item.codigo ?? "—"} · {item.descricao ?? "Sem descrição"} ·{" "}
                        {item.unidade ?? "—"}
                      </p>
                      <p className="text-[11px] text-superficie-500">
                        Composição: {formatarMoeda(valorUnitarioComposicao(item))}/un · Previsto: {formatarMoeda(valorPrevistoDoItem(item))}
                        {jaVinculado && " (já vinculado)"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {erroBusca && <p className="text-xs text-perigo">{erroBusca}</p>}
    </div>
  );
}

export function TabelaMedicao({ medicaoId, obraId, itens, temFiltros }: TabelaMedicaoProps) {
  const router = useRouter();
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [precos, setPrecos] = useState<Record<string, { nome: string; valorUnitario: string; unidade: string }>>(
    () =>
      Object.fromEntries(
        itens.map((item) => [
          item.catalogoId,
          {
            nome: item.nome,
            valorUnitario: String(item.valorUnitario),
            unidade: item.unidade === "—" ? "" : item.unidade,
          },
        ]),
      ),
  );
  const [vinculosOrcamento, setVinculosOrcamento] = useState<
    Record<string, ItemOrcamentoParaCatalogo[]>
  >(() => Object.fromEntries(itens.map((item) => [item.catalogoId, item.orcamentoItens ?? []])));
  const [quantidades, setQuantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      itens.flatMap((item) =>
        item.tarefas.map((tarefa) => [
          `${tarefa.id}-${tarefa.catalogoId}`,
          tarefa.quantidade == null ? "" : String(tarefa.quantidade),
        ]),
      ),
    ),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [modalNovoItemAberto, setModalNovoItemAberto] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState<{
    nome: string;
    valorUnitario: string;
    unidade: string;
    orcamentoItens: ItemOrcamentoParaCatalogo[];
  }>({ nome: "", valorUnitario: "", unidade: "", orcamentoItens: [] });

  function obterPreco(item: ItemMedicao) {
    return (
      precos[item.catalogoId] ?? {
        nome: item.nome,
        valorUnitario: String(item.valorUnitario),
        unidade: item.unidade === "—" ? "" : item.unidade,
      }
    );
  }

  function alternar(catalogoId: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(catalogoId)) novo.delete(catalogoId);
      else novo.add(catalogoId);
      return novo;
    });
  }

  function salvarPreco(item: ItemMedicao) {
    const bruto = obterPreco(item);
    const valorUnitario = parsearNumero(bruto.valorUnitario);
    if (!bruto.nome.trim()) {
      setErro("Informe o nome do item.");
      return;
    }
    if (valorUnitario == null) {
      setErro("Informe um valor unitario valido.");
      return;
    }
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarPrecoCatalogo({
        catalogoId: item.catalogoId,
        medicaoId,
        nome: bruto.nome.trim(),
        valorUnitario,
        unidade: bruto.unidade.trim() || "m",
        orcamentoItemId: vinculosOrcamento[item.catalogoId]?.map((i) => i.id).filter(Boolean) as string[] | undefined,
      });
      if (resultado.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  function salvarQuantidade(tarefa: TarefaMedicao) {
    const chave = `${tarefa.id}-${tarefa.catalogoId}`;
    const valorBruto =
      quantidades[chave] ??
      (tarefa.quantidade == null ? "" : String(tarefa.quantidade));
    if (valorBruto.trim() !== "" && parsearNumero(valorBruto) == null) {
      setErro("Informe uma quantidade valida ou deixe o campo vazio para remover a medicao.");
      return;
    }
    const quantidade = parsearNumero(valorBruto);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await salvarMedicaoTarefa({
        tarefaId: tarefa.id,
        catalogoId: tarefa.catalogoId!,
        quantidade,
      });
      if (resultado.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  function removerQuantidade(tarefa: TarefaMedicao) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await salvarMedicaoTarefa({
        tarefaId: tarefa.id,
        catalogoId: tarefa.catalogoId!,
        quantidade: null,
      });
       if (resultado.erro) setErro(resultado.erro);
       else {
         setQuantidades((atual) => ({ ...atual, [`${tarefa.id}-${tarefa.catalogoId}`]: "" }));
         router.refresh();
       }
    });
  }

  function abrirModalNovoItem() {
    setNovoItemForm({ nome: "", valorUnitario: "", unidade: "", orcamentoItens: [] });
    setModalNovoItemAberto(true);
  }

  function fecharModalNovoItem() {
    setModalNovoItemAberto(false);
  }

  function salvarNovoItem() {
    const valorUnitario = parsearNumero(novoItemForm.valorUnitario);
    if (!novoItemForm.nome.trim()) {
      setErro("Informe o nome do item.");
      return;
    }
    if (valorUnitario == null) {
      setErro("Informe um valor unitario valido.");
      return;
    }
    if (!novoItemForm.unidade.trim()) {
      setErro("Informe a unidade.");
      return;
    }

    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await criarPrecoCatalogo({
        medicaoId,
        nome: novoItemForm.nome.trim(),
        valorUnitario,
        unidade: novoItemForm.unidade.trim(),
        orcamentoItemId: novoItemForm.orcamentoItens.map((i) => i.id).filter(Boolean) as string[] | undefined,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        fecharModalNovoItem();
        router.refresh();
      }
    });
  }

  function excluirItem(item: ItemMedicao) {
    if (!window.confirm(`Excluir o item "${item.nome}" do catalogo?`)) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await excluirPrecoCatalogo({ catalogoId: item.catalogoId, medicaoId });
      if (resultado.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div>
      {erro && (
        <p className="border-b border-borda bg-perigo/5 px-6 py-3 text-sm text-perigo" role="alert">
          {erro}
        </p>
      )}

      {itens.length === 0 ? (
        <div className="p-6">
          <EstadoVazio
            icone={<Ruler className="h-8 w-8" />}
            titulo="Nenhum item de medição"
            descricao={
              temFiltros
                ? "Nenhuma tarefa encontrada com os filtros aplicados."
                : "Crie itens no catálogo de preços para começar a medir."
            }
            acao={
              <button
                type="button"
                onClick={abrirModalNovoItem}
                className="inline-flex items-center gap-2 rounded-lg bg-azul-600 px-4 py-2 text-sm font-medium text-white hover:bg-azul-700"
              >
                <Plus className="h-4 w-4" />
                Novo item
              </button>
            }
          />
        </div>
      ) : (
        <>
        <div className="flex justify-end border-b border-borda px-6 py-3">
          <Botao type="button" variante="contorno" tamanho="sm" onClick={() => baixarCsv(itens, medicaoId)}>
            Exportar CSV
          </Botao>
        </div>
        <Tabela>
          <Cabecalho>
          <LinhaCabecalho>
            <CelulaCabecalho className="w-10" />
            <CelulaCabecalho>Item</CelulaCabecalho>
            <CelulaCabecalho>Unidade</CelulaCabecalho>
            <CelulaCabecalho title="Preço unitário negociado para o contrato executor deste item">Preço do contrato executor</CelulaCabecalho>
            <CelulaCabecalho className="text-right" title="Custo previsto da composição = custo unitário dos componentes × quantidade prevista no orçamento">
              Custo composição
            </CelulaCabecalho>
            <CelulaCabecalho className="text-right">Qtd. total</CelulaCabecalho>
            <CelulaCabecalho className="text-right">Qtd. executada</CelulaCabecalho>
            <CelulaCabecalho className="text-right" title="Quantidade medida × valor unitário do orçamento/composição vinculado">
              Total construtora
            </CelulaCabecalho>
            <CelulaCabecalho className="text-right" title="Preço do orçamento × quantidade das tarefas concluídas">
              Medido construtora
            </CelulaCabecalho>
            <CelulaCabecalho className="text-right" title="Preço do contrato executor × quantidade das tarefas concluídas">
              Medido executor
            </CelulaCabecalho>
            <CelulaCabecalho className="text-right" title="Custo previsto de mão de obra da composição correspondente à quantidade concluída; não é pagamento do executor">
              Custo MO executado
            </CelulaCabecalho>
            <CelulaCabecalho className="text-right">A medir construtora</CelulaCabecalho>
            <CelulaCabecalho className="text-right">Ações</CelulaCabecalho>
          </LinhaCabecalho>
        </Cabecalho>
        <Corpo>
          {itens.map((item) => {
            const expandido = expandidos.has(item.catalogoId);
            const preco = obterPreco(item);
            const vinculo = vinculosOrcamento[item.catalogoId] ?? [];
            return (
              <Fragment key={item.catalogoId}>
                <Linha>
                  <Celula>
                    <button
                      type="button"
                      onClick={() => alternar(item.catalogoId)}
                      aria-expanded={expandido}
                      aria-label={expandido ? "Recolher tarefas" : "Expandir tarefas"}
                      className="rounded-lg p-1 text-superficie-400 hover:bg-superficie-100 hover:text-superficie-700 transition-colors"
                    >
                      {expandido ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </Celula>
                  <Celula>
                    <input
                      value={preco.nome}
                      onChange={(e) =>
                        setPrecos((atual) => {
                          const itemPreco = atual[item.catalogoId] ?? obterPreco(item);
                          return {
                            ...atual,
                            [item.catalogoId]: { ...itemPreco, nome: e.target.value },
                          };
                        })
                      }
                      placeholder="Nome do item"
                      className="w-full min-w-[150px] rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-superficie-900 focus:border-azul-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-azul-500 hover:border-borda"
                    />
                      <SeletorItemOrcamento
                        obraId={obraId}
                        medicaoId={medicaoId}
                      selecionados={vinculo}
                      aoAdicionar={(itemOrcamento) =>
                        setVinculosOrcamento((atual) => {
                          const atualLista = atual[item.catalogoId] ?? [];
                          if (atualLista.some((i) => i.id === itemOrcamento.id)) {
                            return atual;
                          }
                          return {
                            ...atual,
                            [item.catalogoId]: [...atualLista, itemOrcamento],
                          };
                        })
                      }
                      aoRemover={(itemId) =>
                        setVinculosOrcamento((atual) => ({
                          ...atual,
                          [item.catalogoId]: (atual[item.catalogoId] ?? []).filter(
                            (i) => i.id !== itemId,
                          ),
                        }))
                      }
                    />
                    {item.composicaoComponentes.length > 0 && (
                      <div className="mt-2 rounded-lg border border-superficie-200 bg-superficie-50 p-2 text-xs">
                        <p className="font-semibold text-superficie-700">Componentes da composição</p>
                        <ul className="mt-1 space-y-0.5 text-superficie-600">
                          {item.composicaoComponentes.map((componente, indice) => (
                            <li key={`${componente.nome}-${indice}`} className="flex flex-wrap justify-between gap-x-3">
                              <span>{componente.nome} ({CATEGORIA_COMPOSICAO[componente.categoria]?.rotulo ?? componente.categoria})</span>
                              <span>{formatarMoeda(componente.valorUnitario)}/un · {formatarMoeda(componente.valorContribuicao)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Object.keys(item.composicaoCustos).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(item.composicaoCustos).map(([cat, total]) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 rounded-full bg-superficie-100 px-2 py-0.5 text-[10px] font-medium text-superficie-600"
                          >
                            {CATEGORIA_COMPOSICAO[cat]?.rotulo ?? cat}: {formatarMoeda(total)}
                          </span>
                        ))}
                      </div>
                    )}
                  </Celula>
                  <Celula>
                    <input
                      value={preco.unidade}
                      onChange={(e) =>
                        setPrecos((atual) => {
                          const itemPreco = atual[item.catalogoId] ?? obterPreco(item);
                          return {
                            ...atual,
                            [item.catalogoId]: { ...itemPreco, unidade: e.target.value },
                          };
                        })
                      }
                      placeholder="m"
                      className="w-20 rounded-lg border border-borda px-3 py-1.5 text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                    />
                  </Celula>
                  <Celula>
                    <input
                      value={preco.valorUnitario}
                      onChange={(e) =>
                        setPrecos((atual) => {
                          const itemPreco = atual[item.catalogoId] ?? obterPreco(item);
                          return {
                            ...atual,
                            [item.catalogoId]: { ...itemPreco, valorUnitario: e.target.value },
                          };
                        })
                      }
                      placeholder="Preço acordado"
                      inputMode="decimal"
                      className="w-28 rounded-lg border border-borda px-3 py-1.5 text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                    />
                  </Celula>
                  <Celula className="text-right whitespace-nowrap">
                    {vinculo.length > 0 ? (
                      <div>
                        {item.temBaseMaoObra ? (
                          <p className="font-semibold text-azul-700">
                            Custo unitário da composição: {formatarMoeda(item.valorUnitarioComposicao)}
                          </p>
                        ) : (
                          <p className="font-medium text-superficie-500">Decomposição de custos indisponível</p>
                        )}
                        <p className="text-xs text-superficie-500">
                          {vinculo.length}{" "}
                          {vinculo.length === 1 ? "item vinculado" : "itens vinculados"}
                        </p>
                         <p className="mt-1 text-[10px] leading-tight text-superficie-400">
                           Custo previsto total da composição: {formatarMoeda(somarPrevisto(vinculo))}
                           {item.composicaoCustos.material != null && (
                             <> · Material: {formatarMoeda(item.composicaoCustos.material)}</>
                           )}
                           {item.composicaoCustos.equipamento != null && (
                             <> · Equipamento: {formatarMoeda(item.composicaoCustos.equipamento)}</>
                           )}
                         </p>
                        <p className="text-xs text-superficie-500">Medição da construtora: {formatarMoeda(item.valorConstrutoraTotal)}</p>
                         <p className="text-xs text-emerald-600">Medido construtora executado: {formatarMoeda(item.valorConstrutoraExecutado)}</p>
                         <p className="text-xs text-azul-600">Medido executor executado: {formatarMoeda(item.valorExecutorExecutado)}</p>
                         <p className="text-xs text-azul-600">
                            Custo orçamentário de mão de obra executada: {item.temBaseMaoObra ? formatarMoeda(item.valorContabilizado) : "Indisponível"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-superficie-400">—</span>
                    )}
                  </Celula>
                  <Celula className="text-right font-medium text-superficie-900 whitespace-nowrap">
                    {formatarQuantidade(item.quantidadeTotal)}
                  </Celula>
                   <Celula className="text-right font-medium whitespace-nowrap">
                     <span
                      className={
                        item.quantidadeExecutada > 0
                          ? "font-semibold text-emerald-600"
                          : "text-superficie-500"
                      }
                    >
                      {formatarQuantidade(item.quantidadeExecutada)}
                     </span>
                   </Celula>
                   <Celula className="text-right font-medium text-superficie-900 whitespace-nowrap">
                      {formatarMoeda(item.valorConstrutoraTotal)}
                   </Celula>
                  <Celula className="text-right font-medium whitespace-nowrap">
                    <span
                      className={
                        item.valorExecutado > 0
                          ? "font-semibold text-emerald-600"
                          : "text-superficie-500"
                      }
                     >
                         {formatarMoeda(item.valorConstrutoraExecutado)}
                      </span>
                    </Celula>
                    <Celula className="text-right font-medium whitespace-nowrap">
                      <span className={item.valorExecutorExecutado > 0 ? "font-semibold text-azul-600" : "text-superficie-500"}>
                        {formatarMoeda(item.valorExecutorExecutado)}
                      </span>
                    </Celula>
                   <Celula className="text-right font-medium whitespace-nowrap">
                     <span
                       className={
                         item.valorContabilizado > 0
                           ? "font-semibold text-azul-600"
                           : "text-superficie-500"
                       }
                      >
                        {item.temBaseMaoObra ? formatarMoeda(item.valorContabilizado) : "—"}
                      </span>
                    </Celula>
                  <Celula className="text-right font-medium whitespace-nowrap">
                    <span
                      className={
                        item.valorPendente > 0
                          ? "font-semibold text-amber-600"
                          : "text-superficie-400"
                      }
                    >
                          {formatarMoeda(item.valorConstrutoraPendente)}
                    </span>
                  </Celula>
                   <Celula className="text-right whitespace-nowrap">
                     <div className="flex justify-end gap-1">
                       <Botao
                         type="button"
                         variante="contorno"
                         tamanho="sm"
                         onClick={() => salvarPreco(item)}
                         disabled={pendente}
                       >
                         <Save className="h-3.5 w-3.5" />
                         Salvar
                       </Botao>
                       <Botao
                         type="button"
                         variante="fantasma"
                         tamanho="sm"
                         onClick={() => excluirItem(item)}
                         disabled={pendente}
                         aria-label={`Excluir item ${item.nome}`}
                       >
                         <Trash2 className="h-3.5 w-3.5 text-perigo" />
                       </Botao>
                     </div>
                   </Celula>
                </Linha>
                {expandido && (
                  <Linha className="bg-superficie-50/60 hover:bg-superficie-50/60">
                      <Celula colSpan={13} className="p-0">
                      <div className="px-6 py-4">
                        {item.tarefas.length === 0 ? (
                          <p className="text-sm text-superficie-500">
                            Nenhuma tarefa com este item de catálogo.
                          </p>
                        ) : (
                          <ul className="divide-y divide-superficie-100">
                            {item.tarefas.map((tarefa) => {
                              const chave = `${tarefa.id}-${tarefa.catalogoId}`;
                              return (
                                <li
                                  key={chave}
                                  className="flex flex-wrap items-center gap-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-sm font-medium text-superficie-900">
                                        {tarefa.titulo}
                                      </p>
                                       {tarefa.status === "concluido" && tarefa.aprovacao === "aprovado" ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                          Executado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                          Pendente
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-superficie-500">
                                      <Etiqueta
                                        className={STATUS_TAREFA[tarefa.status]?.classe}
                                      >
                                        {STATUS_TAREFA[tarefa.status]?.rotulo}
                                      </Etiqueta>
                                      <span>{tarefa.planta?.nome ?? "Sem planta"}</span>
                                       <span>
                                         {tarefa.responsavel?.nome ?? "Sem responsável"}
                                       </span>
                                       <span title="Identificação operacional; não define o beneficiário financeiro do contrato executor">
                                         Colaborador identificado: {tarefa.executor?.nome ?? "Não definido"}
                                       </span>
                                      <span>
                                        {tarefa.prazo
                                          ? `Prazo: ${formatarData(tarefa.prazo)}`
                                          : "Sem prazo"}
                                      </span>
                                       {tarefa.quantidade != null && tarefa.quantidade > 0 && (
                                         <>
                                           <span className="font-medium text-superficie-700">
                                              Contrato executor: {formatarMoeda(tarefa.quantidade * item.valorUnitario)}
                                           </span>
                                            {tarefa.status === "concluido" && tarefa.aprovacao === "aprovado" && (
                                              <span className="font-medium text-azul-600">
                                                  Custo orçamentário de mão de obra: {formatarMoeda(tarefa.quantidade * item.valorUnitarioMaoObra)}
                                             </span>
                                           )}
                                         </>
                                       )}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={
                                        quantidades[chave] ??
                                        (tarefa.quantidade == null
                                          ? ""
                                          : String(tarefa.quantidade))
                                      }
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setQuantidades((atual) => ({
                                          ...atual,
                                          [chave]: e.target.value,
                                        }))
                                      }
                                      placeholder="Qtd."
                                      inputMode="decimal"
                                      className="w-24 rounded-lg border border-borda px-3 py-1.5 text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                                    />
                                    <Botao
                                      type="button"
                                      variante="contorno"
                                      tamanho="sm"
                                      onClick={() => salvarQuantidade(tarefa)}
                                      disabled={pendente}
                                      aria-label={`Salvar quantidade de ${tarefa.titulo}`}
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                    </Botao>
                                    {tarefa.quantidade != null && tarefa.quantidade > 0 && (
                                      <Botao
                                        type="button"
                                        variante="fantasma"
                                        tamanho="sm"
                                        onClick={() => removerQuantidade(tarefa)}
                                        disabled={pendente}
                                        aria-label={`Remover quantidade de ${tarefa.titulo}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-perigo" />
                                      </Botao>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </Celula>
                  </Linha>
                )}
              </Fragment>
            );
          })}
        </Corpo>
       </Tabela>
       </>
      )}

      {itens.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Botao type="button" onClick={abrirModalNovoItem}>
            <Plus className="h-4 w-4" />
            Novo item do catálogo
          </Botao>
        </div>
      )}

      <Modal
        aberto={modalNovoItemAberto}
        aoFechar={fecharModalNovoItem}
        titulo="Novo item do catálogo"
      >
        <div className="space-y-4">
             <Campo
            rotulo="Nome do item"
            value={novoItemForm.nome}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNovoItemForm((a) => ({ ...a, nome: e.target.value }))
            }
            placeholder="Ex: Concreto FCK 25 MPa"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor unitário"
              type="text"
              inputMode="decimal"
              value={novoItemForm.valorUnitario}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNovoItemForm((a) => ({ ...a, valorUnitario: e.target.value }))
              }
               placeholder="Preço acordado com o executor"
            />
            <Campo
              rotulo="Unidade"
              value={novoItemForm.unidade}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNovoItemForm((a) => ({ ...a, unidade: e.target.value }))
              }
              placeholder="m³"
            />
          </div>
          <SeletorItemOrcamento
            obraId={obraId}
            medicaoId={medicaoId}
            selecionados={novoItemForm.orcamentoItens}
            aoAdicionar={(item) =>
              setNovoItemForm((a) => ({
                ...a,
                orcamentoItens: a.orcamentoItens.some((i) => i.id === item.id)
                  ? a.orcamentoItens
                  : [...a.orcamentoItens, item],
              }))
            }
            aoRemover={(itemId) =>
              setNovoItemForm((a) => ({
                ...a,
                orcamentoItens: a.orcamentoItens.filter((i) => i.id !== itemId),
              }))
            }
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Botao variante="contorno" onClick={fecharModalNovoItem}>
            Cancelar
          </Botao>
          <Botao onClick={salvarNovoItem} disabled={pendente} carregando={pendente}>
            <Save className="h-3.5 w-3.5" />
            Criar
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
