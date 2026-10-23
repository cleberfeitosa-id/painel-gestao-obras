import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHora, paraData } from "@/lib/datas";
import { AcoesRdo } from "@/components/rdo/acoes-rdo";
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from "@/components/ui";

export default async function DetalheRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: rdo }, { data: historico }] = await Promise.all([
    supabase.from("rdos").select("*, obras(nome)").eq("id", id).is("excluido_em", null).single(),
    supabase.from("rdo_historico").select("id, operacao, criado_em, autor_id, antes, depois").eq("rdo_id", id).order("criado_em", { ascending: false }),
  ]);
  if (!rdo) notFound();
  const dados = rdo.conteudo as Record<string, unknown>;
  const resumo: Array<[string, string]> = [["Turno / tempo", String(dados.turnoTempo || "—")], ["Clima", String(dados.clima || "—")], ["Equipe preenchida", Array.isArray(dados.equipe) ? `${dados.equipe.filter((item) => Boolean((item as { quantidade?: string }).quantidade)).length} funções` : "—"], ["Marmitas", String((dados.alimentacao as Array<{ quantidade?: string }> | undefined)?.[0]?.quantidade || "—")]];
  const tarefas = dados.tarefas as { manha?: string; tarde?: string } | undefined;
  const textos: Array<[string, string]> = [["Manhã", String(tarefas?.manha || "Nenhum registro")], ["Tarde", String(tarefas?.tarde || "Nenhum registro")], ["Observações", Array.isArray(dados.observacoes) ? `${dados.observacoes.filter((item) => Boolean((item as { descricao?: string }).descricao)).length} linhas preenchidas` : "Nenhum registro"]];
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/rdo" className="inline-flex items-center gap-1 text-sm font-medium text-superficie-500 hover:text-azul-700"><ChevronLeft className="h-4 w-4" />Todos os RDOs</Link>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-azul-600">Diário de obra</p><h1 className="mt-2 text-3xl font-bold text-superficie-900">{rdo.obras?.nome}</h1><p className="mt-1 text-sm text-superficie-500">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(paraData(rdo.data))}</p></div><AcoesRdo id={id} /></div>
    <Cartao><CartaoCabecalho><CartaoTitulo>Resumo preenchido</CartaoTitulo></CartaoCabecalho><CartaoConteudo><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{resumo.map(([label, value]) => <div key={label}><p className="text-xs font-medium uppercase tracking-wider text-superficie-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-superficie-800">{value}</p></div>)}</div><div className="mt-6 grid gap-4 border-t border-borda pt-5 md:grid-cols-3">{textos.map(([label, value]) => <div key={label}><p className="text-sm font-semibold text-superficie-700">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-superficie-600">{value}</p></div>)}</div></CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><div className="flex items-center gap-2"><History className="h-5 w-5 text-azul-600" /><CartaoTitulo>Histórico preservado</CartaoTitulo></div></CartaoCabecalho><CartaoConteudo><div className="space-y-3">{(historico ?? []).map((evento) => { const antes = evento.antes as Record<string, unknown> | null; const depois = evento.depois as Record<string, unknown> | null; const mudou = antes && depois ? Object.keys(depois).filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo])).filter((campo) => campo !== "atualizado_em").slice(0, 5) : []; return <div key={evento.id} className="rounded-lg border border-borda bg-superficie-50 px-4 py-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium capitalize text-superficie-800">{evento.operacao}</span><span className="text-superficie-500">{formatarDataHora(evento.criado_em)}</span></div>{mudou.length > 0 && <p className="mt-2 text-xs text-superficie-500">Campos alterados: {mudou.join(", ")}</p>}{evento.autor_id && <p className="mt-1 text-xs text-superficie-400">Registrado pelo usuário {evento.autor_id.slice(0, 8)}…</p>}</div>; })}</div></CartaoConteudo></Cartao>
  </div>;
}
