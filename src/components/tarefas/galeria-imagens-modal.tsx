"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { formatarTamanho } from "@/lib/utils";
import { MOMENTO_ANEXO } from "@/lib/domain/rotulos";
import { formatarDataHora } from "@/lib/datas";
import { Botao } from "@/components/ui";
import type { TarefaAnexoRow } from "@/lib/supabase/database.types";

interface AnexoComAutor extends TarefaAnexoRow {
  enviado_por_nome: string | { nome?: string | null } | null;
}

function extrairNomeAutor(
  enviadoPorNome: string | { nome?: string | null } | null | undefined,
): string {
  if (!enviadoPorNome) return "Usuário";
  if (typeof enviadoPorNome === "object") {
    return enviadoPorNome.nome || "Usuário";
  }
  return String(enviadoPorNome);
}

interface GaleriaImagensModalProps {
  aberto: boolean;
  indiceInicial: number;
  imagens: AnexoComAutor[];
  obterUrl: (caminho: string) => string | undefined;
  aoFechar: () => void;
  aoExcluir?: (anexo: AnexoComAutor) => void;
  podeExcluir?: (anexo: AnexoComAutor) => boolean;
}

export function GaleriaImagensModal({
  aberto,
  indiceInicial,
  imagens,
  obterUrl,
  aoFechar,
  aoExcluir,
  podeExcluir,
}: GaleriaImagensModalProps) {
  if (!aberto || imagens.length === 0) return null;

  return (
    <GaleriaImagensConteudo
      key={`${aberto}-${indiceInicial}`}
      indiceInicial={indiceInicial}
      imagens={imagens}
      obterUrl={obterUrl}
      aoFechar={aoFechar}
      aoExcluir={aoExcluir}
      podeExcluir={podeExcluir}
    />
  );
}

function GaleriaImagensConteudo({
  indiceInicial,
  imagens,
  obterUrl,
  aoFechar,
  aoExcluir,
  podeExcluir,
}: Omit<GaleriaImagensModalProps, "aberto">) {
  const [indice, setIndice] = useState(indiceInicial);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = imagens.length;
  const anexoAtual = imagens[indice];
  const urlAtual = anexoAtual ? obterUrl(anexoAtual.caminho) : undefined;

  const anterior = useCallback(() => {
    setErroCarregamento(false);
    setIndice((i) => (i > 0 ? i - 1 : total - 1));
  }, [total]);

  const proximo = useCallback(() => {
    setErroCarregamento(false);
    setIndice((i) => (i < total - 1 ? i + 1 : 0));
  }, [total]);

  useEffect(() => {
    function aoPressionarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        aoFechar();
      } else if (e.key === "ArrowLeft") {
        anterior();
      } else if (e.key === "ArrowRight") {
        proximo();
      }
    }

    window.addEventListener("keydown", aoPressionarTecla);
    return () => window.removeEventListener("keydown", aoPressionarTecla);
  }, [anterior, proximo, aoFechar]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!anexoAtual) return null;

  function aoTocarInicio(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function aoTocarFim(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        anterior();
      } else {
        proximo();
      }
    }
    touchStartX.current = null;
  }

  const permitirExclusao = podeExcluir ? podeExcluir(anexoAtual) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-superficie-950/95 backdrop-blur-md text-white select-none transition-opacity duration-200"
      onTouchStart={aoTocarInicio}
      onTouchEnd={aoTocarFim}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-superficie-950/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white shrink-0">
            {indice + 1} de {total}
          </span>
          <span className="text-sm font-medium text-white/90 truncate max-w-[200px] sm:max-w-md">
            {anexoAtual.nome_arquivo}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {urlAtual && (
            <>
              <a
                href={urlAtual}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Abrir imagem original em nova aba"
                aria-label="Abrir imagem original"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
              <a
                href={urlAtual}
                download={anexoAtual.nome_arquivo}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Baixar imagem"
                aria-label="Baixar imagem"
              >
                <Download className="h-5 w-5" />
              </a>
            </>
          )}
          <button
            type="button"
            onClick={aoFechar}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar galeria"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 min-h-0 overflow-hidden">
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              anterior();
            }}
            className="absolute left-2 sm:left-4 z-10 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all shadow-lg backdrop-blur-sm border border-white/10 cursor-pointer"
            title="Imagem anterior (Seta esquerda)"
            aria-label="Imagem anterior"
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        )}

        <div className="relative max-h-full max-w-full flex items-center justify-center">
          {urlAtual && !erroCarregamento ? (
            <img
              key={anexoAtual.id}
              src={urlAtual}
              alt={anexoAtual.nome_arquivo}
              className="max-h-[68vh] sm:max-h-[72vh] w-auto max-w-full rounded-lg object-contain shadow-2xl transition-all"
              onError={() => setErroCarregamento(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-white/5 border border-white/10 text-center max-w-sm">
              {erroCarregamento ? (
                <>
                  <AlertCircle className="h-12 w-12 text-amber-400 mb-3" />
                  <p className="text-sm font-medium text-white mb-1">
                    Não foi possível carregar a imagem
                  </p>
                  <p className="text-xs text-white/60 mb-4">
                    O link de acesso pode ter expirado ou o arquivo foi modificado.
                  </p>
                  {urlAtual && (
                    <a
                      href={urlAtual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-azul-400 hover:text-azul-300 underline"
                    >
                      Tentar abrir link direto <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                <>
                  <ImageIcon className="h-12 w-12 text-white/40 mb-3" />
                  <p className="text-sm text-white/70">
                    URL da imagem indisponível
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              proximo();
            }}
            className="absolute right-2 sm:right-4 z-10 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all shadow-lg backdrop-blur-sm border border-white/10 cursor-pointer"
            title="Próxima imagem (Seta direita)"
            aria-label="Próxima imagem"
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        )}
      </div>

      <div className="px-4 py-3 bg-superficie-950/90 border-t border-white/10 shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{formatarTamanho(anexoAtual.tamanho_bytes)}</span>
            <span>•</span>
            <span className="font-medium text-white/90">
              {MOMENTO_ANEXO[anexoAtual.momento]?.rotulo ?? anexoAtual.momento}
            </span>
            <span>•</span>
            <span>{extrairNomeAutor(anexoAtual.enviado_por_nome)}</span>
            {anexoAtual.criado_em && (
              <>
                <span>•</span>
                <span>{formatarDataHora(anexoAtual.criado_em)}</span>
              </>
            )}
          </div>

          {permitirExclusao && aoExcluir && (
            <Botao
              type="button"
              variante="perigo"
              tamanho="sm"
              onClick={() => aoExcluir(anexoAtual)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir imagem
            </Botao>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 max-w-full scrollbar-thin">
            {imagens.map((img, idx) => {
              const urlThumb = obterUrl(img.caminho);
              const ativo = idx === indice;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setErroCarregamento(false);
                    setIndice(idx);
                  }}
                  className={`relative shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                    ativo
                      ? "border-azul-400 scale-105 opacity-100 shadow-md ring-2 ring-azul-400/50"
                      : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                  aria-label={`Ver imagem ${idx + 1}`}
                >
                  {urlThumb ? (
                    <img
                      src={urlThumb}
                      alt={img.nome_arquivo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-white/50" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
