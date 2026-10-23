import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormularioRdo } from "@/components/rdo/formulario-rdo";
import { Cartao, CartaoConteudo } from "@/components/ui";
export default async function EditarRdoPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const supabase = await createClient(); const [{ data: rdo }, { data: obras }] = await Promise.all([supabase.from("rdos").select("*, obras(nome)").eq("id", id).is("excluido_em", null).single(), supabase.from("obras").select("id, nome").order("nome")]); if (!rdo) notFound(); return <div className="mx-auto max-w-4xl space-y-5"><Link href={`/rdo/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-superficie-500 hover:text-azul-700"><ChevronLeft className="h-4 w-4" />Voltar para o RDO</Link><div><h1 className="text-2xl font-bold text-superficie-900">Editar RDO</h1><p className="mt-1 text-sm text-superficie-500">A alteração será registrada no histórico automaticamente.</p></div><Cartao><CartaoConteudo><FormularioRdo obras={obras ?? []} rdo={rdo} /></CartaoConteudo></Cartao></div>; }
