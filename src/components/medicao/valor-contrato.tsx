"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import {
  Botao,
  Campo,
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Modal,
} from "@/components/ui";
import { formatarMoeda } from "@/lib/utils";
import { atualizarValorContrato } from "@/app/(protegido)/obras/[id]/medicoes/acoes";

interface ValorContratoProps {
  medicaoId: string;
  valorContrato: number | null;
}

export function ValorContrato({ medicaoId, valorContrato }: ValorContratoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [valor, setValor] = useState(
    valorContrato == null ? "" : String(valorContrato),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrir() {
    setValor(valorContrato == null ? "" : String(valorContrato));
    setErro(null);
    setModalAberto(true);
  }

  function salvar() {
    const bruto = valor.trim().replace(",", ".");
    const valorContratoNovo = bruto === "" ? null : Number(bruto);
    if (valorContratoNovo != null && !Number.isFinite(valorContratoNovo)) {
      setErro("Informe um valor valido.");
      return;
    }
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarValorContrato({
        medicaoId,
        valorContrato: valorContratoNovo,
      });
      if (resultado.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <Cartao>
      <CartaoCabecalho>
        <div className="flex items-center justify-between">
          <CartaoTitulo>Valor do contrato</CartaoTitulo>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={abrir}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Botao>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo>
        <p className="text-2xl font-bold text-azul-600">
          {formatarMoeda(valorContrato)}
        </p>
        <p className="mt-1 text-xs text-superficie-500">
          Valor total contratado da obra
        </p>
      </CartaoConteudo>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo="Valor do contrato"
        descricao="Valor total contratado da obra."
      >
        <div className="space-y-4">
          <Campo
            rotulo="Valor do contrato (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 1500000,00"
            dica="Deixe vazio para limpar o valor."
          />
          {erro && (
            <p className="text-sm text-perigo" role="alert">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setModalAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao type="button" onClick={salvar} carregando={pendente}>
              Salvar
            </Botao>
          </div>
        </div>
      </Modal>
    </Cartao>
  );
}