"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Botao,
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
} from "@/components/ui";
import { cn, formatarMoeda } from "@/lib/utils";

export interface LinhaPainelFinanceiro {
  orcamento_item_id: string;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade_prevista: number;
  previsto: number;
  quantidade_medida: number;
  medido: number;
  quantidade_executada: number;
  executado: number;
  comprado_total: number;
  comprado_material: number;
  saldo_disponivel_material: number;
  economia_material: number;
  composicao_id: string | null;
}

export interface LinhaCustoComposicao {
  composicao_id: string;
  categoria: string;
  total: number;
}

export interface ItemMedidoSemOrcamento {
  id: string;
  nome: string;
  unidade: string;
  valor_unitario: number;
  medicao_titulo: string;
  quantidade: number;
  valor: number;
}

interface LinhaMesclada {
  orcamento_item_ids: string[];
  codigos: string[];
  descricoes: string[];
  unidade: string | null;
  quantidade_prevista: number;
  previsto_mo: number;
  quantidade_medida: number;
  medido: number;
  quantidade_executada: number;
  executado: number;
  comprado_total: number;
  comprado_material: number;
  saldo_disponivel_material: number;
  economia_material: number;
  composicao_ids: string[];
  catalogo_ids: string[];
}

const TAMANHO_PAGINA = 100;

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function BarraProgresso({ percentual }: { percentual: number }) {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-superficie-100">
      <div
        className="h-full rounded-full bg-azul-600"
        style={{ width: `${Math.min(Math.max(percentual, 0), 100)}%` }}
      />
    </div>
  );
}

