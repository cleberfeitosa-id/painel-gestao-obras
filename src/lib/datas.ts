import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const FUSO_HORARIO = "America/Fortaleza";

// Campos `date` do Postgres chegam como "YYYY-MM-DD". `new Date("2026-08-27")`
// interpreta como meia-noite UTC e, em UTC-3, retrocede um dia. parseISO trata
// a string como data local, evitando o off-by-one.
export function paraData(valor: string | Date): Date {
  return typeof valor === "string" ? parseISO(valor) : valor;
}

export function chaveDia(valor: string | Date): string {
  return format(paraData(valor), "yyyy-MM-dd");
}

export function hojeChave(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatarData(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  return format(paraData(valor), "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataExtensa(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  return format(paraData(valor), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

export function formatarDataHora(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  return format(paraData(valor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatarMesAno(valor: string | Date) {
  return format(paraData(valor), "MMMM 'de' yyyy", { locale: ptBR });
}

export type SituacaoPrazo = "sem_prazo" | "atrasado" | "hoje" | "proximo" | "ok";

export function situacaoPrazo(
  prazo: string | null | undefined,
  concluido: boolean,
): { situacao: SituacaoPrazo; dias: number | null; texto: string } {
  if (!prazo) return { situacao: "sem_prazo", dias: null, texto: "Sem prazo" };

  const dias = differenceInCalendarDays(paraData(prazo), new Date());

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

  return eachDayOfInterval({ start: inicio, end: fim }).map((dia) => ({
    data: dia,
    chave: chaveDia(dia),
    doMesAtual: isSameMonth(dia, referencia),
    hoje: isSameDay(dia, new Date()),
  }));
}

export const NOMES_DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export { addDays, isSameDay, startOfMonth };
