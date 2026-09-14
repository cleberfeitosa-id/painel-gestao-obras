"use client";

import { useState } from "react";
import { Botao, Modal, Selecao } from "@/components/ui";
import { FUNCAO_COLUNA_ORCAMENTO, OPCOES_FUNCAO_COLUNA_ORCAMENTO } from "@/lib/domain/rotulos";
import type { ColunaOrcamento, FuncaoColunaOrcamento } from "@/lib/orcamento/tipos";

const ROTULO_TIPO: Record<ColunaOrcamento["tipo"], string> = {
  texto: "Texto",
  numero: "Número",
  moeda: "Moeda",
};

export function ConfiguracaoIndicadores({
  colunas,
  aoAplicar,
}: {
  colunas: ColunaOrcamento[];
  aoAplicar: (colunas: ColunaOrcamento[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<ColunaOrcamento[]>(colunas);

  function abrir() {
    setRascunho(colunas);
    setAberto(true);
  }

  function alterarFuncao(id: string, valor: string) {
    setRascunho((atuais) =>
      atuais.map((coluna) =>
        coluna.id === id
          ? { ...coluna, funcao: valor === "" ? undefined : (valor as FuncaoColunaOrcamento) }
          : coluna,
      ),
    );
  }

  const porFuncao = new Map<FuncaoColunaOrcamento, string[]>();
  for (const coluna of rascunho) {
    if (!coluna.funcao) continue;
    const nomes = porFuncao.get(coluna.funcao) ?? [];
    nomes.push(coluna.nome);
    porFuncao.set(coluna.funcao, nomes);
  }
  const conflitos = [...porFuncao.entries()].filter(([, nomes]) => nomes.length > 1);

  return (
    <>
      <Botao type="button" variante="contorno" tamanho="sm" onClick={abrir}>
        Configurar indicadores
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Configurar indicadores"
        descricao="Atribua uma função semântica a cada coluna. A primeira coluna com cada função será usada nos cards."
        tamanho="lg"
      >
        <div className="space-y-4">
          {conflitos.map(([funcao, nomes]) => (
            <p
              key={funcao}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              A função “{FUNCAO_COLUNA_ORCAMENTO[funcao].rotulo}” está atribuída a mais de uma coluna (
              {nomes.join(", ")}). A primeira coluna é a utilizada.
            </p>
          ))}
          <div className="space-y-3">
            {rascunho.map((coluna) => (
              <div key={coluna.id} className="rounded-lg border border-borda p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-superficie-800">{coluna.nome}</p>
                  <span className="text-xs text-superficie-500">{ROTULO_TIPO[coluna.tipo]}</span>
                </div>
                <Selecao
                  rotulo="Função"
                  value={coluna.funcao ?? ""}
                  onChange={(evento) => alterarFuncao(coluna.id, evento.target.value)}
                >
                  <option value="">— nenhuma —</option>
                  {OPCOES_FUNCAO_COLUNA_ORCAMENTO.map((funcao) => (
                    <option key={funcao} value={funcao}>
                      {FUNCAO_COLUNA_ORCAMENTO[funcao].rotulo}
                    </option>
                  ))}
                </Selecao>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao
              type="button"
              onClick={() => {
                aoAplicar(rascunho);
                setAberto(false);
              }}
            >
              Aplicar
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}