import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { RdoRow } from "@/lib/supabase/database.types";
import { paraData } from "@/lib/datas";
import { normalizarConteudoRdo, type AjusteRdo, type ConteudoRdo } from "@/components/rdo/tipos-rdo";

const POSICOES: Record<string, AjusteRdo> = {
  turnoTempo: { x: 420, y: 795, tamanho: 7, fonte: "helvetica" },
  tarefaManha: { x: 115, y: 742, tamanho: 7, fonte: "helvetica" },
  tarefaTarde: { x: 115, y: 727, tamanho: 7, fonte: "helvetica" },
  observacao1Descricao: { x: 115, y: 440, tamanho: 7, fonte: "helvetica" },
  observacao1Tipo: { x: 480, y: 440, tamanho: 7, fonte: "helvetica" },
  observacao2Descricao: { x: 115, y: 425, tamanho: 7, fonte: "helvetica" },
  observacao2Tipo: { x: 480, y: 425, tamanho: 7, fonte: "helvetica" },
  observacao3Descricao: { x: 115, y: 410, tamanho: 7, fonte: "helvetica" },
  observacao3Tipo: { x: 480, y: 410, tamanho: 7, fonte: "helvetica" },
  alimentacao1: { x: 590, y: 200, tamanho: 7, fonte: "helvetica" },
};

function texto(page: PDFPage, font: PDFFont, value: string | undefined, ajuste: AjusteRdo, maxWidth: number) {
  if (!value?.trim()) return;
  let tamanho = ajuste.tamanho;
  while (tamanho > 4 && font.widthOfTextAtSize(value, tamanho) > maxWidth) tamanho -= 0.25;
  page.drawText(value, { x: ajuste.x, y: ajuste.y, size: tamanho, font, color: rgb(0.05, 0.05, 0.05), maxWidth });
}

export async function exportarRdoPdf(rdo: RdoRow) {
  const modelo = await readFile(path.join(process.cwd(), "RDO-MODELO.pdf"));
  const documento = await PDFDocument.load(modelo);
  while (documento.getPageCount() > 1) documento.removePage(1);
  const pagina = documento.getPages()[0];
  const dados = normalizarConteudoRdo(rdo.conteudo) as ConteudoRdo;
  const ajustes = { ...POSICOES, ...(dados.ajustes ?? {}) };

  const fontes = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier } as const;
  const fonteCache = new Map<string, PDFFont>();
  const obterFonte = async (nome: AjusteRdo["fonte"]) => { const existente = fonteCache.get(nome); if (existente) return existente; const nova = await documento.embedFont(fontes[nome]); fonteCache.set(nome, nova); return nova; };
  const escrever = async (valor: string | undefined, ajuste: AjusteRdo, largura: number) => texto(pagina, await obterFonte(ajuste.fonte), valor, ajuste, largura);
  await escrever(dados.turnoTempo, ajustes.turnoTempo, 230);
  await escrever(dados.tarefas.manha, ajustes.tarefaManha, 535);
  await escrever(dados.tarefas.tarde, ajustes.tarefaTarde, 535);
  for (const [indice, linha] of dados.observacoes.entries()) {
    await escrever(linha.descricao, ajustes[`observacao${indice + 1}Descricao`], 330);
    await escrever(linha.tipo, ajustes[`observacao${indice + 1}Tipo`], 170);
  }
  for (const item of dados.equipe ?? []) await escrever(item.quantidade, { x: 590, y: 356 - ((item.codigo - 1) * 13), tamanho: 7, fonte: "helvetica" }, 55);
  await escrever(dados.alimentacao?.[0]?.quantidade, ajustes.alimentacao1, 55);

  const diaX = [650, 468, 496, 526, 555, 586, 618][paraData(rdo.data).getUTCDay()] ?? 650;
  pagina.drawText("X", { x: diaX, y: 815, size: 8, font: await obterFonte("helvetica"), color: rgb(0.05, 0.05, 0.05) });
  const climaX = { sol: 196, nublado: 350, chuva: 491, impraticavel: 593 }[dados.clima] ?? 196;
  pagina.drawText("X", { x: climaX, y: 735, size: 8, font: await obterFonte("helvetica"), color: rgb(0.05, 0.05, 0.05) });
  return documento.save({ useObjectStreams: false });
}
