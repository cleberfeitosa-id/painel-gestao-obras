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

// Constroi um corredor fino (poligono fechado) ao redor de uma polilinha em
// espaco do PDF: banco esquerdo para frente + banco direito invertido. Usado
// para visualizar tarefas de "distancia linear" como uma regiao estreita.
export function corredorDaPolilinha(
  pontos: PontoPdf[],
  espessura: number,
): PontoPdf[] {
  if (pontos.length < 2) return [];

  const metade = espessura / 2;
  const bancoEsquerdo: PontoPdf[] = [];
  const bancoDireito: PontoPdf[] = [];

  for (let i = 0; i < pontos.length; i += 1) {
    const anterior = pontos[Math.max(0, i - 1)];
    const atual = pontos[i];
    const proximo = pontos[Math.min(pontos.length - 1, i + 1)];

    let dx = proximo.x - anterior.x;
    let dy = proximo.y - anterior.y;
    let comp = Math.hypot(dx, dy);
    if (comp === 0) {
      dx = 0;
      dy = 1;
      comp = 1;
    }
    const nx = -dy / comp;
    const ny = dx / comp;

    bancoEsquerdo.push({ x: atual.x + nx * metade, y: atual.y + ny * metade });
    bancoDireito.push({ x: atual.x - nx * metade, y: atual.y - ny * metade });
  }

  return [...bancoEsquerdo, ...bancoDireito.reverse()];
}

export function deslocarPolilinha(
  pontos: PontoPdf[],
  offset: number,
): PontoPdf[] {
  if (pontos.length < 2 || offset === 0) return pontos;

  const resultado: PontoPdf[] = [];
  const n = pontos.length;
  const normals: { x: number; y: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = pontos[i + 1].x - pontos[i].x;
    const dy = pontos[i + 1].y - pontos[i].y;
    const len = Math.hypot(dx, dy) || 1;
    normals.push({ x: -dy / len, y: dx / len });
  }

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      resultado.push({
        x: pontos[0].x + normals[0].x * offset,
        y: pontos[0].y + normals[0].y * offset,
      });
    } else if (i === n - 1) {
      resultado.push({
        x: pontos[n - 1].x + normals[n - 2].x * offset,
        y: pontos[n - 1].y + normals[n - 2].y * offset,
      });
    } else {
      const n1 = normals[i - 1];
      const n2 = normals[i];
      let nx = (n1.x + n2.x) / 2;
      let ny = (n1.y + n2.y) / 2;
      const nlen = Math.hypot(nx, ny);
      let scale = 1;
      if (nlen < 0.001) {
        nx = n1.x;
        ny = n1.y;
      } else {
        nx /= nlen;
        ny /= nlen;
        const cosAngle = n1.x * nx + n1.y * ny;
        scale = Math.min(2.5, 1 / Math.max(0.4, cosAngle));
      }
      resultado.push({
        x: pontos[i].x + nx * offset * scale,
        y: pontos[i].y + ny * offset * scale,
      });
    }
  }

  return resultado;
}

export function faixasDePolilinhas(
  itens: { id: string; pontos: PontoPdf[] }[],
  espacamento: number,
): Map<string, number> {
  const grupos = new Map<string, { id: string; pontos: PontoPdf[] }[]>();
  for (const item of itens) {
    if (item.pontos.length < 2) continue;
    const chave = item.pontos.map((p) => `${Math.round(p.x / 4)}:${Math.round(p.y / 4)}`).join("|");
    const reversa = [...item.pontos].reverse().map((p) => `${Math.round(p.x / 4)}:${Math.round(p.y / 4)}`).join("|");
    const grupo = grupos.get(chave) ?? grupos.get(reversa) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  }
  const resultado = new Map<string, number>();
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.id.localeCompare(b.id));
    grupo.forEach((item, index) => resultado.set(item.id, (index - (grupo.length - 1) / 2) * espacamento));
  }
  return resultado;
}

