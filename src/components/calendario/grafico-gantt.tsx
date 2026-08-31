"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  addDays,
  format,
  eachDayOfInterval,
  differenceInCalendarDays,
  isSameDay,
  min as dateMin,
  max as dateMax,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { paraData, hojeChave } from "@/lib/datas";
import { cn } from "@/lib/utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ItemGantt = {
  tarefa: {
    id: string;
    titulo: string;
    status: "pendente" | "em_execucao" | "concluido";
    aprovacao: "pendente" | "aprovado" | "reprovado";
    data_inicio: string | null;
    data_fim: string | null;
    data_planejada: string | null;
    prazo: string | null;
  };
  obraNome: string;
};

type Props = {
  itens: ItemGantt[];
  dependencias: Record<string, string[]>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type GrupoGantt = {
  titulo: string;
  total: number;
  concluidas: number;
  inicio: Date;
  fim: Date;
  dependenciasCount: number;
  obraNome: string;
};

function extrairInicio(t: ItemGantt["tarefa"]): Date | null {
  if (t.data_inicio) return paraData(t.data_inicio);
  if (t.data_planejada) return paraData(t.data_planejada);
  return null;
}

function extrairFim(t: ItemGantt["tarefa"]): Date | null {
  if (t.data_fim) return paraData(t.data_fim);
  if (t.prazo) return paraData(t.prazo);
  return null;
}

function ehConcluida(t: ItemGantt["tarefa"]): boolean {
  return t.status === "concluido" || t.aprovacao === "aprovado";
}

// ─── Constantes de layout ──────────────────────────────────────────────────

const LARGURA_COLUNA = 256;
const LARGURA_DIA = 36;
const JANELA_DIAS = 45;

// ─── Componente ─────────────────────────────────────────────────────────────

export function GraficoGantt({ itens, dependencias }: Props) {
  const { grupos, dias, hoje, windowStart } = useMemo(() => {
    const mapaOrdem = new Map<string, number>();
    const mapaGrupos = new Map<
      string,
      { itens: ItemGantt[]; obraNome: string }
    >();

    for (const item of itens) {
      const chave = item.tarefa.titulo;
      if (!mapaGrupos.has(chave)) {
        mapaOrdem.set(chave, mapaOrdem.size);
        mapaGrupos.set(chave, { itens: [], obraNome: item.obraNome });
      }
      mapaGrupos.get(chave)!.itens.push(item);
    }

    const gruposCalculados: (GrupoGantt & { _ordem: number })[] = [];

    for (const [titulo, dados] of mapaGrupos) {
      const inicios: Date[] = [];
      const fims: Date[] = [];
      let concluidas = 0;

      for (const item of dados.itens) {
        const ini = extrairInicio(item.tarefa);
        const fim = extrairFim(item.tarefa);
        if (ini) inicios.push(ini);
        if (fim) fims.push(fim);
        if (ehConcluida(item.tarefa)) concluidas++;
      }

      if (inicios.length === 0 && fims.length === 0) continue;

      const inicio = inicios.length > 0 ? dateMin(inicios) : dateMin(fims);
      const fim = fims.length > 0 ? dateMax(fims) : dateMax(inicios);

      // Dependencias externas deduplicadas por ID
      let dependenciasCount = 0;
      const idsGrupo = new Set(dados.itens.map((i) => i.tarefa.id));
      const idsDependencia = new Set<string>();
      for (const item of dados.itens) {
        const deps = dependencias[item.tarefa.id];
        if (deps) {
          for (const dep of deps) {
            if (!idsGrupo.has(dep) && !idsDependencia.has(dep)) {
              idsDependencia.add(dep);
              dependenciasCount++;
            }
          }
        }
      }

      gruposCalculados.push({
        titulo,
        total: dados.itens.length,
        concluidas,
        inicio,
        fim,
        dependenciasCount,
        obraNome: dados.obraNome,
        _ordem: mapaOrdem.get(titulo) ?? 0,
      });
    }

    // Sort by start date; tie-break by first appearance order
    gruposCalculados.sort((a, b) => {
      const diff = a.inicio.getTime() - b.inicio.getTime();
      return diff !== 0 ? diff : a._ordem - b._ordem;
    });

    const grupos: GrupoGantt[] = gruposCalculados.map((g) => ({
      titulo: g.titulo,
      total: g.total,
      concluidas: g.concluidas,
      inicio: g.inicio,
      fim: g.fim,
      dependenciasCount: g.dependenciasCount,
      obraNome: g.obraNome,
    }));

    const hoje = paraData(hojeChave());

    if (grupos.length === 0) {
      return { grupos, dias: [], hoje, windowStart: hoje };
    }

    const globalStart = dateMin(grupos.map((g) => g.inicio));
    const globalEnd = dateMax(grupos.map((g) => g.fim));
    const windowStart = dateMin([addDays(hoje, -JANELA_DIAS), globalStart]);
    const windowEnd = dateMax([addDays(hoje, JANELA_DIAS), globalEnd]);
    const dias = eachDayOfInterval({ start: windowStart, end: windowEnd });

    return { grupos, dias, hoje, windowStart };
  }, [itens, dependencias]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Alinha a coluna de hoje logo apos a coluna de nomes ao abrir o gantt.
  // Datas anteriores sao alcancaveis rolando para a esquerda.
  const offsetHoje =
    differenceInCalendarDays(hoje, windowStart) * LARGURA_DIA;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pos = () => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = Math.min(
        offsetHoje,
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
      );
    };
    pos();
    // Reaplica apos o layout assentar (fonte/filtro pode mudar a largura).
    let id2: number;
    const id1 = requestAnimationFrame(() => {
      pos();
      id2 = requestAnimationFrame(pos);
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [offsetHoje, hoje, windowStart, dias.length]);

  if (grupos.length === 0) {
    return (
      <div className="rounded-xl border border-borda bg-fundo-card p-8 text-center">
        <p className="text-sm text-superficie-500">
          Nenhuma tarefa com intervalo de datas para exibir no gantt.
        </p>
      </div>
    );
  }

  const totalWidth = LARGURA_COLUNA + dias.length * LARGURA_DIA;

  return (
    <div
      ref={scrollRef}
      className="max-w-full overflow-x-auto rounded-xl border border-borda bg-fundo-card"
    >
      <div style={{ width: totalWidth }}>
          {/* ── Header ── */}
          <div className="sticky top-0 z-30 flex border-b border-borda bg-superficie-50">
            <div className="sticky left-0 z-30 flex w-64 flex-shrink-0 items-center border-r border-borda bg-superficie-50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-superficie-500">
                Tarefa
              </span>
            </div>
            <div className="flex">
              {dias.map((dia) => {
                const diaSemana = dia.getDay();
                const fimDeSemana = diaSemana === 0 || diaSemana === 6;
                const ehHoje = isSameDay(dia, hoje);
                return (
                  <div
                    key={dia.toISOString()}
                    className={cn(
                      "flex flex-col items-center border-r border-borda py-1.5",
                      ehHoje
                        ? "bg-azul-500/10"
                        : fimDeSemana
                          ? "bg-superficie-100"
                          : "bg-superficie-50",
                    )}
                    style={{ width: LARGURA_DIA }}
                  >
                    <span
                      className={cn(
                        "text-[10px] leading-tight",
                        ehHoje
                          ? "font-bold text-azul-700"
                          : fimDeSemana
                            ? "font-medium text-superficie-400"
                            : "font-semibold text-superficie-700",
                      )}
                    >
                      {format(dia, "d")}
                    </span>
                    <span className="text-[9px] leading-tight text-superficie-400">
                      {format(dia, "EEE", { locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Body rows ── */}
          {grupos.map((grupo) => {
            const barStartDias = differenceInCalendarDays(
              grupo.inicio,
              windowStart,
            );
            const barEndDias = differenceInCalendarDays(
              grupo.fim,
              windowStart,
            );
            const pct =
              grupo.total > 0
                ? Math.round((grupo.concluidas / grupo.total) * 100)
                : 0;
            const clampedPct = Math.min(100, Math.max(0, pct));

            return (
              <div
                key={grupo.titulo}
                className="flex min-h-14 border-b border-borda"
              >
                {/* Label cell (sticky left) */}
                <div className="sticky left-0 z-20 flex w-64 flex-shrink-0 flex-col justify-center border-r border-borda bg-fundo-card px-3 py-2">
                  <p className="text-sm font-medium leading-tight text-superficie-900">
                    {grupo.titulo}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-[11px] text-superficie-500">
                      {grupo.total}{" "}
                      {grupo.total === 1 ? "tarefa" : "tarefas"} ·{" "}
                      {grupo.obraNome}
                    </span>
                    {grupo.dependenciasCount > 0 && (
                      <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-azul-50 px-1.5 py-0.5 text-[10px] font-medium text-azul-700 ring-1 ring-inset ring-azul-200/50">
                        ↳ {grupo.dependenciasCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline area */}
                <div className="relative flex flex-1 items-center">
                  {/* Day gridlines */}
                  {dias.map((dia, idx) => {
                    const diaSemana = dia.getDay();
                    const fimDeSemana = diaSemana === 0 || diaSemana === 6;
                    return (
                      <div
                        key={dia.toISOString()}
                        className={cn(
                          "absolute inset-y-0 border-r border-borda",
                          fimDeSemana && "bg-superficie-50/50",
                        )}
                        style={{
                          left: idx * LARGURA_DIA,
                          width: LARGURA_DIA,
                        }}
                      />
                    );
                  })}

                  {/* Today vertical accent line */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-azul-500"
                    style={{
                      left:
                        differenceInCalendarDays(hoje, windowStart) *
                          LARGURA_DIA -
                        1,
                      zIndex: 5,
                    }}
                  />

                  {/* Progress bar */}
                  <div
                    className="absolute flex items-center rounded-md bg-slate-200"
                    style={{
                      left: barStartDias * LARGURA_DIA,
                      width: Math.max(
                        (barEndDias - barStartDias) * LARGURA_DIA,
                        8,
                      ),
                      height: 22,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    title={`${grupo.titulo}: ${clampedPct}% concluído (${grupo.concluidas}/${grupo.total})`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-md bg-emerald-500"
                      style={{ width: `${clampedPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 rounded-r-md bg-slate-200"
                      style={{ width: `${100 - clampedPct}%` }}
                    />
                    <div className="relative z-10 flex w-full items-center justify-between px-2">
                      <span className="text-[10px] font-semibold text-white drop-shadow-sm">
                        {clampedPct}%
                      </span>
                      <span className="text-[10px] font-medium text-white drop-shadow-sm">
                        {grupo.concluidas}/{grupo.total} concluídas
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
