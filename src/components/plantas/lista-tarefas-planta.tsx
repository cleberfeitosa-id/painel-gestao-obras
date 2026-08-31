"use client";

import { MapPin } from "lucide-react";
import {
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
  EstadoVazio,
  Etiqueta,
  Selecao,
} from "@/components/ui";
import {
  OPCOES_PRIORIDADE,
  OPCOES_SITUACAO_TAREFA,
  PRIORIDADE_TAREFA,
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import type {
  PrioridadeTarefa,
} from "@/lib/supabase/database.types";
import type { ExecutorFiltro, TarefaPlanta } from "./tipos";
import type { SituacaoTarefa } from "@/lib/domain/rotulos";

interface ListaTarefasPlantaProps {
  tarefas: TarefaPlanta[];
  todasTarefasPagina: TarefaPlanta[];
  paginaAtual: number;
  executores: ExecutorFiltro[];
  filtroSituacao: "todas" | SituacaoTarefa;
  aoMudarSituacao: (valor: "todas" | SituacaoTarefa) => void;
  filtroPrioridade: "todas" | PrioridadeTarefa;
  aoMudarPrioridade: (valor: "todas" | PrioridadeTarefa) => void;
  filtroExecutor: "todos" | "sem" | string;
  aoMudarExecutor: (valor: "todos" | "sem" | string) => void;
  filtroTag: "todas" | "sem" | string;
  aoMudarTag: (valor: "todas" | "sem" | string) => void;
  tags: { id: string; nome: string }[];
  tarefaDestaque: string | null;
  aoDestaque: (id: string | null) => void;
  aoEditarNoMapa?: (id: string) => void;
}

export function ListaTarefasPlanta({
  tarefas,
  todasTarefasPagina,
  paginaAtual,
  executores,
  filtroSituacao,
  aoMudarSituacao,
  filtroPrioridade,
  aoMudarPrioridade,
  filtroExecutor,
  aoMudarExecutor,
  filtroTag,
  aoMudarTag,
  tags,
  tarefaDestaque,
  aoDestaque,
  aoEditarNoMapa,
}: ListaTarefasPlantaProps) {
  const temFiltros =
    filtroSituacao !== "todas" ||
    filtroPrioridade !== "todas" ||
    filtroExecutor !== "todos" ||
    filtroTag !== "todas";

  return (
    <Cartao className="h-fit">
      <CartaoCabecalho>
        <CartaoTitulo>Tarefas na pagina {paginaAtual}</CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Selecao
            rotulo="Situacao"
            value={filtroSituacao}
            onChange={(e) =>
              aoMudarSituacao(e.target.value as "todas" | SituacaoTarefa)
            }
          >
            <option value="todas">Todas</option>
            {OPCOES_SITUACAO_TAREFA.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Prioridade"
            value={filtroPrioridade}
            onChange={(e) =>
              aoMudarPrioridade(e.target.value as "todas" | PrioridadeTarefa)
            }
          >
            <option value="todas">Todas</option>
            {OPCOES_PRIORIDADE.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Selecao
            rotulo="Executor"
            value={filtroExecutor}
            onChange={(e) => aoMudarExecutor(e.target.value)}
          >
            <option value="todos">Todos os executores</option>
            <option value="sem">Sem executor</option>
            {executores.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.nome}
              </option>
            ))}
          </Selecao>

          <Selecao
            rotulo="Tag"
            value={filtroTag}
            onChange={(e) => aoMudarTag(e.target.value)}
          >
            <option value="todas">Todas as tags</option>
            <option value="sem">Sem tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.nome}
              </option>
            ))}
          </Selecao>
        </div>

        {temFiltros && (
          <p className="text-xs text-superficie-500">
            {tarefas.length} de {todasTarefasPagina.length} tarefas na pagina
          </p>
        )}

        {tarefas.length === 0 ? (
          <EstadoVazio
            icone={<MapPin className="h-8 w-8" />}
            titulo={
              temFiltros
                ? "Nenhuma tarefa encontrada"
                : "Nenhuma tarefa"
            }
            descricao={
              temFiltros
                ? "Nao ha tarefas nestes filtros na pagina atual. Tente alterar os filtros."
                : "Nao ha tarefas com esta localizacao na pagina."
            }
          />
        ) : (
          <ul className="divide-y divide-superficie-100">
            {tarefas.map((tarefa) => {
              const prazoInfo = situacaoPrazo(
                tarefa.prazo,
                tarefa.status === "concluido",
              );
              const sit = situacaoDaTarefa({
                status: tarefa.status,
                aprovacao: tarefa.aprovacao,
              });
              const destacada = tarefaDestaque === tarefa.id;
              return (
                <li
                  key={tarefa.id}
                  onMouseEnter={() => aoDestaque(tarefa.id)}
                  onMouseLeave={() => aoDestaque(null)}
                  className={cn(
                    destacada && "bg-azul-50 ring-1 ring-inset ring-azul-200",
                  )}
                >
                  <a
                    href={`/tarefas/${tarefa.id}`}
                    className="block py-3 hover:bg-superficie-50"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-superficie-900">
                      {tarefa.titulo}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Etiqueta className={SITUACAO_TAREFA[sit].classe}>
                        {SITUACAO_TAREFA[sit].rotulo}
                      </Etiqueta>
                      <Etiqueta
                        className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
                      >
                        {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                      </Etiqueta>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs text-superficie-500">
                        {prazoInfo.texto}
                      </p>
                      {aoEditarNoMapa && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            aoEditarNoMapa(tarefa.id);
                          }}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-azul-600 hover:bg-azul-50 hover:text-azul-700 transition-colors"
                          title="Editar posição desta tarefa no mapa"
                        >
                          <MapPin className="h-3 w-3" />
                          <span>Editar no mapa</span>
                        </button>
                      )}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}