function chaveSegmento(a: PontoPdf, b: PontoPdf): { chave: string; orientacao: number } {
  const qa = `${Math.round(a.x / 4)}:${Math.round(a.y / 4)}`;
  const qb = `${Math.round(b.x / 4)}:${Math.round(b.y / 4)}`;
  return qa <= qb
    ? { chave: `${qa}|${qb}`, orientacao: 1 }
    : { chave: `${qb}|${qa}`, orientacao: -1 };
}

export function faixasDeSegmentos(
  itens: { id: string; pontos: PontoPdf[] }[],
  espacamento: number,
): Map<string, number> {
  const grupos = new Map<string, { id: string; indice: number; orientacao: number }[]>();
  for (const item of itens) {
    for (let indice = 0; indice < item.pontos.length - 1; indice += 1) {
      const segmento = chaveSegmento(item.pontos[indice], item.pontos[indice + 1]);
      const grupo = grupos.get(segmento.chave) ?? [];
      grupo.push({ id: item.id, indice, orientacao: segmento.orientacao });
      grupos.set(segmento.chave, grupo);
    }
  }

  const resultado = new Map<string, number>();
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.id.localeCompare(b.id) || a.indice - b.indice);
    grupo.forEach((segmento, indice) => {
      resultado.set(`${segmento.id}:${segmento.indice}`, (indice - (grupo.length - 1) / 2) * espacamento * segmento.orientacao);
    });
  }
  return resultado;
}

export function polilinhaComFaixas(
  pontos: PontoPdf[],
  faixas: Map<string, number>,
  id: string,
): PontoPdf[] {
  if (pontos.length < 2) return pontos;
  const deslocados = pontos.map((ponto) => ({ x: ponto.x, y: ponto.y }));
  const extremidades = pontos.slice(0, -1).map((inicio, indice) => {
    const fim = pontos[indice + 1];
    const dx = fim.x - inicio.x;
    const dy = fim.y - inicio.y;
    const comprimento = Math.hypot(dx, dy) || 1;
    const offset = faixas.get(`${id}:${indice}`) ?? 0;
    const normal = { x: -dy / comprimento, y: dx / comprimento };
    return {
      inicio: { x: inicio.x + normal.x * offset, y: inicio.y + normal.y * offset },
      fim: { x: fim.x + normal.x * offset, y: fim.y + normal.y * offset },
    };
  });

  deslocados[0] = extremidades[0].inicio;
  deslocados[deslocados.length - 1] = extremidades[extremidades.length - 1].fim;
  for (let indice = 1; indice < deslocados.length - 1; indice += 1) {
    const entrada = extremidades[indice - 1].fim;
    const saida = extremidades[indice].inicio;
    const media = { x: (entrada.x + saida.x) / 2, y: (entrada.y + saida.y) / 2 };
    const distancia = Math.hypot(media.x - pontos[indice].x, media.y - pontos[indice].y);
    const limite = Math.max(1, Math.max(Math.abs(faixas.get(`${id}:${indice - 1}`) ?? 0), Math.abs(faixas.get(`${id}:${indice}`) ?? 0)) * 2.5);
    if (distancia > limite) {
      const fator = limite / distancia;
      deslocados[indice] = {
        x: pontos[indice].x + (media.x - pontos[indice].x) * fator,
        y: pontos[indice].y + (media.y - pontos[indice].y) * fator,
      };
    } else {
      deslocados[indice] = media;
    }
  }
  return deslocados;
}

export function distanciaPontoPolilinha(
  p: PontoPdf,
  pontos: PontoPdf[],
): number {
  if (pontos.length === 0) return Infinity;
  if (pontos.length === 1) return Math.hypot(p.x - pontos[0].x, p.y - pontos[0].y);

  let menorDist = Infinity;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const dist = Math.hypot(p.x - projX, p.y - projY);
    if (dist < menorDist) menorDist = dist;
  }
  return menorDist;
}
