import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const FUSO_HORARIO = "America/Fortaleza";

export function paraData(valor: string | Date): Date {
  return typeof valor === "string" ? parseISO(valor) : valor;
}

export function chaveDia(valor: string | Date): string {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return valor;
  }
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_HORARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

export function hojeChave(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_HORARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

export function formatarDataExtensa(
  valor: string | Date | null | undefined,
): string {
  if (!valor) return "—";
  let data: Date;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-").map(Number);
    data = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  } else {
    data = typeof valor === "string" ? new Date(valor) : valor;
  }
  if (Number.isNaN(data.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data);
}

export function formatarDataHora(
  valor: string | Date | null | undefined,
): string {
  if (!valor) return "—";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";

  const formatador = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const partes = formatador.formatToParts(data);
  const get = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

export function formatarMesAno(valor: string | Date): string {
  let data: Date;
  if (typeof valor === "string" && /^\d{4}-\d{2}$/.test(valor)) {
    const [ano, mes] = valor.split("-").map(Number);
    data = new Date(Date.UTC(ano, mes - 1, 15, 12, 0, 0));
  } else if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes] = valor.split("-").map(Number);
    data = new Date(Date.UTC(ano, mes - 1, 15, 12, 0, 0));
  } else {
    data = typeof valor === "string" ? new Date(valor) : valor;
  }
  if (Number.isNaN(data.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    month: "long",
    year: "numeric",
  }).format(data);
}

export type SituacaoPrazo = "sem_prazo" | "atrasado" | "hoje" | "proximo" | "ok";

export function situacaoPrazo(
  prazo: string | null | undefined,
  concluido: boolean,
): { situacao: SituacaoPrazo; dias: number | null; texto: string } {
  if (!prazo) return { situacao: "sem_prazo", dias: null, texto: "Sem prazo" };

  const hoje = paraData(hojeChave());
  const dias = differenceInCalendarDays(paraData(prazo), hoje);

  if (concluido) return { situacao: "ok", dias, texto: formatarData(prazo) };
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      situacao: "atrasado",
      dias,
      texto: `${atraso} ${atraso === 1 ? "dia" : "dias"} em atraso`,
    };
  }
  if (dias === 0) return { situacao: "hoje", dias, texto: "Vence hoje" };
  if (dias <= 3) {
    return {
      situacao: "proximo",
      dias,
      texto: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
    };
  }
  return { situacao: "ok", dias, texto: formatarData(prazo) };
}

export function gradeDoMes(referencia: Date) {
  const inicio = startOfWeek(startOfMonth(referencia), { weekStartsOn: 0 });
  const fim = endOfWeek(endOfMonth(referencia), { weekStartsOn: 0 });
  const hoje = hojeChave();

  return eachDayOfInterval({ start: inicio, end: fim }).map((dia) => {
    const chave = chaveDia(dia);
    return {
      data: dia,
      chave,
      doMesAtual: isSameMonth(dia, referencia),
      hoje: chave === hoje,
    };
  });
}

export const NOMES_DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export { addDays, isSameDay, startOfMonth };
