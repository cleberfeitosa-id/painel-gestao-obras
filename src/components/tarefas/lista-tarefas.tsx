"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { CheckSquare, MapPin, Clock, ChevronDown, ChevronRight } from "lucide-react";
import {
  Cartao,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Avatar,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
  Botao,
} from "@/components/ui";
import { STATUS_TAREFA, PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import { situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { BotaoExcluirTarefa } from "./botao-excluir-tarefa";
import { BotaoDuplicarTarefa } from "./botao-duplicar-tarefa";
import { BotaoEdicaoEmLote } from "./botao-edicao-em-lote";
import type { TarefaComDados } from "@/app/(protegido)/tarefas/page";
import type { PerfilRow, ExecutorRow } from "@/lib/supabase/database.types";

interface ListaTarefasProps {
  tarefas: TarefaComDados[];
  podeExcluir: boolean;
  temFiltros: boolean;
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  tags: { id: string; nome: string }[];
  catalogoPrecos: {
    id: string;
    nome: string;
    unidade: string;
    medicoes: { id: string; titulo: string; obra_id: string };
  }[];
}

const COR_PRAZO: Record<string, string> = {
  atrasado: "text-red-600",
  hoje: "text-amber-600",
  proximo: "text-amber-600",
  ok: "text-superficie-500",
  sem_prazo: "text-superficie-400",
};

export function ListaTarefas({
  tarefas,
  podeExcluir,
  temFiltros,
  responsaveis,
  supervisores,
  executores,
  tags,
  catalogoPrecos,
}: ListaTarefasProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const tarefasPorTitulo = tarefas.reduce((acc, t) => {
    if (!acc[t.titulo]) acc[t.titulo] = [];
    acc[t.titulo].push(t.id);
    return acc;
  }, {} as Record<string, string[]>);

  const grupos = tarefas.reduce((acc, tarefa) => {
    const grupo = acc.find((g) => g.titulo === tarefa.titulo);
    if (grupo) {
      grupo.tarefas.push(tarefa);
    } else {
      acc.push({ titulo: tarefa.titulo, tarefas: [tarefa] });
    }
    return acc;
  }, [] as { titulo: string; tarefas: TarefaComDados[] }[]);

  const alternarRecolhido = (titulo: string) => {
    setRecolhidos((atual) => {
      const novas = new Set(atual);
      if (novas.has(titulo)) {
        novas.delete(titulo);
      } else {
        novas.add(titulo);
      }
      return novas;
    });
  };

  const toggleSelecao = (tarefa: TarefaComDados) => {
    const novas = new Set(selecionadas);
    const grupo = tarefasPorTitulo[tarefa.titulo] || [tarefa.id];
    
    const isSelecionada = novas.has(tarefa.id);
    
    if (isSelecionada) {
      grupo.forEach((id) => novas.delete(id));
    } else {
      grupo.forEach((id) => novas.add(id));
    }
    setSelecionadas(novas);
  };

  const toggleTodas = () => {
    if (selecionadas.size === tarefas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(tarefas.map((t) => t.id)));
    }
  };

  const limparSelecao = () => setSelecionadas(new Set());

  const renderizarLinhaTarefa = (tarefa: TarefaComDados) => {
    const prazoInfo = situacaoPrazo(
      tarefa.prazo,
      tarefa.status === "concluido",
    );
    const isSelecionada = selecionadas.has(tarefa.id);
    return (
      <Linha key={tarefa.id} className={cn(isSelecionada && "bg-azul-50/50")}>
        <Celula className="text-center">
          <input
            type="checkbox"
            checked={isSelecionada}
            onChange={() => toggleSelecao(tarefa)}
            className="h-4 w-4 rounded border-borda text-azul-600 focus:ring-azul-500 cursor-pointer"
          />
        </Celula>
        <Celula>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/tarefas/${tarefa.id}`}
              className="font-medium text-azul-600 hover:text-azul-700"
            >
              {tarefa.titulo}
            </Link>
            {tarefa.tags_tarefa && (
              <span className="inline-flex items-center rounded-md bg-superficie-100 px-2 py-0.5 text-xs font-medium text-superficie-600">
                {tarefa.tags_tarefa.nome}
              </span>
            )}
            {tarefa.tarefa_medicoes && tarefa.tarefa_medicoes.length > 0 && (
              <span
                className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-medium"
                title={tarefa.tarefa_medicoes
                  .map((tm) =>
                    tm.catalogo_precos
                      ? `${tm.catalogo_precos.medicoes?.titulo ?? "Medição"}: ${tm.catalogo_precos.nome} (${tm.quantidade} ${tm.catalogo_precos.unidade})`
                      : `Medição (${tm.quantidade})`
                  )
                  .join("\n")}
              >
                {tarefa.tarefa_medicoes.length === 1 && tarefa.tarefa_medicoes[0].catalogo_precos
                  ? `${tarefa.tarefa_medicoes[0].catalogo_precos.medicoes?.titulo ?? "Medição"}: ${tarefa.tarefa_medicoes[0].catalogo_precos.nome}`
                  : `${tarefa.tarefa_medicoes.length} medições`}
              </span>
            )}
          </div>
        </Celula>
        <Celula>{tarefa.obras.nome}</Celula>
        <Celula>
          {tarefa.responsavel ? (
            <span className="flex items-center gap-2">
              <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
              <span className="text-superficie-700">
                {tarefa.responsavel.nome}
              </span>
            </span>
          ) : (
            <span className="text-superficie-400">—</span>
          )}
        </Celula>
        <Celula>
          <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
            {STATUS_TAREFA[tarefa.status].rotulo}
          </Etiqueta>
        </Celula>
        <Celula>
          <Etiqueta
            className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
          >
            {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
          </Etiqueta>
        </Celula>
        <Celula>
          <span className={COR_PRAZO[prazoInfo.situacao]}>
            {prazoInfo.texto}
          </span>
        </Celula>
        <Celula>
          {tarefa.localizacao_tipo !== "nenhuma" &&
          tarefa.planta_id ? (
            <Link
              href={`/obras/${tarefa.obra_id}/plantas/${tarefa.planta_id}`}
              className="inline-flex items-center gap-1 text-azul-600 hover:text-azul-700"
              title={tarefa.plantas?.nome ?? "Ver na planta"}
            >
              <MapPin className="h-4 w-4" />
              {tarefa.plantas?.nome && (
                <span className="hidden xl:inline max-w-[100px] truncate text-xs">
                  {tarefa.plantas.nome}
                </span>
              )}
            </Link>
          ) : (
            <span className="text-superficie-300">—</span>
          )}
        </Celula>
        {podeExcluir && (
          <Celula>
            <div className="flex items-center justify-end gap-1">
              <BotaoDuplicarTarefa
                tarefaId={tarefa.id}
                titulo={tarefa.titulo}
                compacto
              />
              <BotaoExcluirTarefa
                tarefaId={tarefa.id}
                titulo={tarefa.titulo}
                compacto
              />
            </div>
          </Celula>
        )}
      </Linha>
    );
  };

  const renderizarCardTarefa = (tarefa: TarefaComDados) => {
    const prazoInfo = situacaoPrazo(
      tarefa.prazo,
      tarefa.status === "concluido",
    );
    const isSelecionada = selecionadas.has(tarefa.id);
    return (
      <div key={tarefa.id} className="relative">
        <div className="absolute left-4 top-4 z-10">
          <input
            type="checkbox"
            checked={isSelecionada}
            onChange={() => toggleSelecao(tarefa)}
            className="h-5 w-5 rounded border-borda text-azul-600 focus:ring-azul-500 cursor-pointer"
          />
        </div>
        <Cartao className={cn("transition-shadow group-hover:shadow-md", isSelecionada && "ring-2 ring-azul-500 bg-azul-50/20")}>
          <Link
            href={`/tarefas/${tarefa.id}`}
            className="group block pl-10"
          >
            <CartaoConteudo className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-superficie-900">
                    {tarefa.titulo}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {tarefa.tags_tarefa && (
                      <span className="inline-flex items-center rounded-md bg-superficie-100 px-2 py-0.5 text-xs font-medium text-superficie-600">
                        {tarefa.tags_tarefa.nome}
                      </span>
                    )}
                    {tarefa.tarefa_medicoes && tarefa.tarefa_medicoes.length > 0 && (
                      <span
                        className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-medium"
                        title={tarefa.tarefa_medicoes
                          .map((tm) =>
                            tm.catalogo_precos
                              ? `${tm.catalogo_precos.medicoes?.titulo ?? "Medição"}: ${tm.catalogo_precos.nome} (${tm.quantidade} ${tm.catalogo_precos.unidade})`
                              : `Medição (${tm.quantidade})`
                          )
                          .join("\n")}
                      >
                        {tarefa.tarefa_medicoes.length === 1 && tarefa.tarefa_medicoes[0].catalogo_precos
                          ? `${tarefa.tarefa_medicoes[0].catalogo_precos.medicoes?.titulo ?? "Medição"}: ${tarefa.tarefa_medicoes[0].catalogo_precos.nome}`
                          : `${tarefa.tarefa_medicoes.length} medições`}
                      </span>
                    )}
                  </div>
                </div>
                <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
                  {STATUS_TAREFA[tarefa.status].rotulo}
                </Etiqueta>
              </div>
              <p className="text-sm text-superficie-500">{tarefa.obras.nome}</p>
              <div className="flex items-center justify-between border-t border-borda pt-3">
                <div className="flex items-center gap-2">
                  {tarefa.responsavel ? (
                    <>
                      <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
                      <span className="text-xs text-superficie-600">
                        {tarefa.responsavel.nome}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-superficie-400">
                      Sem responsável
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Etiqueta
                    className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
                  >
                    {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                  </Etiqueta>
                  {tarefa.localizacao_tipo !== "nenhuma" &&
                    tarefa.planta_id && (
                      <MapPin className="h-4 w-4 text-azul-600" />
                    )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-superficie-400" />
                <span className={COR_PRAZO[prazoInfo.situacao]}>
                  {prazoInfo.texto}
                </span>
              </div>
            </CartaoConteudo>
          </Link>
          {podeExcluir && (
            <div className="flex items-center justify-end gap-2 border-t border-borda px-4 py-2">
              <BotaoDuplicarTarefa
                tarefaId={tarefa.id}
                titulo={tarefa.titulo}
                compacto
              />
              <BotaoExcluirTarefa
                tarefaId={tarefa.id}
                titulo={tarefa.titulo}
                compacto
              />
            </div>
          )}
        </Cartao>
      </div>
    );
  };

  if (tarefas.length === 0) {
    return (
      <Cartao>
        <EstadoVazio
          icone={<CheckSquare className="h-8 w-8" />}
          titulo={
            temFiltros ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa cadastrada"
          }
          descricao={
            temFiltros
              ? "Ajuste os filtros ou o termo de busca para encontrar tarefas."
              : "Crie a primeira tarefa para começar o acompanhamento dos canteiros."
          }
        />
      </Cartao>
    );
  }

  return (
    <>
      {selecionadas.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-azul-50 px-4 py-3 border border-azul-200 sticky top-6 z-20 mb-4 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-azul-900">
              {selecionadas.size} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}
            </span>
            <Botao type="button" variante="fantasma" onClick={limparSelecao}>
              Desmarcar
            </Botao>
          </div>
          <div className="flex items-center gap-2">
            <BotaoEdicaoEmLote
              tarefasSelecionadas={tarefas.filter(t => selecionadas.has(t.id))}
              responsaveis={responsaveis}
              supervisores={supervisores}
              executores={executores}
              tags={tags}
              catalogoPrecos={catalogoPrecos}
              aoConcluir={limparSelecao}
            />
          </div>
        </div>
      )}

      <Cartao className="hidden lg:block">
        <Tabela>
          <Cabecalho>
              <LinhaCabecalho>
                <CelulaCabecalho className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={tarefas.length > 0 && selecionadas.size === tarefas.length}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate =
                          selecionadas.size > 0 && selecionadas.size < tarefas.length;
                      }
                    }}
                    onChange={toggleTodas}
                    className="h-4 w-4 rounded border-borda text-azul-600 focus:ring-azul-500 cursor-pointer"
                  />
                </CelulaCabecalho>
                <CelulaCabecalho>Tarefa</CelulaCabecalho>
                <CelulaCabecalho>Obra</CelulaCabecalho>
                <CelulaCabecalho>Responsável</CelulaCabecalho>
                <CelulaCabecalho>Status</CelulaCabecalho>
                <CelulaCabecalho>Prioridade</CelulaCabecalho>
                <CelulaCabecalho>Prazo</CelulaCabecalho>
                <CelulaCabecalho>Local</CelulaCabecalho>
                {podeExcluir && <CelulaCabecalho>Ações</CelulaCabecalho>}
              </LinhaCabecalho>
            </Cabecalho>
            <Corpo>
              {grupos.map((grupo) => {
                if (grupo.tarefas.length === 1) {
                  return renderizarLinhaTarefa(grupo.tarefas[0]);
                }
                const recolhido = recolhidos.has(grupo.titulo);
                return (
                  <Fragment key={grupo.titulo}>
                    <Linha className="bg-superficie-50/60 hover:bg-superficie-50">
                      <td
                        colSpan={podeExcluir ? 9 : 8}
                        className="px-4 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => alternarRecolhido(grupo.titulo)}
                          aria-expanded={!recolhido}
                          aria-controls={`grupo-${grupo.titulo}`}
                          className="flex w-full items-center gap-2 text-left font-semibold text-superficie-800 hover:text-azul-700"
                        >
                          {recolhido ? (
                            <ChevronRight className="h-4 w-4 text-superficie-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-superficie-400" />
                          )}
                          <span>
                            {grupo.titulo} ({grupo.tarefas.length})
                          </span>
                        </button>
                      </td>
                    </Linha>
                    {!recolhido && (
                      <>{grupo.tarefas.map((tarefa) => renderizarLinhaTarefa(tarefa))}</>
                    )}
                  </Fragment>
                );
              })}
            </Corpo>
        </Tabela>
      </Cartao>

      <div className="grid gap-4 lg:hidden">
        {grupos.map((grupo) => {
          if (grupo.tarefas.length === 1) {
            return renderizarCardTarefa(grupo.tarefas[0]);
          }
          const recolhido = recolhidos.has(grupo.titulo);
          return (
            <div key={grupo.titulo} className="space-y-3">
              <button
                type="button"
                onClick={() => alternarRecolhido(grupo.titulo)}
                aria-expanded={!recolhido}
                aria-controls={`grupo-mobile-${grupo.titulo}`}
                className="flex w-full items-center gap-2 rounded-lg border border-borda bg-superficie-50 px-4 py-3 text-left font-semibold text-superficie-800 hover:bg-superficie-100"
              >
                {recolhido ? (
                  <ChevronRight className="h-4 w-4 text-superficie-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-superficie-400" />
                )}
                <span>
                  {grupo.titulo} ({grupo.tarefas.length})
                </span>
              </button>
              {!recolhido &&
                grupo.tarefas.map((tarefa) => renderizarCardTarefa(tarefa))}
            </div>
          );
        })}
      </div>
    </>
  );
}
