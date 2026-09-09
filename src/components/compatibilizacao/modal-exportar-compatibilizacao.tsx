"use client";

import { useState } from "react";
import {
  FileDown,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Modal, Botao } from "@/components/ui";
import {
  exportarCompatibilizacaoPdf,
} from "@/lib/pdf/exportador-compatibilizacao-pdf";
import { baixarArquivoBlob } from "@/lib/pdf/exportador-planta-pdf";

interface ModalExportarProps {
  aberto: boolean;
  aoFechar: () => void;
  plantasComp: any[];
  tarefas: any[];
  choques: any[];
  compatibilizacaoNome: string;
  obraNome: string;
  transparenciaTarefas?: number;
  transparenciaBordas?: number;
}

export function ModalExportarCompatibilizacao({
  aberto,
  aoFechar,
  plantasComp,
  tarefas,
  choques,
  compatibilizacaoNome,
  obraNome,
  transparenciaTarefas = 0,
  transparenciaBordas = 0,
}: ModalExportarProps) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ etapa: string; pct: number } | null>(null);
  const [concluido, setConcluido] = useState(false);

  const aoExportar = async () => {
    setExportando(true);
    setErro(null);
    setProgresso({ etapa: "Preparando...", pct: 0 });
    setConcluido(false);

    try {
      const { blob } = await exportarCompatibilizacaoPdf(
        plantasComp,
        tarefas,
        choques,
        compatibilizacaoNome,
        obraNome,
        transparenciaTarefas,
        transparenciaBordas,
        (etapa, pct) => setProgresso({ etapa, pct })
      );
      
      const nomeArquivo = `Compatibilizacao_${compatibilizacaoNome.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      baixarArquivoBlob(blob, nomeArquivo);
      
      setConcluido(true);
      setTimeout(() => {
        aoFechar();
        setConcluido(false);
        setProgresso(null);
      }, 2000);
    } catch (error) {
      console.error("Erro na exportação:", error);
      setErro(error instanceof Error ? error.message : "Ocorreu um erro ao exportar o PDF.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => !exportando && aoFechar()}
      titulo="Exportar Compatibilização (Alta Qualidade)"
      tamanho="md"
    >
      <div className="space-y-6">
        <p className="text-sm text-superficie-600">
          O PDF gerado manterá 100% da resolução vetorial infinita original das plantas CAD. A geometria da folha será moldada perfeitamente de forma adaptativa. Serão incluídas apenas as marcações de tarefas e choques atualmente visíveis na tela.
        </p>

        <div className="space-y-4">
          <div className="rounded-md border border-azul-200 bg-azul-50/50 p-4">
            <p className="text-sm font-medium text-azul-900">Dimensões do PDF Automáticas</p>
            <p className="text-sm text-azul-800 mt-1">O tamanho final da prancha vai acompanhar exatamente o limite externo extremo gerado pela composição das plantas. Não haverá distorção ou perda da escala e posicionamento.</p>
          </div>
        </div>

        {erro && (
          <div className="rounded-md border border-perigo bg-perigo/5 p-3 text-sm text-perigo flex gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{erro}</p>
          </div>
        )}

        {progresso && !erro && !concluido && (
          <div className="space-y-2 rounded-md border border-azul-200 bg-azul-50/50 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-azul-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-azul-900">{progresso.etapa}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-azul-200">
                  <div
                    className="h-full bg-azul-600 transition-all duration-300 ease-out"
                    style={{ width: `${progresso.pct}%` }}
                  />
                </div>
              </div>
              <span className="w-10 text-right text-sm font-semibold text-azul-700">
                {progresso.pct}%
              </span>
            </div>
          </div>
        )}

        {concluido && (
          <div className="rounded-md border border-sucesso bg-sucesso/5 p-4 flex items-center justify-center gap-2 text-sucesso">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Download iniciado com sucesso!</span>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <Botao variante="fantasma" onClick={aoFechar} disabled={exportando}>
            Cancelar
          </Botao>
          <Botao onClick={aoExportar} carregando={exportando} disabled={concluido}>
            <FileDown className="mr-2 h-4 w-4" />
            {exportando ? "Processando PDF..." : "Exportar e Baixar"}
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
