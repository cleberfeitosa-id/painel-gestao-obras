"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FileText, X, Loader2, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import { Botao, Campo } from "@/components/ui";
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

interface ArquivoNaFila {
  id: string;
  arquivo: File;
  nome: string;
  status: "pendente" | "enviando" | "contando" | "registrando" | "sucesso" | "erro";
  progresso: number;
  erro?: string;
  plantaId?: string;
}

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FormularioUploadPlanta({
  obraId,
}: FormularioUploadPlantaProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<ArquivoNaFila[]>([]);
  const [descricaoCompartilhada, setDescricaoCompartilhada] = useState("");
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [loteFinalizado, setLoteFinalizado] = useState(false);
  const [resultados, setResultados] = useState<{ sucessos: number; falhas: number }>({ sucessos: 0, falhas: 0 });

  function validarArquivo(arquivo: File): string | null {
    if (arquivo.type !== "application/pdf") {
      return "O arquivo deve ser um PDF.";
    }
    if (arquivo.size > LIMITE_BYTES) {
      return "O arquivo deve ter no maximo 100 MB.";
    }
    return null;
  }

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const selecionados = Array.from(e.target.files ?? []);
    setErroGeral(null);

    if (selecionados.length === 0) return;

    const novosArquivos: ArquivoNaFila[] = [];
    const erros: string[] = [];

    for (const arquivo of selecionados) {
      const erroValidacao = validarArquivo(arquivo);
      if (erroValidacao) {
        erros.push(`${arquivo.name}: ${erroValidacao}`);
        continue;
      }
      novosArquivos.push({
        id: gerarId(),
        arquivo,
        nome: arquivo.name.replace(/\.pdf$/i, ""),
        status: "pendente",
        progresso: 0,
      });
    }

    if (erros.length > 0) {
      setErroGeral(erros.join("; "));
    }

    if (novosArquivos.length > 0) {
      setFila((atual) => [...atual, ...novosArquivos]);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function removerDaFila(id: string) {
    setFila((atual) => atual.filter((item) => item.id !== id));
  }

  function atualizarNome(id: string, nome: string) {
    setFila((atual) =>
      atual.map((item) => (item.id === id ? { ...item, nome } : item))
    );
  }

  function enviarParaStorage(url: string, arquivoEnviado: File, onProgress: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", arquivoEnviado.type);
      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable) {
          onProgress(Math.round((evento.loaded / evento.total) * 100));
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

  async function processarArquivo(item: ArquivoNaFila): Promise<{ sucesso: boolean; plantaId?: string; erro?: string }> {
    const { arquivo, nome } = item;

    setFila((atual) =>
      atual.map((i) =>
        i.id === item.id ? { ...i, status: "enviando", progresso: 0 } : i
      )
    );

    const assinatura = await assinarUploadPlanta(obraId, arquivo.name);
    if ("erro" in assinatura) {
      return { sucesso: false, erro: assinatura.erro };
    }

    try {
      await enviarParaStorage(assinatura.url, arquivo, (p) => {
        setFila((atual) =>
          atual.map((i) =>
            i.id === item.id ? { ...i, progresso: p } : i
          )
        );
      });
    } catch {
      return { sucesso: false, erro: "Nao foi possivel enviar o arquivo. Tente novamente." };
    }

    setFila((atual) =>
      atual.map((i) =>
        i.id === item.id ? { ...i, status: "contando", progresso: 100 } : i
      )
    );

    let totalPaginas: number;
    try {
      totalPaginas = await contarPaginasPdf(arquivo);
    } catch {
      return { sucesso: false, erro: "Nao foi possivel ler o PDF. Envie um arquivo valido." };
    }

    setFila((atual) =>
      atual.map((i) =>
        i.id === item.id ? { ...i, status: "registrando" } : i
      )
    );

    const descricaoFinal = descricaoCompartilhada.trim() || undefined;

    const resultado = await registrarPlanta({
      obraId,
      nome: nome.trim() || arquivo.name.replace(/\.pdf$/i, ""),
      descricao: descricaoFinal,
      arquivoPath: assinatura.caminho,
      arquivoNome: arquivo.name,
      tamanhoBytes: arquivo.size,
      totalPaginas,
    });

    if ("erro" in resultado) {
      return { sucesso: false, erro: resultado.erro };
    }

    setFila((atual) =>
      atual.map((i) =>
        i.id === item.id ? { ...i, status: "sucesso", plantaId: resultado.id, progresso: 100 } : i
      )
    );

    return { sucesso: true, plantaId: resultado.id };
  }

  async function enviarLote() {
    if (fila.length === 0) return;
    setEnviandoLote(true);
    setErroGeral(null);
    setLoteFinalizado(false);
    setResultados({ sucessos: 0, falhas: 0 });

    let sucessos = 0;
    let falhas = 0;
    let primeiroSucessoId: string | null = null;

    for (let i = 0; i < fila.length; i++) {
      const item = fila[i];
      if (item.status === "sucesso") {
        sucessos++;
        if (!primeiroSucessoId) primeiroSucessoId = item.plantaId ?? null;
        continue;
      }
      if (item.status === "erro" && !item.erro) {
        falhas++;
        continue;
      }

      const resultado = await processarArquivo(item);

      if (resultado.sucesso) {
        sucessos++;
        if (!primeiroSucessoId) primeiroSucessoId = resultado.plantaId ?? null;
      } else {
        falhas++;
        setFila((atual) =>
          atual.map((i) =>
            i.id === item.id ? { ...i, status: "erro", erro: resultado.erro, progresso: 0 } : i
          )
        );
      }

      setResultados({ sucessos, falhas });
    }

    setEnviandoLote(false);
    setLoteFinalizado(true);

    if (sucessos === 1 && falhas === 0 && primeiroSucessoId) {
      router.push(`/obras/${obraId}/plantas/${primeiroSucessoId}`);
      router.refresh();
    } else {
      router.push(`/obras/${obraId}`);
      router.refresh();
    }
  }

  async function reenviarFalhas() {
    const itensComFalha = fila.filter((item) => item.status === "erro");
    if (itensComFalha.length === 0) return;

    setEnviandoLote(true);
    setErroGeral(null);
    setLoteFinalizado(false);

    let sucessos = resultados.sucessos;
    let falhasContagem = 0;

    for (let i = 0; i < itensComFalha.length; i++) {
      const item = itensComFalha[i];
      const resultado = await processarArquivo(item);

      if (resultado.sucesso) {
        sucessos++;
      } else {
        falhasContagem++;
        setFila((atual) =>
          atual.map((i) =>
            i.id === item.id ? { ...i, status: "erro", erro: resultado.erro, progresso: 0 } : i
          )
        );
      }

      setResultados({ sucessos, falhas: falhasContagem });
    }

    setEnviandoLote(false);
    setLoteFinalizado(true);

    if (falhasContagem === 0) {
      router.push(`/obras/${obraId}`);
      router.refresh();
    }
  }

  function limparFila() {
    setFila([]);
    setDescricaoCompartilhada("");
    setErroGeral(null);
    setLoteFinalizado(false);
    setResultados({ sucessos: 0, falhas: 0 });
  }

  const temArquivos = fila.length > 0;
  const todosFinalizados = fila.every((item) => ["sucesso", "erro"].includes(item.status));
  const haFalhas = fila.some((item) => item.status === "erro");

  return (
    <div className="space-y-6">
      {erroGeral && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {erroGeral}
        </div>
      )}

      {!temArquivos ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-borda bg-superficie-50 px-6 py-12 text-center transition-colors hover:border-azul-400 hover:bg-azul-50/50"
        >
          <FileUp className="h-10 w-10 text-superficie-400" />
          <div>
            <p className="text-sm font-medium text-superficie-800">
              Clique para escolher os PDFs
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Somente PDF, ate 100 MB cada. Voce pode selecionar varios arquivos.
            </p>
          </div>
        </button>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-superficie-700">
                {fila.length} arquivo{ fila.length > 1 ? "s" : "" } selecionado{ fila.length > 1 ? "s" : "" }
              </h3>
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={limparFila}
                disabled={enviandoLote}
              >
                Limpar tudo
              </Botao>
            </div>

            <ul className="space-y-2 max-h-96 overflow-y-auto" role="list" aria-label="Arquivos na fila de upload">
              {fila.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-borda bg-superficie-50 px-4 py-3"
                >
                  <FileText className="h-8 w-8 flex-shrink-0 mt-0.5 text-azul-600" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.nome}
                        onChange={(e) => atualizarNome(item.id, e.target.value)}
                        placeholder="Nome da planta"
                        className="flex-1 min-w-0 rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 placeholder:text-superficie-400 transition-colors focus:outline-none focus:ring-2 focus:ring-azul-500 focus:border-azul-500 disabled:opacity-50"
                        disabled={enviandoLote || item.status !== "pendente"}
                        aria-label={`Nome do arquivo ${item.arquivo.name}`}
                      />
                      <span className="text-xs text-superficie-500 whitespace-nowrap">
                        {formatarTamanho(item.arquivo.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removerDaFila(item.id)}
                        disabled={enviandoLote || item.status !== "pendente"}
                        className="rounded-lg p-1.5 text-superficie-500 transition-colors hover:bg-superficie-100 hover:text-superficie-700 disabled:opacity-50"
                        aria-label={`Remover ${item.arquivo.name} da fila`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-superficie-500">
                      {item.status === "pendente" && (
                        <span className="text-superficie-400">Aguardando</span>
                      )}
                      {item.status === "enviando" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-azul-600" />
                          <span>Enviando... {item.progresso}%</span>
                          <div className="flex-1 h-1.5 bg-superficie-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-azul-600 transition-all"
                              style={{ width: `${item.progresso}%` }}
                            />
                          </div>
                        </>
                      )}
                      {item.status === "contando" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-azul-600" />
                          <span>Contando paginas...</span>
                        </>
                      )}
                      {item.status === "registrando" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-azul-600" />
                          <span>Registrando...</span>
                        </>
                      )}
                      {item.status === "sucesso" && (
                        <span className="flex items-center gap-1 text-verde-600">
                          <CheckCircle className="h-3 w-3" />
                          Enviado com sucesso
                        </span>
                      )}
                      {item.status === "erro" && (
                        <span className="flex items-center gap-1 text-perigo">
                          <AlertCircle className="h-3 w-3" />
                          Falha: {item.erro}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Campo
              rotulo="Descricao (aplicada a todas as plantas)"
              value={descricaoCompartilhada}
              onChange={(e) => setDescricaoCompartilhada(e.target.value)}
              placeholder="Observacoes gerais sobre as plantas (opcional)."
              disabled={enviandoLote}
            />
          </div>

          {loteFinalizado && (
            <div className="rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 text-sm text-azul-800">
              <p className="font-medium">Upload finalizado</p>
              <p>
                {resultados.sucessos} enviado{resultados.sucessos !== 1 ? "s" : ""} com sucesso
                {resultados.falhas > 0
                  ? `, ${resultados.falhas} falha${resultados.falhas !== 1 ? "s" : ""}`
                  : ""}
                .
              </p>
            </div>
          )}

          {(haFalhas && loteFinalizado) && (
            <div className="rounded-lg border border-amarelo-200 bg-amarelo-50 px-4 py-3 text-sm text-amarelo-800">
              <p className="font-medium">Alguns arquivos falharam</p>
              <p>Corrija os erros acima e clique em &ldquo;Reenviar falhas&rdquo; para tentar novamente.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Botao
              variante="fantasma"
              onClick={() => router.back()}
              disabled={enviandoLote}
            >
              Cancelar
            </Botao>
            {haFalhas && loteFinalizado ? (
              <Botao onClick={reenviarFalhas} carregando={enviandoLote}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reenviar falhas ({fila.filter((i) => i.status === "erro").length})
              </Botao>
            ) : (
              <Botao
                onClick={enviarLote}
                carregando={enviandoLote}
                disabled={!temArquivos || todosFinalizados}
              >
                {enviandoLote
                  ? `Enviando ${fila.findIndex((i) => ["enviando", "contando", "registrando"].includes(i.status)) + 1} de ${fila.length}...`
                  : `Enviar ${fila.length} planta${fila.length > 1 ? "s" : ""}`}
              </Botao>
            )}
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={aoSelecionar}
      />
    </div>
  );
}