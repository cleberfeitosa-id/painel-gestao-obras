"use client";

import { Fragment, useState, useTransition } from "react";
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
import { formatarMoeda } from "@/lib/utils";
import { formatarData } from "@/lib/datas";
import { STATUS_TAREFA } from "@/lib/domain/rotulos";
import {
  atualizarPrecoCatalogo,
  criarPrecoCatalogo,
  salvarMedicaoTarefa,
} from "@/app/(protegido)/obras/[id]/medicoes/acoes";
import type { ItemMedicao, TarefaMedicao } from "@/app/(protegido)/obras/[id]/medicoes/[medicaoId]/page";

interface TabelaMedicaoProps {
  medicaoId: string;
  itens: ItemMedicao[];
  temFiltros?: boolean;
  catalogo?: unknown[];
}

function parsearNumero(valor: string): number | null {
  const bruto = valor.trim().replace(",", ".");
  if (bruto === "") return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}

export function TabelaMedicao({ medicaoId, itens, temFiltros }: TabelaMedicaoProps) {
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
  const [novoItemForm, setNovoItemForm] = useState({ nome: "", valorUnitario: "", unidade: "" });

  function alternar(catalogoId: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(catalogoId)) novo.delete(catalogoId);
      else novo.add(catalogoId);
      return novo;
    });
  }

  function salvarPreco(item: ItemMedicao) {
    const bruto = precos[item.catalogoId];
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
      });
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  function salvarQuantidade(tarefa: TarefaMedicao) {
    const chave = `${tarefa.id}-${tarefa.catalogoId}`;
    const quantidade = parsearNumero(quantidades[chave] ?? "");
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await salvarMedicaoTarefa({
        tarefaId: tarefa.id,
        catalogoId: tarefa.catalogoId!,
        quantidade,
      });
      if (resultado.erro) setErro(resultado.erro);
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
    });
  }

  function abrirModalNovoItem() {
    setNovoItemForm({ nome: "", valorUnitario: "", unidade: "" });
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
      });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        fecharModalNovoItem();
      }
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
        <Tabela>
          <Cabecalho>
          <LinhaCabecalho>
            <CelulaCabecalho className="w-10" />
            <CelulaCabecalho>Item</CelulaCabecalho>
            <CelulaCabecalho>Unidade</CelulaCabecalho>
            <CelulaCabecalho>Valor unitário</CelulaCabecalho>
            <CelulaCabecalho className="text-right">Quantidade total</CelulaCabecalho>
            <CelulaCabecalho className="text-right">Valor total</CelulaCabecalho>
            <CelulaCabecalho className="text-right">Ações</CelulaCabecalho>
          </LinhaCabecalho>
        </Cabecalho>
        <Corpo>
          {itens.map((item) => {
            const expandido = expandidos.has(item.catalogoId);
            const preco = precos[item.catalogoId];
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
                        setPrecos((atual) => ({
                          ...atual,
                          [item.catalogoId]: { ...atual[item.catalogoId], nome: e.target.value },
                        }))
                      }
                      placeholder="Nome do item"
                      className="w-full min-w-[150px] rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-superficie-900 focus:border-azul-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-azul-500 hover:border-borda"
                    />
                  </Celula>
                  <Celula>
                    <input
                      value={preco.unidade}
                      onChange={(e) =>
                        setPrecos((atual) => ({
                          ...atual,
                          [item.catalogoId]: { ...atual[item.catalogoId], unidade: e.target.value },
                        }))
                      }
                      placeholder="m"
                      className="w-20 rounded-lg border border-borda px-3 py-1.5 text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                    />
                  </Celula>
                  <Celula>
                    <input
                      value={preco.valorUnitario}
                      onChange={(e) =>
                        setPrecos((atual) => ({
                          ...atual,
                          [item.catalogoId]: { ...atual[item.catalogoId], valorUnitario: e.target.value },
                        }))
                      }
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-28 rounded-lg border border-borda px-3 py-1.5 text-sm text-superficie-900 focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
                    />
                  </Celula>
                  <Celula className="text-right font-medium text-superficie-900">
                    {item.quantidadeTotal}
                  </Celula>
                  <Celula className="text-right font-medium text-superficie-900">
                    {formatarMoeda(item.valorTotal)}
                  </Celula>
                  <Celula className="text-right">
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
                  </Celula>
                </Linha>
                {expandido && (
                  <Linha className="bg-superficie-50/60 hover:bg-superficie-50/60">
                    <Celula colSpan={7} className="p-0">
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
                                    <p className="truncate text-sm font-medium text-superficie-900">
                                      {tarefa.titulo}
                                    </p>
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
                                      <span>
                                        {tarefa.prazo
                                          ? `Prazo: ${formatarData(tarefa.prazo)}`
                                          : "Sem prazo"}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={quantidades[chave] ?? ""}
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
              placeholder="0,00"
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
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Botao variante="contorno" onClick={fecharModalNovoItem}>
            Cancelar
          </Botao>
          <Botao onClick={salvarNovoItem} disabled={pendente}>
            <Save className="h-3.5 w-3.5" />
            Criar
          </Botao>
        </div>
      </Modal>
    </div>
  );
}