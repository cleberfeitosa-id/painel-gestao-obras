"use client";

import { useState } from "react";
import { Modal, Botao } from "@/components/ui";

export interface DimensoesQuadroConfig {
  larguraMm: number;
  alturaMm: number;
  profundidadeMm: number;
  larguraUtilMm: number;
  alturaUtilMm: number;
  margemLateralMm: number;
  margemTopoMm: number;
  margemBaseMm?: number;
  margemDireitaMm?: number;
}

interface ModalDimensoesQuadroProps {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dimensoes: DimensoesQuadroConfig) => void;
  valoresIniciais: DimensoesQuadroConfig;
}

export function ModalDimensoesQuadro({
  aberto,
  aoFechar,
  aoSalvar,
  valoresIniciais,
}: ModalDimensoesQuadroProps) {
  if (!aberto) return null;

  return (
    <ModalDimensoesConteudo
      aoFechar={aoFechar}
      aoSalvar={aoSalvar}
      valoresIniciais={valoresIniciais}
    />
  );
}

function ModalDimensoesConteudo({
  aoFechar,
  aoSalvar,
  valoresIniciais,
}: Omit<ModalDimensoesQuadroProps, "aberto">) {
  const [larguraMm, setLarguraMm] = useState(valoresIniciais.larguraMm);
  const [alturaMm, setAlturaMm] = useState(valoresIniciais.alturaMm);
  const [profundidadeMm, setProfundidadeMm] = useState(valoresIniciais.profundidadeMm);

  const [margemTopoMm, setMargemTopoMm] = useState(valoresIniciais.margemTopoMm ?? 30);
  const [margemBaseMm, setMargemBaseMm] = useState(
    valoresIniciais.margemBaseMm ?? valoresIniciais.margemTopoMm ?? 30,
  );
  const [margemEsquerdaMm, setMargemEsquerdaMm] = useState(
    valoresIniciais.margemLateralMm ?? 30,
  );
  const [margemDireitaMm, setMargemDireitaMm] = useState(
    valoresIniciais.margemDireitaMm ?? valoresIniciais.margemLateralMm ?? 30,
  );
  const [margensIguais, setMargensIguais] = useState(
    (valoresIniciais.margemTopoMm ?? 30) === (valoresIniciais.margemLateralMm ?? 30) &&
      (valoresIniciais.margemBaseMm ?? valoresIniciais.margemTopoMm ?? 30) ===
        (valoresIniciais.margemDireitaMm ?? valoresIniciais.margemLateralMm ?? 30),
  );

  function atualizarMargemGeral(val: number) {
    setMargemTopoMm(val);
    setMargemBaseMm(val);
    setMargemEsquerdaMm(val);
    setMargemDireitaMm(val);
  }

  const larguraUtilCalculada = Math.max(
    100,
    larguraMm - margemEsquerdaMm - margemDireitaMm,
  );
  const alturaUtilCalculada = Math.max(
    100,
    alturaMm - margemTopoMm - margemBaseMm,
  );

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    aoSalvar({
      larguraMm,
      alturaMm,
      profundidadeMm,
      larguraUtilMm: larguraUtilCalculada,
      alturaUtilMm: alturaUtilCalculada,
      margemLateralMm: margemEsquerdaMm,
      margemTopoMm,
      margemBaseMm,
      margemDireitaMm,
    });
    aoFechar();
  }

  return (
    <Modal
      aberto={true}
      aoFechar={aoFechar}
      titulo="Dimensões e Margens do Quadro"
      descricao="Configure as dimensões do invólucro e as 4 margens (topo, base, esquerda e direita) da chapa útil de montagem."
      tamanho="lg"
    >
      <form onSubmit={submeter} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-superficie-700 mb-1">
              Largura Total (mm)
            </label>
            <input
              type="number"
              min={150}
              max={3000}
              step={10}
              required
              value={larguraMm}
              onChange={(e) => setLarguraMm(Number(e.target.value))}
              className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-superficie-700 mb-1">
              Altura Total (mm)
            </label>
            <input
              type="number"
              min={150}
              max={3000}
              step={10}
              required
              value={alturaMm}
              onChange={(e) => setAlturaMm(Number(e.target.value))}
              className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-superficie-700 mb-1">
              Profundidade (mm)
            </label>
            <input
              type="number"
              min={80}
              max={1200}
              step={10}
              required
              value={profundidadeMm}
              onChange={(e) => setProfundidadeMm(Number(e.target.value))}
              className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
            />
          </div>
        </div>

        <div className="rounded-xl bg-superficie-50 p-3.5 border border-borda space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-superficie-800 uppercase tracking-wider">
              Margens da Chapa Útil (4 Extremidades)
            </p>
            <label className="flex items-center gap-1.5 text-xs text-superficie-600 cursor-pointer">
              <input
                type="checkbox"
                checked={margensIguais}
                onChange={(e) => {
                  const check = e.target.checked;
                  setMargensIguais(check);
                  if (check) {
                    atualizarMargemGeral(margemTopoMm);
                  }
                }}
                className="rounded border-borda text-azul-600 focus:ring-azul-500"
              />
              <span>Margens simétricas iguais</span>
            </label>
          </div>

          {margensIguais ? (
            <div>
              <label className="block text-xs font-medium text-superficie-700 mb-1">
                Recuo das 4 Extremidades (Topo, Base, Esquerda e Direita em mm)
              </label>
              <input
                type="number"
                min={0}
                max={250}
                step={5}
                required
                value={margemTopoMm}
                onChange={(e) => atualizarMargemGeral(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Topo / Superior (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={5}
                  required
                  value={margemTopoMm}
                  onChange={(e) => setMargemTopoMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Base / Inferior (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={5}
                  required
                  value={margemBaseMm}
                  onChange={(e) => setMargemBaseMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Lateral Esquerda (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={5}
                  required
                  value={margemEsquerdaMm}
                  onChange={(e) => setMargemEsquerdaMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Lateral Direita (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={5}
                  required
                  value={margemDireitaMm}
                  onChange={(e) => setMargemDireitaMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-borda text-xs text-superficie-600">
            <span>Área Útil da Chapa Resultante:</span>
            <span className="font-bold text-superficie-900">
              {larguraUtilCalculada} mm (L) × {alturaUtilCalculada} mm (A)
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario">
            Aplicar Dimensões
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
