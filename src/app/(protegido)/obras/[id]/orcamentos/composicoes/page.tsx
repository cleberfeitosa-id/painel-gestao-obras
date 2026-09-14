import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import {
  Cartao,
  CartaoConteudo,
  EstadoVazio,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
} from "@/components/ui";
import { FiltrosComposicoes } from "@/components/orcamento/filtros-composicoes";
import { Paginacao } from "@/components/ui";
import { ModalComposicao } from "@/components/orcamento/modal-composicao";
import { BotaoExcluirComposicao } from "@/components/orcamento/botao-excluir-composicao";
import { BotaoExcluirComposicoes } from "@/components/orcamento/botao-excluir-composicoes";
import { AcoesComposicao } from "@/components/orcamento/acoes-composicao";
import type { ComposicaoRow } from "@/lib/supabase/database.types";

const TAMANHO_PAGINA = 50;

// PostgREST interpreta virgulas e parenteses como sintaxe do filtro `or()`
// e aspas como delimitadores de valor. Removemos esses caracteres do termo
// antes de interpolar no `or()` para nao quebrar a consulta nem permitir
// injecao de operadores.
function escapeOrTerm(termo: string): string {
  return termo.replace(/[,()"']/g, "");
}

async function buscarComposicoes(
  obraId: string,
  params: Record<string, string | undefined>,
): Promise<{ composicoes: ComposicaoRow[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("composicoes")
    .select("*", { count: "exact" })
    .eq("obra_id", obraId);

  const busca = params.busca?.trim();
  if (busca) {
    const termoSeguro = escapeOrTerm(busca);
    query = query.or(`codigo.ilike.%${termoSeguro}%,nome.ilike.%${termoSeguro}%`);
  }

  if (params.vinculo === "com") {
    query = query.not("codigo", "is", null);
  } else if (params.vinculo === "sem") {
    query = query.is("codigo", null);
  }

  const ordenar = params.ordenar ?? "codigo";
  switch (ordenar) {
    case "nome":
      query = query.order("nome", { ascending: true });
      break;
    case "custo":
      query = query.order("custo_unitario", { ascending: false });
      break;
    case "recentes":
      query = query.order("criado_em", { ascending: false });
      break;
    case "codigo":
    default:
      query = query.order("codigo", { ascending: true, nullsFirst: true });
      break;
  }

  const pagina = Math.max(1, Number(params.pagina) || 1);
  const inicio = (pagina - 1) * TAMANHO_PAGINA;
  const fim = inicio + TAMANHO_PAGINA - 1;
  query = query.range(inicio, fim);

  const { data, error, count } = await query;
  if (error) {
    console.error("Erro ao buscar composicoes:", error);
    return { composicoes: [], total: 0 };
  }

  return { composicoes: (data ?? []) as ComposicaoRow[], total: count ?? 0 };
}

async function buscarContagemComponentes(
  composicaoIds: string[],
): Promise<Map<string, number>> {
  if (composicaoIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("composicao_componentes")
    .select("composicao_id")
    .in("composicao_id", composicaoIds);

  if (error) {
    console.error("Erro ao buscar contagem de componentes:", error);
    return new Map();
  }

  const contagem = new Map<string, number>();
  for (const item of data ?? []) {
    contagem.set(item.composicao_id, (contagem.get(item.composicao_id) ?? 0) + 1);
  }
  return contagem;
}

async function buscarObra(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, nome").eq("id", id).single();
  return data;
}

export default async function ComposicoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const paramsBusca = await searchParams;

  const vinculoValido = ["com", "sem"].includes(paramsBusca.vinculo ?? "") ? paramsBusca.vinculo : undefined;
  const ordenarValido = ["codigo", "nome", "custo", "recentes"].includes(paramsBusca.ordenar ?? "")
    ? paramsBusca.ordenar
    : undefined;

  const filtros = {
    busca: paramsBusca.busca,
    vinculo: vinculoValido,
    ordenar: ordenarValido,
    pagina: paramsBusca.pagina,
  };

  const [obra, { composicoes, total }] = await Promise.all([
    buscarObra(id),
    buscarComposicoes(id, filtros),
  ]);

  if (!obra) {
    return null;
  }

  const paginaAtual = Math.max(1, Number(paramsBusca.pagina) || 1);
  const totalPaginas = Math.ceil(total / TAMANHO_PAGINA);

  const idsPagina = composicoes.map((c) => c.id);
  const contagemComponentes = await buscarContagemComponentes(idsPagina);

  const temFiltros = Boolean(filtros.busca || filtros.vinculo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/obras/${id}/orcamentos`} className="inline-flex items-center gap-1 text-sm text-azul-600 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar para orçamentos
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-superficie-900">Composições</h1>
          <p className="mt-1 text-sm text-superficie-500">{obra.nome}</p>
        </div>
      </div>

      <Cartao>
        <CartaoConteudo>
          <FiltrosComposicoes />
        </CartaoConteudo>
      </Cartao>

      <BotaoExcluirComposicoes obraId={id} />

      {composicoes.length === 0 ? (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<Search className="h-8 w-8" />}
              titulo={temFiltros ? "Nenhum resultado para os filtros" : "Nenhuma composição cadastrada"}
              descricao={temFiltros ? "Tente ajustar os filtros ou limpar a busca." : "Crie a primeira composição para começar."}
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <>
          <Cartao>
            <CartaoConteudo className="p-0">
              <Tabela>
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho aria-label="Selecionar"><span className="sr-only">Selecionar</span></CelulaCabecalho>
                    <CelulaCabecalho>Código</CelulaCabecalho>
                    <CelulaCabecalho>Descrição</CelulaCabecalho>
                    <CelulaCabecalho>Unidade</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Custo</CelulaCabecalho>
                    <CelulaCabecalho className="text-center">Componentes</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">Ações</CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {composicoes.map((composicao) => (
                    <Linha key={composicao.id}>
                      <Celula><input type="checkbox" data-composicao-id={composicao.id} aria-label={`Selecionar composição ${composicao.nome}`} /></Celula>
                      <Celula className="font-mono text-sm">
                        {composicao.codigo ?? <span className="text-superficie-400">—</span>}
                      </Celula>
                      <Celula className="max-w-xs truncate">{composicao.nome}</Celula>
                      <Celula>{composicao.unidade}</Celula>
                      <Celula className="text-right font-mono tabular-nums">
                        {formatarMoeda(composicao.custo_unitario)}
                      </Celula>
                      <Celula className="text-center text-superficie-500">
                        {contagemComponentes.get(composicao.id) ?? 0}
                      </Celula>
                      <Celula className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AcoesComposicao
                            composicaoId={composicao.id}
                            nome={composicao.nome}
                            obraId={id}
                          />
                          <BotaoExcluirComposicao composicaoId={composicao.id} titulo={composicao.nome} obraId={id} compacto />
                        </div>
                      </Celula>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            </CartaoConteudo>
          </Cartao>

          <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={total} rotuloItens="composições" />

          <ModalComposicao obraId={id} />
        </>
      )}
    </div>
  );
}
