"use client";

import { useState } from "react";
import {
  FileDown,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Modal, Botao } from "@/components/ui";
import {
  exportarRelatorioRdoCompletoPdf,
  baixarArquivoBlob,
  type OpcoesExportacaoPlanta,
  type TamanhoFolhaPdf,
  OPCOES_EXPORTACAO_PADRAO,
} from "@/lib/pdf/exportador-planta-pdf";
import type {
  FiguraPlanta,
  TarefaRelatorio,
} from "@/components/relatorios/documento-relatorio";

export interface DadosExportacaoRelatorio {
  titulo: string;
  subtitulo: string;
  filtros: { rotulo: string; valor: string }[];
  geradoEm: Date;
  concluidas: TarefaRelatorio[];
  andamento: TarefaRelatorio[];
  totalAbertas: number;
  totalFotos: number;
  urlsMap: Map<string, string>;
  plantas: FiguraPlanta[];
}

interface ModalExportarRelatorioProps {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosExportacaoRelatorio;
}

export function ModalExportarRelatorio({
  aberto,
  aoFechar,
  dados,
}: ModalExportarRelatorioProps) {
  const [opcoes, setOpcoes] = useState<OpcoesExportacaoPlanta>(OPCOES_EXPORTACAO_PADRAO);
  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; pct: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  async function handleExportar() {
    setExportando(true);
    setErro(null);
    setConcluido(false);

    try {
      const blob = await exportarRelatorioRdoCompletoPdf(
        dados.titulo,
        dados.subtitulo,
        dados.filtros,
        dados.geradoEm,
        dados.concluidas,
        dados.andamento,
        dados.totalAbertas,
        dados.totalFotos,
        dados.urlsMap,
        dados.plantas,
        {
          ...opcoes,
          aoProgresso: (etapa, pct) => setProgresso({ etapa, pct }),
        },
      );

      const nomeArquivo = `Relatorio-Tecnico-RDO-${new Date().toISOString().slice(0, 10)}-${opcoes.tamanhoFolha}.pdf`;
      baixarArquivoBlob(blob, nomeArquivo);

      setConcluido(true);
      setTimeout(() => {
        if (!exportando) {
          aoFechar();
          setProgresso(null);
          setConcluido(false);
        }
      }, 2000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Ocorreu um erro ao gerar o PDF do relatório.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => {
        if (!exportando) {
          aoFechar();
          setProgresso(null);
          setErro(null);
        }
      }}
      titulo="Exportar Relatório Técnico com Pranchas e Links"
      descricao={`Gera o PDF com pranchas em tamanho grande (${opcoes.tamanhoFolha}), pinos e regiões iluminadas com transparência, hiperlinks interativos para as tarefas e fichas completas.`}
      tamanho="lg"
    >
      <div className="space-y-5 pt-1">
        {erro && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">Falha na exportação</p>
              <p className="text-xs text-red-700 mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        {concluido && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">PDF gerado e baixado com sucesso!</p>
              <p className="text-xs text-emerald-700">O arquivo contém os hiperlinks interativos e as pranchas em alta resolução.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-superficie-600">
            Formato das Pranchas de Planta
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["A0", "A1", "A2", "A3"] as TamanhoFolhaPdf[]).map((tam) => (
              <button
                key={tam}
                type="button"
                disabled={exportando}
                onClick={() => setOpcoes((prev) => ({ ...prev, tamanhoFolha: tam }))}
                className={`flex flex-col items-center justify-center rounded-lg border p-2.5 transition-all ${
                  opcoes.tamanhoFolha === tam
                    ? "border-azul-600 bg-azul-50 text-azul-700 font-bold shadow-sm"
                    : "border-superficie-200 bg-white text-superficie-700 hover:bg-superficie-50"
                }`}
              >
                <span className="text-base">{tam}</span>
                <span className="text-[10px] text-superficie-500 font-normal">
                  {tam === "A0" ? "841 × 1189 mm" : tam === "A1" ? "594 × 841 mm" : tam === "A2" ? "420 × 594 mm" : "297 × 420 mm"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-superficie-600">
            Fichas Técnicas e Detalhamento
          </label>
          <div className="space-y-2 rounded-xl border border-superficie-200 bg-superficie-50/50 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={exportando}
                checked={opcoes.incluirDetalhamentoTarefas}
                onChange={(e) =>
                  setOpcoes((prev) => ({
                    ...prev,
                    incluirDetalhamentoTarefas: e.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-superficie-300 text-azul-600 accent-azul-600"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium text-sm text-superficie-900">
                  <Layers className="h-4 w-4 text-azul-600" />
                  <span>Incluir fichas de detalhamento de cada tarefa</span>
                </div>
                <p className="text-xs text-superficie-500">
                  Cria páginas com os dados técnicos de cada tarefa com hiperlinks interativos conectados aos pinos/regiões das pranchas.
                </p>
              </div>
            </label>

            {opcoes.incluirDetalhamentoTarefas && (
              <div className="ml-7 space-y-2.5 pt-2 border-t border-superficie-200">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={exportando}
                    checked={opcoes.incluirFotosAnexos}
                    onChange={(e) =>
                      setOpcoes((prev) => ({
                        ...prev,
                        incluirFotosAnexos: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-superficie-300 text-azul-600 accent-azul-600"
                  />
                  <span className="flex items-center gap-1.5 text-xs text-superficie-800">
                    <ImageIcon className="h-3.5 w-3.5 text-superficie-500" />
                    Fotos e evidências anexadas (comprimidas e otimizadas em alta velocidade)
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {exportando && progresso && (
          <div className="space-y-2 rounded-xl border border-azul-200 bg-azul-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-azul-900">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-azul-600" />
                {progresso.etapa}
              </span>
              <span>{progresso.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-azul-200/60">
              <div
                className="h-full bg-azul-600 transition-all duration-300"
                style={{ width: `${progresso.pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao
            variante="secundario"
            onClick={aoFechar}
            disabled={exportando}
          >
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={handleExportar}
            disabled={exportando}
            carregando={exportando}
          >
            {exportando ? "Exportando..." : (
              <>
                <FileDown className="h-4 w-4" />
                Exportar Relatório PDF ({opcoes.tamanhoFolha})
              </>
            )}
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
