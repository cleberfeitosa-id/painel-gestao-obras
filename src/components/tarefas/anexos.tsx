"use client";

import { useRef, useState, useTransition } from "react";
import {
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import { Botao, Modal, EstadoVazio } from "@/components/ui";
import { formatarTamanho } from "@/lib/utils";
import { MOMENTO_ANEXO } from "@/lib/domain/rotulos";
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
  urls: Map<string, string>;
  usuarioId: string;
  podeEscrever: boolean;
}

type ArquivoEmUpload = {
  nome: string;
  progresso: number;
  erro?: string;
};

function classificarTipo(mime: string): TipoAnexo {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  return "arquivo";
}

export function Anexos({
  tarefaId,
  anexos,
  urls,
  usuarioId,
  podeEscrever,
}: AnexosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<ArquivoEmUpload[]>([]);
  const [momento, setMomento] = useState<MomentoAnexo>("andamento");
  const [imagemAberta, setImagemAberta] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const imagens = anexos.filter((a) => a.tipo === "imagem");
  const videos = anexos.filter((a) => a.tipo === "video");
  const arquivos = anexos.filter((a) => a.tipo === "arquivo");

  function atualizarUpload(nome: string, mudancas: Partial<ArquivoEmUpload>) {
    setUploads((atual) =>
      atual.map((u) => (u.nome === nome ? { ...u, ...mudancas } : u)),
    );
  }

  async function enviarArquivo(arquivo: File) {
    const nome = arquivo.name;
    setUploads((atual) => [...atual, { nome, progresso: 0 }]);

    try {
      const assinatura = await assinarUploadAnexo(tarefaId, arquivo.name);
      if (!assinatura.url || !assinatura.caminho) {
        atualizarUpload(nome, { erro: assinatura.erro ?? "Falha no upload." });
        return;
      }

      // Upload direto do navegador para o Storage via URL assinada (PUT).
      // Nunca passa pela funcao serverless, que corta corpos acima de 4,5 MB.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", assinatura.url!);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            atualizarUpload(nome, { progresso: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Falha de rede"));
        xhr.send(arquivo);
      });

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
        atualizarUpload(nome, { erro: resultado.erro });
        return;
      }

      setUploads((atual) => atual.filter((u) => u.nome !== nome));
    } catch {
      atualizarUpload(nome, { erro: "Falha no upload. Tente novamente." });
    }
  }

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    for (const arquivo of arquivos) {
      void enviarArquivo(arquivo);
    }
    e.target.value = "";
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
            <Botao
              type="button"
              variante="primario"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Enviar arquivos
            </Botao>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={aoSelecionar}
            className="hidden"
            aria-label="Selecionar arquivos para enviar"
          />

          {uploads.length > 0 && (
            <ul className="space-y-2">
              {uploads.map((upload) => (
                <li
                  key={upload.nome}
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
                        {upload.progresso}%
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
                {imagens.map((anexo) => {
                  const url = urls.get(anexo.caminho);
                  return (
                    <div key={anexo.id} className="group relative">
                      {url ? (
                        <button
                          type="button"
                          onClick={() => setImagemAberta(url)}
                          className="block aspect-square w-full overflow-hidden rounded-lg border border-borda"
                          aria-label={`Ampliar ${anexo.nome_arquivo}`}
                        >
                          <img
                            src={url}
                            alt={anexo.nome_arquivo}
                            className="h-full w-full object-cover"
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
                          className="absolute right-1 top-1 rounded-lg bg-superficie-900/70 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
                  const url = urls.get(anexo.caminho);
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
                          className="absolute right-1 top-1 rounded-lg bg-superficie-900/70 p-1.5 text-white"
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
                  const url = urls.get(anexo.caminho);
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
                          className="rounded-lg p-1.5 text-superficie-400 hover:text-perigo hover:bg-superficie-100 transition-colors"
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

      <Modal
        aberto={imagemAberta !== null}
        aoFechar={() => setImagemAberta(null)}
        titulo="Imagem"
        tamanho="xl"
      >
        {imagemAberta && (
          <img
            src={imagemAberta}
            alt="Imagem ampliada"
            className="w-full rounded-lg"
          />
        )}
      </Modal>

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
          <Botao type="button" variante="perigo" onClick={confirmarExclusao}>
            Excluir
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
