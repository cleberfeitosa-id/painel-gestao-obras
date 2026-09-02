"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
} from "lucide-react";
import { Botao, Modal, EstadoVazio } from "@/components/ui";
import { formatarTamanho } from "@/lib/utils";
import { MOMENTO_ANEXO } from "@/lib/domain/rotulos";
import { comprimirImagem, eImagemComprimivel } from "@/lib/compressao-imagem";
import { CameraModal } from "@/components/tarefas/camera-modal";
import { GaleriaImagensModal } from "@/components/tarefas/galeria-imagens-modal";
import {
  assinarUploadAnexo,
  registrarAnexo,
  excluirAnexo,
} from "@/app/(protegido)/tarefas/acoes";
import type {
  TarefaAnexoRow,
  MomentoAnexo,
  TipoAnexo,
} from "@/lib/supabase/database.types";

interface AnexoComAutor extends TarefaAnexoRow {
  enviado_por_nome: string | null;
}

interface AnexosProps {
  tarefaId: string;
  anexos: AnexoComAutor[];
  urls: Map<string, string> | Record<string, string>;
  usuarioId: string;
  podeEscrever: boolean;
}

type ArquivoEmUpload = {
  id: string;
  nome: string;
  progresso: number;
  statusTexto?: string;
  erro?: string;
};

