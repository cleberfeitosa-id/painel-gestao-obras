"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save } from "lucide-react";
import { atualizarCompra } from "@/app/(protegido)/obras/[id]/compras/acoes";
import { Botao, Modal } from "@/components/ui";

type ItemCompra = {
  orcamento_item_id: string | null;
  composicao_id: string | null;
  composicao_componente_id: string | null;
  codigo_insumo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  categoria: string | null;
  coeficiente: number | null;
};

export function EditarCompraModal({ obraId, compraId, fornecedor, documento, dataCompra, observacao, itens }: { obraId: string; compraId: string; fornecedor: string | null; documento: string | null; dataCompra: string; observacao?: string | null; itens: ItemCompra[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [cabecalho, setCabecalho] = useState({ fornecedor: fornecedor ?? "", documento: documento ?? "", dataCompra, observacao: observacao ?? "" });
  const [linhas, setLinhas] = useState<ItemCompra[]>(itens);

  function abrir() {
    setCabecalho({ fornecedor: fornecedor ?? "", documento: documento ?? "", dataCompra, observacao: observacao ?? "" });
    setLinhas(itens);
    setErro(null);
    setAberto(true);
  }

  function salvar() {
    if (linhas.length === 0) return setErro("A compra deve possuir pelo menos um item.");
    if (linhas.some((item) => !item.descricao.trim() || !item.unidade.trim() || item.quantidade <= 0 || item.valor_unitario < 0)) return setErro("Preencha descrição, unidade, quantidade e valor unitário dos itens.");
    setErro(null);
    iniciar(async () => {
      const resultado = await atualizarCompra({ compraId, obraId, ...cabecalho, fornecedor: cabecalho.fornecedor.trim(), documento: cabecalho.documento.trim() || null, observacao: cabecalho.observacao.trim() || null, itens: linhas.map((item) => ({ orcamentoItemId: item.orcamento_item_id, composicaoId: item.composicao_id, composicaoComponenteId: item.composicao_componente_id, codigoInsumo: item.codigo_insumo, descricao: item.descricao, unidade: item.unidade, quantidade: item.quantidade, valorUnitario: item.valor_unitario, categoria: item.categoria, coeficiente: item.coeficiente })) });
      if (resultado.erro) setErro(resultado.erro);
      else { setAberto(false); router.refresh(); }
    });
  }

  function adicionarItem() {
    setLinhas((atual) => [...atual, {
      orcamento_item_id: null,
      composicao_id: null,
      composicao_componente_id: null,
      codigo_insumo: null,
      descricao: "",
      unidade: "un",
      quantidade: 1,
      valor_unitario: 0,
      categoria: "outro",
      coeficiente: null,
    }]);
  }

  return <><Botao type="button" variante="fantasma" tamanho="sm" onClick={abrir} aria-label="Editar compra"><Pencil className="h-3.5 w-3.5" />Editar</Botao><Modal aberto={aberto} aoFechar={() => { if (!pendente) setAberto(false); }} titulo="Editar compra" descricao="Atualize os dados da compra e seus itens." tamanho="xl"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><input className="rounded-lg border border-borda px-3 py-2 text-sm" placeholder="Fornecedor (opcional)" value={cabecalho.fornecedor} onChange={(e) => setCabecalho({ ...cabecalho, fornecedor: e.target.value })} /><input className="rounded-lg border border-borda px-3 py-2 text-sm" placeholder="Nota fiscal / pedido" value={cabecalho.documento} onChange={(e) => setCabecalho({ ...cabecalho, documento: e.target.value })} /><input className="rounded-lg border border-borda px-3 py-2 text-sm" type="date" value={cabecalho.dataCompra} onChange={(e) => setCabecalho({ ...cabecalho, dataCompra: e.target.value })} /><input className="rounded-lg border border-borda px-3 py-2 text-sm" placeholder="Observação" value={cabecalho.observacao} onChange={(e) => setCabecalho({ ...cabecalho, observacao: e.target.value })} /></div><div className="flex justify-end"><Botao type="button" variante="contorno" tamanho="sm" onClick={adicionarItem} disabled={pendente}>+ Novo item</Botao></div><div className="overflow-x-auto rounded-lg border border-borda"><table className="w-full text-sm"><thead><tr className="border-b border-borda text-left"><th className="p-2">Descrição</th><th className="p-2">Un.</th><th className="p-2">Quantidade</th><th className="p-2">Valor unitário</th><th className="p-2" /></tr></thead><tbody>{linhas.map((item, indice) => <tr key={`${item.composicao_componente_id ?? "manual"}-${indice}`} className="border-b border-borda"><td className="p-2"><input className="w-56 rounded border border-borda px-2 py-1" value={item.descricao} onChange={(e) => setLinhas((atual) => atual.map((linha, i) => i === indice ? { ...linha, descricao: e.target.value } : linha))} /></td><td className="p-2"><input className="w-20 rounded border border-borda px-2 py-1" value={item.unidade} onChange={(e) => setLinhas((atual) => atual.map((linha, i) => i === indice ? { ...linha, unidade: e.target.value } : linha))} /></td><td className="p-2"><input className="w-28 rounded border border-borda px-2 py-1" type="number" min="0" step="any" value={item.quantidade} onChange={(e) => setLinhas((atual) => atual.map((linha, i) => i === indice ? { ...linha, quantidade: Number(e.target.value) } : linha))} /></td><td className="p-2"><input className="w-28 rounded border border-borda px-2 py-1" type="number" min="0" step="any" value={item.valor_unitario} onChange={(e) => setLinhas((atual) => atual.map((linha, i) => i === indice ? { ...linha, valor_unitario: Number(e.target.value) } : linha))} /></td><td className="p-2"><button type="button" className="text-xs font-medium text-perigo" onClick={() => setLinhas((atual) => atual.filter((_, i) => i !== indice))}>Remover</button></td></tr>)}</tbody></table></div>{erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}<div className="flex justify-end gap-2"><Botao type="button" variante="contorno" onClick={() => setAberto(false)} disabled={pendente}>Cancelar</Botao><Botao type="button" onClick={salvar} carregando={pendente}><Save className="h-3.5 w-3.5" />Salvar</Botao></div></div></Modal></>;
}
