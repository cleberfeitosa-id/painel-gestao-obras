"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import {
  assinarUploadPlanta,
  registrarPlanta,
} from "@/app/(protegido)/obras/[id]/plantas/acoes";
import { contarPaginasPdf } from "@/components/plantas/pdfjs";
import type { ObraRow } from "@/lib/supabase/database.types";

interface ModalUploadNovaPlantaProps {
  aberto: boolean;
  obras: ObraRow[];
  obraIdPadrao?: string;
  aoConcluir: (obraId: string, plantaId: string) => void;
  aoFechar: () => void;
}

export function ModalUploadNovaPlanta({
  aberto,
  obras,
  obraIdPadrao,
  aoConcluir,
  aoFechar,
}: ModalUploadNovaPlantaProps) {
  const [obraId, setObraId] = useState(obraIdPadrao ?? (obras[0]?.id ?? ""));
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files[0]) {
      const f = files[0];
      if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
        setErro("Apenas arquivos PDF são permitidos.");
        return;
      }
      setArquivo(f);
      setErro(null);
      if (!nome) {
        setNome(f.name.replace(/\.pdf$/i, ""));
      }
    }
  }

  async function enviar() {
    if (!obraId) {
      setErro("Selecione uma obra.");
      return;
    }
    if (!arquivo) {
      setErro("Selecione um arquivo PDF da planta.");
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome da planta.");
      return;
    }

    setEnviando(true);
    setErro(null);
    setProgresso(5);

    try {
      const assinado = await assinarUploadPlanta(obraId, arquivo.name);
      if ("erro" in assinado) {
        setErro(assinado.erro);
        setEnviando(false);
        return;
      }

      setProgresso(20);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", assinado.url);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round(20 + (evt.loaded / evt.total) * 60);
            setProgresso(pct);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Falha no upload: status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload."));
        xhr.send(arquivo);
      });

      setProgresso(85);

      const totalPaginas = await contarPaginasPdf(arquivo);
      setProgresso(90);

      const resultado = await registrarPlanta({
        obraId,
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        arquivoPath: assinado.caminho,
        arquivoNome: arquivo.name,
        tamanhoBytes: arquivo.size,
        totalPaginas,
      });

      if ("erro" in resultado) {
        setErro(resultado.erro);
        setEnviando(false);
        return;
      }

      setProgresso(100);
      setEnviando(false);
      aoConcluir(obraId, resultado.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro desconhecido no envio.";
      setErro(msg);
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Incluir Nova Planta na Obra"
      descricao="Envie uma planta em PDF para realizar o levantamento de quantidades."
      tamanho="md"
    >
      <div className="space-y-4">
        {erro && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
            {erro}
          </div>
        )}

        <Selecao
          rotulo="Obra"
          obrigatorio
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
        >
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Selecao>

        <Campo
          rotulo="Nome da Planta"
          obrigatorio
          placeholder="Ex.: Planta Elétrica Pavimento Tipo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <Campo
          rotulo="Descrição (opcional)"
          placeholder="Ex.: Projeto elétrico com tomadas e iluminação"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <div>
          <label className="block text-xs font-semibold text-superficie-700 mb-1">
            Arquivo PDF da Planta *
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={selecionarArquivo}
            className="w-full text-xs text-superficie-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-azul-50 file:text-azul-700 hover:file:bg-azul-100 cursor-pointer"
          />
        </div>

        {enviando && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-superficie-600">
              <span>Enviando e processando...</span>
              <span>{progresso}%</span>
            </div>
            <div className="w-full bg-superficie-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-azul-600 h-full transition-all duration-200"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={enviar}
            carregando={enviando}
            disabled={!arquivo || !nome.trim()}
          >
            <UploadCloud className="h-4 w-4" />
            Enviar Planta
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
