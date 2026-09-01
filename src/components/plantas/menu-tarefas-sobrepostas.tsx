"use client";

import { useEffect, useRef } from "react";
import {
  MapPin,
  Square,
  X,
  Calendar,
  User,
  Zap,
  Ruler,
  Boxes,
  ArrowDownUp,
} from "lucide-react";
import { Etiqueta } from "@/components/ui";
import {
  PRIORIDADE_TAREFA,
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { formatarData, situacaoPrazo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import type { TarefaPlanta } from "./tipos";

interface MenuTarefasSobrepostasProps {
  posicao: { x: number; y: number };
  tarefas: TarefaPlanta[];
  aoSelecionar: (tarefa: TarefaPlanta) => void;
  aoFechar: () => void;
  aoDestaque?: (id: string | null) => void;
}

export function MenuTarefasSobrepostas({
  posicao,
  tarefas,
  aoSelecionar,
  aoFechar,
  aoDestaque,
}: MenuTarefasSobrepostasProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const menuWidth = 320;
  const menuEstimatedHeight = Math.min(380, 80 + tarefas.length * 75);

  const left = Math.max(
    16,
    Math.min(
      posicao.x,
      typeof window !== "undefined" ? window.innerWidth - menuWidth - 16 : posicao.x,
    ),
  );

  const top = Math.max(
    16,
    Math.min(
      posicao.y,
      typeof window !== "undefined"
        ? window.innerHeight - menuEstimatedHeight - 16
        : posicao.y,
    ),
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-superficie-950/20 backdrop-blur-[1px]"
        onClick={aoFechar}
      />

      <div
        ref={menuRef}
        style={{ left: `${left}px`, top: `${top}px` }}
        className="fixed z-50 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-borda bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-borda px-3.5 py-2.5 bg-superficie-50/80 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-azul-100 text-xs font-bold text-azul-700">
              {tarefas.length}
            </span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-superficie-700">
              Tarefas sobrepostas
            </h3>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg p-1 text-superficie-400 hover:bg-superficie-200 hover:text-superficie-700 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-3.5 pt-2 text-[11px] text-superficie-500">
          Selecione a tarefa que deseja abrir:
        </p>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 divide-y-0">
          {tarefas.map((tarefa) => {
            const sit = situacaoDaTarefa({
              status: tarefa.status,
              aprovacao: tarefa.aprovacao,
            });
            const opcaoSituacao = SITUACAO_TAREFA[sit];
            const prazoInfo = situacaoPrazo(
              tarefa.prazo,
              tarefa.status === "concluido",
            );
            const tipo = tarefa.localizacao_tipo;

            return (
              <button
                key={tarefa.id}
                type="button"
                onClick={() => aoSelecionar(tarefa)}
                onMouseEnter={() => aoDestaque?.(tarefa.id)}
                onMouseLeave={() => aoDestaque?.(null)}
                className="group flex w-full flex-col gap-1.5 rounded-lg border border-transparent p-2.5 text-left transition-all hover:border-azul-200 hover:bg-azul-50/60 focus:border-azul-300 focus:bg-azul-50 focus:outline-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {tipo === "circuito" ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Circuito na planta"
                      >
                        <Zap className="h-3 w-3" />
                      </span>
                    ) : tipo === "distancia" ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Distância linear na planta"
                      >
                        <Ruler className="h-3 w-3" />
                      </span>
                    ) : tipo === "area" ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Área na planta"
                      >
                        <Boxes className="h-3 w-3" />
                      </span>
                    ) : tipo === "descida" ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Descida vertical na planta"
                      >
                        <ArrowDownUp className="h-3 w-3" />
                      </span>
                    ) : tipo === "regiao" ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Região na planta"
                      >
                        <Square className="h-3 w-3" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-xs",
                          opcaoSituacao.pino,
                        )}
                        title="Pino na planta"
                      >
                        <MapPin className="h-3 w-3" />
                      </span>
                    )}
                    <span className="truncate text-xs font-semibold text-superficie-900 group-hover:text-azul-700">
                      {tarefa.titulo}
                    </span>
                  </div>
                  <Etiqueta className={cn("shrink-0 text-[10px]", opcaoSituacao.classe)}>
                    {opcaoSituacao.rotulo}
                  </Etiqueta>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-superficie-500">
                  <Etiqueta className={cn("text-[10px]", PRIORIDADE_TAREFA[tarefa.prioridade].classe)}>
                    {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
                  </Etiqueta>
                  {tarefa.responsavel?.nome && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 text-superficie-400" />
                      {tarefa.responsavel.nome}
                    </span>
                  )}
                  {tarefa.prazo && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-superficie-400" />
                      {formatarData(tarefa.prazo)} ({prazoInfo.texto})
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
