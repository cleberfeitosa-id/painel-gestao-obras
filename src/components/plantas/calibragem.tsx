"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Ruler } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import {
  calcularCalibracao,
  distanciaEmPontos,
  formatarMedida,
} from "@/lib/pdf/coordenadas";
import type {
  PlantaCalibracaoRow,
  PontoPdf,
} from "@/lib/supabase/database.types";

interface CalibragemProps {
  calibracao: PlantaCalibracaoRow | null;
  pontos: PontoPdf[];
  podeEditar: boolean;
  aoIniciar: () => void;
  aoSalvar: (
    distanciaReal: number,
    unidade: "m" | "cm",
  ) => Promise<{ erro?: string }>;
  aoCancelar: () => void;
}

export function Calibragem({
  calibracao,
  pontos,
  podeEditar,
  aoIniciar,
  aoSalvar,
  aoCancelar,
}: CalibragemProps) {
  const [distancia, setDistancia] = useState("");
  const [unidade, setUnidade] = useState<"m" | "cm">("m");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modalAberto = pontos.length === 2;

  useEffect(() => {
    if (pontos.length === 2) {
      setDistancia("");
      setErro(null);
    }
  }, [pontos.length]);

  const distanciaEmPontosRef = pontos.length === 2 ? distanciaEmPontos(pontos[0], pontos[1]) : 0;
  const valorDistancia = Number(distancia.replace(",", "."));
  const escalaPreview =
    pontos.length === 2 && Number.isFinite(valorDistancia) && valorDistancia > 0
      ? calcularCalibracao(pontos[0], pontos[1], valorDistancia)
      : null;

  async function salvar() {
    if (!Number.isFinite(valorDistancia) || valorDistancia <= 0) {
      setErro("Informe uma distancia real valida e maior que zero.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const resultado = await aoSalvar(valorDistancia, unidade);
    if (resultado.erro) {
      setErro(resultado.erro);
      setSalvando(false);
    }
  }

  return (
    <>
      {calibracao ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-900">
              Pagina calibrada
            </p>
            <p className="text-xs text-emerald-700">
              Escala: 1 ponto ={" "}
              {formatarMedida(calibracao.unidades_por_ponto, calibracao.unidade)}{" "}
              · Referencia:{" "}
              {formatarMedida(calibracao.distancia_real, calibracao.unidade)}
            </p>
          </div>
          {podeEditar && (
            <Botao variante="contorno" tamanho="sm" onClick={aoIniciar}>
              <Ruler className="h-4 w-4" />
              Recalibrar
            </Botao>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              Pagina nao calibrada
            </p>
            <p className="text-xs text-amber-700">
              Calibre a escala para medir distancias e areas em metros.
            </p>
          </div>
          {podeEditar && (
            <Botao variante="secundario" tamanho="sm" onClick={aoIniciar}>
              <Ruler className="h-4 w-4" />
              Calibrar escala
            </Botao>
          )}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={aoCancelar}
        titulo="Calibrar escala"
        descricao="Informe a distancia real entre os dois pontos marcados na planta."
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-superficie-600">
            Distancia entre os pontos no PDF:{" "}
            <strong>{formatarMedida(distanciaEmPontosRef, "pt")}</strong>
          </p>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Campo
              rotulo="Distancia real"
              obrigatorio
              type="number"
              inputMode="decimal"
              step="any"
              min="0.001"
              placeholder="Ex.: 5,4"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              erro={erro ?? undefined}
            />
            <Selecao
              rotulo="Unidade"
              obrigatorio
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as "m" | "cm")}
            >
              <option value="m">Metros (m)</option>
              <option value="cm">Centimetros (cm)</option>
            </Selecao>
          </div>

          {escalaPreview && (
            <p className="rounded-lg bg-superficie-50 px-3 py-2 text-xs text-superficie-600">
              Escala resultante: 1 ponto ={" "}
              {formatarMedida(escalaPreview, unidade)}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Botao variante="fantasma" onClick={aoCancelar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={salvando}>
              Salvar calibracao
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}