"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ChevronLeft, ChevronRight, Eye, Layers, Link2, RotateCcw, Search } from "lucide-react";
import {
  Botao,
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
  Celula,
  CelulaCabecalho,
  Cabecalho,
  Corpo,
  EstadoVazio,
  Etiqueta,
  Linha,
  LinhaCabecalho,
  Modal,
  Tabela,
} from "@/components/ui";
import { cn, formatarMoeda } from "@/lib/utils";
import { CATEGORIA_COMPOSICAO, STATUS_VINCULO } from "@/lib/domain/rotulos";
import { temDivergencia, type ItemVinculo } from "@/lib/orcamento/vinculo";
import {
  aplicarCustoCalculado,
  buscarComposicoesParaVinculo,
  reverterCustoCalculado,
  vincularComposicao,
} from "@/app/(protegido)/obras/[id]/orcamentos/[orcamentoId]/acoes";

type FiltroAnalise = "todos" | "divergencia" | "sem_composicao" | "desatualizadas";

const FILTROS: Array<{ valor: FiltroAnalise; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "divergencia", rotulo: "Com divergência" },
  { valor: "sem_composicao", rotulo: "Sem composição" },
  { valor: "desatualizadas", rotulo: "Desatualizadas" },
];

const TAMANHO_PAGINA = 100;

type ComposicaoBusca = {
  id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  custo_unitario: number;
};

interface AnaliseComposicaoProps {
  obraId: string;
  orcamentoId: string;
  itens: ItemVinculo[];
}

function CelulaDiferenca({ item }: { item: ItemVinculo }) {
  const diferenca = item.diferenca;
  if (diferenca == null) {
    return <Celula className="text-right text-superficie-400">—</Celula>;
  }
  if (Math.abs(diferenca) <= 0.005) {
    return <Celula className="text-right text-superficie-400">R$ 0,00</Celula>;
  }
  const calculadoMaior = diferenca > 0;
  return (
    <Celula
      className={cn(
        "text-right font-mono tabular-nums",
        calculadoMaior ? "text-perigo" : "text-emerald-600",
      )}
    >
      {calculadoMaior ? "+" : "−"}
      {formatarMoeda(Math.abs(diferenca))}
    </Celula>
  );
}

