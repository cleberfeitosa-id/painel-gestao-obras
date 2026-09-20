"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Ruler } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import {
  calcularCalibracao,
  calcularCalibracaoPorEscala,
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
    dados:
      | { metodo: "referencia"; distanciaReal: number; unidade: "m" | "cm" }
      | { metodo: "escala"; denominador: number; unidade: "m" | "cm" },
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
  const [denominador, setDenominador] = useState("");
  const [unidade, setUnidade] = useState<"m" | "cm">("m");
  const [metodo, setMetodo] = useState<"referencia" | "escala">("referencia");
  const [escalaAberta, setEscalaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modalAberto = pontos.length === 2 || escalaAberta;

  const distanciaEmPontosRef = pontos.length === 2 ? distanciaEmPontos(pontos[0], pontos[1]) : 0;
  const valorDistancia = Number(distancia.replace(",", "."));
  const valorDenominador = Number(denominador.replace(",", "."));
  const escalaPreview =
    pontos.length === 2 && Number.isFinite(valorDistancia) && valorDistancia > 0
      ? calcularCalibracao(pontos[0], pontos[1], valorDistancia)
      : null;
  const escalaInformadaPreview =
    metodo === "escala" && Number.isFinite(valorDenominador) && valorDenominador > 0
      ? calcularCalibracaoPorEscala(valorDenominador, unidade)
      : null;

  async function salvar() {
    if (metodo === "referencia" && (!Number.isFinite(valorDistancia) || valorDistancia <= 0)) {
      setErro("Informe uma distancia real valida e maior que zero.");
      return;
    }
    if (metodo === "escala" && (!Number.isFinite(valorDenominador) || valorDenominador <= 0)) {
      setErro("Informe um denominador de escala valido e maior que zero.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await aoSalvar(
        metodo === "referencia"
          ? { metodo, distanciaReal: valorDistancia, unidade }
          : { metodo, denominador: valorDenominador, unidade },
      );
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setDistancia("");
      setDenominador("");
      setEscalaAberta(false);
      setErro(null);
    } catch {
      setErro("Nao foi possivel salvar a calibracao. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    setDistancia("");
    setDenominador("");
    setEscalaAberta(false);
    setMetodo("referencia");
    setErro(null);
    setSalvando(false);
    aoCancelar();
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
            <div className="flex flex-wrap gap-2">
              <Botao variante="contorno" tamanho="sm" onClick={aoIniciar}>
                <Ruler className="h-4 w-4" />
                Recalibrar por pontos
              </Botao>
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  setMetodo("escala");
                  setEscalaAberta(true);
                }}
              >
                Recalibrar por escala
              </Botao>
            </div>
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
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" tamanho="sm" onClick={aoIniciar}>
                <Ruler className="h-4 w-4" />
                Calibrar por pontos
              </Botao>
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  setMetodo("escala");
                  setEscalaAberta(true);
                }}
              >
                Informar escala
              </Botao>
            </div>
          )}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={cancelar}
        titulo="Calibrar escala"
        descricao="Use uma distancia de referencia ou informe a escala nominal da planta."
        tamanho="sm"
      >
        <div key={modalAberto ? "aberto" : "fechado"} className="space-y-4">
          <div className="flex rounded-lg border border-borda p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-sm ${metodo === "referencia" ? "bg-azul-50 font-medium text-azul-700" : "text-superficie-600"}`}
              onClick={() => setMetodo("referencia")}
            >
              Dois pontos
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-sm ${metodo === "escala" ? "bg-azul-50 font-medium text-azul-700" : "text-superficie-600"}`}
              onClick={() => setMetodo("escala")}
            >
              Informar escala
            </button>
          </div>

          {metodo === "referencia" ? (
            <>
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
            </>
          ) : (
            <>
              <p className="text-sm text-superficie-600">
                A escala deve estar no formato <strong>1:50</strong>. Ela assume que o PDF preserva a escala nominal da planta.
              </p>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Campo
                  rotulo="Escala"
                  obrigatorio
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0.001"
                  placeholder="Ex.: 50"
                  value={denominador}
                  onChange={(e) => setDenominador(e.target.value)}
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
            </>
          )}

          {(metodo === "referencia" ? escalaPreview : escalaInformadaPreview) && (
            <p className="rounded-lg bg-superficie-50 px-3 py-2 text-xs text-superficie-600">
              Fator resultante: 1 ponto PDF ={" "}
              {formatarMedida((metodo === "referencia" ? escalaPreview : escalaInformadaPreview) ?? 0, unidade)}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
             <Botao variante="fantasma" onClick={cancelar} disabled={salvando}>
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
