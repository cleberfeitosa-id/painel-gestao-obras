import type { PontoPdf, RegiaoPdf } from "@/lib/supabase/database.types";

export type Calibracao = {
  unidadesPorPonto: number;
  unidade: string;
};

export type Retangulo = { x: number; y: number; largura: number; altura: number };

// Coordenadas sao SEMPRE persistidas em espaco do PDF (pontos, origem inferior
// esquerda, Y para cima). Isso as torna independentes de zoom, DPI e tamanho da
// janela — o mesmo pino cai no mesmo lugar em qualquer tela.
export function telaParaPdf(
  clienteX: number,
  clienteY: number,
  areaCanvas: DOMRect,
  larguraPagina: number,
  alturaPagina: number,
): PontoPdf {
  const proporcaoX = (clienteX - areaCanvas.left) / areaCanvas.width;
  const proporcaoY = (clienteY - areaCanvas.top) / areaCanvas.height;

  return {
    x: proporcaoX * larguraPagina,
    y: (1 - proporcaoY) * alturaPagina,
  };
}

export function pdfParaPercentual(
  ponto: PontoPdf,
  larguraPagina: number,
  alturaPagina: number,
): { esquerda: number; topo: number } {
  return {
    esquerda: (ponto.x / larguraPagina) * 100,
    topo: (1 - ponto.y / alturaPagina) * 100,
  };
}

export function distanciaEmPontos(p1: PontoPdf, p2: PontoPdf): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function calcularCalibracao(
  p1: PontoPdf,
  p2: PontoPdf,
  distanciaReal: number,
): number {
  const pontos = distanciaEmPontos(p1, p2);
  if (pontos <= 0) {
    throw new Error("Os dois pontos de calibragem precisam ser distintos.");
  }
  return distanciaReal / pontos;
}

export function medirDistancia(
  p1: PontoPdf,
  p2: PontoPdf,
  calibracao: Calibracao,
): number {
  return distanciaEmPontos(p1, p2) * calibracao.unidadesPorPonto;
}

// Formula do cadarco (shoelace). A area escala com o QUADRADO do fator linear.
export function medirArea(
  vertices: PontoPdf[],
  calibracao: Calibracao,
): number {
  if (vertices.length < 3) return 0;

  let soma = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length;
    soma += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }

  return (Math.abs(soma) / 2) * calibracao.unidadesPorPonto ** 2;
}

export function medirPerimetro(
  vertices: PontoPdf[],
  calibracao: Calibracao,
): number {
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length;
    total += distanciaEmPontos(vertices[i], vertices[j]);
  }
  return total * calibracao.unidadesPorPonto;
}

export function limitesDaRegiao(regiao: RegiaoPdf): Retangulo | null {
  if (!regiao.vertices.length) return null;

  const xs = regiao.vertices.map((v) => v.x);
  const ys = regiao.vertices.map((v) => v.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x,
    y,
    largura: Math.max(...xs) - x,
    altura: Math.max(...ys) - y,
  };
}

export function centroDaRegiao(regiao: RegiaoPdf): PontoPdf | null {
  const limites = limitesDaRegiao(regiao);
  if (!limites) return null;
  return {
    x: limites.x + limites.largura / 2,
    y: limites.y + limites.altura / 2,
  };
}

export function retanguloParaRegiao(
  inicio: PontoPdf,
  fim: PontoPdf,
): RegiaoPdf {
  return {
    vertices: [
      { x: inicio.x, y: inicio.y },
      { x: fim.x, y: inicio.y },
      { x: fim.x, y: fim.y },
      { x: inicio.x, y: fim.y },
    ],
  };
}

export function pontoEmRegiao(
  ponto: PontoPdf,
  regiao: RegiaoPdf,
  margem = 0,
): boolean {
  const limites = limitesDaRegiao(regiao);
  if (!limites) return false;
  return (
    ponto.x >= limites.x - margem &&
    ponto.x <= limites.x + limites.largura + margem &&
    ponto.y >= limites.y - margem &&
    ponto.y <= limites.y + limites.altura + margem
  );
}

export function formatarMedida(valor: number, unidade: string, casas = 2) {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} ${unidade}`;
}

export type Canto = "nw" | "ne" | "sw" | "se";
export const CANTOS: Canto[] = ["nw", "ne", "sw", "se"];

export function cantoParaPonto(limites: Retangulo, canto: Canto): PontoPdf {
  switch (canto) {
    case "nw":
      return { x: limites.x, y: limites.y + limites.altura };
    case "ne":
      return { x: limites.x + limites.largura, y: limites.y + limites.altura };
    case "sw":
      return { x: limites.x, y: limites.y };
    case "se":
      return { x: limites.x + limites.largura, y: limites.y };
  }
}

export function regiaoComCanto(
  regiao: RegiaoPdf,
  canto: Canto,
  novo: PontoPdf,
): RegiaoPdf {
  const limites = limitesDaRegiao(regiao);
  if (!limites) return regiao;
  let x1 = limites.x;
  let x2 = limites.x + limites.largura;
  let y1 = limites.y;
  let y2 = limites.y + limites.altura;
  if (canto === "nw" || canto === "ne") y2 = novo.y;
  if (canto === "sw" || canto === "se") y1 = novo.y;
  if (canto === "nw" || canto === "sw") x1 = novo.x;
  if (canto === "ne" || canto === "se") x2 = novo.x;
  const ax = Math.min(x1, x2);
  const bx = Math.max(x1, x2);
  const ay = Math.min(y1, y2);
  const by = Math.max(y1, y2);
  return retanguloParaRegiao({ x: ax, y: ay }, { x: bx, y: by });
}

export function moverRegiao(
  regiao: RegiaoPdf,
  deltaX: number,
  deltaY: number,
): RegiaoPdf {
  return {
    vertices: regiao.vertices.map((v) => ({
      x: v.x + deltaX,
      y: v.y + deltaY,
    })),
  };
}
