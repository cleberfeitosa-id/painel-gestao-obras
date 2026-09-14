import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoConteudo, Cabecalho, Celula, CelulaCabecalho, Corpo, EstadoVazio, Linha, LinhaCabecalho, Tabela } from "@/components/ui";
import { NovaCompra } from "@/components/compras/nova-compra";

export default async function ComprasPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ busca?: string }> }) {
  const { id } = await params;
  const { busca } = await searchParams;
  const supabase = await createClient();
  const termo = busca?.trim();
  const [{ data: obra }, { data: compras }, { data: itens }, { data: composicoes }] = await Promise.all([
    supabase.from("obras").select("id, nome").eq("id", id).single(),
    supabase.from("compras").select("id, fornecedor, documento, data_compra").eq("obra_id", id).order("data_compra", { ascending: false }),
    supabase.from("orcamento_itens").select("id, codigo, descricao, orcamentos!inner(obra_id)").eq("orcamentos.obra_id", id).eq("ativo", true).eq("tipo", "item").order("ordem").limit(1000),
    supabase.from("composicoes").select("id, codigo, nome").eq("obra_id", id).order("codigo").limit(1000),
  ]);
  if (!obra) return null;
  const compraIds = (compras ?? []).map((compra) => compra.id);
  const { data: itensCompras } = compraIds.length > 0
    ? await supabase.from("compra_itens").select("compra_id, quantidade, valor_unitario, descricao, unidade, orcamento_item_id, composicao_id, categoria").in("compra_id", compraIds)
    : { data: [] };
  const itensPorCompra = new Map<string, Array<{ quantidade: number; valor_unitario: number; descricao: string; unidade: string; orcamento_item_id: string | null; composicao_id: string | null; categoria: string | null }>>();
  for (const item of itensCompras ?? []) {
    const lista = itensPorCompra.get(item.compra_id) ?? [];
    lista.push(item);
    itensPorCompra.set(item.compra_id, lista);
  }
  const itensOrcamento = (itens ?? []).map((item) => ({ id: item.id, rotulo: `${item.codigo ?? "Sem código"} — ${item.descricao ?? "Sem descrição"}` }));
  const opcoesComposicoes = (composicoes ?? []).map((item) => ({ id: item.id, rotulo: `${item.codigo ?? "Sem código"} — ${item.nome}` }));
  const rotulosOrcamento = new Map(itensOrcamento.map((item) => [item.id, item.rotulo]));
  const rotulosComposicoes = new Map(opcoesComposicoes.map((item) => [item.id, item.rotulo]));
  const linhas = (compras ?? []).map((compra) => ({ ...compra, compra_itens: itensPorCompra.get(compra.id) ?? [] })).filter((compra) => !termo || [compra.fornecedor, compra.documento, ...compra.compra_itens.flatMap((item) => [item.descricao, item.orcamento_item_id ? rotulosOrcamento.get(item.orcamento_item_id) : null, item.composicao_id ? rotulosComposicoes.get(item.composicao_id) : null])].some((valor) => valor?.toLocaleLowerCase().includes(termo.toLocaleLowerCase())));
  const total = linhas.reduce((soma, compra) => soma + compra.compra_itens.reduce((subtotal, item) => subtotal + item.quantidade * item.valor_unitario, 0), 0);
  return <div className="space-y-6"><div><Link href={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-azul-600 hover:underline"><ArrowLeft className="h-4 w-4" />Voltar para a obra</Link><h1 className="mt-2 text-2xl font-bold text-superficie-900">Compras</h1><p className="mt-1 text-sm text-superficie-500">{obra.nome} · custo realizado de aquisição, separado da medição contratual.</p></div><NovaCompra obraId={id} /><Cartao><CartaoCabecalho><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Compras cadastradas</h2><p className="text-sm text-superficie-500">Total comprado: {formatarMoeda(total)}</p></div><form><input name="busca" defaultValue={busca} className="rounded border border-borda px-3 py-2 text-sm" placeholder="Filtrar fornecedor, documento ou item" /></form></div></CartaoCabecalho><CartaoConteudo className="p-0">{linhas.length === 0 ? <div className="p-6"><EstadoVazio icone={<ShoppingCart className="h-8 w-8" />} titulo="Nenhuma compra encontrada" descricao={termo ? "Ajuste o filtro ou cadastre uma nova compra." : "Cadastre a primeira compra da obra."} /></div> : <div className="overflow-x-auto"><Tabela><Cabecalho><LinhaCabecalho><CelulaCabecalho>Data</CelulaCabecalho><CelulaCabecalho>Fornecedor</CelulaCabecalho><CelulaCabecalho>Documento</CelulaCabecalho><CelulaCabecalho>Itens associados</CelulaCabecalho><CelulaCabecalho className="text-right">Total</CelulaCabecalho></LinhaCabecalho></Cabecalho><Corpo>{linhas.map((compra) => { const valor = (compra.compra_itens ?? []).reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0); return <Linha key={compra.id}><Celula>{compra.data_compra}</Celula><Celula>{compra.fornecedor ?? "—"}</Celula><Celula>{compra.documento ?? "—"}</Celula><Celula><div className="space-y-1">{(compra.compra_itens ?? []).map((item, indice) => <div key={`${compra.id}-${indice}`}><div>{item.descricao}</div>{item.orcamento_item_id && <span className="mr-1 rounded-full bg-azul-50 px-2 py-0.5 text-xs text-azul-700">Orçamento: {rotulosOrcamento.get(item.orcamento_item_id) ?? "item"}</span>}{item.composicao_id && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Composição: {rotulosComposicoes.get(item.composicao_id) ?? "composição"}</span>}</div>)}</div></Celula><Celula className="text-right font-mono">{formatarMoeda(valor)}</Celula></Linha>; })}</Corpo></Tabela></div>}</CartaoConteudo></Cartao></div>;
}
