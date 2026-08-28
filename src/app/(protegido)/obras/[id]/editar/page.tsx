import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FormularioObra } from "@/components/obras/formulario-obra";
import { atualizarObra } from "../../acoes";
import type { ObraRow, PerfilRow } from "@/lib/supabase/database.types";

async function buscarDados(id: string) {
  const supabase = await createClient();
  const [{ data: obra }, { data: responsaveis }] = await Promise.all([
    supabase.from("obras").select("*").eq("id", id).single(),
    supabase
      .from("perfis")
      .select("*")
      .eq("ativo", true)
      .order("nome"),
  ]);
  return {
    obra: obra as ObraRow | null,
    responsaveis: (responsaveis ?? []) as PerfilRow[],
  };
}

export default async function EditarObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { obra, responsaveis } = await buscarDados(id);

  if (!obra) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/obras/${obra.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a obra
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Editar obra
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Atualize as informacoes de {obra.nome}.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dados da obra</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioObra
            acao={atualizarObra}
            responsaveis={responsaveis}
            obra={obra}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