function CartaoResumo({
  rotulo,
  valor,
  classe,
  progresso,
}: {
  rotulo: string;
  valor: string;
  classe?: string;
  progresso?: number;
}) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>{rotulo}</CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo>
        <p className={cn("text-2xl font-bold", classe ?? "text-superficie-900")}>
          {valor}
        </p>
        {progresso != null && (
          <div className="mt-2 flex items-center gap-2">
            <BarraProgresso percentual={progresso} />
            <span className="text-xs font-medium text-superficie-500">
              {formatarPercentual(progresso)}
            </span>
          </div>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function obterPrevistoMaoDeObra(
  linha: LinhaPainelFinanceiro,
  custos: LinhaCustoComposicao[],
): number {
  if (!linha.composicao_id) return 0;
  const custoMo = custos.find(
    (c) => c.composicao_id === linha.composicao_id && c.categoria === "mao_de_obra",
  );
  if (!custoMo) return 0;
  return linha.quantidade_prevista * custoMo.total;
}

function mesclarLinhasPorCatalogo(
  linhas: LinhaPainelFinanceiro[],
  custos: LinhaCustoComposicao[],
  vinculoCatalogo: Map<string, Set<string>>,
): LinhaMesclada[] {
  const catalogoParaLinhas = new Map<string, LinhaPainelFinanceiro[]>();

  for (const linha of linhas) {
    const catalogoIds = vinculoCatalogo.get(linha.orcamento_item_id);
    if (!catalogoIds || catalogoIds.size === 0) {
      const key = `solo-${linha.orcamento_item_id}`;
      const arr = catalogoParaLinhas.get(key) ?? [];
      arr.push(linha);
      catalogoParaLinhas.set(key, arr);
      continue;
    }

    for (const catalogoId of catalogoIds) {
      const arr = catalogoParaLinhas.get(catalogoId) ?? [];
      arr.push(linha);
      catalogoParaLinhas.set(catalogoId, arr);
    }
  }

  const resultado: LinhaMesclada[] = [];

  for (const [chave, grupo] of catalogoParaLinhas.entries()) {
    if (grupo.length === 1 && !chave.startsWith("solo-")) {
      const linha = grupo[0];
      const previstoMo = obterPrevistoMaoDeObra(linha, custos);
      resultado.push({
        orcamento_item_ids: [linha.orcamento_item_id],
        codigos: [linha.codigo ?? "—"],
        descricoes: [linha.descricao ?? "—"],
        unidade: linha.unidade,
        quantidade_prevista: linha.quantidade_prevista,
        previsto_mo: previstoMo,
        quantidade_medida: linha.quantidade_medida,
        medido: linha.medido,
        quantidade_executada: linha.quantidade_executada,
        executado: linha.executado,
        comprado_total: linha.comprado_total,
        comprado_material: linha.comprado_material,
        saldo_disponivel_material: linha.saldo_disponivel_material,
        economia_material: linha.economia_material,
        composicao_ids: linha.composicao_id ? [linha.composicao_id] : [],
        catalogo_ids: Array.from(vinculoCatalogo.get(linha.orcamento_item_id) ?? []),
      });
      continue;
    }

    if (grupo.length === 1 && chave.startsWith("solo-")) {
      const linha = grupo[0];
      const previstoMo = obterPrevistoMaoDeObra(linha, custos);
      resultado.push({
        orcamento_item_ids: [linha.orcamento_item_id],
        codigos: [linha.codigo ?? "—"],
        descricoes: [linha.descricao ?? "—"],
        unidade: linha.unidade,
        quantidade_prevista: linha.quantidade_prevista,
        previsto_mo: previstoMo,
        quantidade_medida: linha.quantidade_medida,
        medido: linha.medido,
        quantidade_executada: linha.quantidade_executada,
        executado: linha.executado,
        comprado_total: linha.comprado_total,
        comprado_material: linha.comprado_material,
        saldo_disponivel_material: linha.saldo_disponivel_material,
        economia_material: linha.economia_material,
        composicao_ids: linha.composicao_id ? [linha.composicao_id] : [],
        catalogo_ids: [],
      });
      continue;
    }

    const primeiraLinha = grupo[0];
    const previstoMoTotal = grupo.reduce(
      (acc, l) => acc + obterPrevistoMaoDeObra(l, custos),
      0,
    );
    const quantidadePrevistaTotal = grupo.reduce((acc, l) => acc + l.quantidade_prevista, 0);
    const compradoTotal = grupo.reduce((acc, l) => acc + l.comprado_total, 0);
    const compradoMaterial = grupo.reduce((acc, l) => acc + l.comprado_material, 0);
    const saldoDisponivelMaterial = grupo.reduce(
      (acc, l) => acc + l.saldo_disponivel_material,
      0,
    );
    const economiaMaterial = grupo.reduce((acc, l) => acc + l.economia_material, 0);

    resultado.push({
      orcamento_item_ids: grupo.map((l) => l.orcamento_item_id),
      codigos: grupo.map((l) => l.codigo ?? "—"),
      descricoes: grupo.map((l) => l.descricao ?? "—"),
      unidade: primeiraLinha.unidade,
      quantidade_prevista: quantidadePrevistaTotal,
      previsto_mo: previstoMoTotal,
      quantidade_medida: primeiraLinha.quantidade_medida,
      medido: primeiraLinha.medido,
      quantidade_executada: primeiraLinha.quantidade_executada,
      executado: primeiraLinha.executado,
      comprado_total: compradoTotal,
      comprado_material: compradoMaterial,
      saldo_disponivel_material: saldoDisponivelMaterial,
      economia_material: economiaMaterial,
      composicao_ids: grupo
        .map((l) => l.composicao_id)
        .filter((c): c is string => c !== null),
      catalogo_ids: Array.from(
        new Set(grupo.flatMap((l) => Array.from(vinculoCatalogo.get(l.orcamento_item_id) ?? []))),
      ),
    });
  }

  return resultado;
}

export function PainelFinanceiro({
  linhas,
  custos,
  medidosSemOrcamento,
  vinculoCatalogo,
}: {
  linhas: LinhaPainelFinanceiro[];
  custos: LinhaCustoComposicao[];
  medidosSemOrcamento: ItemMedidoSemOrcamento[];
  vinculoCatalogo: Map<string, Set<string>>;
}) {
  const [pagina, setPagina] = useState(1);

  const linhasMescladas = useMemo(
    () => mesclarLinhasPorCatalogo(linhas, custos, vinculoCatalogo),
    [linhas, custos, vinculoCatalogo],
  );

  const totais = useMemo(() => {
    let previsto = 0;
    let medido = 0;
    let executado = 0;
    let comprado = 0;
    let economia = 0;
    for (const linha of linhasMescladas) {
      previsto += linha.previsto_mo;
      medido += linha.medido;
      executado += linha.executado;
      comprado += linha.comprado_total;
      economia += linha.economia_material;
    }
    return { previsto, medido, executado, comprado, saldo: previsto - executado - comprado, economia };
  }, [linhasMescladas]);

  const percentualGeral =
    totais.previsto > 0 ? (totais.executado / totais.previsto) * 100 : 0;

  const totalPaginas = Math.max(1, Math.ceil(linhasMescladas.length / TAMANHO_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const linhasPagina = linhasMescladas.slice(
    (paginaSegura - 1) * TAMANHO_PAGINA,
    paginaSegura * TAMANHO_PAGINA,
  );

  const semMedicao = useMemo(
    () => linhasMescladas.filter((linha) => linha.medido === 0 && linha.comprado_total === 0),
    [linhasMescladas],
  );

  const porCategoria = useMemo(() => {
    const totalPorComposicao = new Map<string, number>();
    for (const custo of custos) {
      totalPorComposicao.set(
        custo.composicao_id,
        (totalPorComposicao.get(custo.composicao_id) ?? 0) + custo.total,
      );
    }

    const categorias = new Map<string, { previsto: number; executado: number }>();
    const semComposicao = { previsto: 0, executado: 0 };

    for (const linha of linhasMescladas) {
      if (linha.composicao_ids.length === 0) {
        semComposicao.previsto += linha.previsto_mo;
        semComposicao.executado += linha.executado;
        continue;
      }
      for (const composicaoId of linha.composicao_ids) {
        const totalComposicao = totalPorComposicao.get(composicaoId) ?? 0;
        if (totalComposicao <= 0) {
          semComposicao.previsto += linha.previsto_mo / linha.composicao_ids.length;
          semComposicao.executado += linha.executado / linha.composicao_ids.length;
          continue;
        }
        for (const custo of custos) {
          if (custo.composicao_id !== composicaoId) continue;
          const ratio = custo.total / totalComposicao;
          const atual = categorias.get(custo.categoria) ?? {
            previsto: 0,
            executado: 0,
          };
          atual.previsto += (linha.previsto_mo / linha.composicao_ids.length) * ratio;
          atual.executado += (linha.executado / linha.composicao_ids.length) * ratio;
          categorias.set(custo.categoria, atual);
        }
      }
    }

    return {
      categorias: [...categorias.entries()].sort((a, b) =>
        a[0].localeCompare(b[0], "pt-BR"),
      ),
      semComposicao,
    };
  }, [linhasMescladas, custos]);

  const itensComCompra = useMemo(
    () => linhasMescladas.filter((linha) => linha.comprado_total > 0),
    [linhasMescladas],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <CartaoResumo rotulo="Total previsto (mão de obra)" valor={formatarMoeda(totais.previsto)} />
        <CartaoResumo
          rotulo="Total medido (mão de obra)"
          valor={formatarMoeda(totais.medido)}
          classe="text-azul-600"
        />
        <CartaoResumo
          rotulo="Total executado (mão de obra)"
          valor={formatarMoeda(totais.executado)}
          classe="text-emerald-600"
        />
        <CartaoResumo
          rotulo="Total comprado (materiais)"
          valor={formatarMoeda(totais.comprado)}
          classe="text-violet-600"
        />
        <CartaoResumo
          rotulo="Economia / Excedente"
          valor={formatarMoeda(Math.abs(totais.economia))}
          classe={totais.economia < 0 ? "text-perigo" : "text-emerald-600"}
          progresso={
            totais.previsto > 0
              ? (totais.economia / totais.previsto) * 100
              : undefined
          }
        />
        <CartaoResumo
          rotulo="% Executado geral"
          valor={formatarPercentual(percentualGeral)}
          progresso={percentualGeral}
        />
      </div>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo>Previsto vs medido (mão de obra) × comprado (materiais)</CartaoTitulo>
            <span className="text-xs text-superficie-500">
              {linhasMescladas.length} {linhasMescladas.length === 1 ? "item" : "itens"}
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <div className="overflow-x-auto">
            <Tabela>
              <Cabecalho>
                <LinhaCabecalho>
                  <CelulaCabecalho>Código</CelulaCabecalho>
                  <CelulaCabecalho>Item</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Previsto (m.o.)</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Medido (m.o.)</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Executado (m.o.)</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Comprado (mat.)</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Disponível</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Economia</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">% Exec.</CelulaCabecalho>
                </LinhaCabecalho>
              </Cabecalho>
              <Corpo>
                {linhasPagina.map((linha) => {
                  const saldo = linha.previsto_mo - linha.executado - linha.comprado_total;
                  const percentual =
                    linha.previsto_mo > 0
                      ? ((linha.executado + linha.comprado_total) / linha.previsto_mo) * 100
                      : 0;
                  return (
                    <Linha key={linha.orcamento_item_ids.join("-")}>
                      <Celula className="font-mono text-xs text-superficie-500">
                        {linha.codigos.join(" + ")}
                      </Celula>
                      <Celula className="font-medium text-superficie-900">
                        {linha.descricoes.join(" + ")}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap">
                        {formatarMoeda(linha.previsto_mo)}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap text-azul-600">
                        {formatarMoeda(linha.medido)}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap text-emerald-600">
                        {formatarMoeda(linha.executado)}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap text-violet-600">
                        {formatarMoeda(linha.comprado_total)}
                      </Celula>
                      <Celula
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
                          saldo < 0 ? "text-perigo" : "text-superficie-900",
                        )}
                      >
                        {formatarMoeda(saldo)}
                      </Celula>
                      <Celula
                        className={cn(
                          "text-right font-semibold whitespace-nowrap",
                          linha.economia_material < 0 ? "text-perigo" : "text-emerald-600",
                        )}
                      >
                        {linha.economia_material > 0 ? "+" : ""}
                        {formatarMoeda(linha.economia_material)}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <BarraProgresso percentual={percentual} />
                          <span className="text-xs font-medium text-superficie-700">
                            {formatarPercentual(percentual)}
                          </span>
                        </div>
                      </Celula>
                    </Linha>
                  );
                })}
                <Linha className="bg-superficie-50 font-semibold hover:bg-superficie-50">
                  <Celula colSpan={2} className="font-semibold text-superficie-900">
                    Total
                  </Celula>
                  <Celula className="text-right font-semibold whitespace-nowrap">
                    {formatarMoeda(totais.previsto)}
                  </Celula>
                  <Celula className="text-right font-semibold whitespace-nowrap text-azul-600">
                    {formatarMoeda(totais.medido)}
                  </Celula>
                  <Celula className="text-right font-semibold whitespace-nowrap text-emerald-600">
                    {formatarMoeda(totais.executado)}
                  </Celula>
                  <Celula className="text-right font-semibold whitespace-nowrap text-violet-600">
                    {formatarMoeda(totais.comprado)}
                  </Celula>
                  <Celula
                    className={cn(
                      "text-right font-semibold whitespace-nowrap",
                      totais.saldo < 0 ? "text-perigo" : "text-superficie-900",
                    )}
                  >
                    {formatarMoeda(totais.saldo)}
                  </Celula>
                  <Celula
                    className={cn(
                      "text-right font-semibold whitespace-nowrap",
                      totais.economia < 0 ? "text-perigo" : "text-emerald-600",
                    )}
                  >
                    {totais.economia > 0 ? "+" : ""}
                    {formatarMoeda(totais.economia)}
                  </Celula>
                  <Celula className="text-right font-semibold whitespace-nowrap">
                    {formatarPercentual(percentualGeral)}
                  </Celula>
                </Linha>
              </Corpo>
            </Tabela>
          </div>
          <div className="px-6 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-superficie-500">
                Página {paginaSegura} de {totalPaginas} · {linhasMescladas.length} itens
              </p>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    onClick={() => setPagina(paginaSegura - 1)}
                    disabled={paginaSegura <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Botao>
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    onClick={() => setPagina(paginaSegura + 1)}
                    disabled={paginaSegura >= totalPaginas}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Botao>
                </div>
              )}
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Itens sem medição/compra</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="p-0">
            {semMedicao.length === 0 ? (
              <p className="px-6 py-4 text-sm text-superficie-500">
                Todos os itens possuem medição ou compra vinculada.
              </p>
            ) : (
              <Tabela>
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Código</CelulaCabecalho>
                    <CelulaCabecalho>Item</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Previsto (m.o.)</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {semMedicao.map((linha) => (
                    <Linha key={linha.orcamento_item_ids.join("-")}>
                      <Celula className="font-mono text-xs text-superficie-500">
                        {linha.codigos.join(" + ")}
                      </Celula>
                      <Celula className="font-medium text-superficie-900">
                        {linha.descricoes.join(" + ")}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap">
                        {formatarMoeda(linha.previsto_mo)}
                      </Celula>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            )}
          </CartaoConteudo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Itens medidos sem orçamento</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="p-0">
            {medidosSemOrcamento.length === 0 ? (
              <p className="px-6 py-4 text-sm text-superficie-500">
                Nenhum item medido sem vínculo com o orçamento.
              </p>
            ) : (
              <Tabela>
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Item</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Qtd.</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Valor</CelulaCabecalho>
                    <CelulaCabecalho>Medição</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {medidosSemOrcamento.map((item) => (
                    <Linha key={item.id}>
                      <Celula className="font-medium text-superficie-900">
                        {item.nome}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap">
                        {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
                      </Celula>
                      <Celula className="text-right whitespace-nowrap">
                        {formatarMoeda(item.valor)}
                      </Celula>
                      <Celula className="text-superficie-500">
                        {item.medicao_titulo}
                      </Celula>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            )}
          </CartaoConteudo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Itens com compra registrada</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="p-0">
            {itensComCompra.length === 0 ? (
              <p className="px-6 py-4 text-sm text-superficie-500">
                Nenhuma compra registrada para os itens do orçamento.
                <br />
                <span className="text-xs">
                  Acesse a página de{" "}
                  <a href={`/obras/${linhas[0]?.orcamento_item_id ? "../compras" : "#"}`} className="text-azul-600 underline">
                    Compras
                  </a>{" "}
                  para cadastrar.
                </span>
              </p>
            ) : (
              <Tabela>
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Item</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Comprado</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Disponível</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {itensComCompra.slice(0, 20).map((linha) => (
                    <Linha key={linha.orcamento_item_ids.join("-")}>
                      <Celula className="font-medium text-superficie-900">
                        {linha.codigos.join(" + ")}<br />
                        <span className="text-xs text-superficie-500">{linha.descricoes.join(" + ")}</span>
                      </Celula>
                      <Celula className="text-right whitespace-nowrap text-violet-600">
                        {formatarMoeda(linha.comprado_total)}
                      </Celula>
                      <Celula
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
                          linha.saldo_disponivel_material < 0 ? "text-perigo" : "text-emerald-600",
                        )}
                      >
                        {formatarMoeda(linha.saldo_disponivel_material)}
                      </Celula>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            )}
          </CartaoConteudo>
        </Cartao>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Previsto vs executado por categoria (rateio pela composição)</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <Tabela>
            <Cabecalho>
              <LinhaCabecalho>
                <CelulaCabecalho>Categoria</CelulaCabecalho>
                <CelulaCabecalho className="text-right">Previsto (rateio)</CelulaCabecalho>
                <CelulaCabecalho className="text-right">Executado (rateio)</CelulaCabecalho>
                <CelulaCabecalho className="text-right">% Executado</CelulaCabecalho>
              </LinhaCabecalho>
            </Cabecalho>
            <Corpo>
              {porCategoria.categorias.map(([categoria, valores]) => {
                const percentual =
                  valores.previsto > 0
                    ? (valores.executado / valores.previsto) * 100
                    : 0;
                return (
                  <Linha key={categoria}>
                    <Celula className="font-medium text-superficie-900">
                      {categoria === "mao_de_obra" ? "Mão de obra" : categoria === "material" ? "Material" : categoria === "equipamento" ? "Equipamento" : "Outro"}
                    </Celula>
                    <Celula className="text-right whitespace-nowrap">
                      {formatarMoeda(valores.previsto)}
                    </Celula>
                    <Celula className="text-right whitespace-nowrap">
                      {formatarMoeda(valores.executado)}
                    </Celula>
                    <Celula className="text-right whitespace-nowrap">
                      {formatarPercentual(percentual)}
                    </Celula>
                  </Linha>
                );
              })}
              <Linha className="bg-superficie-50 hover:bg-superficie-50">
                <Celula className="font-semibold text-superficie-900">
                  Sem composição
                </Celula>
                <Celula className="text-right font-semibold whitespace-nowrap">
                  {formatarMoeda(porCategoria.semComposicao.previsto)}
                </Celula>
                <Celula className="text-right font-semibold whitespace-nowrap">
                  {formatarMoeda(porCategoria.semComposicao.executado)}
                </Celula>
                <Celula className="text-right font-semibold whitespace-nowrap">
                  {formatarPercentual(
                    porCategoria.semComposicao.previsto > 0
                      ? (porCategoria.semComposicao.executado /
                          porCategoria.semComposicao.previsto) *
                          100
                      : 0
                  )}
                </Celula>
              </Linha>
            </Corpo>
          </Tabela>
          <p className="px-6 py-3 text-xs text-superficie-500">
            Valores rateados pela composição vinculada; não representam custo real
            incorrido. Compras são registradas separadamente como custo real.
          </p>
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}