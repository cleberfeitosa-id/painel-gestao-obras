import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditorOrcamento } from "@/components/orcamento/editor-orcamento";
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from "@/components/ui";
import { formatarDataHora } from "@/lib/datas";
import type { OrcamentoRow } from "@/lib/supabase/database.types";
import type { ColunaOrcamento, LinhaOrcamento } from "@/lib/orcamento/tipos";

export default async function OrcamentoDetalhePage({ params }: { params: Promise<{ id: string; orcamentoId: string }> }) {
  const { id, orcamentoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).eq("obra_id", id).single();
  if (!data) notFound();
  const orcamento = data as OrcamentoRow;

  const { data: versoes } = await supabase
    .from("orcamento_versoes")
    .select("versao, criado_em, criado_por")
    .eq("orcamento_id", orcamentoId)
    .order("versao", { ascending: false })
    .limit(10);
  const autorIds = [...new Set((versoes ?? []).map((versao) => versao.criado_por).filter((valor): valor is string => valor != null))];
  let nomesAutores = new Map<string, string>();
  if (autorIds.length) {
    const { data: perfis } = await supabase.from("perfis").select("id, nome").in("id", autorIds);
    nomesAutores = new Map((perfis ?? []).map((perfil) => [perfil.id, perfil.nome]));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/obras/${id}/orcamentos`} className="inline-flex items-center gap-1 text-sm text-azul-600">
          <ArrowLeft className="h-4 w-4" />Voltar para orçamentos
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{orcamento.nome}</h1>
      </div>
      <EditorOrcamento
        obraId={id}
        orcamentoId={orcamentoId}
        nomeInicial={orcamento.nome}
        colunasIniciais={orcamento.colunas as unknown as ColunaOrcamento[]}
        linhasIniciais={orcamento.linhas as unknown as LinhaOrcamento[]}
        versaoInicial={orcamento.versao}
      />
      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Histórico de versões</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          {versoes && versoes.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {versoes.map((versao) => (
                <li key={versao.versao} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-superficie-800">v{versao.versao}</span>
                  <span className="text-superficie-500">{formatarDataHora(versao.criado_em)}</span>
                  <span className="text-superficie-500">{versao.criado_por ? nomesAutores.get(versao.criado_por) ?? "—" : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-superficie-500">Nenhuma versão registrada.</p>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}