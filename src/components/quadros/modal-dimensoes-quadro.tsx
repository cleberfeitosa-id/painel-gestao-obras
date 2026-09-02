"use client";

import { useState, useEffect } from "react";
import { Modal, Botao } from "@/components/ui";

interface ModalDimensoesQuadroProps {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dimensoes: {
    larguraMm: number;
    alturaMm: number;
    profundidadeMm: number;
    larguraUtilMm: number;
    alturaUtilMm: number;
    margemLateralMm: number;
    margemTopoMm: number;
  }) => void;
  valoresIniciais: {
    larguraMm: number;
    alturaMm: number;
    profundidadeMm: number;
    larguraUtilMm: number;
    alturaUtilMm: number;
    margemLateralMm: number;
    margemTopoMm: number;
  };
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
  const [margemLateralMm, setMargemLateralMm] = useState(valoresIniciais.margemLateralMm);
  const [margemTopoMm, setMargemTopoMm] = useState(valoresIniciais.margemTopoMm);

  const larguraUtilCalculada = Math.max(100, larguraMm - margemLateralMm * 2);
  const alturaUtilCalculada = Math.max(100, alturaMm - margemTopoMm * 2);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    aoSalvar({
      larguraMm,
      alturaMm,
      profundidadeMm,
      larguraUtilMm: larguraUtilCalculada,
      alturaUtilMm: alturaUtilCalculada,
      margemLateralMm,
      margemTopoMm,
    });
    aoFechar();
  }

  return (
    <Modal
      aberto={true}
      aoFechar={aoFechar}
      titulo="Dimensões e Área Útil do Quadro"
      descricao="Configure as dimensões externas e a chapa metálica de montagem interna que delimita a área útil."
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
              min={200}
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
              min={200}
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
              min={100}
              max={1000}
              step={10}
              required
              value={profundidadeMm}
              onChange={(e) => setProfundidadeMm(Number(e.target.value))}
              className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
            />
          </div>
        </div>

        <div className="rounded-lg bg-superficie-50 p-3 border border-borda space-y-3">
          <p className="text-xs font-semibold text-superficie-800 uppercase tracking-wider">
            Delimitação da Chapa Metálica Interna (Área Útil)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-superficie-700 mb-1">
                Margem Lateral (mm)
              </label>
              <input
                type="number"
                min={0}
                max={200}
                step={5}
                required
                value={margemLateralMm}
                onChange={(e) => setMargemLateralMm(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-superficie-700 mb-1">
                Margem Topo/Base (mm)
              </label>
              <input
                type="number"
                min={0}
                max={200}
                step={5}
                required
                value={margemTopoMm}
                onChange={(e) => setMargemTopoMm(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-borda text-xs text-superficie-600">
            <span>Área Útil Calculada:</span>
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
