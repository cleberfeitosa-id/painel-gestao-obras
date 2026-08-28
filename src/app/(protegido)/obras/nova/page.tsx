import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FormularioObra } from "@/components/obras/formulario-obra";
import { criarObra } from "../acoes";
import type { PerfilRow } from "@/lib/supabase/database.types";

async function buscarResponsaveis() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as PerfilRow[];
}

export default async function NovaObraPage() {
  const responsaveis = await buscarResponsaveis();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/obras"
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para obras
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Nova obra
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Cadastre um novo canteiro ou projeto.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dados da obra</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioObra acao={criarObra} responsaveis={responsaveis} />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
