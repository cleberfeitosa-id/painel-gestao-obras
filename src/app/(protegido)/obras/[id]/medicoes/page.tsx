import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Ruler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo, EstadoVazio } from "@/components/ui";
import { NovaMedicaoModal } from "@/components/medicao/nova-medicao-modal";
import type { MedicaoRow } from "@/lib/supabase/database.types";

interface MedicaoComValores extends MedicaoRow {
  valor_executado: number;
  valor_pendente: number;
  valor_pago: number;
}

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

  const lista: MedicaoComValores[] = [];
  for (const medicao of medicoes ?? []) {
    const [executado, pendente, pago] = await Promise.all([
      supabase.rpc("valor_executado_medicao", { p_medicao_id: medicao.id }),
      supabase.rpc("valor_pendente_medicao", { p_medicao_id: medicao.id }),
      supabase.rpc("valor_pago_medicao", { p_medicao_id: medicao.id }),
    ]);
    lista.push({
      ...medicao,
      valor_executado: (executado.data as number) ?? 0,
      valor_pendente: (pendente.data as number) ?? 0,
      valor_pago: (pago.data as number) ?? 0,
    });
  }

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
          Contratos de medição desta obra. Cada medição possui seu próprio
          catálogo de preços e valores executados.
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
            const saldo =
              medicao.valor_contrato != null
                ? medicao.valor_contrato - medicao.valor_pago
                : null;
            const baseMedida = medicao.valor_executado + medicao.valor_pendente;
            const percentualExecutado =
              baseMedida > 0
                ? Math.round((medicao.valor_executado / baseMedida) * 100)
                : 0;
            return (
              <Link key={medicao.id} href={`/obras/${obra.id}/medicoes/${medicao.id}`}>
                <Cartao className="h-full transition-shadow hover:shadow-md">
                  <CartaoCabecalho>
                    <CartaoTitulo>{medicao.titulo}</CartaoTitulo>
                  </CartaoCabecalho>
                  <CartaoConteudo className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-superficie-500">Valor do contrato</span>
                      <span className="text-sm font-semibold text-superficie-900">
                        {formatarMoeda(medicao.valor_contrato)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-superficie-500">Valor pago</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatarMoeda(medicao.valor_pago)}
                      </span>
                    </div>
                    {medicao.valor_contrato != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-superficie-500">Saldo do contrato</span>
                        <span className="text-sm font-semibold text-azul-600">
                          {formatarMoeda(saldo)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-superficie-500">Valor executado</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatarMoeda(medicao.valor_executado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-superficie-500">Valor pendente</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {formatarMoeda(medicao.valor_pendente)}
                      </span>
                    </div>
                    {baseMedida > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-superficie-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-superficie-500">Progresso físico-financeiro</span>
                          <span className="font-bold text-emerald-600">
                            {percentualExecutado}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-superficie-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(percentualExecutado, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CartaoConteudo>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
