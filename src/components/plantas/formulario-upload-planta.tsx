"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FileText } from "lucide-react";
import { AreaTexto, Botao, Campo } from "@/components/ui";
import { formatarTamanho } from "@/lib/utils";
import { contarPaginasPdf } from "./pdfjs";
import {
  assinarUploadPlanta,
  registrarPlanta,
} from "@/app/(protegido)/obras/[id]/plantas/acoes";

const LIMITE_BYTES = 100 * 1024 * 1024;

interface FormularioUploadPlantaProps {
  obraId: string;
}

export function FormularioUploadPlanta({
  obraId,
}: FormularioUploadPlantaProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const selecionado = e.target.files?.[0] ?? null;
    setErro(null);
    if (!selecionado) return;
    if (selecionado.type !== "application/pdf") {
      setErro("O arquivo deve ser um PDF.");
      return;
    }
    if (selecionado.size > LIMITE_BYTES) {
      setErro("O arquivo deve ter no maximo 100 MB.");
      return;
    }
    setArquivo(selecionado);
    setNome(selecionado.name.replace(/\.pdf$/i, ""));
    setProgresso(0);
  }

  function enviarParaStorage(url: string, arquivoEnviado: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", arquivoEnviado.type);
      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable) {
          setProgresso(Math.round((evento.loaded / evento.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Falha no upload: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Falha de rede no upload."));
      xhr.send(arquivoEnviado);
    });
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);

    const assinatura = await assinarUploadPlanta(obraId, arquivo.name);
    if ("erro" in assinatura) {
      setErro(assinatura.erro);
      setEnviando(false);
      return;
    }

    try {
      await enviarParaStorage(assinatura.url, arquivo);
    } catch {
      setErro("Nao foi possivel enviar o arquivo. Tente novamente.");
      setEnviando(false);
      return;
    }

    let totalPaginas: number;
    try {
      totalPaginas = await contarPaginasPdf(arquivo);
    } catch {
      setErro("Nao foi possivel ler o PDF. Envie um arquivo valido.");
      setEnviando(false);
      return;
    }

    const resultado = await registrarPlanta({
      obraId,
      nome: nome.trim() || arquivo.name.replace(/\.pdf$/i, ""),
      descricao,
      arquivoPath: assinatura.caminho,
      arquivoNome: arquivo.name,
      tamanhoBytes: arquivo.size,
      totalPaginas,
    });

    if ("erro" in resultado) {
      setErro(resultado.erro);
      setEnviando(false);
      return;
    }

    router.push(`/obras/${obraId}/plantas/${resultado.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {erro}
        </div>
      )}

      {!arquivo ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-borda bg-superficie-50 px-6 py-12 text-center transition-colors hover:border-azul-400 hover:bg-azul-50/50"
        >
          <FileUp className="h-10 w-10 text-superficie-400" />
          <div>
            <p className="text-sm font-medium text-superficie-800">
              Clique para escolher o PDF
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Somente PDF, ate 100 MB.
            </p>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-borda bg-superficie-50 px-4 py-3">
          <FileText className="h-8 w-8 flex-shrink-0 text-azul-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-superficie-900">
              {arquivo.name}
            </p>
            <p className="text-xs text-superficie-500">
              {formatarTamanho(arquivo.size)}
            </p>
          </div>
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => {
              setArquivo(null);
              setNome("");
              setErro(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={enviando}
          >
            Trocar
          </Botao>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={aoSelecionar}
      />

      {arquivo && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Campo
              rotulo="Nome da planta"
              obrigatorio
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Pavimento tipo - 2o andar"
            />
            <Campo
              rotulo="Paginas"
              value="Detectadas apos o envio"
              disabled
            />
          </div>

          <AreaTexto
            rotulo="Descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Observacoes sobre a planta (opcional)."
          />

          {enviando && (
            <div>
              <div className="flex items-center justify-between text-xs text-superficie-500">
                <span>Enviando para o armazenamento...</span>
                <span>{progresso}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-superficie-100">
                <div
                  className="h-full rounded-full bg-azul-600 transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Botao
              variante="fantasma"
              onClick={() => router.back()}
              disabled={enviando}
            >
              Cancelar
            </Botao>
            <Botao onClick={enviar} carregando={enviando}>
              Enviar planta
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}