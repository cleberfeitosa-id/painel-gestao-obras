"use client";

import { useState } from "react";
import { Download, Copy, Printer, Check } from "lucide-react";
import { Modal, Botao } from "@/components/ui";
import type { ItemListaMateriais } from "@/lib/quadros/tipos";

interface ModalListaMateriaisProps {
  aberto: boolean;
  aoFechar: () => void;
  quadroTag: string;
  quadroNome?: string | null;
  materiais: ItemListaMateriais[];
}

export function ModalListaMateriais({
  aberto,
  aoFechar,
  quadroTag,
  quadroNome,
  materiais,
}: ModalListaMateriaisProps) {
  const [copiado, setCopiado] = useState(false);

  function exportarCsv() {
    const cabecalho = ["Item", "Especificacao", "Quantidade", "Unidade", "Norma", "Detalhes"];
    const linhas = materiais.map((m) => [
      `"${m.item.replace(/"/g, '""')}"`,
      `"${m.especificacao.replace(/"/g, '""')}"`,
      m.quantidade,
      `"${m.unidade}"`,
      `"${m.norma}"`,
      `"${m.detalhes.replace(/"/g, '""')}"`,
    ]);

    const csv = [cabecalho.join(";"), ...linhas.map((l) => l.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lista-materiais-${quadroTag.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function copiarTexto() {
    const texto = materiais
      .map(
        (m, idx) =>
          `${idx + 1}. ${m.item} - ${m.especificacao} | Qtd: ${m.quantidade} ${m.unidade} (Norma: ${m.norma})`,
      )
      .join("\n");

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function imprimir() {
    window.print();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Lista de Componentes e Materiais (BOM) - ${quadroTag}`}
      descricao={`Quantitativo consolidado de componentes, trilhos, canaletas e barramentos do ${quadroNome || quadroTag}.`}
      tamanho="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda pb-3">
          <span className="text-xs text-superficie-500 font-medium">
            Total de {materiais.length} itens mapeados
          </span>
          <div className="flex items-center gap-2">
            <Botao type="button" variante="contorno" tamanho="sm" onClick={copiarTexto}>
              {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado!" : "Copiar"}
            </Botao>
            <Botao type="button" variante="contorno" tamanho="sm" onClick={exportarCsv}>
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Botao>
            <Botao type="button" variante="contorno" tamanho="sm" onClick={imprimir}>
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Botao>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-borda">
          <table className="w-full text-left text-xs">
            <thead className="bg-superficie-50 text-superficie-700 font-semibold border-b border-borda sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Item / Componente</th>
                <th className="py-2.5 px-3">Especificação Técnica</th>
                <th className="py-2.5 px-3 text-center">Qtd</th>
                <th className="py-2.5 px-3">Unid</th>
                <th className="py-2.5 px-3">Norma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-superficie-100">
              {materiais.map((m, idx) => (
                <tr key={idx} className="hover:bg-superficie-50/50 transition-colors">
                  <td className="py-2 px-3 font-medium text-superficie-900">
                    {m.item}
                    {m.detalhes && (
                      <span className="block text-[10px] text-superficie-500 mt-0.5">
                        {m.detalhes}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-superficie-700">
                    {m.especificacao}
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-superficie-900">
                    {m.quantidade}
                  </td>
                  <td className="py-2 px-3 text-superficie-600">{m.unidade}</td>
                  <td className="py-2 px-3 text-superficie-500 font-mono text-[11px]">
                    {m.norma}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Botao type="button" variante="primario" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
