"use client";

import { useMemo } from "react";
import { deslocarPolilinha, faixasDeSegmentos, pdfParaPercentual, polilinhaComFaixas } from "@/lib/pdf/coordenadas";
import { obterCondutoresVisuais, rotuloCondutor } from "@/lib/levantamento/calculos";
import type { ItemLevantamento } from "@/lib/levantamento/tipos";

interface PreviaCircuitos2DProps {
  itens: ItemLevantamento[];
  largura: number;
  altura: number;
  escala: number;
  espessura: number;
  mostrarCondutores: boolean;
}

function caminho(pontos: { x: number; y: number }[], largura: number, altura: number, escala: number) {
  return pontos.map((p, index) => {
    const pct = pdfParaPercentual(p, largura, altura);
    const x = (pct.esquerda / 100) * largura * escala;
    const y = (pct.topo / 100) * altura * escala;
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

export function PreviaCircuitos2D({ itens, largura, altura, escala, espessura, mostrarCondutores }: PreviaCircuitos2DProps) {
  const circuitos = useMemo(() => itens.filter((item) => item.tipo === "tubulacao_cabo" && item.pontos.length >= 2), [itens]);
  const faixas = useMemo(() => faixasDeSegmentos(circuitos, Math.max(5, espessura * 4)), [circuitos, espessura]);
  const larguraSvg = largura * escala;
  const alturaSvg = altura * escala;

  return (
    <svg className="pointer-events-none absolute inset-0 z-[11] w-full h-full" viewBox={`0 0 ${larguraSvg} ${alturaSvg}`} preserveAspectRatio="none" aria-label="Prévia realista dos circuitos">
      {circuitos.map((item) => {
        const meta = item.metadadosCabo;
        const pontos = item.pontos;
        const pontosComFaixa = polilinhaComFaixas(pontos, faixas, item.id);
        const base = caminho(pontosComFaixa, largura, altura, escala);
        if (!meta || !mostrarCondutores) {
          return <path key={item.id} d={base} fill="none" stroke={item.cor} strokeWidth={espessura * 1.6} strokeOpacity={0.82} strokeLinecap="round" strokeLinejoin="round" />;
        }
        const condutores = obterCondutoresVisuais(meta);
        const gap = Math.max(1.5, espessura * 1.35);
        return (
          <g key={item.id}>
            <path d={base} fill="none" stroke={meta.cor || item.cor} strokeWidth={Math.max(8, espessura * 5)} strokeOpacity={0.3} strokeLinecap="round" strokeLinejoin="round" />
            {condutores.map((condutor, index) => {
              const deslocamento = (index - (condutores.length - 1) / 2) * gap;
              const pontosDeslocados = deslocarPolilinha(pontosComFaixa, deslocamento);
              const d = caminho(pontosDeslocados, largura, altura, escala);
              const cor = condutor.corCabo || item.cor;
              const contraste = cor.toUpperCase() === "#FFFFFF" || cor.toUpperCase() === "#FFF";
              return (
                <g key={`${item.id}-${condutor.funcao}-${condutor.fase ?? ""}-${index}`}>
                  {contraste && <path d={d} fill="none" stroke="#0f172a" strokeWidth={espessura + 2} strokeOpacity={0.72} strokeLinecap="round" />}
                  <path d={d} fill="none" stroke={cor} strokeWidth={espessura} strokeDasharray={condutor.funcao === "neutro" ? "8,4" : condutor.funcao === "terra" ? "3,3" : condutor.funcao === "retorno" ? "6,3" : undefined} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                    <title>{`${rotuloCondutor(condutor.funcao)}${condutor.fase ? ` ${condutor.fase}` : ""}`}</title>
                  </path>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
