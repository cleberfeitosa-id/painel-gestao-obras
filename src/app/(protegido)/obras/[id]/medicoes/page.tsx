import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Ruler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo, EstadoVazio } from "@/components/ui";
import { NovaMedicaoModal } from "@/components/medicao/nova-medicao-modal";
import { EditarMedicaoModal } from "@/components/medicao/editar-medicao-modal";
import { ExcluirMedicao } from "@/components/medicao/excluir-medicao";
import type { MedicaoRow } from "@/lib/supabase/database.types";


export default async function MedicoesObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  const podeMedir = perfil && (perfil.papel === "admin" || perfil.papel === "gestor");

  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!obra) notFound();

  const { data: medicoes } = await supabase
    .from("medicoes")
    .select("*")
    .eq("obra_id", id)
    .order("criado_em", { ascending: false });

  const lista = (medicoes ?? []) as MedicaoRow[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${obra.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a obra
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-superficie-900">Medições</h1>
            <span className="text-sm text-superficie-500">{obra.nome}</span>
          </div>
          {podeMedir && <NovaMedicaoModal obraId={obra.id} />}
        </div>
        <p className="mt-1 text-sm text-superficie-500">
           Orçamentos e medições desta obra, com os valores do cliente e dos contratos executores.
        </p>
      </div>

      {lista.length === 0 ? (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<Ruler className="h-8 w-8" />}
              titulo="Nenhuma medição"
              descricao="Crie uma nova medição para começar a medir os serviços desta obra."
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((medicao) => {
            return (
              <Cartao key={medicao.id} className="h-full transition-shadow hover:shadow-md">
                <CartaoCabecalho className="flex items-center justify-between gap-3">
                  <Link href={`/obras/${obra.id}/medicoes/${medicao.id}`} className="min-w-0 hover:text-azul-700">
                    <CartaoTitulo className="truncate">{medicao.titulo}</CartaoTitulo>
                  </Link>
                  {podeMedir && (
                    <div className="flex shrink-0 items-center gap-1">
                      <EditarMedicaoModal medicaoId={medicao.id} obraId={obra.id} titulo={medicao.titulo} compacto />
                      <ExcluirMedicao medicaoId={medicao.id} obraId={obra.id} titulo={medicao.titulo} />
                    </div>
                  )}
                </CartaoCabecalho>
                <Link href={`/obras/${obra.id}/medicoes/${medicao.id}`} className="block">
                  <CartaoConteudo>
                    <p className="text-sm text-superficie-500">Abrir detalhes da medição</p>
                  </CartaoConteudo>
                </Link>
              </Cartao>
            );
          })}
        </div>
      )}
    </div>
  );
}
