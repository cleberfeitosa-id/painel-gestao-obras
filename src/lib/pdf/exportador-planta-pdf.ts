"use client";

import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import {
  corredorDaPolilinha,
  deslocarPolilinha,
  limitesDaRegiao,
  pdfParaPercentual,
} from "@/lib/pdf/coordenadas";
import {
  situacaoDaTarefa,
  SITUACAO_TAREFA,
} from "@/lib/domain/rotulos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { formatarMoeda } from "@/lib/utils";
import type { TarefaExportacaoCompleta } from "@/app/(protegido)/obras/[id]/plantas/acoes";
import type {
  ItemLevantamento,
  ResumoLevantamento,
} from "@/lib/levantamento/tipos";
import type {
  FiguraPlanta,
  TarefaRelatorio,
} from "@/components/relatorios/documento-relatorio";

export type TamanhoFolhaPdf = "A0" | "A1" | "A2" | "A3";

export interface OpcoesExportacaoPlanta {
  tamanhoFolha: TamanhoFolhaPdf;
  incluirDetalhamentoTarefas: boolean;
  incluirZoomPlanta: boolean;
  incluirFotosAnexos: boolean;
  incluirItensMedicao: boolean;
  incluirValoresFinanceiros: boolean;
  qualidadeImagens: "otimizada" | "alta";
  tarefaIdsFiltro?: string[];
  aoProgresso?: (etapa: string, percentual: number) => void;
}

export const OPCOES_EXPORTACAO_PADRAO: OpcoesExportacaoPlanta = {
  tamanhoFolha: "A0",
  incluirDetalhamentoTarefas: true,
  incluirZoomPlanta: true,
  incluirFotosAnexos: true,
  incluirItensMedicao: true,
  incluirValoresFinanceiros: false,
  qualidadeImagens: "otimizada",
};

const DIMENSOES_FOLHA_PT: Record<TamanhoFolhaPdf, { largura: number; altura: number }> = {
  A0: { largura: 3370.39, altura: 2383.94 },
  A1: { largura: 2383.94, altura: 1683.78 },
  A2: { largura: 1683.78, altura: 1190.55 },
  A3: { largura: 1190.55, altura: 841.89 },
};

const DIMENSOES_A4_PT = { largura: 595.28, altura: 841.89 };

const CORES_STATUS_HEX: Record<string, string> = {
  pendente: "#94a3b8",
  em_execucao: "#f59e0b",
  concluido: "#10b981",
  aprovado: "#10b981",
  reprovado: "#ef4444",
};

function hexParaRgba(hex: string, alfa = 1): string {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((ch) => ch + ch).join("");
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

function desenharRetanguloArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  altura: number,
  raio: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + largura - raio, y);
  ctx.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  ctx.lineTo(x + largura, y + altura - raio);
  ctx.quadraticCurveTo(x + largura, y + altura, x + largura - raio, y + altura);
  ctx.lineTo(x + raio, y + altura);
  ctx.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  ctx.lineTo(x, y + raio);
  ctx.quadraticCurveTo(x, y, x + raio, y);
  ctx.closePath();
}

function quebrarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
): string[] {
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let linhaAtual = "";

  for (const palavra of palavras) {
    const teste = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > larguraMax && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = teste;
    }
  }
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

async function carregarElementoImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const fallbackImg = new Image();
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => resolve(null);
          fallbackImg.src = blobUrl;
        })
        .catch(() => resolve(null));
    };
    img.src = url;
  });
}

async function renderizarPaginaPdfEmCanvas(
  urlPdf: string,
  numeroPagina: number,
  larguraMinima = 3200,
): Promise<{
  canvas: HTMLCanvasElement;
  dimensoesPdf: { largura: number; altura: number };
}> {
  const { pdfjs } = await import("@/components/plantas/pdfjs");
  const loadingTask = pdfjs.getDocument(urlPdf);
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(numeroPagina);
  const unscaledVp = page.getViewport({ scale: 1.0 });

  const escala = Math.max(1.5, Math.min(3.5, larguraMinima / unscaledVp.width));
  const viewport = page.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Não foi possível criar contexto 2D para renderização do PDF.");

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  return {
    canvas,
    dimensoesPdf: { largura: unscaledVp.width, altura: unscaledVp.height },
  };
}

  const comprimirImagem = async (
  url: string,
  maxDimensao = 1200,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; nome: string } | null> => {
  try {
    const img = await carregarElementoImagem(url);
    if (!img || img.naturalWidth === 0) return null;

    const naturalAspect = img.naturalWidth / img.naturalHeight;
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    if (width > maxDimensao || height > maxDimensao) {
      if (naturalAspect > 1) {
        width = maxDimensao;
        height = Math.round(maxDimensao / naturalAspect);
      } else {
        height = maxDimensao;
        width = Math.round(maxDimensao * naturalAspect);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, width, height, nome: "" };
  } catch {
    return null;
  }
};

// 1. Corrigir proporção no zoom (Crop Canvas)
function extrairRecortePlantaCanvas(
  baseCanvas: HTMLCanvasElement,
  centroPct: { xPct: number; yPct: number },
  limitesPct?: { minX: number; minY: number; maxX: number; maxY: number },
  corDestaque = "#2563eb",
  numeroMarcador = 1,
): HTMLCanvasElement | null {
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = 800;
  cropCanvas.height = 600;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 800, 600);

  const cx = (centroPct.xPct / 100) * baseCanvas.width;
  const cy = (centroPct.yPct / 100) * baseCanvas.height;

  let srcW = baseCanvas.width * 0.15;
  let srcH = baseCanvas.height * 0.15;

  if (limitesPct) {
    const regW = ((limitesPct.maxX - limitesPct.minX) / 100) * baseCanvas.width;
    const regH = ((limitesPct.maxY - limitesPct.minY) / 100) * baseCanvas.height;
    srcW = Math.max(baseCanvas.width * 0.1, regW * 1.2);
    srcH = Math.max(baseCanvas.height * 0.1, regH * 1.2);
  }

  const targetAspect = 800 / 600;
  if (srcW / srcH !== targetAspect) {
    if (srcW / srcH > targetAspect) {
      srcH = srcW / targetAspect;
    } else {
      srcW = srcH * targetAspect;
    }
  }

  if (srcW > baseCanvas.width) {
    srcW = baseCanvas.width;
    srcH = srcW / targetAspect;
  }
  if (srcH > baseCanvas.height) {
    srcH = baseCanvas.height;
    srcW = srcH * targetAspect;
  }

  const srcX = Math.max(0, Math.min(baseCanvas.width - srcW, cx - srcW / 2));
  const srcY = Math.max(0, Math.min(baseCanvas.height - srcH, cy - srcH / 2));

  const destAspect = 800 / 600;
  const srcAspect = srcW / srcH;
  
  let dW, dH, dX, dY;
  
  if (srcAspect > destAspect) {
    dW = 800;
    dH = 800 / srcAspect;
    dX = 0;
    dY = (600 - dH) / 2;
  } else {
    dH = 600;
    dW = 600 * srcAspect;
    dX = (800 - dW) / 2;
    dY = 0;
  }
  
  ctx.drawImage(baseCanvas, srcX, srcY, srcW, srcH, dX, dY, dW, dH);

  const destCenterX = ((cx - srcX) / srcW) * 800;
  const destCenterY = ((cy - srcY) / srcH) * 600;

  if (limitesPct) {
    const rMinX = (((limitesPct.minX / 100) * baseCanvas.width - srcX) / srcW) * 800;
    const rMaxX = (((limitesPct.maxX / 100) * baseCanvas.width - srcX) / srcW) * 800;
    const rMinY = (((limitesPct.minY / 100) * baseCanvas.height - srcY) / srcH) * 600;
    const rMaxY = (((limitesPct.maxY / 100) * baseCanvas.height - srcY) / srcH) * 600;

    ctx.fillStyle = hexParaRgba(corDestaque, 0.25);
    ctx.fillRect(rMinX, rMinY, rMaxX - rMinX, rMaxY - rMinY);

    ctx.strokeStyle = corDestaque;
    ctx.lineWidth = 4;
    ctx.strokeRect(rMinX, rMinY, rMaxX - rMinX, rMaxY - rMinY);
  }

  ctx.beginPath();
  ctx.arc(destCenterX, destCenterY, 36, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(destCenterX, destCenterY, 26, 0, Math.PI * 2);
  ctx.fillStyle = corDestaque;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(numeroMarcador), destCenterX, destCenterY);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 1000, 680);

  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  desenharRetanguloArredondado(ctx, 16, 16, 200, 36, 6);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("PLANTA (ZOOM)", 28, 34);

  return cropCanvas;
}

