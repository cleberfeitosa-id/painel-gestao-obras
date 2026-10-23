import Link from "next/link";
import { Plus, ClipboardList, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";
import { Botao, Cartao, CartaoConteudo, EstadoVazio } from "@/components/ui";

export default async function RdoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("rdos").select("*, obras(nome)").is("excluido_em", null).order("data", { ascending: false });
  const rdos = (data ?? []) as Array<{ id: string; data: string; atualizado_em: string; obras: { nome: string } | null }>;
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-azul-600">Operação de campo</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-superficie-900">RDO</h1><p className="mt-1 text-sm text-superficie-500">Preencha, exporte e mantenha o histórico dos diários de obra.</p></div><Link href="/rdo/novo"><Botao><Plus className="h-4 w-4" />Novo RDO</Botao></Link></div>
    <Cartao><CartaoConteudo>{rdos.length ? <div className="divide-y divide-borda">{rdos.map((rdo) => <Link key={rdo.id} href={`/rdo/${rdo.id}`} className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-50 text-azul-700"><ClipboardList className="h-5 w-5" /></div><div className="min-w-0"><p className="font-semibold text-superficie-900 group-hover:text-azul-700">{formatarData(rdo.data)}</p><p className="truncate text-sm text-superficie-500">{rdo.obras?.nome ?? "Obra removida"}</p></div></div><div className="flex items-center gap-3 text-sm text-superficie-400"><span className="hidden sm:inline">Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(rdo.atualizado_em))}</span><ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></div></Link>)}</div> : <EstadoVazio icone={<ClipboardList className="h-8 w-8" />} titulo="Nenhum RDO salvo" descricao="Crie o primeiro diário usando o modelo oficial da obra." acao={<Link href="/rdo/novo"><Botao><Plus className="h-4 w-4" />Criar RDO</Botao></Link>} />}</CartaoConteudo></Cartao>
  </div>;
}
