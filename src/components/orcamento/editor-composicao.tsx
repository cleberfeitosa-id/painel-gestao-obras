"use client";

import { useState, useTransition } from "react";
import { Botao, Cartao, CartaoCabecalho, CartaoConteudo, Campo, Selecao } from "@/components/ui";
import { salvarComposicao } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";
import { CATEGORIA_COMPOSICAO } from "@/lib/domain/rotulos";

type Componente = {
  codigo?: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
};

const componenteVazio: Componente = {
  codigo: "",
  nome: "",
  categoria: "material",
  unidade: "un",
  quantidade: 1,
  custoUnitario: 0,
};

interface EditorComposicaoProps {
  obraId: string;
  composicao?: {
    id: string;
    codigo: string | null;
    nome: string;
    unidade: string;
    componentes: Componente[];
  };
  rotuloBotao?: string;
  aoSalvar?: () => void;
  aoFechar?: () => void;
}

export function EditorComposicao({
  obraId,
  composicao,
  rotuloBotao,
  aoSalvar,
  aoFechar,
}: EditorComposicaoProps) {
  const [codigo, setCodigo] = useState(composicao?.codigo ?? "");
  const [nome, setNome] = useState(composicao?.nome ?? "");
  const [unidade, setUnidade] = useState(composicao?.unidade ?? "un");
  const [componentes, setComponentes] = useState<Componente[]>(
    composicao && composicao.componentes.length > 0 ? composicao.componentes : [componenteVazio],
  );
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: "erro" | "sucesso" } | null>(null);
  const [salvando, iniciarTransicao] = useTransition();

  // Sincroniza o formulario quando a prop composicao muda sem remontagem
  // (padrao React de ajuste de estado durante o render).
  const [composicaoAnterior, setComposicaoAnterior] = useState(composicao);
  if (composicao !== composicaoAnterior) {
    setComposicaoAnterior(composicao);
    setCodigo(composicao?.codigo ?? "");
    setNome(composicao?.nome ?? "");
    setUnidade(composicao?.unidade ?? "un");
    setComponentes(
      composicao && composicao.componentes.length > 0 ? composicao.componentes : [componenteVazio],
    );
    setMensagem(null);
  }

  function atualizar(indice: number, campo: keyof Componente, valor: string) {
    setComponentes((atuais) =>
      atuais.map((item, idx) =>
        idx === indice
          ? {
              ...item,
              [campo]:
                campo === "quantidade" || campo === "custoUnitario"
                  ? Number(valor.replace(",", ".")) || 0
                  : valor,
            }
          : item,
      ),
    );
  }

  function adicionarComponente() {
    setComponentes((atuais) => [...atuais, componenteVazio]);
  }

  function removerComponente(indice: number) {
    setComponentes((atuais) => atuais.filter((_, idx) => idx !== indice));
  }

  function salvar() {
    const componentesValidos = componentes.filter((c) => c.nome.trim() !== "");
    if (componentesValidos.length === 0) {
      setMensagem({ texto: "Adicione pelo menos um componente.", tipo: "erro" });
      return;
    }

    iniciarTransicao(async () => {
      const resultado = await salvarComposicao({
        id: composicao?.id,
        obraId,
        codigo: codigo.trim() || undefined,
        nome,
        unidade,
        componentes: componentesValidos,
      });

      if (resultado.erro) {
        if (resultado.erro.includes("Ciclo de composicao")) {
          setMensagem({
            texto: "Esta composição criaria um ciclo (uma composição não pode depender de si mesma).",
            tipo: "erro",
          });
        } else {
          setMensagem({ texto: resultado.erro, tipo: "erro" });
        }
      } else {
        setMensagem({ texto: "Composição salva.", tipo: "sucesso" });
        if (aoSalvar) aoSalvar();
        if (!composicao && aoFechar) aoFechar();
      }
    });
  }

  const titulo = composicao ? "Editar composição" : "Nova composição";
  const botaoTexto = rotuloBotao ?? (composicao ? "Salvar alterações" : "Salvar composição");

  return (
    <Cartao>
      <CartaoCabecalho>
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </CartaoCabecalho>
      <CartaoConteudo className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo
            rotulo="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código opcional"
            dica="Código único para identificação no orçamento."
          />
          <Campo
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da composicao"
            obrigatorio
          />
          <Campo
            rotulo="Unidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            placeholder="un"
            obrigatorio
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Componente</th>
                <th className="p-2 text-left">Categoria</th>
                <th className="p-2 text-left">Unidade</th>
                <th className="p-2 text-left">Qtd.</th>
                <th className="p-2 text-left">Custo unitário</th>
                <th className="p-2 text-left">Subtotal</th>
                <th className="p-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {componentes.map((item, indice) => (
                <tr key={indice}>
                  <td className="p-1">
                    <input
                      className="w-28 rounded border border-borda px-2 py-1"
                      value={item.codigo ?? ""}
                      onChange={(e) => atualizar(indice, "codigo", e.target.value)}
                      placeholder="Código"
                      aria-label="Código do componente"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      className="w-full rounded border border-borda px-2 py-1"
                      value={item.nome}
                      onChange={(e) => atualizar(indice, "nome", e.target.value)}
                      placeholder="Nome do componente"
                    />
                  </td>
                  <td className="p-1">
                    <Selecao
                      rotulo="Categoria"
                      value={item.categoria}
                      onChange={(e) => atualizar(indice, "categoria", e.target.value)}
                    >
                      {Object.entries(CATEGORIA_COMPOSICAO).map(([valor, { rotulo }]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </Selecao>
                  </td>
                  <td className="p-1">
                    <input
                      className="w-20 rounded border border-borda px-2 py-1"
                      type="text"
                      value={item.unidade}
                      onChange={(e) => atualizar(indice, "unidade", e.target.value)}
                      placeholder="un"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      className="w-24 rounded border border-borda px-2 py-1"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={item.quantidade}
                      onChange={(e) => atualizar(indice, "quantidade", e.target.value)}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      className="w-32 rounded border border-borda px-2 py-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.custoUnitario}
                      onChange={(e) => atualizar(indice, "custoUnitario", e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-sm font-mono tabular-nums text-superficie-600">
                    {formatarSubtotal(item.quantidade, item.custoUnitario)}
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={() => removerComponente(indice)}
                      className="text-superficie-400 hover:text-perigo transition-colors"
                      aria-label="Remover componente"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao type="button" variante="secundario" onClick={adicionarComponente}>
            Adicionar componente
          </Botao>
        </div>

        {mensagem && (
          <div
            role="alert"
            className={`rounded-lg px-4 py-3 text-sm ${
              mensagem.tipo === "erro"
                ? "border border-perigo bg-perigo/5 text-perigo"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-borda">
          {aoFechar && (
            <Botao variante="fantasma" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Botao>
          )}
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            {botaoTexto}
          </Botao>
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}

function formatarSubtotal(quantidade: number, custoUnitario: number): string {
  const valor = quantidade * custoUnitario;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
