import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { GestaoExecutores } from "@/components/executores/gestao-executores";
import type { ExecutorRow, ObraRow } from "@/lib/supabase/database.types";

async function buscarDados(id: string) {
  const supabase = await createClient();
  const [{ data: obra }, { data: executores }] = await Promise.all([
    supabase.from("obras").select("id, nome").eq("id", id).single(),
    supabase
      .from("executores")
      .select("*")
      .eq("obra_id", id)
      .order("nome"),
  ]);
  return {
    obra: (obra ?? null) as Pick<ObraRow, "id" | "nome"> | null,
    executores: (executores ?? []) as ExecutorRow[],
  };
}

export default async function ExecutoresObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { obra, executores } = await buscarDados(id);

  if (!obra) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/obras/${obra.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a obra
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">Executores</h1>
        <p className="mt-1 text-sm text-superficie-500">
          Pessoas que executam tarefas de {obra.nome} sem precisar de cadastro.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Executores de {obra.nome}</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <GestaoExecutores obraId={obra.id} executores={executores} />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}