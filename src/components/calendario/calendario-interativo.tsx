"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, CalendarClock, RotateCw } from "lucide-react";
import { Botao, Campo, Modal } from "@/components/ui";
import { reagendarTarefa } from "@/app/(protegido)/calendario/acoes";
import { chaveDia, NOMES_DIAS_SEMANA } from "@/lib/datas";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/supabase/database.types";

export type ItemCalendario = {
  tarefa: TarefaRow;
  obraNome: string;
  responsavelNome: string | null;
};

type Celula = {
  data: Date;
  chave: string;
  doMesAtual: boolean;
  hoje: boolean;
};

type Props = {
  semana: Celula[][];
  itensPorDia: Map<string, ItemCalendario[]>;
  podeReagendar: boolean;
};

const MAX_ITENS = 3;
const ANO_CALENDARIO = 2026;
const JANEIRO_2026_DOMINGO = 4;

export function CalendarioInterativo({
  semana,
  itensPorDia,
  podeReagendar,
}: Props) {
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [tarefaReagendar, setTarefaReagendar] = useState<ItemCalendario | null>(
    null,
  );
  const [novaData, setNovaData] = useState("");
  const [erroReagendar, setErroReagendar] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [itemAnimado, setItemAnimado] = useState<string | null>(null);

  const itensDoDia = (chave: string) => {
    const itens = itensPorDia.get(chave) ?? [];
    return {
      planejadas: itens.filter((i) => i.tarefa.status !== "concluido"),
      concluidas: itens.filter((i) => i.tarefa.status === "concluido"),
    };
  };

  const moverTarefa = useCallback(
    async (tarefaId: string, diaChave: string) => {
      if (!podeReagendar) return;
      setItemAnimado(tarefaId);
      const resultado = await reagendarTarefa(tarefaId, diaChave);
      setItemAnimado(null);
      void resultado;
    },
    [podeReagendar],
  );

  const abrirReagendar = (item: ItemCalendario) => {
    setTarefaReagendar(item);
    setNovaData(item.tarefa.data_planejada ?? chaveDia(new Date()));
    setErroReagendar(undefined);
  };

  const confirmarReagendar = async () => {
    if (!tarefaReagendar) return;
    setSalvando(true);
    setErroReagendar(undefined);
    const resultado = await reagendarTarefa(tarefaReagendar.tarefa.id, novaData);
    setSalvando(false);
    if (resultado.erro) {
      setErroReagendar(resultado.erro);
      return;
    }
    setTarefaReagendar(null);
  };

  const renderItem = (item: ItemCalendario, concluida: boolean) => {
    const podeArrastar = podeReagendar && !concluida;
    return (
      <div
        key={item.tarefa.id}
        draggable={podeArrastar}
        onDragStart={(e) => {
          if (!podeArrastar) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData("text/plain", item.tarefa.id);
          e.dataTransfer.effectAllowed = "move";
          setArrastado(item.tarefa.id);
        }}
        onDragEnd={() => {
          setArrastado(null);
          setSobre(null);
        }}
        className={cn(
          "flex items-start gap-1 rounded px-1 py-0.5 text-[11px] leading-tight",
          concluida
            ? "bg-emerald-50 text-emerald-800 line-through decoration-emerald-400"
            : "bg-azul-50 text-azul-900 ring-1 ring-inset ring-azul-200/50",
          arrastado === item.tarefa.id && "opacity-50",
          itemAnimado === item.tarefa.id && "animate-pulse",
          podeArrastar && "cursor-grab active:cursor-grabbing",
        )}
        title={`${concluida ? "Executada" : "Planejada"}: ${item.tarefa.titulo}`}
      >
        {concluida ? (
          <CheckCircle2
            className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600"
            aria-hidden="true"
          />
        ) : (
          <CalendarClock
            className="mt-0.5 h-3 w-3 flex-shrink-0 text-azul-600"
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 truncate">
          <span className="sr-only">{concluida ? "Executada:" : "Planejada:"}</span>
          {item.tarefa.titulo}
        </span>
        {podeArrastar && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              abrirReagendar(item);
            }}
            className="rounded p-0.5 text-azul-500 opacity-70 hover:bg-azul-100 hover:opacity-100"
            aria-label={`Reagendar ${item.tarefa.titulo}`}
            title="Reagendar"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const nomesDia = NOMES_DIAS_SEMANA.map((nome, idx) => {
    const data = new Date(ANO_CALENDARIO, 0, JANEIRO_2026_DOMINGO + idx);
    return { nome, diaDaSemana: format(data, "EEEE", { locale: ptBR }) };
  });

  return (
    <>
      {podeReagendar && (
        <p className="text-sm text-superficie-500">
          Arraste as tarefas entre os dias para replanej-las ou use o botão de
          reagendar para acesso por toque e teclado.
        </p>
      )}

      <div className="hidden lg:block">
        <div className="grid grid-cols-7 overflow-hidden rounded-t-xl border border-borda">
          {NOMES_DIAS_SEMANA.map((nome, idx) => (
            <div
              key={nome}
              className="border-b border-r border-borda bg-superficie-50 py-2 text-center text-xs font-semibold uppercase tracking-wide text-superficie-600 last:border-r-0"
            >
              <span className="sr-only">{nomesDia[idx].diaDaSemana}.</span>
              {nome}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-b-xl border border-t-0 border-borda">
          {semana.flat().map((celula) => {
            const { planejadas, concluidas } = itensDoDia(celula.chave);
            const todos = [...planejadas, ...concluidas];
            const visiveis = todos.slice(0, MAX_ITENS);
            const restantes = todos.length - visiveis.length;
            const sobreCelula = sobre === celula.chave && arrastado != null;

            return (
              <div
                key={celula.chave}
                onDragOver={(e) => {
                  if (!podeReagendar || !arrastado) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setSobre(celula.chave);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setSobre((atual) => (atual === celula.chave ? null : atual));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const tarefaId = e.dataTransfer.getData("text/plain");
                  setSobre(null);
                  if (tarefaId) {
                    moverTarefa(tarefaId, celula.chave);
                  }
                }}
                className={cn(
                  "flex min-h-[104px] flex-col gap-1 border-r border-b border-borda p-1.5 last:border-r-0",
                  celula.doMesAtual ? "bg-white" : "bg-superficie-50/40",
                  celula.hoje && "bg-azul-50/40",
                  sobreCelula && "bg-azul-50 ring-2 ring-inset ring-azul-400",
                )}
              >
                <div className="flex items-center gap-1">
                  <Link
                    href={`/calendario/${celula.chave}`}
                    aria-label={`Ver tarefas de ${format(celula.data, "d 'de' MMMM", { locale: ptBR })}`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-azul-100",
                      celula.hoje
                        ? "bg-azul-600 text-white"
                        : celula.doMesAtual
                          ? "text-superficie-700"
                          : "text-superficie-400",
                    )}
                  >
                    {format(celula.data, "d")}
                  </Link>
                  {todos.length > 0 && (
                    <span
                      className="ml-auto rounded-full bg-superficie-100 px-1.5 text-[10px] font-medium text-superficie-500"
                      aria-hidden="true"
                    >
                      {todos.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  {visiveis.map((item) =>
                    renderItem(item, concluidas.includes(item)),
                  )}
                  {restantes > 0 && (
                    <Link
                      href={`/calendario/${celula.chave}`}
                      className="px-1 text-[11px] font-medium text-azul-600 hover:text-azul-700"
                    >
                      +{restantes} mais
                    </Link>
                  )}
                  {todos.length === 0 && (
                    <span className="sr-only">
                      Nenhuma atividade planejada ou executada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden">
        <ol className="space-y-4">
          {semana.flat().map((celula) => {
            const { planejadas, concluidas } = itensDoDia(celula.chave);
            const todos = [...planejadas, ...concluidas];
            if (todos.length === 0 && !celula.doMesAtual) return null;
            return (
              <li key={celula.chave}>
                <Link
                  href={`/calendario/${celula.chave}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border border-borda bg-white p-3",
                    celula.hoje && "ring-2 ring-azul-400",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg text-sm font-bold",
                      celula.hoje
                        ? "bg-azul-600 text-white"
                        : "bg-superficie-100 text-superficie-700",
                    )}
                  >
                    {format(celula.data, "d")}
                    <span className="text-[10px] font-medium uppercase">
                      {format(celula.data, "EEE", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {todos.length === 0 ? (
                      <p className="text-sm text-superficie-500">
                        Nenhuma atividade
                      </p>
                    ) : (
                      todos.map((item) => (
                        <div
                          key={item.tarefa.id}
                          className="truncate text-sm text-superficie-700"
                        >
                          <span
                            className={cn(
                              "mr-1 font-bold",
                              concluidas.includes(item)
                                ? "text-emerald-600"
                                : "text-azul-600",
                            )}
                            aria-hidden="true"
                          >
                            •
                          </span>
                          {item.tarefa.titulo}
                        </div>
                      ))
                    )}
                  </div>
                  {todos.length > 0 && (
                    <span className="flex-shrink-0 text-xs text-superficie-400">
                      {todos.length}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 hidden items-center gap-4 text-xs text-superficie-500 lg:flex">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-azul-50 ring-1 ring-azul-200" />
          Planejada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-50" />
          Executada
        </span>
      </div>

      <Modal
        aberto={tarefaReagendar != null}
        aoFechar={() => setTarefaReagendar(null)}
        titulo="Reagendar tarefa"
        descricao={tarefaReagendar?.tarefa.titulo}
        tamanho="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmarReagendar();
          }}
          className="space-y-4"
        >
          <Campo
            rotulo="Nova data"
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            erro={erroReagendar}
            obrigatorio
          />
          <div className="flex justify-end gap-2">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setTarefaReagendar(null)}
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              variante="primario"
              carregando={salvando}
              disabled={!novaData}
            >
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
