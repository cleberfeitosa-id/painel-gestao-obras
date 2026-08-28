import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
} from "@/components/ui";
import { FormularioUploadPlanta } from "@/components/plantas/formulario-upload-planta";

export default async function NovaPlantaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();

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
          Nova planta
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Envie o PDF da planta de {obra.nome}.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Upload do PDF</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioUploadPlanta obraId={obra.id} />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}