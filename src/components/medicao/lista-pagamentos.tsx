"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, Receipt } from "lucide-react";
import {
  Botao,
  Campo,
  AreaTexto,
  Modal,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
  EstadoVazio,
} from "@/components/ui";
import { formatarMoeda } from "@/lib/utils";
import { formatarData, hojeChave } from "@/lib/datas";
import {
  registrarPagamento,
  excluirPagamento,
} from "@/app/(protegido)/obras/[id]/medicoes/acoes";

export interface ItemPagamento {
  id: string;
  valor: number;
  data_pagamento: string;
  descricao: string;
}

interface ListaPagamentosProps {
  medicaoId: string;
  pagamentos: ItemPagamento[];
}

function parsearNumero(valor: string): number | null {
  const bruto = valor.trim().replace(",", ".");
  if (bruto === "") return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export function ListaPagamentos({ medicaoId, pagamentos }: ListaPagamentosProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrirModal() {
    setValor("");
    setDataPagamento(hojeChave());
    setDescricao("");
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setErro(null);
  }

  function salvar() {
    const valorNumerico = parsearNumero(valor);
    if (valorNumerico == null) {
      setErro("Informe um valor pago válido maior que zero.");
      return;
    }
    if (!dataPagamento.trim()) {
      setErro("Informe a data do pagamento.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Informe uma descrição que identifique o pagamento.");
      return;
    }

    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await registrarPagamento({
        medicaoId,
        valor: valorNumerico,
        dataPagamento: dataPagamento.trim(),
        descricao: descricao.trim(),
      });

      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        fecharModal();
      }
    });
  }

  function handleExcluir(pagamentoId: string, descricaoPagamento: string) {
    if (!window.confirm(`Deseja realmente excluir o pagamento "${descricaoPagamento}"?`)) {
      return;
    }

    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await excluirPagamento({
        pagamentoId,
        medicaoId,
      });

      if (resultado.erro) {
        setErro(resultado.erro);
      }
    });
  }

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);

  return (
    <div>
      {erro && (
        <p className="border-b border-borda bg-perigo/5 px-6 py-3 text-sm text-perigo" role="alert">
          {erro}
        </p>
      )}

      {pagamentos.length === 0 ? (
        <div className="p-6">
          <EstadoVazio
            icone={<Receipt className="h-8 w-8" />}
            titulo="Nenhum pagamento registrado"
            descricao="Registre os pagamentos efetuados para deduzir do valor do contrato."
            acao={
              <button
                type="button"
                onClick={abrirModal}
                className="inline-flex items-center gap-2 rounded-lg bg-azul-600 px-4 py-2 text-sm font-medium text-white hover:bg-azul-700"
              >
                <Plus className="h-4 w-4" />
                Registrar pagamento
              </button>
            }
          />
        </div>
      ) : (
        <>
          <Tabela>
            <Cabecalho>
              <LinhaCabecalho>
                <CelulaCabecalho>Data</CelulaCabecalho>
                <CelulaCabecalho>Identificação / Descrição</CelulaCabecalho>
                <CelulaCabecalho className="text-right">Valor pago</CelulaCabecalho>
                <CelulaCabecalho className="text-right w-20">Ações</CelulaCabecalho>
              </LinhaCabecalho>
            </Cabecalho>
            <Corpo>
              {pagamentos.map((pagamento) => (
                <Linha key={pagamento.id}>
                  <Celula className="font-medium text-superficie-900 whitespace-nowrap">
                    {formatarData(pagamento.data_pagamento)}
                  </Celula>
                  <Celula className="text-superficie-700">
                    {pagamento.descricao}
                  </Celula>
                  <Celula className="text-right font-semibold text-emerald-600 whitespace-nowrap">
                    {formatarMoeda(pagamento.valor)}
                  </Celula>
                  <Celula className="text-right">
                    <Botao
                      type="button"
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => handleExcluir(pagamento.id, pagamento.descricao)}
                      disabled={pendente}
                      aria-label={`Excluir pagamento ${pagamento.descricao}`}
                    >
                      <Trash2 className="h-4 w-4 text-perigo" />
                    </Botao>
                  </Celula>
                </Linha>
              ))}
              <Linha className="bg-superficie-50/60 font-medium">
                <Celula colSpan={2} className="text-superficie-900 font-semibold">
                  Total pago
                </Celula>
                <Celula className="text-right font-bold text-emerald-600 whitespace-nowrap">
                  {formatarMoeda(totalPago)}
                </Celula>
                <Celula />
              </Linha>
            </Corpo>
          </Tabela>

          <div className="p-4 flex justify-end border-t border-borda">
            <Botao type="button" onClick={abrirModal}>
              <Plus className="h-4 w-4" />
              Registrar pagamento
            </Botao>
          </div>
        </>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo="Registrar pagamento"
        descricao="Informe os detalhes do pagamento efetuado para este contrato."
      >
        <div className="space-y-4">
          <Campo
            rotulo="Valor pago (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 15000,00"
            inputMode="decimal"
            obrigatorio
            autoFocus
          />
          <Campo
            rotulo="Data do pagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            obrigatorio
          />
          <AreaTexto
            rotulo="Identificação / Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Pagamento referente à 1ª parcela de infraestrutura elétrica conforme medição..."
            dica="Texto identificando a que se refere o pagamento."
            obrigatorio
          />
          {erro && (
            <p className="text-sm text-perigo" role="alert">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Botao
              type="button"
              variante="contorno"
              onClick={fecharModal}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao type="button" onClick={salvar} carregando={pendente}>
              <Save className="h-3.5 w-3.5" />
              Salvar pagamento
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
