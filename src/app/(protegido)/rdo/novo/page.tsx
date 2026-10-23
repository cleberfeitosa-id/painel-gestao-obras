import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormularioRdo } from "@/components/rdo/formulario-rdo";
import { Cartao, CartaoConteudo } from "@/components/ui";
export default async function NovoRdoPage() { const supabase = await createClient(); const { data } = await supabase.from("obras").select("id, nome").order("nome"); return <div className="mx-auto max-w-4xl space-y-5"><Link href="/rdo" className="inline-flex items-center gap-1 text-sm font-medium text-superficie-500 hover:text-azul-700"><ChevronLeft className="h-4 w-4" />Voltar para RDO</Link><div><h1 className="text-2xl font-bold text-superficie-900">Novo RDO</h1><p className="mt-1 text-sm text-superficie-500">Os campos serão aplicados sobre o PDF oficial, mantendo o layout e a assinatura original.</p></div><Cartao><CartaoConteudo><FormularioRdo obras={data ?? []} /></CartaoConteudo></Cartao></div>; }
