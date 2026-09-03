"use client";

import { useState } from "react";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Percent,
} from "lucide-react";
import { formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import type { ItemMedicao } from "@/app/(protegido)/obras/[id]/medicoes/[medicaoId]/page";

interface GraficosProgressoMedicaoProps {
  itens: ItemMedicao[];
  valorExecutado: number;
  valorPendente: number;
  valorTotalCadastrado: number;
  valorContrato: number | null;
}

const PALETA_CORES = [
  "#2563eb",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#64748b",
];

export function GraficosProgressoMedicao({
  itens,
  valorExecutado,
  valorPendente,
  valorTotalCadastrado,
  valorContrato,
}: GraficosProgressoMedicaoProps) {
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [visaoAtiva, setVisaoAtiva] = useState<"todos" | "barras" | "donut">("todos");

  const itensComValor = itens.filter((item) => item.valorTotal > 0);

  const itensOrdenadosPorPeso = [...itensComValor].sort(
    (a, b) => b.valorTotal - a.valorTotal,
  );

  const progressoGlobal =
    valorTotalCadastrado > 0 ? (valorExecutado / valorTotalCadastrado) * 100 : 0;
  const pendenteGlobal =
    valorTotalCadastrado > 0 ? (valorPendente / valorTotalCadastrado) * 100 : 0;

  const progressoContrato =
    valorContrato && valorContrato > 0
      ? (valorExecutado / valorContrato) * 100
      : null;

  const itemAtivo = itemSelecionadoId
    ? itens.find((i) => i.catalogoId === itemSelecionadoId) ?? null
    : null;

  const raio = 38;
  const circunferencia = 2 * Math.PI * raio;

  const fatiasDonut: {
    item: ItemMedicao;
    dashArray: number;
    offset: number;
    cor: string;
  }[] = [];
  let offsetAtual = 0;
  for (let index = 0; index < itensOrdenadosPorPeso.length; index++) {
    const item = itensOrdenadosPorPeso[index];
    const dashArray = (item.pesoPercentual / 100) * circunferencia;
    const offset = offsetAtual;
    offsetAtual += (item.pesoPercentual / 100) * circunferencia;
    const cor = PALETA_CORES[index % PALETA_CORES.length];
    fatiasDonut.push({ item, dashArray, offset, cor });
  }

  if (itensComValor.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-azul-600" />
            <h2 className="text-lg font-bold text-superficie-900">
              Progresso Físico-Financeiro da Obra
            </h2>
          </div>
          <p className="text-xs text-superficie-500">
            Avanço ponderado pelo valor associado de cada item de medição.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-superficie-100 p-1">
          <button
            type="button"
            onClick={() => setVisaoAtiva("todos")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              visaoAtiva === "todos"
                ? "bg-white text-superficie-900 shadow-sm"
                : "text-superficie-600 hover:text-superficie-900"
            }`}
          >
            Visão Completa
          </button>
          <button
            type="button"
            onClick={() => setVisaoAtiva("barras")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              visaoAtiva === "barras"
                ? "bg-white text-superficie-900 shadow-sm"
                : "text-superficie-600 hover:text-superficie-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Avanço por Item
          </button>
          <button
            type="button"
            onClick={() => setVisaoAtiva("donut")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              visaoAtiva === "donut"
                ? "bg-white text-superficie-900 shadow-sm"
                : "text-superficie-600 hover:text-superficie-900"
            }`}
          >
            <PieChartIcon className="h-3.5 w-3.5" />
            Distribuição de Peso
          </button>
        </div>
      </div>

      <Cartao className="border-l-4 border-l-azul-600 overflow-hidden">
        <CartaoConteudo className="p-5 sm:p-6">
          <div className="grid gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-superficie-200 pb-4 md:pb-0 md:pr-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-superficie-500">
                <Percent className="h-4 w-4 text-azul-600" />
                Avanço Ponderado Global
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-superficie-900">
                  {progressoGlobal.toFixed(1)}%
                </span>
                <span className="text-sm font-semibold text-emerald-600">
                  executado
                </span>
              </div>
              <p className="mt-2 text-xs text-superficie-500 leading-relaxed">
                Calculado com base no peso financeiro de cada serviço concluído
                em relação ao total medido ({formatarMoeda(valorTotalCadastrado)}).
              </p>

              {progressoContrato !== null && (
                <div className="mt-3 pt-3 border-t border-superficie-100 flex items-center justify-between text-xs">
                  <span className="text-superficie-500">Sobre o contrato:</span>
                  <span className="font-bold text-azul-600">
                    {progressoContrato.toFixed(1)}% executado
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-8 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-emerald-700 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Executado: {formatarMoeda(valorExecutado)} ({progressoGlobal.toFixed(1)}%)
                  </span>
                  <span className="text-amber-700 flex items-center gap-1.5 font-semibold">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Pendente: {formatarMoeda(valorPendente)} ({pendenteGlobal.toFixed(1)}%)
                  </span>
                </div>

                <div className="h-3.5 w-full overflow-hidden rounded-full bg-superficie-100 p-0.5 flex">
                  <div
                    className="h-full rounded-l-full bg-emerald-500 transition-all duration-500 relative group cursor-pointer"
                    style={{ width: `${Math.min(progressoGlobal, 100)}%` }}
                    title={`Executado: ${progressoGlobal.toFixed(1)}%`}
                  />
                  <div
                    className="h-full rounded-r-full bg-amber-400 transition-all duration-500 relative group cursor-pointer"
                    style={{ width: `${Math.max(0, Math.min(pendenteGlobal, 100 - progressoGlobal))}%` }}
                    title={`Pendente: ${pendenteGlobal.toFixed(1)}%`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-100">
                  <p className="text-[11px] font-medium text-emerald-700">Valor Executado</p>
                  <p className="text-sm sm:text-base font-bold text-emerald-800">
                    {formatarMoeda(valorExecutado)}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50/70 p-2.5 border border-amber-100">
                  <p className="text-[11px] font-medium text-amber-700">Valor Pendente</p>
                  <p className="text-sm sm:text-base font-bold text-amber-800">
                    {formatarMoeda(valorPendente)}
                  </p>
                </div>
                <div className="rounded-lg bg-azul-50/70 p-2.5 border border-azul-100">
                  <p className="text-[11px] font-medium text-azul-700">Base Total Medida</p>
                  <p className="text-sm sm:text-base font-bold text-azul-800">
                    {formatarMoeda(valorTotalCadastrado)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      {(visaoAtiva === "todos" || visaoAtiva === "donut") && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Cartao className={visaoAtiva === "donut" ? "lg:col-span-12" : "lg:col-span-5"}>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-azul-600" />
                  Peso por Valor Associado
                </CartaoTitulo>
                <span className="text-xs text-superficie-500">
                  {itensComValor.length} {itensComValor.length === 1 ? "item" : "itens"}
                </span>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="space-y-4">
              <div className="flex flex-col items-center justify-center pt-2">
                <div className="relative h-56 w-56">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r={raio}
                      className="stroke-superficie-100 fill-none"
                      strokeWidth="13"
                    />
                    {fatiasDonut.map(({ item, dashArray, offset, cor }) => {
                      const estaSelecionado = itemSelecionadoId === item.catalogoId;

                      return (
                        <circle
                          key={item.catalogoId}
                          cx="50"
                          cy="50"
                          r={raio}
                          className="fill-none transition-all duration-300 cursor-pointer"
                          stroke={cor}
                          strokeWidth={estaSelecionado ? "16" : "13"}
                          strokeDasharray={`${dashArray} ${circunferencia}`}
                          strokeDashoffset={-offset}
                          opacity={
                            itemSelecionadoId === null || estaSelecionado ? 1 : 0.4
                          }
                          onMouseEnter={() => setItemSelecionadoId(item.catalogoId)}
                          onMouseLeave={() => setItemSelecionadoId(null)}
                        />
                      );
                    })}
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-xs font-medium text-superficie-500">
                      {itemAtivo ? "Peso do Item" : "Progresso Global"}
                    </span>
                    <span className="text-2xl font-black text-superficie-900">
                      {itemAtivo
                        ? `${itemAtivo.pesoPercentual.toFixed(1)}%`
                        : `${progressoGlobal.toFixed(1)}%`}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600">
                      {itemAtivo
                        ? `${itemAtivo.progressoPercentual.toFixed(1)}% executado`
                        : "ponderado"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-superficie-100 text-xs">
                {itensOrdenadosPorPeso.map((item, index) => {
                  const cor = PALETA_CORES[index % PALETA_CORES.length];
                  const estaSelecionado = itemSelecionadoId === item.catalogoId;

                  return (
                    <button
                      type="button"
                      key={item.catalogoId}
                      onClick={() =>
                        setItemSelecionadoId(estaSelecionado ? null : item.catalogoId)
                      }
                      onMouseEnter={() => setItemSelecionadoId(item.catalogoId)}
                      onMouseLeave={() => setItemSelecionadoId(null)}
                      className={`w-full text-left pt-1.5 pb-1 px-2 rounded flex items-center justify-between gap-2 transition-colors ${
                        estaSelecionado ? "bg-superficie-100 font-semibold" : "hover:bg-superficie-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span className="truncate text-superficie-800">{item.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-superficie-600">
                          {formatarMoeda(item.valorTotal)}
                        </span>
                        <span className="rounded bg-superficie-100 px-1.5 py-0.5 text-[10px] font-bold text-superficie-700">
                          {item.pesoPercentual.toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CartaoConteudo>
          </Cartao>

          <Cartao className={visaoAtiva === "donut" ? "lg:col-span-12" : "lg:col-span-7"}>
            <CartaoCabecalho>
              <div className="flex items-center justify-between">
                <CartaoTitulo className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-azul-600" />
                  Progresso Ponderado por Item
                </CartaoTitulo>
                <span className="text-xs text-superficie-500">
                  Ordenado por maior impacto no valor
                </span>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="space-y-4">
              <div className="space-y-3.5">
                {itensOrdenadosPorPeso.map((item, index) => {
                  const cor = PALETA_CORES[index % PALETA_CORES.length];
                  const estaSelecionado = itemSelecionadoId === item.catalogoId;

                  return (
                    <div
                      key={item.catalogoId}
                      className={`p-2.5 rounded-lg border transition-all ${
                        estaSelecionado
                          ? "border-azul-400 bg-azul-50/30 shadow-xs"
                          : "border-superficie-150 hover:border-superficie-300 bg-white"
                      }`}
                      onMouseEnter={() => setItemSelecionadoId(item.catalogoId)}
                      onMouseLeave={() => setItemSelecionadoId(null)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cor }}
                          />
                          <span className="truncate text-sm font-semibold text-superficie-900">
                            {item.nome}
                          </span>
                          <span className="text-xs text-superficie-400">
                            ({item.unidade})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-superficie-500">
                            Peso:{" "}
                            <strong className="text-superficie-800">
                              {item.pesoPercentual.toFixed(1)}%
                            </strong>
                          </span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {item.progressoPercentual.toFixed(1)}% feito
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-100 flex">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(item.progressoPercentual, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-superficie-500 pt-0.5">
                          <span>
                            Qtd:{" "}
                            <strong className="text-superficie-700">
                              {item.quantidadeExecutada}
                            </strong>{" "}
                            / {item.quantidadeTotal} {item.unidade}
                          </span>
                          <div className="flex items-center gap-3">
                            <span>
                              Executado:{" "}
                              <strong className="text-emerald-700">
                                {formatarMoeda(item.valorExecutado)}
                              </strong>
                            </span>
                            <span>
                              Pendente:{" "}
                              <strong className="text-amber-700">
                                {formatarMoeda(item.valorPendente)}
                              </strong>
                            </span>
                            <span className="text-azul-700 font-medium">
                              Avanço na obra: +{item.contribuicaoProgresso.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CartaoConteudo>
          </Cartao>
        </div>
      )}

      {visaoAtiva === "barras" && (
        <Cartao>
          <CartaoCabecalho>
            <div className="flex items-center justify-between">
              <CartaoTitulo className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-azul-600" />
                Quadro Completo de Avanço e Peso por Item
              </CartaoTitulo>
              <span className="text-xs text-superficie-500">
                {itensOrdenadosPorPeso.length} itens cadastrados
              </span>
            </div>
          </CartaoCabecalho>
          <CartaoConteudo className="space-y-4">
            <div className="space-y-3">
              {itensOrdenadosPorPeso.map((item, index) => {
                const cor = PALETA_CORES[index % PALETA_CORES.length];
                return (
                  <div
                    key={item.catalogoId}
                    className="p-3 rounded-lg border border-superficie-200 bg-white hover:border-azul-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span className="font-semibold text-superficie-900 text-sm truncate">
                          {item.nome}
                        </span>
                        <span className="text-xs text-superficie-500">
                          ({formatarMoeda(item.valorUnitario)} / {item.unidade})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs bg-superficie-100 text-superficie-700 px-2 py-0.5 rounded-full font-medium">
                          Peso: {item.pesoPercentual.toFixed(1)}%
                        </span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                          {item.progressoPercentual.toFixed(1)}% concluído
                        </span>
                        <span className="text-xs bg-azul-50 text-azul-700 px-2 py-0.5 rounded-full font-medium">
                          Contribuição: +{item.contribuicaoProgresso.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-superficie-100 flex">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(item.progressoPercentual, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-superficie-500">Quantidade:</span>{" "}
                          <span className="font-semibold text-superficie-800">
                            {item.quantidadeExecutada} / {item.quantidadeTotal} {item.unidade}
                          </span>
                        </div>
                        <div>
                          <span className="text-superficie-500">Valor Total:</span>{" "}
                          <span className="font-semibold text-superficie-800">
                            {formatarMoeda(item.valorTotal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-emerald-700">Executado:</span>{" "}
                          <span className="font-bold text-emerald-800">
                            {formatarMoeda(item.valorExecutado)}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-700">Pendente:</span>{" "}
                          <span className="font-bold text-amber-800">
                            {formatarMoeda(item.valorPendente)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CartaoConteudo>
        </Cartao>
      )}

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-azul-600" />
              Balanço Financeiro por Item de Medição
            </CartaoTitulo>
            <span className="text-xs text-superficie-500">
              Impacto no progresso global
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-superficie-50 text-superficie-600 border-b border-superficie-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item de Medição</th>
                  <th className="px-4 py-3 font-semibold text-right">Peso no Orçamento</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor Executado</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor Pendente</th>
                  <th className="px-4 py-3 font-semibold text-right">% Item Executado</th>
                  <th className="px-4 py-3 font-semibold text-right">Avanço na Obra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-superficie-100">
                {itensOrdenadosPorPeso.map((item, index) => {
                  const cor = PALETA_CORES[index % PALETA_CORES.length];
                  return (
                    <tr key={item.catalogoId} className="hover:bg-superficie-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-superficie-900 flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span className="truncate max-w-xs">{item.nome}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-superficie-700">
                        {item.pesoPercentual.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-superficie-900">
                        {formatarMoeda(item.valorTotal)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">
                        {formatarMoeda(item.valorExecutado)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600">
                        {formatarMoeda(item.valorPendente)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center rounded-full bg-superficie-100 px-2 py-0.5 text-[11px] font-bold text-superficie-800">
                          {item.progressoPercentual.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-azul-700">
                        +{item.contribuicaoProgresso.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-superficie-100/60 font-semibold text-superficie-900 border-t border-superficie-200">
                <tr>
                  <td className="px-4 py-3">Total Consolidado</td>
                  <td className="px-4 py-3 text-right">100,0%</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatarMoeda(valorTotalCadastrado)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">
                    {formatarMoeda(valorExecutado)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">
                    {formatarMoeda(valorPendente)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      {progressoGlobal.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-azul-800 font-extrabold">
                    {progressoGlobal.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