interface ItemPreparadoTarefa {
  tarefa: TarefaExportacaoCompleta;
  obraNome: string;
  plantaNome: string;
  cropCanvas: HTMLCanvasElement | null;
  fotosCanvases: HTMLCanvasElement[];
  alturaCalculada: number;
}

function calcularAlturaCartao(
  t: TarefaExportacaoCompleta,
  temCrop: boolean,
  qtdFotos: number,
  opcoes: OpcoesExportacaoPlanta,
): number {
  let alt = 130;

  const totalImagens = (temCrop ? 1 : 0) + qtdFotos;
  if (totalImagens > 0) {
    if (totalImagens <= 3) {
      alt += 320;
    } else {
      alt += 560;
    }
  }

  if (opcoes.incluirItensMedicao && t.medicoes.length > 0) {
    alt += 45 + Math.min(3, t.medicoes.length) * 32;
    if (opcoes.incluirValoresFinanceiros) alt += 36;
  } else if (t.descricao) {
    alt += 90;
  }

  alt += 35;
  return alt;
}

function renderizarCartaoTarefaGrade(
  ctx: CanvasRenderingContext2D,
  item: ItemPreparadoTarefa,
  x: number,
  y: number,
  largura: number,
  altura: number,
  opcoes: OpcoesExportacaoPlanta,
) {
  const { tarefa, obraNome, plantaNome, cropCanvas, fotosCanvases } = item;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  desenharRetanguloArredondado(ctx, x, y, largura, altura, 12);
  ctx.fill();
  ctx.stroke();

  const corStatus = CORES_STATUS_HEX[tarefa.status] ?? "#2563eb";
  const sit = situacaoDaTarefa({ status: tarefa.status, aprovacao: tarefa.aprovacao });
  const rotuloSit = SITUACAO_TAREFA[sit].rotulo;

  ctx.fillStyle = corStatus;
  desenharRetanguloArredondado(ctx, x + 16, y + 16, 44, 36, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(tarefa.numero), x + 38, y + 34);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const linhasTitulo = quebrarTexto(ctx, tarefa.titulo, largura - 280);
  ctx.fillText(linhasTitulo[0] ?? tarefa.titulo, x + 72, y + 34);

  ctx.fillStyle = hexParaRgba(corStatus, 0.15);
  ctx.strokeStyle = corStatus;
  ctx.lineWidth = 1.5;
  desenharRetanguloArredondado(ctx, x + largura - 160, y + 16, 144, 36, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = corStatus;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rotuloSit.toUpperCase(), x + largura - 88, y + 34);

  ctx.fillStyle = "#64748b";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Obra: ${obraNome} · Planta: ${plantaNome} (Pág. ${tarefa.pagina})`, x + 18, y + 74);
  ctx.fillText(`Resp: ${tarefa.responsavel_nome ?? "—"} · Prazo: ${tarefa.prazo ? formatarData(tarefa.prazo) : "Sem prazo"} · Prioridade: ${tarefa.prioridade.toUpperCase()}`, x + 18, y + 100);

  let yAtual = y + 124;

  const todasImagensParaExibir: { canvas: HTMLCanvasElement; rotulo: string }[] = [];
  if (cropCanvas) {
    todasImagensParaExibir.push({ canvas: cropCanvas, rotulo: "Planta (Zoom)" });
  }
  fotosCanvases.forEach((fc, idx) => {
    todasImagensParaExibir.push({ canvas: fc, rotulo: `Evidência ${idx + 1}` });
  });

  if (todasImagensParaExibir.length > 0) {
    const qtdImgs = todasImagensParaExibir.length;

    if (qtdImgs <= 3) {
      const hImg = 300;
      const gapImg = 16;
      const wImg = (largura - 36 - (qtdImgs - 1) * gapImg) / qtdImgs;

      todasImagensParaExibir.forEach((imgObj, i) => {
        const xImg = x + 18 + i * (wImg + gapImg);
        ctx.drawImage(imgObj.canvas, xImg, yAtual, wImg, hImg);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(xImg, yAtual, wImg, hImg);

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillRect(xImg, yAtual + hImg - 28, wImg, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(imgObj.rotulo, xImg + wImg / 2, yAtual + hImg - 10);
      });

      yAtual += hImg + 20;
    } else {
      const hImg = 250;
      const colunas = 2;
      const wImg = (largura - 36 - 16) / colunas;

      todasImagensParaExibir.slice(0, 4).forEach((imgObj, i) => {
        const cIdx = i % colunas;
        const rIdx = Math.floor(i / colunas);
        const xImg = x + 18 + cIdx * (wImg + 16);
        const yImgPos = yAtual + rIdx * (hImg + 14);

        ctx.drawImage(imgObj.canvas, xImg, yImgPos, wImg, hImg);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(xImg, yImgPos, wImg, hImg);

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillRect(xImg, yImgPos + hImg - 28, wImg, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(imgObj.rotulo, xImg + wImg / 2, yImgPos + hImg - 10);
      });

      yAtual += 2 * (hImg + 14) + 10;
    }
  }

  if (opcoes.incluirItensMedicao && tarefa.medicoes.length > 0) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x + 18, yAtual, largura - 36, 32);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ITEM DE MEDIÇÃO", x + 28, yAtual + 21);
    ctx.fillText("QUANTIDADE", x + largura - 220, yAtual + 21);
    if (opcoes.incluirValoresFinanceiros) {
      ctx.fillText("TOTAL", x + largura - 100, yAtual + 21);
    }
    yAtual += 32;

    tarefa.medicoes.slice(0, 3).forEach((m, mIdx) => {
      ctx.fillStyle = mIdx % 2 === 0 ? "#f8fafc" : "#ffffff";
      ctx.fillRect(x + 18, yAtual, largura - 36, 28);

      ctx.fillStyle = "#0f172a";
      ctx.font = "15px sans-serif";
      ctx.fillText(m.nome.substring(0, 32), x + 28, yAtual + 19);
      ctx.fillText(`${m.quantidade} ${m.unidade}`, x + largura - 220, yAtual + 19);

      if (opcoes.incluirValoresFinanceiros) {
        ctx.fillText(formatarMoeda(m.valor_total_tarefa), x + largura - 100, yAtual + 19);
      }
      yAtual += 28;
    });

    if (opcoes.incluirValoresFinanceiros) {
      const somaTarefa = tarefa.medicoes.reduce((acc, med) => acc + med.valor_total_tarefa, 0);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(x + 18, yAtual, largura - 36, 30);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("Subtotal da Tarefa:", x + 28, yAtual + 20);
      ctx.fillText(formatarMoeda(somaTarefa), x + largura - 100, yAtual + 20);
      yAtual += 36;
    }
  } else if (tarefa.descricao) {
    ctx.fillStyle = "#475569";
    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";
    const linhas = quebrarTexto(ctx, tarefa.descricao, largura - 40);
    linhas.slice(0, 3).forEach((lin) => {
      ctx.fillText(lin, x + 18, yAtual + 18);
      yAtual += 24;
    });
  }

  ctx.fillStyle = "#2563eb";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("← Ver na Prancha", x + largura - 18, y + altura - 18);
}

function gerarPaginaGradeDinamicaCanvas(
  coluna1: { item: ItemPreparadoTarefa; y: number }[],
  coluna2: { item: ItemPreparadoTarefa; y: number }[],
  numeroPaginaDoc: number,
  totalPaginasDoc: number,
  tituloDocumento: string,
  opcoes: OpcoesExportacaoPlanta,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 2480;
  canvas.height = 3508;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 2480, 3508);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 2480, 140);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("VASCONCELOS ENGENHARIA", 60, 70);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${tituloDocumento.toUpperCase()} · FICHAS TÉCNICAS (PÁGINA ${numeroPaginaDoc}/${totalPaginasDoc})`, 2420, 70);

  const cardW = 1140;
  const col1X = 60;
  const col2X = 1260;

  coluna1.forEach((entry) => {
    renderizarCartaoTarefaGrade(
      ctx,
      entry.item,
      col1X,
      entry.y,
      cardW,
      entry.item.alturaCalculada,
      opcoes,
    );
  });

  coluna2.forEach((entry) => {
    renderizarCartaoTarefaGrade(
      ctx,
      entry.item,
      col2X,
      entry.y,
      cardW,
      entry.item.alturaCalculada,
      opcoes,
    );
  });

  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Painel de Gestão de Obras · Vasconcelos Engenharia · Página ${numeroPaginaDoc} de ${totalPaginasDoc}`, 1240, 3460);

  return canvas.toDataURL("image/jpeg", 0.94);
}

export async function exportarPlantaIluminadaPdf(
  urlPdf: string,
  paginaNumero: number,
  obraNome: string,
  plantaNome: string,
  tarefas: TarefaExportacaoCompleta[],
  opcoes: OpcoesExportacaoPlanta = OPCOES_EXPORTACAO_PADRAO,
): Promise<Blob> {
  const notificar = (etapa: string, pct: number) => {
    if (opcoes.aoProgresso) opcoes.aoProgresso(etapa, pct);
  };

  notificar("Carregando e renderizando prancha em alta resolução...", 5);
  const { canvas: baseCanvas, dimensoesPdf } = await renderizarPaginaPdfEmCanvas(
    urlPdf,
    paginaNumero,
    3400,
  );

  notificar("Construindo planta iluminada com pinos e regiões...", 20);
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = baseCanvas.width;
  compositeCanvas.height = baseCanvas.height;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível inicializar o canvas da planta.");

  ctx.drawImage(baseCanvas, 0, 0);

  const tarefasParaExportar = (opcoes.tarefaIdsFiltro && opcoes.tarefaIdsFiltro.length > 0)
    ? tarefas.filter((t) => opcoes.tarefaIdsFiltro?.includes(t.id))
    : tarefas;

  const coordenadasClickA0: {
    tarefaId: string;
    numero: number;
    pctMinX: number;
    pctMinY: number;
    pctMaxX: number;
    pctMaxY: number;
  }[] = [];

  // Remover badge de texto e pinos numerados
  tarefasParaExportar.forEach((t) => {
    const cor = CORES_STATUS_HEX[t.status] ?? "#2563eb";

    if (t.localizacao_tipo === "ponto" && t.ponto_x != null && t.ponto_y != null) {
      const pct = pdfParaPercentual(
        { x: t.ponto_x, y: t.ponto_y },
        dimensoesPdf.largura,
        dimensoesPdf.altura,
      );

      const px = (pct.esquerda / 100) * compositeCanvas.width;
      const py = (pct.topo / 100) * compositeCanvas.height;

      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = hexParaRgba(cor, 0.6);
      ctx.fill();


      coordenadasClickA0.push({
        tarefaId: t.id,
        numero: t.numero,
        pctMinX: pct.esquerda - 2,
        pctMinY: pct.topo - 2,
        pctMaxX: pct.esquerda + 2,
        pctMaxY: pct.topo + 2,
      });
    } else if (t.localizacao_tipo === "regiao" && t.regiao) {
      const limites = limitesDaRegiao(t.regiao);
      if (!limites) return;

      const c1 = pdfParaPercentual({ x: limites.x, y: limites.y }, dimensoesPdf.largura, dimensoesPdf.altura);
      const c2 = pdfParaPercentual({ x: limites.x + limites.largura, y: limites.y + limites.altura }, dimensoesPdf.largura, dimensoesPdf.altura);

      const minLeft = Math.min(c1.esquerda, c2.esquerda);
      const maxLeft = Math.max(c1.esquerda, c2.esquerda);
      const minTop = Math.min(c1.topo, c2.topo);
      const maxTop = Math.max(c1.topo, c2.topo);

      const rx = (minLeft / 100) * compositeCanvas.width;
      const ry = (minTop / 100) * compositeCanvas.height;
      const rw = ((maxLeft - minLeft) / 100) * compositeCanvas.width;
      const rh = ((maxTop - minTop) / 100) * compositeCanvas.height;

      ctx.fillStyle = hexParaRgba(cor, 0.4);
      ctx.fillRect(rx, ry, rw, rh);

      coordenadasClickA0.push({
        tarefaId: t.id,
        numero: t.numero,
        pctMinX: minLeft,
        pctMinY: minTop,
        pctMaxX: maxLeft,
        pctMaxY: maxTop,
      });
    } else if (
      t.localizacao_tipo === "distancia" &&
      t.localizacao_detalhe?.pontos &&
      t.localizacao_detalhe.pontos.length >= 2
    ) {
      const corredor = corredorDaPolilinha(t.localizacao_detalhe.pontos, 8);
      if (corredor.length >= 3) {
        ctx.beginPath();
        corredor.forEach((p, idx) => {
          const pct = pdfParaPercentual(p, dimensoesPdf.largura, dimensoesPdf.altura);
          const px = (pct.esquerda / 100) * compositeCanvas.width;
          const py = (pct.topo / 100) * compositeCanvas.height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = hexParaRgba(cor, 0.45);
        ctx.fill();
      }
    } else if (
      t.localizacao_tipo === "circuito" &&
      t.localizacao_detalhe?.pontos &&
      t.localizacao_detalhe.pontos.length >= 2
    ) {
      const pontos = t.localizacao_detalhe.pontos;
      const condutores =
        (t.localizacao_detalhe.condutores as Array<{
          tipo: string;
          quantidade: number;
        }>) || [];
      const itemFase = condutores.find((c) => c.tipo === "fase");
      const itemNeutro = condutores.find((c) => c.tipo === "neutro");
      const itemTerra = condutores.find((c) => c.tipo === "terra");
      const itemRetorno = condutores.find((c) => c.tipo === "retorno");

      const corFaseR =
        (t.localizacao_detalhe.corFaseR as string) ||
        (t.localizacao_detalhe.corFase as string) ||
        "#FFFFFF";
      const corFaseS =
        (t.localizacao_detalhe.corFaseS as string) || "#000000";
      const corFaseT =
        (t.localizacao_detalhe.corFaseT as string) || "#EF4444";

      const linhas: {
        cor: string;
        dash?: number[];
        strokeContrast?: boolean;
      }[] = [];
      const qtdFase =
        itemFase?.quantidade ?? (condutores.length === 0 ? 1 : 0);
      const qtdNeutro =
        itemNeutro?.quantidade ?? (condutores.length === 0 ? 1 : 0);
      const qtdTerra =
        itemTerra?.quantidade ?? (condutores.length === 0 ? 1 : 0);
      const qtdRetorno = itemRetorno?.quantidade ?? 0;

      if (qtdFase >= 1)
        linhas.push({
          cor: corFaseR,
          strokeContrast: corFaseR.toUpperCase() === "#FFFFFF",
        });
      if (qtdFase >= 2)
        linhas.push({
          cor: corFaseS,
          strokeContrast: corFaseS.toUpperCase() === "#FFFFFF",
        });
      if (qtdFase >= 3)
        linhas.push({
          cor: corFaseT,
          strokeContrast: corFaseT.toUpperCase() === "#FFFFFF",
        });
      for (let i = 0; i < qtdNeutro; i++)
        linhas.push({ cor: "#2563EB", dash: [10, 5] });
      for (let i = 0; i < qtdTerra; i++)
        linhas.push({ cor: "#16A34A", dash: [4, 4] });
      for (let i = 0; i < qtdRetorno; i++)
        linhas.push({ cor: "#F59E0B", dash: [6, 3] });
      if (linhas.length === 0)
        linhas.push({
          cor: corFaseR,
          strokeContrast: corFaseR.toUpperCase() === "#FFFFFF",
        });

      const K = linhas.length;
      const gap = 2.4;
      const larguraCorredor = Math.max(14, K * gap + 10);
      const corredor = corredorDaPolilinha(pontos, larguraCorredor);
      if (corredor.length >= 3) {
        ctx.beginPath();
        corredor.forEach((p, idx) => {
          const pct = pdfParaPercentual(
            p,
            dimensoesPdf.largura,
            dimensoesPdf.altura,
          );
          const px = (pct.esquerda / 100) * compositeCanvas.width;
          const py = (pct.topo / 100) * compositeCanvas.height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = hexParaRgba(cor, 0.55);
        ctx.fill();
      }

      linhas.forEach((linha, idx) => {
        const offset = (idx - (K - 1) / 2) * gap;
        const ptsDeslocados = deslocarPolilinha(pontos, offset);
        if (ptsDeslocados.length >= 2) {
          ctx.beginPath();
          ptsDeslocados.forEach((p, pIdx) => {
            const pct = pdfParaPercentual(
              p,
              dimensoesPdf.largura,
              dimensoesPdf.altura,
            );
            const px = (pct.esquerda / 100) * compositeCanvas.width;
            const py = (pct.topo / 100) * compositeCanvas.height;
            if (pIdx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          if (linha.strokeContrast) {
            ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.stroke();
          }
          ctx.strokeStyle = linha.cor;
          ctx.lineWidth = 2;
          ctx.setLineDash(linha.dash || []);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    } else if (
      t.localizacao_tipo === "area" &&
      t.localizacao_detalhe?.pontos &&
      t.localizacao_detalhe.pontos.length >= 3
    ) {
      ctx.beginPath();
      t.localizacao_detalhe.pontos.forEach((p, idx) => {
        const pct = pdfParaPercentual(p, dimensoesPdf.largura, dimensoesPdf.altura);
        const px = (pct.esquerda / 100) * compositeCanvas.width;
        const py = (pct.topo / 100) * compositeCanvas.height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = hexParaRgba(cor, 0.35);
      ctx.fill();
      ctx.strokeStyle = hexParaRgba(cor, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (
      t.localizacao_tipo === "descida" &&
      t.ponto_x != null &&
      t.ponto_y != null
    ) {
      const pct = pdfParaPercentual(
        { x: t.ponto_x, y: t.ponto_y },
        dimensoesPdf.largura,
        dimensoesPdf.altura,
      );
      const px = (pct.esquerda / 100) * compositeCanvas.width;
      const py = (pct.topo / 100) * compositeCanvas.height;

      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = hexParaRgba(cor, 0.8);
      ctx.fill();
    }
  });


  notificar("Inicializando documento PDF...", 35);

  const pdfDoc = await PDFDocument.create();

  const dims = DIMENSOES_FOLHA_PT[opcoes.tamanhoFolha];
  const aspectCanvas = compositeCanvas.width / compositeCanvas.height;
  const a0Width = aspectCanvas >= 1 ? dims.largura : dims.altura;
  const a0Height = aspectCanvas >= 1 ? dims.altura : dims.largura;

  const a0Page = pdfDoc.addPage([a0Width, a0Height]);
  const compositeDataUrl = compositeCanvas.toDataURL("image/jpeg", 0.94);
  const compositeBytes = await fetch(compositeDataUrl).then((r) => r.arrayBuffer());
  const a0Image = await pdfDoc.embedJpg(compositeBytes);

  a0Page.drawImage(a0Image, { x: 0, y: 0, width: a0Width, height: a0Height });

  const mapaTarefasParaPagina = new Map<string, ReturnType<typeof pdfDoc.context.register>>();

  if (opcoes.incluirDetalhamentoTarefas && tarefasParaExportar.length > 0) {
    notificar("Processando miniaturas e fotos das tarefas...", 45);

    const itensPreparados: ItemPreparadoTarefa[] = await Promise.all(
      tarefasParaExportar.map(async (t) => {
        let cropCanvas: HTMLCanvasElement | null = null;
        if (opcoes.incluirZoomPlanta) {
          if (t.localizacao_tipo === "ponto" && t.ponto_x != null && t.ponto_y != null) {
            const pct = pdfParaPercentual({ x: t.ponto_x, y: t.ponto_y }, dimensoesPdf.largura, dimensoesPdf.altura);
            cropCanvas = extrairRecortePlantaCanvas(baseCanvas, { xPct: pct.esquerda, yPct: pct.topo }, undefined, CORES_STATUS_HEX[t.status] ?? "#2563eb", t.numero);
          } else if (t.localizacao_tipo === "regiao" && t.regiao) {
            const limites = limitesDaRegiao(t.regiao);
            if (limites) {
              const c1 = pdfParaPercentual({ x: limites.x, y: limites.y }, dimensoesPdf.largura, dimensoesPdf.altura);
              const c2 = pdfParaPercentual({ x: limites.x + limites.largura, y: limites.y + limites.altura }, dimensoesPdf.largura, dimensoesPdf.altura);
              const minX = Math.min(c1.esquerda, c2.esquerda);
              const maxX = Math.max(c1.esquerda, c2.esquerda);
              const minY = Math.min(c1.topo, c2.topo);
              const maxY = Math.max(c1.topo, c2.topo);
              cropCanvas = extrairRecortePlantaCanvas(baseCanvas, { xPct: (minX + maxX) / 2, yPct: (minY + maxY) / 2 }, { minX, minY, maxX, maxY }, CORES_STATUS_HEX[t.status] ?? "#2563eb", t.numero);
            }
          }
        }

        const fotosCanvases: HTMLCanvasElement[] = [];
        if (opcoes.incluirFotosAnexos && t.anexos.length > 0) {
          const anexosComUrl = t.anexos.filter((a) => a.url);
          const comprimidos = await Promise.all(
            anexosComUrl.map((a) => (a.url ? comprimirImagem(a.url, 1200) : Promise.resolve(null))),
          );
          comprimidos.forEach((c) => {
            if (c) fotosCanvases.push(c.canvas);
          });
        }

        const alturaCalculada = calcularAlturaCartao(
          t,
          cropCanvas !== null,
          fotosCanvases.length,
          opcoes,
        );

        return {
          tarefa: t,
          obraNome,
          plantaNome,
          cropCanvas,
          fotosCanvases,
          alturaCalculada,
        };
      }),
    );

    const MAX_ALTURA_COLUNA = 3200;
    const GAP_Y = 24;
    const paginasAgrupadas: {
      col1: { item: ItemPreparadoTarefa; y: number }[];
      col2: { item: ItemPreparadoTarefa; y: number }[];
    }[] = [];

    let col1Atual: { item: ItemPreparadoTarefa; y: number }[] = [];
    let col2Atual: { item: ItemPreparadoTarefa; y: number }[] = [];
    let h1Atual = 160;
    let h2Atual = 160;

    for (const item of itensPreparados) {
      const hNecessaria = item.alturaCalculada + GAP_Y;

      if (h1Atual <= h2Atual) {
        if (h1Atual + hNecessaria > MAX_ALTURA_COLUNA && (col1Atual.length > 0 || col2Atual.length > 0)) {
          paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
          col1Atual = [];
          col2Atual = [];
          h1Atual = 160;
          h2Atual = 160;
        }
        col1Atual.push({ item, y: h1Atual });
        h1Atual += hNecessaria;
      } else {
        if (h2Atual + hNecessaria > MAX_ALTURA_COLUNA && (col1Atual.length > 0 || col2Atual.length > 0)) {
          paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
          col1Atual = [];
          col2Atual = [];
          h1Atual = 160;
          h2Atual = 160;
        }
        col2Atual.push({ item, y: h2Atual });
        h2Atual += hNecessaria;
      }
    }

    if (col1Atual.length > 0 || col2Atual.length > 0) {
      paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
    }

    const totalPaginasDetalhes = paginasAgrupadas.length;

    for (let pIdx = 0; pIdx < totalPaginasDetalhes; pIdx++) {
      const { col1, col2 } = paginasAgrupadas[pIdx];
      notificar(`Gerando página ${pIdx + 1} de ${totalPaginasDetalhes} com fichas técnicas em alta resolução...`, 60 + Math.round((pIdx / totalPaginasDetalhes) * 30));

      const pageDataUrl = gerarPaginaGradeDinamicaCanvas(
        col1,
        col2,
        pIdx + 1,
        totalPaginasDetalhes,
        plantaNome,
        opcoes,
      );

      const taskPage = pdfDoc.addPage([DIMENSOES_A4_PT.largura, DIMENSOES_A4_PT.altura]);
      const taskBytes = await fetch(pageDataUrl).then((r) => r.arrayBuffer());
      const taskImg = await pdfDoc.embedJpg(taskBytes);

      taskPage.drawImage(taskImg, {
        x: 0,
        y: 0,
        width: DIMENSOES_A4_PT.largura,
        height: DIMENSOES_A4_PT.altura,
      });

      col1.concat(col2).forEach((entry) => {
        mapaTarefasParaPagina.set(entry.item.tarefa.id, taskPage.ref);
      });

      const backLink = pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [20, DIMENSOES_A4_PT.altura - 60, 200, DIMENSOES_A4_PT.altura - 20],
        Border: [0, 0, 0],
        Dest: [a0Page.ref, "XYZ", null, null, null],
      });
      const backLinkRef = pdfDoc.context.register(backLink);

      let taskAnnots = taskPage.node.lookup(PDFName.of("Annots"));
      if (!taskAnnots || !(taskAnnots instanceof PDFArray)) {
        taskAnnots = pdfDoc.context.obj([]);
        taskPage.node.set(PDFName.of("Annots"), taskAnnots);
      }
      (taskAnnots as PDFArray).push(backLinkRef);
    }
  }

  notificar("Injetando hiperlinks nos pinos da prancha...", 92);

  for (const coord of coordenadasClickA0) {
    const targetPageRef = mapaTarefasParaPagina.get(coord.tarefaId);
    if (!targetPageRef) continue;

    const xMin = (coord.pctMinX / 100) * a0Width;
    const xMax = (coord.pctMaxX / 100) * a0Width;
    const yMin = ((100 - coord.pctMaxY) / 100) * a0Height;
    const yMax = ((100 - coord.pctMinY) / 100) * a0Height;

    const linkAnnot = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [xMin, yMin, xMax, yMax],
      Border: [0, 0, 0],
      Dest: [targetPageRef, "XYZ", null, null, null],
    });
    const linkRef = pdfDoc.context.register(linkAnnot);

    let annots = a0Page.node.lookup(PDFName.of("Annots"));
    if (!annots || !(annots instanceof PDFArray)) {
      annots = pdfDoc.context.obj([]);
      a0Page.node.set(PDFName.of("Annots"), annots);
    }
    (annots as PDFArray).push(linkRef);
  }

  notificar("Finalizando arquivo PDF...", 96);
  const pdfBytes = await pdfDoc.save();

  notificar("Pronto para download!", 100);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export async function exportarLevantamentoIluminadoPdf(
  urlPdf: string,
  paginaNumero: number,
  nomeLevantamento: string,
  obraNome: string,
  plantaNome: string,
  itens: ItemLevantamento[],
  resumo: ResumoLevantamento,
  tarefasVinculadas: TarefaExportacaoCompleta[] = [],
  opcoes: OpcoesExportacaoPlanta = OPCOES_EXPORTACAO_PADRAO,
): Promise<Blob> {
  const notificar = (etapa: string, pct: number) => {
    if (opcoes.aoProgresso) opcoes.aoProgresso(etapa, pct);
  };

  notificar("Renderizando prancha do levantamento...", 5);
  const { canvas: baseCanvas, dimensoesPdf } = await renderizarPaginaPdfEmCanvas(
    urlPdf,
    paginaNumero,
    3400,
  );

  notificar("Desenhando elementos, cabos e tubulações iluminadas...", 20);
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = baseCanvas.width;
  compositeCanvas.height = baseCanvas.height;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível inicializar o canvas do levantamento.");

  ctx.drawImage(baseCanvas, 0, 0);

  itens.forEach((it) => {
    const cor = it.cor || "#2563eb";

    if (it.tipo === "ponto" && it.pontos.length > 0) {
      const p = it.pontos[0];
      const pct = pdfParaPercentual(p, dimensoesPdf.largura, dimensoesPdf.altura);
      const px = (pct.esquerda / 100) * compositeCanvas.width;
      const py = (pct.topo / 100) * compositeCanvas.height;

      ctx.beginPath();
      ctx.arc(px, py, 32, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(it.numero), px, py);
    } else if (it.tipo === "distancia" || it.tipo === "tubulacao_cabo") {
      if (it.pontos.length >= 2) {
        ctx.beginPath();
        it.pontos.forEach((p, idx) => {
          const pct = pdfParaPercentual(p, dimensoesPdf.largura, dimensoesPdf.altura);
          const px = (pct.esquerda / 100) * compositeCanvas.width;
          const py = (pct.topo / 100) * compositeCanvas.height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });

        ctx.strokeStyle = cor;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    } else if (it.tipo === "area" && it.pontos.length >= 3) {
      ctx.beginPath();
      it.pontos.forEach((p, idx) => {
        const pct = pdfParaPercentual(p, dimensoesPdf.largura, dimensoesPdf.altura);
        const px = (pct.esquerda / 100) * compositeCanvas.width;
        const py = (pct.topo / 100) * compositeCanvas.height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();

      ctx.fillStyle = hexParaRgba(cor, 0.3);
      ctx.fill();

      ctx.strokeStyle = cor;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  });

  const seloW = 460;
  const seloH = 180;
  const seloX = compositeCanvas.width - seloW - 40;
  const seloY = compositeCanvas.height - seloH - 40;

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  desenharRetanguloArredondado(ctx, seloX, seloY, seloW, seloH, 12);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("VASCONCELOS ENGENHARIA", seloX + 28, seloY + 22);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`LEVANTAMENTO: ${nomeLevantamento.toUpperCase()}`, seloX + 28, seloY + 52);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Obra: ${obraNome} · Planta: ${plantaNome} (Pág. ${paginaNumero})`, seloX + 28, seloY + 82);
  ctx.fillText(`Itens: ${itens.length} · Elementos: ${resumo.totalGeralElementos} un`, seloX + 28, seloY + 106);
  ctx.fillText(`Tubulações: ${resumo.totalGeralDistancias.toFixed(1)}m · Cabos: ${resumo.totalGeralCabos.toFixed(1)}m`, seloX + 28, seloY + 130);

  notificar("Inicializando documento PDF...", 40);
  const pdfDoc = await PDFDocument.create();
  const dims = DIMENSOES_FOLHA_PT[opcoes.tamanhoFolha];
  const aspectCanvas = compositeCanvas.width / compositeCanvas.height;
  const a0Width = aspectCanvas >= 1 ? dims.largura : dims.altura;
  const a0Height = aspectCanvas >= 1 ? dims.altura : dims.largura;

  const a0Page = pdfDoc.addPage([a0Width, a0Height]);
  const compositeDataUrl = compositeCanvas.toDataURL("image/jpeg", 0.94);
  const compositeBytes = await fetch(compositeDataUrl).then((r) => r.arrayBuffer());
  const a0Image = await pdfDoc.embedJpg(compositeBytes);

  a0Page.drawImage(a0Image, { x: 0, y: 0, width: a0Width, height: a0Height });

  if (opcoes.incluirDetalhamentoTarefas && tarefasVinculadas.length > 0) {
    const itensPreparados: ItemPreparadoTarefa[] = await Promise.all(
      tarefasVinculadas.map(async (t) => {
        let cropCanvas: HTMLCanvasElement | null = null;
        if (t.ponto_x != null && t.ponto_y != null) {
          const pct = pdfParaPercentual({ x: t.ponto_x, y: t.ponto_y }, dimensoesPdf.largura, dimensoesPdf.altura);
          cropCanvas = extrairRecortePlantaCanvas(baseCanvas, { xPct: pct.esquerda, yPct: pct.topo }, undefined, CORES_STATUS_HEX[t.status] ?? "#2563eb", t.numero);
        }

        const fotosCanvases: HTMLCanvasElement[] = [];
        if (t.anexos.length > 0) {
          const anexosComUrl = t.anexos.filter((a) => a.url);
          const comprimidos = await Promise.all(
            anexosComUrl.map((a) => (a.url ? comprimirImagem(a.url, 1200) : Promise.resolve(null))),
          );
          comprimidos.forEach((c) => {
            if (c) fotosCanvases.push(c.canvas);
          });
        }

        const alturaCalculada = calcularAlturaCartao(
          t,
          cropCanvas !== null,
          fotosCanvases.length,
          opcoes,
        );

        return {
          tarefa: t,
          obraNome,
          plantaNome,
          cropCanvas,
          fotosCanvases,
          alturaCalculada,
        };
      }),
    );

    const MAX_ALTURA_COLUNA = 3200;
    const GAP_Y = 24;
    const paginasAgrupadas: {
      col1: { item: ItemPreparadoTarefa; y: number }[];
      col2: { item: ItemPreparadoTarefa; y: number }[];
    }[] = [];

    let col1Atual: { item: ItemPreparadoTarefa; y: number }[] = [];
    let col2Atual: { item: ItemPreparadoTarefa; y: number }[] = [];
    let h1Atual = 160;
    let h2Atual = 160;

    for (const item of itensPreparados) {
      const hNecessaria = item.alturaCalculada + GAP_Y;

      if (h1Atual <= h2Atual) {
        if (h1Atual + hNecessaria > MAX_ALTURA_COLUNA && (col1Atual.length > 0 || col2Atual.length > 0)) {
          paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
          col1Atual = [];
          col2Atual = [];
          h1Atual = 160;
          h2Atual = 160;
        }
        col1Atual.push({ item, y: h1Atual });
        h1Atual += hNecessaria;
      } else {
        if (h2Atual + hNecessaria > MAX_ALTURA_COLUNA && (col1Atual.length > 0 || col2Atual.length > 0)) {
          paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
          col1Atual = [];
          col2Atual = [];
          h1Atual = 160;
          h2Atual = 160;
        }
        col2Atual.push({ item, y: h2Atual });
        h2Atual += hNecessaria;
      }
    }

    if (col1Atual.length > 0 || col2Atual.length > 0) {
      paginasAgrupadas.push({ col1: col1Atual, col2: col2Atual });
    }

    const totalPaginasDetalhes = paginasAgrupadas.length;

    for (let pIdx = 0; pIdx < totalPaginasDetalhes; pIdx++) {
      const { col1, col2 } = paginasAgrupadas[pIdx];
      const pageDataUrl = gerarPaginaGradeDinamicaCanvas(
        col1,
        col2,
        pIdx + 1,
        totalPaginasDetalhes,
        nomeLevantamento,
        opcoes,
      );

      const taskPage = pdfDoc.addPage([DIMENSOES_A4_PT.largura, DIMENSOES_A4_PT.altura]);
      const taskBytes = await fetch(pageDataUrl).then((r) => r.arrayBuffer());
      const taskImg = await pdfDoc.embedJpg(taskBytes);

      taskPage.drawImage(taskImg, { x: 0, y: 0, width: DIMENSOES_A4_PT.largura, height: DIMENSOES_A4_PT.altura });
    }
  }

  notificar("Finalizando geração do PDF...", 96);
  const pdfBytes = await pdfDoc.save();

  notificar("Pronto para download!", 100);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export async function exportarRelatorioRdoCompletoPdf(
  titulo: string,
  subtitulo: string,
  filtros: { rotulo: string; valor: string }[],
  geradoEm: Date,
  concluidas: TarefaRelatorio[],
  andamento: TarefaRelatorio[],
  totalAbertas: number,
  totalFotos: number,
  urlsMap: Map<string, string>,
  plantas: FiguraPlanta[],
  opcoes: OpcoesExportacaoPlanta = OPCOES_EXPORTACAO_PADRAO,
): Promise<Blob> {
  const notificar = (etapa: string, pct: number) => {
    if (opcoes.aoProgresso) opcoes.aoProgresso(etapa, pct);
  };

  notificar("Iniciando documento do Relatório...", 5);
  const pdfDoc = await PDFDocument.create();

  const capaCanvas = document.createElement("canvas");
  capaCanvas.width = 2480;
  capaCanvas.height = 3508;
  const ctxCapa = capaCanvas.getContext("2d");
  if (!ctxCapa) throw new Error("Não foi possível inicializar canvas da capa.");

  ctxCapa.fillStyle = "#ffffff";
  ctxCapa.fillRect(0, 0, 2480, 3508);

  ctxCapa.fillStyle = "#0f172a";
  ctxCapa.fillRect(0, 0, 2480, 180);

  ctxCapa.fillStyle = "#38bdf8";
  ctxCapa.font = "bold 26px sans-serif";
  ctxCapa.fillText("VASCONCELOS ENGENHARIA", 80, 70);

  ctxCapa.fillStyle = "#ffffff";
  ctxCapa.font = "bold 42px sans-serif";
  ctxCapa.fillText(titulo.toUpperCase(), 80, 130);

  ctxCapa.fillStyle = "#f8fafc";
  ctxCapa.strokeStyle = "#e2e8f0";
  ctxCapa.lineWidth = 2;
  desenharRetanguloArredondado(ctxCapa, 80, 220, 2320, 160, 12);
  ctxCapa.fill();
  ctxCapa.stroke();

  ctxCapa.fillStyle = "#64748b";
  ctxCapa.font = "bold 18px sans-serif";
  let xFiltro = 110;
  filtros.forEach((f) => {
    ctxCapa.fillStyle = "#64748b";
    ctxCapa.fillText(f.rotulo.toUpperCase(), xFiltro, 270);
    ctxCapa.fillStyle = "#0f172a";
    ctxCapa.font = "bold 22px sans-serif";
    ctxCapa.fillText(f.valor, xFiltro, 310);
    ctxCapa.font = "bold 18px sans-serif";
    xFiltro += 520;
  });

  ctxCapa.fillStyle = "#64748b";
  ctxCapa.fillText("GERADO EM", xFiltro, 270);
  ctxCapa.fillStyle = "#0f172a";
  ctxCapa.font = "bold 22px sans-serif";
  ctxCapa.fillText(formatarDataHora(geradoEm.toISOString()), xFiltro, 310);

  const cardW = 550;
  const cardH = 160;
  const gapCard = 40;
  const cardsInfo = [
    { rotulo: "Tarefas Concluídas", valor: concluidas.length, corFundo: "#ecfdf5", corBorda: "#a7f3d0", corTexto: "#065f46" },
    { rotulo: "Em Andamento", valor: andamento.length, corFundo: "#fffbeb", corBorda: "#fde68a", corTexto: "#92400e" },
    { rotulo: "Em Aberto", valor: totalAbertas, corFundo: "#f8fafc", corBorda: "#cbd5e1", corTexto: "#334155" },
    { rotulo: "Registros Fotográficos", valor: totalFotos, corFundo: "#eff6ff", corBorda: "#bfdbfe", corTexto: "#1e40af" },
  ];

  cardsInfo.forEach((card, idx) => {
    const xCard = 80 + idx * (cardW + gapCard);
    ctxCapa.fillStyle = card.corFundo;
    ctxCapa.strokeStyle = card.corBorda;
    ctxCapa.lineWidth = 2;
    desenharRetanguloArredondado(ctxCapa, xCard, 420, cardW, cardH, 12);
    ctxCapa.fill();
    ctxCapa.stroke();

    ctxCapa.fillStyle = card.corTexto;
    ctxCapa.font = "bold 20px sans-serif";
    ctxCapa.fillText(card.rotulo, xCard + 24, 465);

    ctxCapa.font = "bold 52px sans-serif";
    ctxCapa.fillText(String(card.valor), xCard + 24, 540);
  });

  ctxCapa.fillStyle = "#0f172a";
  ctxCapa.font = "bold 28px sans-serif";
  ctxCapa.fillText("PRANCHAS DE PLANTAS ILUMINADAS NO RELATÓRIO", 80, 640);

  let yPlantaList = 680;
  if (plantas.length === 0) {
    ctxCapa.fillStyle = "#64748b";
    ctxCapa.font = "italic 20px sans-serif";
    ctxCapa.fillText("Nenhuma planta vinculada às atividades deste relatório.", 80, yPlantaList + 30);
    yPlantaList += 80;
  } else {
    plantas.forEach((fig, idx) => {
      ctxCapa.fillStyle = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
      ctxCapa.strokeStyle = "#e2e8f0";
      desenharRetanguloArredondado(ctxCapa, 80, yPlantaList, 2320, 80, 10);
      ctxCapa.fill();
      ctxCapa.stroke();

      ctxCapa.fillStyle = "#2563eb";
      ctxCapa.font = "bold 24px sans-serif";
      ctxCapa.fillText(`Prancha ${idx + 1}: ${fig.plantaNome} (Página ${fig.pagina})`, 110, yPlantaList + 50);

      ctxCapa.fillStyle = "#64748b";
      ctxCapa.font = "20px sans-serif";
      ctxCapa.fillText(`${fig.marcadores.length} marcações identificadas · Clique nos pinos da prancha para ir à tarefa`, 1100, yPlantaList + 50);

      yPlantaList += 95;
    });
  }

  yPlantaList += 30;
  ctxCapa.fillStyle = "#0f172a";
  ctxCapa.font = "bold 28px sans-serif";
  ctxCapa.fillText("RESUMO DE ATIVIDADES REGISTRADAS", 80, yPlantaList);
  yPlantaList += 40;

  const todasTarefas = [...concluidas, ...andamento];
  todasTarefas.slice(0, 16).forEach((tar, idx) => {
    ctxCapa.fillStyle = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
    ctxCapa.fillRect(80, yPlantaList, 2320, 52);

    const sit = situacaoDaTarefa({ status: tar.status, aprovacao: tar.aprovacao });
    const cor = CORES_STATUS_HEX[tar.status] ?? "#2563eb";

    ctxCapa.beginPath();
    ctxCapa.arc(105, yPlantaList + 26, 8, 0, Math.PI * 2);
    ctxCapa.fillStyle = cor;
    ctxCapa.fill();

    ctxCapa.fillStyle = "#0f172a";
    ctxCapa.font = "20px sans-serif";
    ctxCapa.fillText(`${tar.titulo} (${tar.obras.nome})`, 130, yPlantaList + 34);

    ctxCapa.fillStyle = "#64748b";
    ctxCapa.font = "18px sans-serif";
    ctxCapa.fillText(SITUACAO_TAREFA[sit].rotulo, 1950, yPlantaList + 34);

    yPlantaList += 52;
  });

  const capaPage = pdfDoc.addPage([DIMENSOES_A4_PT.largura, DIMENSOES_A4_PT.altura]);
  const capaBytes = await fetch(capaCanvas.toDataURL("image/jpeg", 0.94)).then((r) => r.arrayBuffer());
  const capaImg = await pdfDoc.embedJpg(capaBytes);
  capaPage.drawImage(capaImg, { x: 0, y: 0, width: DIMENSOES_A4_PT.largura, height: DIMENSOES_A4_PT.altura });

  const mapaPranchasRefs: { plantaKey: string; pageRef: ReturnType<typeof pdfDoc.context.register> }[] = [];
  const coordsPlantasLinks: { plantaKey: string; tarefaId: string; pctMinX: number; pctMinY: number; pctMaxX: number; pctMaxY: number }[] = [];
  const mapaBaseCanvases = new Map<string, { canvas: HTMLCanvasElement; dimensoesPdf: { largura: number; altura: number } }>();

  const plantasComUrl = plantas.filter((p) => p.urlPdf);
  for (let pIdx = 0; pIdx < plantasComUrl.length; pIdx++) {
    const fig = plantasComUrl[pIdx];
    const plantaKey = `${fig.plantaId}::${fig.pagina}`;
    notificar(`Renderizando prancha iluminada ${pIdx + 1} de ${plantasComUrl.length} (${fig.plantaNome})...`, 20 + Math.round((pIdx / plantasComUrl.length) * 25));

    const { canvas: baseCanvas, dimensoesPdf } = await renderizarPaginaPdfEmCanvas(
      fig.urlPdf!,
      fig.pagina,
      3400,
    );

    mapaBaseCanvases.set(plantaKey, { canvas: baseCanvas, dimensoesPdf });

    const compCanvas = document.createElement("canvas");
    compCanvas.width = baseCanvas.width;
    compCanvas.height = baseCanvas.height;
    const compCtx = compCanvas.getContext("2d");
    if (!compCtx) continue;

    compCtx.drawImage(baseCanvas, 0, 0);

    fig.marcadores.forEach((m) => {
      const cor = CORES_STATUS_HEX[m.status] ?? "#2563eb";
      const matchingTar = todasTarefas.find((t) => t.titulo === m.titulo && t.planta_id === fig.plantaId);

      if (m.localizacao_tipo === "ponto" && m.ponto_x != null && m.ponto_y != null) {
        const pct = pdfParaPercentual({ x: m.ponto_x, y: m.ponto_y }, dimensoesPdf.largura, dimensoesPdf.altura);
        const px = (pct.esquerda / 100) * compCanvas.width;
        const py = (pct.topo / 100) * compCanvas.height;

        compCtx.beginPath();
        compCtx.arc(px, py, 36, 0, Math.PI * 2);
        compCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
        compCtx.fill();

        compCtx.beginPath();
        compCtx.arc(px, py, 26, 0, Math.PI * 2);
        compCtx.fillStyle = cor;
        compCtx.fill();
        compCtx.lineWidth = 4;
        compCtx.strokeStyle = "#ffffff";
        compCtx.stroke();

        compCtx.fillStyle = "#ffffff";
        compCtx.font = "bold 22px sans-serif";
        compCtx.textAlign = "center";
        compCtx.textBaseline = "middle";
        compCtx.fillText(String(m.numero), px, py);

        if (matchingTar) {
          coordsPlantasLinks.push({
            plantaKey,
            tarefaId: matchingTar.id,
            pctMinX: pct.esquerda - 2.5,
            pctMinY: pct.topo - 2.5,
            pctMaxX: pct.esquerda + 2.5,
            pctMaxY: pct.topo + 2.5,
          });
        }
      } else if (m.localizacao_tipo === "regiao" && m.regiao) {
        const limites = limitesDaRegiao(m.regiao);
        if (limites) {
          const c1 = pdfParaPercentual({ x: limites.x, y: limites.y }, dimensoesPdf.largura, dimensoesPdf.altura);
          const c2 = pdfParaPercentual({ x: limites.x + limites.largura, y: limites.y + limites.altura }, dimensoesPdf.largura, dimensoesPdf.altura);
          const minLeft = Math.min(c1.esquerda, c2.esquerda);
          const maxLeft = Math.max(c1.esquerda, c2.esquerda);
          const minTop = Math.min(c1.topo, c2.topo);
          const maxTop = Math.max(c1.topo, c2.topo);

          const rx = (minLeft / 100) * compCanvas.width;
          const ry = (minTop / 100) * compCanvas.height;
          const rw = ((maxLeft - minLeft) / 100) * compCanvas.width;
          const rh = ((maxTop - minTop) / 100) * compCanvas.height;

          compCtx.fillStyle = hexParaRgba(cor, 0.28);
          compCtx.fillRect(rx, ry, rw, rh);
          compCtx.strokeStyle = cor;
          compCtx.lineWidth = 5;
          compCtx.strokeRect(rx, ry, rw, rh);

          compCtx.beginPath();
          compCtx.arc(rx, ry, 24, 0, Math.PI * 2);
          compCtx.fillStyle = cor;
          compCtx.fill();
          compCtx.lineWidth = 3.5;
          compCtx.strokeStyle = "#ffffff";
          compCtx.stroke();

          compCtx.fillStyle = "#ffffff";
          compCtx.font = "bold 20px sans-serif";
          compCtx.textAlign = "center";
          compCtx.textBaseline = "middle";
          compCtx.fillText(String(m.numero), rx, ry);

          if (matchingTar) {
            coordsPlantasLinks.push({
              plantaKey,
              tarefaId: matchingTar.id,
              pctMinX: minLeft,
              pctMinY: minTop,
              pctMaxX: maxLeft,
              pctMaxY: maxTop,
            });
          }
        }
      }
    });

    const sW = 460;
    const sH = 180;
    const sX = compCanvas.width - sW - 40;
    const sY = compCanvas.height - sH - 40;

    compCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
    desenharRetanguloArredondado(compCtx, sX, sY, sW, sH, 12);
    compCtx.fill();

    compCtx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    compCtx.lineWidth = 2;
    compCtx.stroke();

    compCtx.fillStyle = "#38bdf8";
    compCtx.font = "bold 18px sans-serif";
    compCtx.textAlign = "left";
    compCtx.textBaseline = "top";
    compCtx.fillText("VASCONCELOS ENGENHARIA", sX + 28, sY + 22);

    compCtx.fillStyle = "#ffffff";
    compCtx.font = "bold 20px sans-serif";
    compCtx.fillText(`PLANTA: ${fig.plantaNome.toUpperCase()}`, sX + 28, sY + 52);

    compCtx.fillStyle = "#94a3b8";
    compCtx.font = "14px sans-serif";
    compCtx.fillText(`Página: ${fig.pagina} · Total de Marcações: ${fig.marcadores.length}`, sX + 28, sY + 82);
    compCtx.fillText(`Formato: ${opcoes.tamanhoFolha} · Emissão: ${new Date().toLocaleDateString("pt-BR")}`, sX + 28, sY + 106);
    compCtx.fillText("Clique nos pinos/regiões para ir à tarefa", sX + 28, sY + 130);

    const dims = DIMENSOES_FOLHA_PT[opcoes.tamanhoFolha];
    const aspect = compCanvas.width / compCanvas.height;
    const pW = aspect >= 1 ? dims.largura : dims.altura;
    const pH = aspect >= 1 ? dims.altura : dims.largura;

    const sheetPage = pdfDoc.addPage([pW, pH]);
    const sheetDataUrl = compCanvas.toDataURL("image/jpeg", 0.94);
    const sheetBytes = await fetch(sheetDataUrl).then((r) => r.arrayBuffer());
    const sheetImg = await pdfDoc.embedJpg(sheetBytes);

    sheetPage.drawImage(sheetImg, { x: 0, y: 0, width: pW, height: pH });
    mapaPranchasRefs.push({ plantaKey, pageRef: sheetPage.ref });
  }

  const mapaTarefasParaPagina = new Map<string, ReturnType<typeof pdfDoc.context.register>>();

  if (opcoes.incluirDetalhamentoTarefas && todasTarefas.length > 0) {
    notificar("Gerando miniaturas das plantas e fotos em alta resolução...", 50);

    const itensPreparados: ItemPreparadoTarefa[] = await Promise.all(
      todasTarefas.map(async (t, idx) => {
        const plantaKey = `${t.planta_id}::${t.pagina ?? 1}`;
        const baseInfo = mapaBaseCanvases.get(plantaKey);

        let cropCanvas: HTMLCanvasElement | null = null;
        if (opcoes.incluirZoomPlanta && baseInfo) {
          if (t.localizacao_tipo === "ponto" && t.ponto_x != null && t.ponto_y != null) {
            const pct = pdfParaPercentual({ x: t.ponto_x, y: t.ponto_y }, baseInfo.dimensoesPdf.largura, baseInfo.dimensoesPdf.altura);
            cropCanvas = extrairRecortePlantaCanvas(baseInfo.canvas, { xPct: pct.esquerda, yPct: pct.topo }, undefined, CORES_STATUS_HEX[t.status] ?? "#2563eb", idx + 1);
          } else if (t.localizacao_tipo === "regiao" && t.regiao) {
            const limites = limitesDaRegiao(t.regiao);
            if (limites) {
              const c1 = pdfParaPercentual({ x: limites.x, y: limites.y }, baseInfo.dimensoesPdf.largura, baseInfo.dimensoesPdf.altura);
              const c2 = pdfParaPercentual({ x: limites.x + limites.largura, y: limites.y + limites.altura }, baseInfo.dimensoesPdf.largura, baseInfo.dimensoesPdf.altura);
              const minX = Math.min(c1.esquerda, c2.esquerda);
              const maxX = Math.max(c1.esquerda, c2.esquerda);
              const minY = Math.min(c1.topo, c2.topo);
              const maxY = Math.max(c1.topo, c2.topo);
              cropCanvas = extrairRecortePlantaCanvas(baseInfo.canvas, { xPct: (minX + maxX) / 2, yPct: (minY + maxY) / 2 }, { minX, minY, maxX, maxY }, CORES_STATUS_HEX[t.status] ?? "#2563eb", idx + 1);
            }
          }
        }

        const fotosCanvases: HTMLCanvasElement[] = [];
        if (opcoes.incluirFotosAnexos && t.anexos.length > 0) {
          const anexosComUrl = t.anexos.filter((a) => urlsMap.get(a.caminho));
          const comprimidos = await Promise.all(
            anexosComUrl.map((a) => {
              const url = urlsMap.get(a.caminho);
              return url ? comprimirImagem(url, 1200) : Promise.resolve(null);
            }),
          );
          comprimidos.forEach((c) => {
            if (c) fotosCanvases.push(c.canvas);
          });
        }

        const tarefaExp: TarefaExportacaoCompleta = {
          id: t.id,
          numero: idx + 1,
          titulo: t.titulo,
          descricao: t.descricao,
          status: t.status,
          prioridade: t.prioridade,
          aprovacao: t.aprovacao,
          prazo: t.prazo,
          criado_em: t.criado_em,
          pagina: t.pagina ?? 1,
          localizacao_tipo: t.localizacao_tipo,
          ponto_x: t.ponto_x,
          ponto_y: t.ponto_y,
          regiao: t.regiao,
          localizacao_detalhe: null,
          responsavel_nome: t.responsavel?.nome ?? null,
          executor_nome: t.executor?.nome ?? null,
          supervisor_nome: t.supervisor?.nome ?? null,
          tags: [],
          anexos: t.anexos.map((a) => ({
            id: a.id,
            nome: a.nome_arquivo,
            tipo: a.tipo,
            momento: a.momento,
            url: urlsMap.get(a.caminho) ?? null,
            tamanho_bytes: a.tamanho_bytes ?? 0,
          })),
          comentarios: t.comentarios.map((c) => ({
            id: c.id,
            texto: c.texto,
            criado_em: c.criado_em,
            autor_nome: null,
          })),
          medicoes: [],
        };

        const alturaCalculada = calcularAlturaCartao(
          tarefaExp,
          cropCanvas !== null,
          fotosCanvases.length,
          opcoes,
        );

        return {
          tarefa: tarefaExp,
          obraNome: t.obras.nome,
          plantaNome: t.planta?.nome ?? "Planta",
          cropCanvas,
          fotosCanvases,
          alturaCalculada,
        };
      }),
    );

    const TAREFAS_POR_PAGINA = 12;
    const paginasAgrupadas: {
      col1: { item: ItemPreparadoTarefa; y: number }[];
      col2: { item: ItemPreparadoTarefa; y: number }[];
    }[] = [];

    for (let i = 0; i < itensPreparados.length; i += TAREFAS_POR_PAGINA) {
      const paginaItens = itensPreparados.slice(i, i + TAREFAS_POR_PAGINA);
      const col1: { item: ItemPreparadoTarefa; y: number }[] = [];
      const col2: { item: ItemPreparadoTarefa; y: number }[] = [];
      
      let h1Atual = 160;
      let h2Atual = 160;

      paginaItens.forEach((item, idx) => {
        if (idx % 2 === 0) {
          col1.push({ item, y: h1Atual });
          h1Atual += item.alturaCalculada + 24;
        } else {
          col2.push({ item, y: h2Atual });
          h2Atual += item.alturaCalculada + 24;
        }
      });
      paginasAgrupadas.push({ col1, col2 });
    }

    const totalPaginasDetalhes = paginasAgrupadas.length;

    for (let pIdx = 0; pIdx < totalPaginasDetalhes; pIdx++) {
      const { col1, col2 } = paginasAgrupadas[pIdx];
      notificar(`Montando página ${pIdx + 1} de ${totalPaginasDetalhes} com fichas técnicas em alta resolução...`, 65 + Math.round((pIdx / totalPaginasDetalhes) * 25));

      const pageDataUrl = gerarPaginaGradeDinamicaCanvas(
        col1,
        col2,
        pIdx + 1,
        totalPaginasDetalhes,
        titulo,
        opcoes,
      );

      const taskPage = pdfDoc.addPage([DIMENSOES_A4_PT.largura, DIMENSOES_A4_PT.altura]);
      const taskBytes = await fetch(pageDataUrl).then((r) => r.arrayBuffer());
      const taskImg = await pdfDoc.embedJpg(taskBytes);

      taskPage.drawImage(taskImg, {
        x: 0,
        y: 0,
        width: DIMENSOES_A4_PT.largura,
        height: DIMENSOES_A4_PT.altura,
      });

      col1.concat(col2).forEach((entry) => {
        mapaTarefasParaPagina.set(entry.item.tarefa.id, taskPage.ref);
      });

      if (mapaPranchasRefs.length > 0) {
        const pranchaPrincipal = mapaPranchasRefs[0];
        const backLink = pdfDoc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [20, DIMENSOES_A4_PT.altura - 60, 200, DIMENSOES_A4_PT.altura - 20],
          Border: [0, 0, 0],
          Dest: [pranchaPrincipal.pageRef, "XYZ", null, null, null],
        });
        const backLinkRef = pdfDoc.context.register(backLink);

        let taskAnnots = taskPage.node.lookup(PDFName.of("Annots"));
        if (!taskAnnots || !(taskAnnots instanceof PDFArray)) {
          taskAnnots = pdfDoc.context.obj([]);
          taskPage.node.set(PDFName.of("Annots"), taskAnnots);
        }
        (taskAnnots as PDFArray).push(backLinkRef);
      }
    }
  }

  notificar("Injetando hiperlinks nas pranchas...", 92);
  const dimsFolha = DIMENSOES_FOLHA_PT[opcoes.tamanhoFolha];

  for (const coord of coordsPlantasLinks) {
    const targetPageRef = mapaTarefasParaPagina.get(coord.tarefaId);
    if (!targetPageRef) continue;

    const pranchaTarget = mapaPranchasRefs.find((pr) => pr.plantaKey === coord.plantaKey);
    if (!pranchaTarget) continue;

    const pWidth = dimsFolha.largura;
    const pHeight = dimsFolha.altura;

    const xMin = (coord.pctMinX / 100) * pWidth;
    const xMax = (coord.pctMaxX / 100) * pWidth;
    const yMin = ((100 - coord.pctMaxY) / 100) * pHeight;
    const yMax = ((100 - coord.pctMinY) / 100) * pHeight;

    const linkAnnot = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [xMin, yMin, xMax, yMax],
      Border: [0, 0, 0],
      Dest: [targetPageRef, "XYZ", null, null, null],
    });
    const linkRef = pdfDoc.context.register(linkAnnot);

    const pranchaPage = pdfDoc.getPages().find((p) => p.ref === pranchaTarget.pageRef);
    if (pranchaPage) {
      let annots = pranchaPage.node.lookup(PDFName.of("Annots"));
      if (!annots || !(annots instanceof PDFArray)) {
        annots = pdfDoc.context.obj([]);
        pranchaPage.node.set(PDFName.of("Annots"), annots);
      }
      (annots as PDFArray).push(linkRef);
    }
  }

  notificar("Salvando arquivo PDF...", 96);
  const pdfBytes = await pdfDoc.save();

  notificar("Pronto!", 100);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export function baixarArquivoBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
