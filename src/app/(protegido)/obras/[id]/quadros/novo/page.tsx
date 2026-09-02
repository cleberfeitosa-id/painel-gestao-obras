import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormNovoQuadro } from "@/components/quadros/form-novo-quadro";
import { buscarTemplatesQuadros } from "@/app/(protegido)/obras/[id]/quadros/acoes";
import type { ObraRow, PlantaRow } from "@/lib/supabase/database.types";

async function buscarObra(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();
  return data as Pick<ObraRow, "id" | "nome"> | null;
}

async function buscarPlantas(obraId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plantas")
    .select("id, nome")
    .eq("obra_id", obraId)
    .order("nome");
  return (data ?? []) as Pick<PlantaRow, "id" | "nome">[];
}

export default async function NovoQuadroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [obra, plantas, templates] = await Promise.all([
    buscarObra(id),
    buscarPlantas(id),
    buscarTemplatesQuadros(),
  ]);

  if (!obra) notFound();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href={`/obras/${obra.id}/quadros`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para quadros de {obra.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Novo Quadro Elétrico
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Crie um quadro do zero ou inicie com base em um template padrão da engenharia.
        </p>
      </div>

      <FormNovoQuadro
        obraId={obra.id}
        plantas={plantas}
        templates={templates}
      />
    </div>
  );
}
