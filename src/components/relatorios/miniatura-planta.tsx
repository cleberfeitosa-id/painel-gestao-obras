"use client";

import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Spinner } from "@/components/ui";
import { limitesDaRegiao, pdfParaPercentual } from "@/lib/pdf/coordenadas";
import { situacaoDaTarefa, SITUACAO_TAREFA } from "@/lib/domain/rotulos";
import { cn } from "@/lib/utils";
import type {
  AprovacaoTarefa,
  RegiaoPdf,
  StatusTarefa,
  TipoLocalizacao,
} from "@/lib/supabase/database.types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type MarcadorPlanta = {
  numero: number;
  titulo: string;
  localizacao_tipo: TipoLocalizacao;
  ponto_x: number | null;
  ponto_y: number | null;
  regiao: RegiaoPdf | null;
  status: StatusTarefa;
  aprovacao: AprovacaoTarefa;
};

type Dimensoes = { largura: number; altura: number };

function Numeracao({
  numero,
  cor,
}: {
  numero: number;
  cor: string;
}) {
  return (
    <span
      className={cn(
        "marcador-planta-badge flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ring-1 ring-white/80",
        cor,
      )}
    >
      {numero}
    </span>
  );
}

export function MiniaturaPlanta({
  urlPdf,
  titulo,
  pageNumber,
  marcadores,
}: {
  urlPdf: string;
  titulo: string;
  pageNumber: number;
  marcadores: MarcadorPlanta[];
}) {
  const envoltorioRef = useRef<HTMLDivElement>(null);
  const [dimensoes, setDimensoes] = useState<Dimensoes | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  const capturarCanvas = () => {
    const canvas = envoltorioRef.current?.querySelector("canvas");
    if (canvas && !imagemUrl) setImagemUrl(canvas.toDataURL("image/png"));
  };

  const pronto = imagemUrl !== null && dimensoes !== null;

  return (
    <figure className="quebra-evitar space-y-2">
      <figcaption className="text-sm font-semibold text-superficie-800">
        {titulo}
      </figcaption>

      <div className="rounded-lg border border-borda bg-superficie-50 p-2">
        {!pronto ? (
          <div ref={envoltorioRef}>
            {erro ? (
              <p className="p-6 text-center text-sm text-superficie-500">
                Não foi possível carregar a planta.
              </p>
            ) : (
              <Document
                file={urlPdf}
                onLoadError={() => setErro(true)}
                loading={
                  <div className="flex min-h-[220px] items-center justify-center">
                    <Spinner tamanho="md" />
                  </div>
                }
                error={
                  <p className="p-6 text-center text-sm text-superficie-500">
                    Não foi possível carregar a planta.
                  </p>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={640}
                  onLoadSuccess={(page) => {
                    const vp = page.getViewport({ scale: 1 });
                    setDimensoes({ largura: vp.width, altura: vp.height });
                  }}
                  onRenderSuccess={capturarCanvas}
                />
              </Document>
            )}
          </div>
        ) : null}

        {pronto && (
          <div className="relative w-full">
            <img
              src={imagemUrl}
              alt={titulo}
              className="w-full rounded border border-borda"
            />
            <div className="absolute inset-0">
              {marcadores
                .filter(
                  (m) =>
                    m.localizacao_tipo === "ponto" &&
                    m.ponto_x != null &&
                    m.ponto_y != null,
                )
                .map((m) => {
                  const pos = pdfParaPercentual(
                    { x: m.ponto_x!, y: m.ponto_y! },
                    dimensoes.largura,
                    dimensoes.altura,
                  );
                  const cor = SITUACAO_TAREFA[
                    situacaoDaTarefa({ status: m.status, aprovacao: m.aprovacao })
                  ].pino;
                  return (
                    <div
                      key={m.numero}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${pos.esquerda}%`, top: `${pos.topo}%` }}
                    >
                      <Numeracao numero={m.numero} cor={cor} />
                    </div>
                  );
                })}
              {marcadores
                .filter(
                  (m) => m.localizacao_tipo === "regiao" && m.regiao,
                )
                .map((m) => {
                  const limites = limitesDaRegiao(m.regiao!);
                  if (!limites) return null;
                  const canto1 = pdfParaPercentual(
                    { x: limites.x, y: limites.y },
                    dimensoes.largura,
                    dimensoes.altura,
                  );
                  const canto2 = pdfParaPercentual(
                    { x: limites.x + limites.largura, y: limites.y + limites.altura },
                    dimensoes.largura,
                    dimensoes.altura,
                  );
                  const cor = SITUACAO_TAREFA[
                    situacaoDaTarefa({ status: m.status, aprovacao: m.aprovacao })
                  ].regiao;
                  return (
                    <div
                      key={m.numero}
                      className={cn("absolute border-2", cor)}
                      style={{
                        left: `${Math.min(canto1.esquerda, canto2.esquerda)}%`,
                        top: `${Math.min(canto1.topo, canto2.topo)}%`,
                        width: `${Math.abs(canto2.esquerda - canto1.esquerda)}%`,
                        height: `${Math.abs(canto2.topo - canto1.topo)}%`,
                      }}
                    >
                      <span className="absolute -left-2 -top-2">
                        <Numeracao
                          numero={m.numero}
                          cor={
                            SITUACAO_TAREFA[
                              situacaoDaTarefa({
                                status: m.status,
                                aprovacao: m.aprovacao,
                              })
                            ].pino
                          }
                        />
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {marcadores.length > 0 && (
        <ol className="space-y-1 text-xs text-superficie-600">
          {marcadores.map((m) => {
            const sit = situacaoDaTarefa({
              status: m.status,
              aprovacao: m.aprovacao,
            });
            return (
              <li key={m.numero} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-superficie-300 text-[9px] font-bold text-white">
                  {m.numero}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-superficie-800">
                    {m.titulo}
                  </span>
                  <span className="ml-1 text-superficie-500">
                    · {SITUACAO_TAREFA[sit].rotulo}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