export function AnaliseComposicao({ obraId, orcamentoId, itens }: AnaliseComposicaoProps) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroAnalise>("todos");
  const [pagina, setPagina] = useState(1);
  const [itemDetalhe, setItemDetalhe] = useState<ItemVinculo | null>(null);
  const [itemVinculo, setItemVinculo] = useState<ItemVinculo | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<ComposicaoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const filtrados = useMemo(() => {
    switch (filtro) {
      case "divergencia":
        return itens.filter(temDivergencia);
      case "sem_composicao":
        return itens.filter((item) => item.status === "ausente" || item.status === "duplicada");
      case "desatualizadas":
        return itens.filter((item) => item.status === "desatualizada");
      default:
        return itens;
    }
  }, [itens, filtro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA);

  const resumo = useMemo(() => {
    let vinculadas = 0;
    let semComposicao = 0;
    let comDivergencia = 0;
    let impacto = 0;
    for (const item of itens) {
      if (item.status === "encontrada" || item.status === "desatualizada") vinculadas += 1;
      if (item.status === "ausente" || item.status === "duplicada") semComposicao += 1;
      if (temDivergencia(item)) {
        comDivergencia += 1;
        impacto += (item.diferenca ?? 0) * item.quantidade;
      }
    }
    return { vinculadas, semComposicao, comDivergencia, impacto };
  }, [itens]);

  function mudarFiltro(novo: FiltroAnalise) {
    setFiltro(novo);
    setPagina(1);
  }

  function aplicar(item: ItemVinculo) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await aplicarCustoCalculado({
        orcamentoId,
        obraId,
        chaveEstavel: item.chaveEstavel,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  function reverter(item: ItemVinculo) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await reverterCustoCalculado({
        orcamentoId,
        obraId,
        chaveEstavel: item.chaveEstavel,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  async function buscar() {
    setErro(null);
    setBuscando(true);
    const resultado = await buscarComposicoesParaVinculo({ obraId, termo: termoBusca });
    setBuscando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setResultadosBusca(resultado.composicoes ?? []);
  }

  function vincular(composicaoId: string) {
    if (!itemVinculo) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await vincularComposicao({
        orcamentoId,
        obraId,
        chaveEstavel: itemVinculo.chaveEstavel,
        composicaoId,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setItemVinculo(null);
      router.refresh();
    });
  }

  function abrirVinculo(item: ItemVinculo) {
    setErro(null);
    setTermoBusca("");
    setResultadosBusca([]);
    setItemVinculo(item);
  }

  function fecharVinculo() {
    setErro(null);
    setItemVinculo(null);
  }

  return (
    <Cartao>
      <CartaoCabecalho>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CartaoTitulo>Análise de composições</CartaoTitulo>
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map((filtroOpcao) => (
              <button
                key={filtroOpcao.valor}
                type="button"
                onClick={() => mudarFiltro(filtroOpcao.valor)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  filtro === filtroOpcao.valor
                    ? "bg-azul-600 text-white"
                    : "bg-superficie-100 text-superficie-600 hover:bg-superficie-200",
                )}
              >
                {filtroOpcao.rotulo}
              </button>
            ))}
          </div>
        </div>
      </CartaoCabecalho>

      <CartaoConteudo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-borda bg-superficie-50 px-4 py-3">
            <p className="text-xs text-superficie-500">Vinculadas</p>
            <p className="text-lg font-semibold text-superficie-900">{resumo.vinculadas}</p>
          </div>
          <div className="rounded-lg border border-borda bg-superficie-50 px-4 py-3">
            <p className="text-xs text-superficie-500">Sem composição</p>
            <p className="text-lg font-semibold text-superficie-900">{resumo.semComposicao}</p>
          </div>
          <div className="rounded-lg border border-borda bg-superficie-50 px-4 py-3">
            <p className="text-xs text-superficie-500">Com divergência</p>
            <p className="text-lg font-semibold text-superficie-900">{resumo.comDivergencia}</p>
          </div>
          <div className="rounded-lg border border-borda bg-superficie-50 px-4 py-3">
            <p className="text-xs text-superficie-500">Impacto total</p>
            <p className="text-lg font-semibold text-superficie-900">{formatarMoeda(resumo.impacto)}</p>
          </div>
        </div>

        {erro && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
          >
            {erro}
          </div>
        )}

        {itens.length === 0 ? (
          <EstadoVazio
            icone={<Layers className="h-8 w-8" />}
            titulo="Nenhum item para analisar"
            descricao="Este orçamento não possui itens projetados. Importe ou adicione itens para comparar com as composições."
          />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="overflow-x-auto rounded-lg border border-borda">
              <Tabela>
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Código</CelulaCabecalho>
                    <CelulaCabecalho>Descrição</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Qtd.</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Valor original</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Valor calculado</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Diferença</CelulaCabecalho>
                    <CelulaCabecalho>Composição</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Ações</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {visiveis.map((item) => {
                    const status = STATUS_VINCULO[item.status];
                    const podeAplicar =
                      (item.status === "encontrada" || item.status === "desatualizada") &&
                      temDivergencia(item);
                    return (
                      <Linha key={item.chaveEstavel}>
                        <Celula className="font-mono text-sm">
                          {item.codigo ?? <span className="text-superficie-400">—</span>}
                        </Celula>
                        <Celula className="max-w-xs truncate">
                          {item.descricao ?? <span className="text-superficie-400">—</span>}
                        </Celula>
                        <Celula className="text-right tabular-nums">
                          {item.quantidade.toLocaleString("pt-BR")}
                          {item.unidade ? <span className="ml-1 text-xs text-superficie-400">{item.unidade}</span> : null}
                        </Celula>
                        <Celula className="text-right font-mono tabular-nums">
                          {formatarMoeda(item.valorOriginal)}
                        </Celula>
                        <Celula className="text-right font-mono tabular-nums">
                          {formatarMoeda(item.valorCalculado)}
                        </Celula>
                        <CelulaDiferenca item={item} />
                        <Celula>
                          <Etiqueta className={status.classe}>{status.rotulo}</Etiqueta>
                        </Celula>
                        <Celula className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.composicaoId && (
                              <Botao
                                variante="fantasma"
                                tamanho="sm"
                                onClick={() => setItemDetalhe(item)}
                                title="Ver composição"
                              >
                                <Eye className="h-4 w-4" />
                                Ver composição
                              </Botao>
                            )}
                            <Botao
                              variante="secundario"
                              tamanho="sm"
                              onClick={() => aplicar(item)}
                              disabled={!podeAplicar || pendente}
                              title="Aplicar o custo calculado da composição"
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                              Aplicar calculado
                            </Botao>
                            {item.aplicado && (
                              <Botao
                                variante="contorno"
                                tamanho="sm"
                                onClick={() => reverter(item)}
                                disabled={pendente}
                                title="Restaurar o valor original"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Manter original
                              </Botao>
                            )}
                            {(item.status === "ausente" || item.status === "duplicada") && (
                              <Botao
                                variante="contorno"
                                tamanho="sm"
                                onClick={() => abrirVinculo(item)}
                                disabled={pendente}
                                title="Vincular composição manualmente"
                              >
                                <Link2 className="h-4 w-4" />
                                Vincular
                              </Botao>
                            )}
                          </div>
                        </Celula>
                      </Linha>
                    );
                  })}
                </Corpo>
              </Tabela>
            </div>

            {filtrados.length === 0 && (
              <p className="py-6 text-center text-sm text-superficie-500">
                Nenhum item corresponde ao filtro selecionado.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-superficie-500">
                Página {paginaAtual} de {totalPaginas} · {filtrados.length} itens
              </p>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    onClick={() => setPagina(paginaAtual - 1)}
                    disabled={paginaAtual <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Botao>
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    onClick={() => setPagina(paginaAtual + 1)}
                    disabled={paginaAtual >= totalPaginas}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Botao>
                </div>
              )}
            </div>
          </div>
        )}
      </CartaoConteudo>

      <Modal
        aberto={itemDetalhe !== null}
        aoFechar={() => setItemDetalhe(null)}
        titulo="Custo da composição"
        descricao={
          itemDetalhe
            ? `${itemDetalhe.codigo ?? "Sem código"} — ${itemDetalhe.descricao ?? "Sem descrição"}`
            : undefined
        }
        tamanho="md"
      >
        {itemDetalhe && (
          <div className="space-y-4">
            <div className="space-y-2">
              {Object.entries(itemDetalhe.porCategoria).map(([categoria, total]) => (
                <div
                  key={categoria}
                  className="flex items-center justify-between rounded-lg border border-borda px-4 py-2.5"
                >
                  <span className="text-sm text-superficie-600">
                    {CATEGORIA_COMPOSICAO[categoria]?.rotulo ?? categoria}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{formatarMoeda(total)}</span>
                </div>
              ))}
              {Object.keys(itemDetalhe.porCategoria).length === 0 && (
                <p className="text-sm text-superficie-500">
                  Esta composição não possui custo calculado.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-borda pt-3">
              <span className="text-sm font-semibold text-superficie-800">Total</span>
              <span className="font-mono text-base font-semibold tabular-nums">
                {formatarMoeda(itemDetalhe.valorCalculado)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        aberto={itemVinculo !== null}
        aoFechar={fecharVinculo}
        titulo="Vincular composição"
        descricao={
          itemVinculo
            ? `Item ${itemVinculo.codigo ?? "sem código"} — ${itemVinculo.descricao ?? "sem descrição"}`
            : undefined
        }
        tamanho="lg"
      >
        {itemVinculo && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={termoBusca}
                onChange={(evento) => setTermoBusca(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") buscar();
                }}
                placeholder="Buscar por código ou nome..."
                className="block w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 placeholder:text-superficie-400 transition-colors focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500"
              />
              <Botao variante="secundario" onClick={buscar} carregando={buscando}>
                <Search className="h-4 w-4" />
                Buscar
              </Botao>
            </div>
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
              >
                {erro}
              </div>
            )}
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {resultadosBusca.map((composicao) => (
                <button
                  key={composicao.id}
                  type="button"
                  onClick={() => vincular(composicao.id)}
                  disabled={pendente}
                  className="w-full rounded-lg border border-borda px-4 py-2.5 text-left transition-colors hover:bg-superficie-50 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-superficie-800">
                        {composicao.codigo ?? "—"}
                      </p>
                      <p className="truncate text-sm text-superficie-600">{composicao.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm tabular-nums">
                        {formatarMoeda(composicao.custo_unitario)}
                      </p>
                      <p className="text-xs text-superficie-400">{composicao.unidade}</p>
                    </div>
                  </div>
                </button>
              ))}
              {resultadosBusca.length === 0 && !buscando && (
                <p className="py-6 text-center text-sm text-superficie-500">
                  Nenhuma composição encontrada.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Cartao>
  );
}