"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buscarInsumosCompra,
  criarCompra,
} from "@/app/(protegido)/obras/[id]/compras/acoes";
import type { InsumoCompra } from "@/app/(protegido)/obras/[id]/compras/acoes";
import {
  Botao,
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
} from "@/components/ui";
import { formatarMoeda } from "@/lib/utils";

type LinhaCompra = Omit<InsumoCompra, "quantidadeReal" | "valorUnitarioReal" | "componenteId" | "orcamentoItemId" | "composicaoId"> & {
  componenteId: string | null;
  orcamentoItemId: string | null;
  composicaoId: string | null;
  nome: string;
  unidade: string;
  categoria: InsumoCompra["categoria"];
  quantidadeReal: number | null;
  valorUnitarioReal: number | null;
  alterado: boolean;
};

export function NovaCompra({
  obraId,
}: {
  obraId: string;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // cabecalho
  const [fornecedor, setFornecedor] = useState("");
  const [documento, setDocumento] = useState("");
  const [dataCompra, setDataCompra] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [observacao, setObservacao] = useState("");

  // autocomplete
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<InsumoCompra[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [insumos, setInsumos] = useState<LinhaCompra[]>([]);

  // -- autocomplete --
  const buscar = useCallback(async (termo: string) => {
    if (!termo.trim()) {
      setResultadosBusca([]);
      setMostrarResultados(false);
      return;
    }
    setBuscando(true);
    const res = await buscarInsumosCompra(obraId, termo);
    if ("insumos" in res) {
      setErro(null);
      const linhas = (res.insumos ?? []).map((insumo) => ({
        ...insumo,
        quantidadeReal: null,
        valorUnitarioReal: null,
        alterado: false,
      }));
      setResultadosBusca(res.insumos ?? []);
      setInsumos((prev) => {
        const existentes = new Set(prev.map((item) => `${item.componenteId ?? "manual"}:${item.orcamentoItemId ?? item.nome}`));
        const novos = linhas.filter((item) => !existentes.has(`${item.componenteId ?? "manual"}:${item.orcamentoItemId ?? item.nome}`));
        return [...prev, ...novos];
      });
      setMostrarResultados(false);
    } else {
      setResultadosBusca([]);
      setErro(res.erro ?? "Nao foi possivel buscar os insumos.");
      setMostrarResultados(true);
    }
    setBuscando(false);
  }, [obraId]);

  const executarBusca = useCallback(() => {
    void buscar(termoBusca);
  }, [buscar, termoBusca]);

  const alterarInsumo = useCallback((index: number, campo: "quantidadeReal" | "valorUnitarioReal", valor: string) => {
    const numero = Number(valor.replace(",", "."));
    const valorNumerico = valor.trim() === "" ? null : Number.isFinite(numero) && numero >= 0 ? numero : 0;
    setInsumos((prev) => prev.map((item, i) => i === index ? { ...item, [campo]: valorNumerico, alterado: true } : item));
  }, []);

  const removerInsumo = useCallback((index: number) => {
    setInsumos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const adicionarInsumoManual = useCallback(() => {
    setInsumos((prev) => [...prev, {
      componenteId: null,
      orcamentoItemId: null,
      orcamentoCodigo: null,
      orcamentoDescricao: null,
      quantidadeComposicao: 0,
      quantidadePrevista: 0,
      valorPrevisto: 0,
      codigo: null,
      nome: "",
      unidade: "un",
      coeficiente: 0,
      custoUnitario: 0,
      composicaoId: null,
      composicaoCodigo: null,
      composicaoNome: "Insumo manual",
      categoria: "material",
      quantidadeReal: null,
      valorUnitarioReal: null,
      alterado: true,
    }]);
  }, []);

  const alterarTexto = useCallback((index: number, campo: "codigo" | "nome" | "unidade", valor: string) => {
    setInsumos((prev) => prev.map((item, i) => i === index ? { ...item, [campo]: valor, alterado: true } : item));
  }, []);

  const limparSelecao = useCallback(() => {
    setInsumos([]);
  }, []);

  // -- salvar --
  function salvar() {
    if (!fornecedor.trim()) {
      setErro("Informe o fornecedor.");
      return;
    }
    const linhasAlteradas = insumos.filter((item) => item.alterado);
    if (linhasAlteradas.length === 0) {
      setErro("Altere pelo menos um item para incluí-lo na compra.");
      return;
    }
    if (linhasAlteradas.some((item) => !item.nome.trim() || !item.unidade.trim() || item.quantidadeReal === null || item.quantidadeReal <= 0 || item.valorUnitarioReal === null || item.valorUnitarioReal < 0)) {
      setErro("Preencha descrição, unidade, quantidade e valor unitário real dos itens alterados.");
      return;
    }
    const itensParaEnviar = linhasAlteradas.map((c) => ({
      orcamentoItemId: c.orcamentoItemId,
      composicaoId: c.composicaoId,
      composicaoComponenteId: c.componenteId,
      codigoInsumo: c.codigo,
      descricao: c.nome,
      unidade: c.unidade,
      quantidade: c.quantidadeReal as number,
      valorUnitario: c.valorUnitarioReal as number,
      categoria: c.categoria,
      coeficiente: c.coeficiente,
    }));

    setErro(null);
    iniciar(async () => {
      const resultado = await criarCompra({
        obraId,
        fornecedor: fornecedor.trim() || null,
        documento: documento.trim() || null,
        dataCompra,
        observacao: observacao.trim() || null,
        itens: itensParaEnviar,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setFornecedor("");
        setDocumento("");
        setObservacao("");
        setTermoBusca("");
        setResultadosBusca([]);
        setMostrarResultados(false);
        limparSelecao();
        router.refresh();
      }
    });
  }

  // -- totais calculados --
  const totalReal = insumos.reduce((s, c) => s + (c.quantidadeReal ?? 0) * (c.valorUnitarioReal ?? 0), 0);

  return (
    <Cartao>
      <CartaoCabecalho>
        <div>
          <h2 className="text-lg font-semibold">Cadastrar compra</h2>
          <p className="text-sm text-superficie-500">
        Registre o custo efetivamente comprado para materiais, separado da medição contratual de mão de obra.
          </p>
        </div>
      </CartaoCabecalho>

      <CartaoConteudo className="space-y-6">
        {erro && (
          <div
            role="alert"
            className="rounded-lg border border-perigo bg-perigo/5 px-4 py-2 text-sm font-medium text-perigo"
          >
            {erro}
          </div>
        )}

        {/* --- Cabeçalho: fornecedor, documento, data --- */}
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-lg border border-borda px-3 py-2 text-sm"
            placeholder="Fornecedor *"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
          />
          <input
            className="rounded-lg border border-borda px-3 py-2 text-sm"
            placeholder="Nota fiscal / pedido"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
          <input
            className="rounded-lg border border-borda px-3 py-2 text-sm"
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
          />
          <input
            className="rounded-lg border border-borda px-3 py-2 text-sm sm:col-span-3"
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {/* --- Autocomplete: buscar insumo --- */}
         <div className="space-y-2">
           <div className="flex items-center justify-between gap-3">
             <label className="text-sm font-medium text-superficie-700">
             Código do item ou composição
             </label>
             <button type="button" onClick={adicionarInsumoManual} className="text-sm font-medium text-azul-700 hover:text-azul-800">
               + Adicionar insumo manual
             </button>
           </div>

          <div className="relative">
             <div className="flex gap-2">
               <input
                 className="min-w-0 flex-1 rounded-lg border border-borda px-3 py-2 text-sm"
                 placeholder="Digite o código do item ou da composição..."
                 value={termoBusca}
                 onChange={(e) => setTermoBusca(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === "Enter") {
                   e.preventDefault();
                   executarBusca();
                 }
               }}
               />
               <Botao type="button" onClick={executarBusca} disabled={buscando || !termoBusca.trim()}>
                 {buscando ? "Buscando..." : "Buscar"}
               </Botao>
             </div>
            {mostrarResultados && resultadosBusca.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-borda bg-white shadow-lg">
                   <ul className="divide-y divide-superficie-100">
                     {resultadosBusca.map((insumo) => (
                       <li key={insumo.componenteId + insumo.orcamentoItemId}>
                         <div className="w-full px-3 py-2.5 text-left text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-superficie-900">
                              {insumo.codigo ?? "—"}
                            </span>
                            <span className="shrink-0 text-xs text-superficie-400">
                              {insumo.composicaoCodigo ?? "—"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-superficie-600">
                            {insumo.nome}
                          </p>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-superficie-500">
                            <span>Un.: {insumo.unidade}</span>
                              <span>{insumo.categoria.replace("_", " ")}</span>
                             <span>V. un. prev.: {formatarMoeda(insumo.custoUnitario)}</span>
                             <span>Orç.: {insumo.orcamentoCodigo ?? "—"}</span>
                             <span>Prev.: {insumo.quantidadePrevista.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {insumo.unidade}</span>
                          </div>
                         </div>
                       </li>
                    ))}
                   </ul>
                <p className="border-t border-borda px-3 py-2 text-xs text-superficie-500">
                  {resultadosBusca.length} item(ns) carregado(s) na tabela.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- Lista de insumos selecionados --- */}
        {insumos.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <Tabela>
              <Cabecalho>
                <LinhaCabecalho>
                  <CelulaCabecalho>Código</CelulaCabecalho>
                  <CelulaCabecalho>Insumo</CelulaCabecalho>
                  <CelulaCabecalho>Un.</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Coef.</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Qtd. prev.</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Valor un. prev.</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Valor total prev.</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Qtd. real *</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Valor un. real *</CelulaCabecalho>
                   <CelulaCabecalho className="text-right">Total real</CelulaCabecalho>
                  <CelulaCabecalho>Composição</CelulaCabecalho>
                  <CelulaCabecalho></CelulaCabecalho>
                </LinhaCabecalho>
              </Cabecalho>
              <Corpo>
                {insumos.map((insumo, i) => {
                   const totalRealItem = (insumo.quantidadeReal ?? 0) * (insumo.valorUnitarioReal ?? 0);
                  return (
                      <Linha key={`${insumo.componenteId ?? "manual"}-${insumo.orcamentoItemId ?? i}`} className={insumo.alterado ? "bg-ambar-50" : undefined}>
                       <Celula className="font-mono text-xs text-superficie-500">
                         {insumo.componenteId ? insumo.codigo ?? "—" : <input className="w-24 rounded border border-borda px-2 py-1" value={insumo.codigo ?? ""} onChange={(e) => alterarTexto(i, "codigo", e.target.value)} placeholder="Código" aria-label="Código do insumo manual" />}
                       </Celula>
                       <Celula className="min-w-[18rem] max-w-[28rem] whitespace-normal break-words font-medium text-superficie-900">
                         {insumo.componenteId ? insumo.nome : <input className="w-44 rounded border border-borda px-2 py-1" value={insumo.nome} onChange={(e) => alterarTexto(i, "nome", e.target.value)} placeholder="Descrição" aria-label="Descrição do insumo manual" />}
                       </Celula>
                       <Celula>{insumo.componenteId ? insumo.unidade : <input className="w-16 rounded border border-borda px-2 py-1" value={insumo.unidade} onChange={(e) => alterarTexto(i, "unidade", e.target.value)} aria-label="Unidade do insumo manual" />}</Celula>
                      <Celula className="text-right tabular-nums">
                        {insumo.coeficiente.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                      </Celula>
                      <Celula className="text-right tabular-nums">
                         {insumo.quantidadePrevista.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                      </Celula>
                       <Celula className="text-right tabular-nums font-medium">
                          {formatarMoeda(insumo.custoUnitario)}
                        </Celula>
                       <Celula className="text-right tabular-nums font-medium">
                          {formatarMoeda(insumo.valorPrevisto)}
                       </Celula>
                       <Celula>
                          <input className="w-28 rounded border border-borda px-2 py-1 text-right tabular-nums" type="number" min="0" step="any" value={insumo.quantidadeReal ?? ""} placeholder="0" onChange={(e) => alterarInsumo(i, "quantidadeReal", e.target.value)} aria-label={`Quantidade real de ${insumo.nome}`} />
                       </Celula>
                       <Celula>
                          <input className="w-28 rounded border border-borda px-2 py-1 text-right tabular-nums" type="number" min="0" step="any" value={insumo.valorUnitarioReal ?? ""} placeholder="0" onChange={(e) => alterarInsumo(i, "valorUnitarioReal", e.target.value)} aria-label={`Valor real por unidade de ${insumo.nome}`} />
                       </Celula>
                       <Celula className="text-right tabular-nums font-medium">
                          {formatarMoeda(totalRealItem)}
                      </Celula>
                      <Celula className="max-w-[160px] truncate text-xs text-superficie-500">
                        {insumo.composicaoCodigo ?? "—"} · {insumo.composicaoNome}
                      </Celula>
                      <Celula>
                        <button
                          type="button"
                          onClick={() => removerInsumo(i)}
                          className="text-xs font-medium text-perigo hover:text-perigo/80"
                        >
                          Remover
                        </button>
                      </Celula>
                    </Linha>
                  );
                })}

                {/* Linha de total */}
                <Linha className="bg-superficie-50 font-semibold hover:bg-superficie-50">
                   <Celula colSpan={9} className="font-semibold text-superficie-900">
                    Total
                  </Celula>
                  <Celula className="text-right tabular-nums font-bold">
                    {formatarMoeda(totalReal)}
                  </Celula>
                  <Celula />
                  <Celula />
                </Linha>
              </Corpo>
            </Tabela>
          </div>
        )}

        {/* --- Botão salvar --- */}
        <div className="flex justify-end gap-2 border-t border-borda pt-4">
           <Botao
            onClick={salvar}
            disabled={salvando || insumos.length === 0}
          >
            {salvando ? "Salvando..." : "Salvar compra"}
          </Botao>
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}
