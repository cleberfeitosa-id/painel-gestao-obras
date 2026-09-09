"use client";

import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, StandardFonts, BlendMode, degrees, PDFPage, PDFName, moveTo, lineTo, fillAndStroke, closePath, setFillingRgbColor, setStrokingRgbColor, setLineWidth } from "pdf-lib";
import { calcularMatrizTransformacao } from "@/components/compatibilizacao/math";

export async function exportarCompatibilizacaoPdf(
  plantasComp: any[],
  tarefas: any[],
  choques: any[],
  compatibilizacaoNome: string,
  obraNome: string,
  aoProgresso?: (etapa: string, pct: number) => void
): Promise<{ blob: Blob; url: string }> {
  const notificar = (etapa: string, pct: number) => {
    if (aoProgresso) aoProgresso(etapa, pct);
  };

  const plantaBase = plantasComp.find(p => p.e_base);
  if (!plantaBase) throw new Error("Planta base não encontrada");

  const sobrepostas = plantasComp.filter(p => !p.e_base && p.visivel && p.urlPdf);
  const totalPlantas = 1 + sobrepostas.length;
  
  const renderedPlans: any[] = [];
  
  notificar("Baixando planta base...", 5);
  const getPageDimensions = (page: PDFPage) => {
    const angle = page.getRotation().angle;
    let w = page.getWidth();
    let h = page.getHeight();
    if (angle === 90 || angle === 270) {
      w = page.getHeight();
      h = page.getWidth();
    }
    return { largura: w, altura: h, angle };
  };

  const baseBytes = await fetch(plantaBase.urlPdf).then(res => res.arrayBuffer());
  const baseDoc = await PDFDocument.load(baseBytes);
  const basePdfPage = baseDoc.getPage(plantaBase.pagina - 1);
  const bH_orig = getPageDimensions(basePdfPage);

  renderedPlans.push({ isBase: true, p: plantaBase, doc: baseDoc, pdfPage: basePdfPage, dim: bH_orig });

  let index = 0;
  for (const p of sobrepostas) {
    index++;
    notificar(`Baixando sobreposição ${index}/${sobrepostas.length}...`, 5 + (30 * index / totalPlantas));
    
    const pBytes = await fetch(p.urlPdf).then(res => res.arrayBuffer());
    const pDoc = await PDFDocument.load(pBytes);
    const pPdfPage = pDoc.getPage(p.pagina - 1);
    const pDim = getPageDimensions(pPdfPage);
    
    renderedPlans.push({ isBase: false, p, doc: pDoc, pdfPage: pPdfPage, dim: pDim });
  }

  notificar("Calculando alinhamento vetorial...", 35);
  
  let minX = 0;
  let minY = 0;
  let maxX = bH_orig.largura;
  let maxY = bH_orig.altura;

  for (const rp of renderedPlans) {
    if (rp.isBase) continue;
    const p = rp.p;
    if (p.ref1_x && p.ref2_x && plantaBase.ref1_x && plantaBase.ref2_x) {
      const mat = calcularMatrizTransformacao(
        { x: plantaBase.ref1_x, y: plantaBase.ref1_y },
        { x: plantaBase.ref2_x, y: plantaBase.ref2_y },
        { x: p.ref1_x, y: p.ref1_y },
        { x: p.ref2_x, y: p.ref2_y }
      );
      
      rp.mat = mat;

      const corners = [
        { x: 0, y: 0 },
        { x: rp.dim.largura, y: 0 },
        { x: rp.dim.largura, y: rp.dim.altura },
        { x: 0, y: rp.dim.altura }
      ];

      for (const pt of corners) {
        const nx = mat.a * pt.x + mat.c * pt.y + mat.e;
        const ny = mat.b * pt.x + mat.d * pt.y + mat.f;
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      }
    } else {
       if (rp.dim.largura > maxX) maxX = rp.dim.largura;
       if (rp.dim.altura > maxY) maxY = rp.dim.altura;
    }
  }

  // Adicionando um pequeno padding para a legenda não ficar colada na borda
  const padding = 50;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const unionWidth = maxX - minX;
  const unionHeight = maxY - minY;

  notificar("Montando documento PDF vetorial...", 40);

  const finalDoc = await PDFDocument.create();
  const fontBold = await finalDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await finalDoc.embedFont(StandardFonts.Helvetica);

  const finalPage = finalDoc.addPage([unionWidth, unionHeight]);

  // Aplica o deslocamento global
  finalPage.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(1, 0, 0, 1, -minX, -minY)
  );

  notificar("Embutindo páginas...", 50);

  for (const rp of renderedPlans) {
    const embeddedPage = await finalDoc.embedPage(rp.pdfPage);
    
    // As hachuras e fundos CAD resetam a opacidade nativamente (ca=1.0).
    // O Transparency Group isola a planta e garante que o BlendMode afete a camada inteira,
    // derretendo o fundo branco e respeitando o nível de opacidade fornecido.
    // O flush() é vital pois processa e cria a referência do XObject internamente.
    try {
      await finalDoc.flush();
      const xobj = finalDoc.context.lookup(embeddedPage.ref) as any;
      if (xobj && xobj.dict) {
        const groupDict = finalDoc.context.obj({
          Type: 'Group',
          S: 'Transparency',
          I: true,
          K: false
        });
        xobj.dict.set(PDFName.of('Group'), groupDict);
      }
    } catch (e) {
      console.warn("Aviso: Falha ao aplicar Transparency Group", e);
    }

    finalPage.pushOperators(pushGraphicsState());
    
    if (!rp.isBase && rp.mat) {
      finalPage.pushOperators(
        concatTransformationMatrix(rp.mat.a, rp.mat.b, rp.mat.c, rp.mat.d, rp.mat.e, rp.mat.f)
      );
    }

    const angle = rp.dim.angle;
    let dx = 0;
    let dy = 0;
    if (angle === 90) dy = rp.dim.altura;
    if (angle === 180) { dx = rp.dim.largura; dy = rp.dim.altura; }
    if (angle === 270) dx = rp.dim.largura;

    finalPage.drawPage(embeddedPage, { 
      x: dx, 
      y: dy, 
      rotate: degrees(-angle),
      opacity: rp.isBase ? 1.0 : (rp.p.opacidade ?? 0.5),
      blendMode: rp.isBase ? BlendMode.Normal : BlendMode.Multiply
    });
    
    finalPage.pushOperators(popGraphicsState());
  }

  notificar("Desenhando choques e tarefas...", 65);

  const parseHex = (hex: string) => {
    if (!hex) return rgb(0, 0, 1);
    const h = hex.replace('#', '');
    return rgb(
      parseInt(h.substring(0,2), 16)/255,
      parseInt(h.substring(2,4), 16)/255,
      parseInt(h.substring(4,6), 16)/255
    );
  };

  choques.forEach(c => {
    const px = c.ponto_x;
    const py = c.ponto_y;

    const size = 15;

    // Draw triangle for choque
    finalPage.pushOperators(pushGraphicsState());
    
    // Draw yellow triangle with red border
    finalPage.pushOperators(
      setFillingRgbColor(254/255, 240/255, 138/255),
      setStrokingRgbColor(220/255, 38/255, 38/255),
      setLineWidth(2),
      moveTo(px, py + size),
      lineTo(px + size, py - size * 0.5),
      lineTo(px - size, py - size * 0.5),
      closePath(),
      fillAndStroke()
    );
    
    finalPage.drawText("!", {
      x: px - (size * 0.25),
      y: py - (size * 0.1),
      size: size * 1.2,
      font: fontBold,
      color: rgb(220/255, 38/255, 38/255)
    });
    
    finalPage.pushOperators(popGraphicsState());
  });

  tarefas.forEach(t => {
    const plantaDaTarefa = plantasComp.find(p => p.planta_id === t.planta_id);
    if (!plantaDaTarefa || !plantaDaTarefa.dimensoes || !plantaDaTarefa.visivel) return;

    let px_pdf = t.ponto_x;
    let py_pdf = t.ponto_y;

    if (!plantaDaTarefa.e_base && plantaDaTarefa.ref1_x) {
      const mat = calcularMatrizTransformacao(
        { x: plantaBase.ref1_x, y: plantaBase.ref1_y },
        { x: plantaBase.ref2_x, y: plantaBase.ref2_y },
        { x: plantaDaTarefa.ref1_x, y: plantaDaTarefa.ref1_y },
        { x: plantaDaTarefa.ref2_x, y: plantaDaTarefa.ref2_y }
      );
      const nx = mat.a * px_pdf + mat.c * py_pdf + mat.e;
      const ny = mat.b * px_pdf + mat.d * py_pdf + mat.f;
      px_pdf = nx;
      py_pdf = ny;
    }

    const size = 10;
    
    finalPage.drawCircle({
      x: px_pdf,
      y: py_pdf,
      size: size,
      color: parseHex(plantaDaTarefa.cor_identificacao || "#2563eb"),
      borderColor: rgb(1, 1, 1),
      borderWidth: 1.5,
    });

    const isConcluido = t.status === 'concluido';
    finalPage.drawText(isConcluido ? "✓" : "!", {
      x: px_pdf - (size * 0.4),
      y: py_pdf - (size * 0.4),
      size: size * 1.2,
      font: fontBold,
      color: rgb(1, 1, 1)
    });
  });

  // Remove o deslocamento global para desenhar a legenda no canto da página fixa
  finalPage.pushOperators(popGraphicsState());

  notificar("Adicionando legendas...", 80);

  // Desenhar a legenda de choques se houver choques
  if (choques.length > 0) {
    const legendMargin = 20;
    const legendPadding = 15;
    const lineHeight = 16;
    const titleSize = 14;
    const textSize = 10;
    
    let maxTextWidth = fontBold.widthOfTextAtSize("Legenda de Choques", titleSize);
    
    const legendItems = choques.map((c, i) => {
      const text = `${i + 1}. ${c.descricao}`;
      const width = fontNormal.widthOfTextAtSize(text, textSize);
      if (width > maxTextWidth) maxTextWidth = width;
      return text;
    });
    
    const boxWidth = maxTextWidth + 30 + legendPadding * 2; // +30 pro ícone/espaço
    const boxHeight = legendPadding * 2 + titleSize + 10 + (legendItems.length * lineHeight);
    
    // Posição no canto superior direito (PDF coordinates: 0,0 is bottom-left)
    const boxX = unionWidth - boxWidth - legendMargin;
    const boxY = unionHeight - boxHeight - legendMargin;
    
    // Fundo da legenda
    finalPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
      opacity: 0.9,
    });
    
    // Título
    finalPage.drawText("Legenda de Choques", {
      x: boxX + legendPadding,
      y: boxY + boxHeight - legendPadding - titleSize + 2,
      font: fontBold,
      size: titleSize,
      color: rgb(0, 0, 0)
    });
    
    // Itens
    legendItems.forEach((text, i) => {
      const itemY = boxY + boxHeight - legendPadding - titleSize - 10 - (i * lineHeight) - 10;
      
      // Ícone (mini triângulo)
      const px = boxX + legendPadding + 5;
      const py = itemY + 3;
      const size = 5;
      
      finalPage.pushOperators(pushGraphicsState());
      finalPage.pushOperators(
        setFillingRgbColor(254/255, 240/255, 138/255),
        setStrokingRgbColor(220/255, 38/255, 38/255),
        setLineWidth(1),
        moveTo(px, py + size),
        lineTo(px + size, py - size * 0.5),
        lineTo(px - size, py - size * 0.5),
        closePath(),
        fillAndStroke(),
        popGraphicsState()
      );
      
      // Texto
      finalPage.drawText(text, {
        x: boxX + legendPadding + 20,
        y: itemY,
        font: fontNormal,
        size: textSize,
        color: rgb(0, 0, 0)
      });
    });
    
    // Adicionar um número aos ícones no mapa também!
    // Para facilitar a associação com a legenda
    finalPage.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(1, 0, 0, 1, -minX, -minY)
    );
    choques.forEach((c, i) => {
      const px = c.ponto_x;
      const py = c.ponto_y;
      
      finalPage.drawText(`${i + 1}`, {
        x: px - 3,
        y: py + 15,
        size: 10,
        font: fontBold,
        color: rgb(0, 0, 0) // texto preto acima do triângulo
      });
    });
    finalPage.pushOperators(popGraphicsState());
  }

  notificar("Finalizando PDF...", 90);
  const pdfBytes = await finalDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  return { blob, url };
}