function classificarTipo(mime: string): TipoAnexo {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  return "arquivo";
}

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function Anexos({
  tarefaId,
  anexos,
  urls,
  usuarioId,
  podeEscrever,
}: AnexosProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [uploads, setUploads] = useState<ArquivoEmUpload[]>([]);
  const [momento, setMomento] = useState<MomentoAnexo>("andamento");
  const [indiceGaleria, setIndiceGaleria] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const imagens = anexos.filter((a) => a.tipo === "imagem");
  const videos = anexos.filter((a) => a.tipo === "video");
  const arquivos = anexos.filter((a) => a.tipo === "arquivo");

  const obterUrl = useCallback(
    (caminho: string): string | undefined => {
      if (!caminho) return undefined;
      if (urls instanceof Map) {
        return urls.get(caminho);
      }
      if (typeof urls === "object" && urls !== null) {
        return (urls as Record<string, string>)[caminho];
      }
      return undefined;
    },
    [urls],
  );

  function atualizarUpload(id: string, mudancas: Partial<ArquivoEmUpload>) {
    setUploads((atual) =>
      atual.map((u) => (u.id === id ? { ...u, ...mudancas } : u)),
    );
  }

  async function enviarArquivo(itemUpload: { id: string; arquivo: File }) {
    const { id, arquivo: arquivoOriginal } = itemUpload;
    let arquivo = arquivoOriginal;

    try {
      if (eImagemComprimivel(arquivoOriginal)) {
        atualizarUpload(id, {
          statusTexto: "Otimizando imagem...",
          progresso: 0,
        });
        arquivo = await comprimirImagem(arquivoOriginal, {
          maxDimensao: 1920,
          qualidade: 0.82,
        });
        atualizarUpload(id, { nome: arquivo.name });
      }

      atualizarUpload(id, {
        statusTexto: "Iniciando envio...",
        progresso: 0,
      });

      const assinatura = await assinarUploadAnexo(tarefaId, arquivo.name);
      if (!assinatura.url || !assinatura.caminho) {
        atualizarUpload(id, { erro: assinatura.erro ?? "Falha no upload." });
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", assinatura.url!);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            atualizarUpload(id, {
              progresso: pct,
              statusTexto: pct < 100 ? `Enviando... ${pct}%` : "Processando...",
            });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Falha de rede"));
        xhr.send(arquivo);
      });

      atualizarUpload(id, { statusTexto: "Registrando anexo..." });

      const resultado = await registrarAnexo({
        tarefaId,
        tipo: classificarTipo(arquivo.type || "application/octet-stream"),
        momento,
        caminho: assinatura.caminho,
        nomeArquivo: arquivo.name,
        mime: arquivo.type || null,
        tamanhoBytes: arquivo.size,
      });

      if (resultado.erro) {
        atualizarUpload(id, { erro: resultado.erro });
        return;
      }

      setUploads((atual) => atual.filter((u) => u.id !== id));
    } catch {
      atualizarUpload(id, { erro: "Falha no upload. Tente novamente." });
    }
  }

  async function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;

    const itensParaUpload = arquivos.map((arquivo) => ({
      id: gerarId(),
      arquivo,
      nome: arquivo.name,
    }));

    setUploads((atual) => [
      ...atual,
      ...itensParaUpload.map((item) => ({
        id: item.id,
        nome: item.nome,
        progresso: 0,
        statusTexto: "Aguardando...",
      })),
    ]);

    e.target.value = "";

    for (const item of itensParaUpload) {
      await enviarArquivo(item);
    }
  }

  async function aoCapturarFotoDireta(arquivo: File) {
    const item = {
      id: gerarId(),
      arquivo,
      nome: arquivo.name,
    };

    setUploads((atual) => [
      ...atual,
      {
        id: item.id,
        nome: item.nome,
        progresso: 0,
        statusTexto: "Aguardando...",
      },
    ]);

    await enviarArquivo(item);
  }

  function confirmarExclusao() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    iniciarTransicao(async () => {
      await excluirAnexo(id, tarefaId);
    });
  }

  const podeExcluirAnexo = (anexo: AnexoComAutor) =>
    podeEscrever || anexo.enviado_por === usuarioId;

  return (
    <div className="space-y-6">
      {podeEscrever && (
        <div className="space-y-3 rounded-lg border border-dashed border-borda p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-superficie-700 mb-1.5">
                Momento do anexo
              </label>
              <select
                value={momento}
                onChange={(e) => setMomento(e.target.value as MomentoAnexo)}
                className="block w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
              >
                {Object.entries(MOMENTO_ANEXO).map(([valor, opcao]) => (
                  <option key={valor} value={valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Botao
                type="button"
                variante="primario"
                onClick={() => setCameraAberta(true)}
              >
                <Camera className="h-4 w-4" />
                Tirar foto
              </Botao>
              <Botao
                type="button"
                variante="contorno"
                onClick={() => inputFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Galeria / Arquivos
              </Botao>
            </div>
          </div>
          <p className="text-[11px] text-superficie-500">
            Tire fotos diretamente na tela ou selecione fotos e arquivos da galeria. Imagens são otimizadas automaticamente antes do envio.
          </p>
          <input
            ref={inputFileRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={aoSelecionar}
            className="hidden"
            aria-label="Selecionar arquivos para enviar"
          />
          <input
            ref={inputCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={aoSelecionar}
            className="hidden"
            aria-label="Tirar foto com a câmera"
          />

          {uploads.length > 0 && (
            <ul className="space-y-2">
              {uploads.map((upload) => (
                <li
                  key={upload.id}
                  className="rounded-lg border border-borda px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-superficie-700">
                      {upload.nome}
                    </span>
                    {upload.erro ? (
                      <span className="text-xs text-perigo">{upload.erro}</span>
                    ) : (
                      <span className="text-xs text-superficie-500">
                        {upload.statusTexto ?? `${upload.progresso}%`}
                      </span>
                    )}
                  </div>
                  {!upload.erro && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-superficie-100">
                      <div
                        className="h-full rounded-full bg-azul-600 transition-all"
                        style={{ width: `${upload.progresso}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {anexos.length === 0 ? (
        <EstadoVazio
          icone={<FileText className="h-8 w-8" />}
          titulo="Nenhum anexo"
          descricao="Envie fotos, videos ou arquivos para registrar o andamento da tarefa."
        />
      ) : (
        <div className="space-y-6">
          {imagens.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-superficie-700">
                Imagens
              </h4>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {imagens.map((anexo, idx) => {
                  const url = obterUrl(anexo.caminho);
                  return (
                    <div key={anexo.id} className="group relative">
                      {url ? (
                        <button
                          type="button"
                          onClick={() => setIndiceGaleria(idx)}
                          className="block aspect-square w-full overflow-hidden rounded-lg border border-borda bg-superficie-100 focus:outline-none focus:ring-2 focus:ring-azul-500 cursor-pointer"
                          aria-label={`Ampliar ${anexo.nome_arquivo}`}
                        >
                          <img
                            src={url}
                            alt={anexo.nome_arquivo}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-borda bg-superficie-50">
                          <ImageIcon className="h-6 w-6 text-superficie-400" />
                        </div>
                      )}
                      {podeExcluirAnexo(anexo) && (
                        <button
                          type="button"
                          onClick={() => setExcluirId(anexo.id)}
                          className="absolute right-1 top-1 rounded-lg bg-superficie-900/80 p-1.5 text-white shadow transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-perigo focus:opacity-100 cursor-pointer"
                          aria-label="Excluir imagem"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-superficie-700">
                Videos
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {videos.map((anexo) => {
                  const url = obterUrl(anexo.caminho);
                  return (
                    <div key={anexo.id} className="relative">
                      {url ? (
                        <video
                          src={url}
                          controls
                          className="w-full rounded-lg border border-borda"
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-borda bg-superficie-50">
                          <Video className="h-6 w-6 text-superficie-400" />
                        </div>
                      )}
                      {podeExcluirAnexo(anexo) && (
                        <button
                          type="button"
                          onClick={() => setExcluirId(anexo.id)}
                          className="absolute right-1 top-1 rounded-lg bg-superficie-900/70 p-1.5 text-white cursor-pointer"
                          aria-label="Excluir video"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {arquivos.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-superficie-700">
                Arquivos
              </h4>
              <ul className="divide-y divide-superficie-100 rounded-lg border border-borda">
                {arquivos.map((anexo) => {
                  const url = obterUrl(anexo.caminho);
                  return (
                    <li
                      key={anexo.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <FileText className="h-5 w-5 flex-shrink-0 text-superficie-400" />
                      <div className="min-w-0 flex-1">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-medium text-azul-600 hover:text-azul-700"
                          >
                            {anexo.nome_arquivo}
                          </a>
                        ) : (
                          <span className="truncate text-sm text-superficie-700">
                            {anexo.nome_arquivo}
                          </span>
                        )}
                        <p className="text-xs text-superficie-500">
                          {formatarTamanho(anexo.tamanho_bytes)} ·{" "}
                          {MOMENTO_ANEXO[anexo.momento].rotulo} ·{" "}
                          {anexo.enviado_por_nome ?? "Usuario"}
                        </p>
                      </div>
                      {podeExcluirAnexo(anexo) && (
                        <button
                          type="button"
                          onClick={() => setExcluirId(anexo.id)}
                          className="rounded-lg p-1.5 text-superficie-400 hover:text-perigo hover:bg-superficie-100 transition-colors cursor-pointer"
                          aria-label="Excluir arquivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <GaleriaImagensModal
        aberto={indiceGaleria !== null}
        indiceInicial={indiceGaleria ?? 0}
        imagens={imagens}
        obterUrl={obterUrl}
        aoFechar={() => setIndiceGaleria(null)}
        aoExcluir={(anexo) => {
          setIndiceGaleria(null);
          setExcluirId(anexo.id);
        }}
        podeExcluir={podeExcluirAnexo}
      />

      <Modal
        aberto={excluirId !== null}
        aoFechar={() => setExcluirId(null)}
        titulo="Excluir anexo"
        descricao="O arquivo sera removido do armazenamento. Esta acao nao pode ser desfeita."
      >
        <div className="flex justify-end gap-3">
          <Botao
            type="button"
            variante="contorno"
            onClick={() => setExcluirId(null)}
          >
            Cancelar
          </Botao>
          <Botao type="button" variante="perigo" onClick={confirmarExclusao} carregando={pendente}>
            Excluir
          </Botao>
        </div>
      </Modal>

      <CameraModal
        aberto={cameraAberta}
        aoFechar={() => setCameraAberta(false)}
        aoCapturar={aoCapturarFotoDireta}
        aoUsarArquivoAlternativo={() => inputFileRef.current?.click()}
      />
    </div>
  );
}
