import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Ruler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo, EstadoVazio } from "@/components/ui";
import { NovaMedicaoModal } from "@/components/medicao/nova-medicao-modal";
import type { MedicaoRow } from "@/lib/supabase/database.types";
import { buscarResumoDaMedicao } from "@/lib/medicoes/resumo-da-medicao";

interface MedicaoComValores extends MedicaoRow {
  valor_executor_medido: number;
  valor_executor_executado: number;
  valor_executor_pendente: number;
  valor_construtora_executado: number;
  valor_construtora_pendente: number;
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

  const lista = await Promise.all(
    (medicoes ?? []).map(async (medicao): Promise<MedicaoComValores> => {
      const resumo = await buscarResumoDaMedicao(medicao.id, id);
      return {
        ...medicao,
        valor_executor_medido: resumo.executorMedido,
        valor_executor_executado: resumo.executorExecutado,
        valor_executor_pendente: resumo.executorPendente,
        valor_construtora_executado: resumo.construtoraExecutado,
        valor_construtora_pendente: resumo.construtoraPendente,
        valor_executado: resumo.construtoraExecutado,
        valor_pendente: resumo.construtoraPendente,
        valor_pago: resumo.pago,
      };
    }),
  );

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
            const saldoExecutor = medicao.valor_executor_executado - medicao.valor_pago;
            const baseMedida = medicao.valor_construtora_executado + medicao.valor_construtora_pendente;
            const percentualExecutado =
              baseMedida > 0
                ? Math.round((medicao.valor_construtora_executado / baseMedida) * 100)
                : 0;
            return (
              <Link key={medicao.id} href={`/obras/${obra.id}/medicoes/${medicao.id}`}>
                <Cartao className="h-full transition-shadow hover:shadow-md">
                  <CartaoCabecalho>
                    <CartaoTitulo>{medicao.titulo}</CartaoTitulo>
                  </CartaoCabecalho>
                  <CartaoConteudo className="space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-sm text-superficie-500">Contrato executor</span>
                      <span className="text-sm font-semibold text-superficie-900">
                         {formatarMoeda(medicao.valor_contrato)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-superficie-500">Total pago ao executor</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatarMoeda(medicao.valor_pago)}
                      </span>
                    </div>
                    {medicao.valor_contrato != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-superficie-500">Saldo do executor</span>
                        <span className={`text-sm font-semibold ${saldoExecutor < 0 ? "text-perigo" : "text-azul-600"}`}>
                           {formatarMoeda(saldoExecutor)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                         <span className="text-sm text-superficie-500">Executor — medido executado</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatarMoeda(medicao.valor_executor_executado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-sm text-superficie-500">Executor — a medir</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {formatarMoeda(medicao.valor_executor_pendente)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-superficie-500">Construtora — medido executado</span>
                      <span className="text-sm font-semibold text-emerald-700">
                        {formatarMoeda(medicao.valor_construtora_executado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-sm text-superficie-500">Construtora — a medir</span>
                      <span className="text-sm font-semibold text-amber-700">
                        {formatarMoeda(medicao.valor_construtora_pendente)}
                      </span>
                    </div>
                    {baseMedida > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-superficie-100">
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-superficie-500">Progresso construtora</span>
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
