"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  OPCOES_STATUS_TAREFA,
  PRIORIDADE_TAREFA,
  STATUS_TAREFA,
} from "@/lib/domain/rotulos";
import { situacaoPrazo } from "@/lib/datas";
import type {
  PrioridadeTarefa,
  StatusTarefa,
} from "@/lib/supabase/database.types";
import type { TarefaPlanta } from "./tipos";

interface ListaTarefasPlantaProps {
  tarefas: TarefaPlanta[];
  paginaAtual: number;
}

export function ListaTarefasPlanta({
  tarefas,
  paginaAtual,
}: ListaTarefasPlantaProps) {
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusTarefa>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<
    "todas" | PrioridadeTarefa
  >("todas");

  const tarefasPagina = useMemo(
    () => tarefas.filter((t) => t.pagina === paginaAtual),
    [tarefas, paginaAtual],
  );

  const filtradas = tarefasPagina.filter(
    (t) =>
      (filtroStatus === "todos" || t.status === filtroStatus) &&
      (filtroPrioridade === "todas" || t.prioridade === filtroPrioridade),
  );

  return (
    <Cartao className="h-fit">
      <CartaoCabecalho>
        <CartaoTitulo>Tarefas na pagina {paginaAtual}</CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Selecao
            rotulo="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "todos" | StatusTarefa)}
          >
            <option value="todos">Todos</option>
            {OPCOES_STATUS_TAREFA.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Prioridade"
            value={filtroPrioridade}
            onChange={(e) =>
              setFiltroPrioridade(e.target.value as "todas" | PrioridadeTarefa)
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

        {filtradas.length === 0 ? (
          <EstadoVazio
            icone={<MapPin className="h-8 w-8" />}
            titulo="Nenhuma tarefa"
            descricao="Nao ha tarefas com esta localizacao na pagina."
          />
        ) : (
          <ul className="divide-y divide-superficie-100">
            {filtradas.map((tarefa) => {
              const prazoInfo = situacaoPrazo(
                tarefa.prazo,
                tarefa.status === "concluido",
              );
              return (
                <li key={tarefa.id}>
                  <Link
                    href={`/tarefas/${tarefa.id}`}
                    className="block py-3 hover:bg-superficie-50"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-superficie-900">
                      {tarefa.titulo}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
                        {STATUS_TAREFA[tarefa.status].rotulo}
                      </Etiqueta>
                      <Etiqueta
                        className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}
                      >
                        {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                      </Etiqueta>
                    </div>
                    <p className="mt-1.5 text-xs text-superficie-500">
                      {prazoInfo.texto}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}