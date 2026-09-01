import type { Calibracao } from "@/lib/pdf/coordenadas";
import { formatarMedida } from "@/lib/pdf/coordenadas";
import { rotuloCondutor } from "./calculos";
import type { ItemLevantamento, Nivel3D, ResumoLevantamento } from "./tipos";

interface DadosExportacao {
  nomeLevantamento: string;
  obraNome: string;
  plantaNome: string;
  pagina: number;
  dataCriacao?: string;
  itens: ItemLevantamento[];
  resumo: ResumoLevantamento;
  niveis: Nivel3D[];
  calibracao: Calibracao | null;
}

export function gerarCsvLevantamento(dados: DadosExportacao): string {
  const linhas: string[] = [];

  function escaparCsv(campo: string | number | null | undefined): string {
    if (campo === null || campo === undefined) return '""';
    const str = String(campo).replace(/"/g, '""');
    return `"${str}"`;
  }

  linhas.push(
    [
      escaparCsv("LEVANTAMENTO DE QUANTIDADES - VASCONCELOS ENGENHARIA"),
    ].join(";"),
  );
  linhas.push(
    [
      escaparCsv("Obra"),
      escaparCsv(dados.obraNome),
      escaparCsv("Planta"),
      escaparCsv(dados.plantaNome),
      escaparCsv("Página"),
      escaparCsv(dados.pagina),
    ].join(";"),
  );
  linhas.push(
    [
      escaparCsv("Levantamento"),
      escaparCsv(dados.nomeLevantamento),
      escaparCsv("Data"),
      escaparCsv(new Date().toLocaleDateString("pt-BR")),
      escaparCsv("Calibração"),
      escaparCsv(
        dados.calibracao
          ? `1 pt = ${formatarMedida(dados.calibracao.unidadesPorPonto, dados.calibracao.unidade)}`
          : "Não calibrada (em pontos)",
      ),
    ].join(";"),
  );
  linhas.push("");

  linhas.push([escaparCsv("1. RESUMO DE ELEMENTOS CONTADOS (PONTOS)")].join(";"));
  linhas.push(
    [
      escaparCsv("Categoria"),
      escaparCsv("Elemento"),
      escaparCsv("Nível / Altura"),
      escaparCsv("Quantidade"),
      escaparCsv("Unidade"),
    ].join(";"),
  );
  for (const el of dados.resumo.elementos) {
    linhas.push(
      [
        escaparCsv(el.categoria),
        escaparCsv(el.nome),
        escaparCsv(el.nivelNome ?? "Padrão"),
        escaparCsv(el.quantidade),
        escaparCsv("un"),
      ].join(";"),
    );
  }
  linhas.push(
    [
      escaparCsv("TOTAL DE ELEMENTOS"),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(dados.resumo.totalGeralElementos),
      escaparCsv("un"),
    ].join(";"),
  );
  linhas.push("");

  linhas.push(
    [escaparCsv("2. RESUMO DE DISTÂNCIAS / TUBULAÇÕES / ELETRODUTOS")].join(";"),
  );
  linhas.push(
    [
      escaparCsv("Categoria"),
      escaparCsv("Tipo de Linha / Tubulação"),
      escaparCsv("Trechos"),
      escaparCsv("Comprimento Total"),
      escaparCsv("Unidade"),
    ].join(";"),
  );
  for (const dist of dados.resumo.distancias) {
    linhas.push(
      [
        escaparCsv(dist.categoria),
        escaparCsv(dist.nome),
        escaparCsv(dist.quantidadeTrechos),
        escaparCsv(dist.totalMetros.toFixed(2).replace(".", ",")),
        escaparCsv("m"),
      ].join(";"),
    );
  }
  for (const desc of dados.resumo.descidasSubidas) {
    linhas.push(
      [
        escaparCsv("Tubulações e Cabos"),
        escaparCsv(`Descidas/Subidas Verticais (${desc.nome})`),
        escaparCsv(desc.quantidade),
        escaparCsv(desc.alturaTotal.toFixed(2).replace(".", ",")),
        escaparCsv("m"),
      ].join(";"),
    );
  }
  linhas.push(
    [
      escaparCsv("TOTAL DE DISTÂNCIAS / TUBULAÇÕES"),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(dados.resumo.totalGeralDistancias.toFixed(2).replace(".", ",")),
      escaparCsv("m"),
    ].join(";"),
  );
  linhas.push("");

  linhas.push(
    [escaparCsv("3. RESUMO DE CABOS E CONDUTORES (DETALHADO POR CIRCUITO)")].join(
      ";",
    ),
  );
  linhas.push(
    [
      escaparCsv("Circuito"),
      escaparCsv("Tipo de Cabo / Bitola"),
      escaparCsv("Tipo Condutor"),
      escaparCsv("Função Condutor"),
      escaparCsv("Qtd Condutores"),
      escaparCsv("Comprimento Total"),
      escaparCsv("Unidade"),
    ].join(";"),
  );
  for (const c of dados.resumo.cabos) {
    linhas.push(
      [
        escaparCsv(c.circuito),
        escaparCsv(c.tipoCabo),
        escaparCsv(c.tipoCondutor),
        escaparCsv(rotuloCondutor(c.funcao)),
        escaparCsv(c.quantidadeCondutores),
        escaparCsv(c.comprimentoTotal.toFixed(2).replace(".", ",")),
        escaparCsv("m"),
      ].join(";"),
    );
  }
  linhas.push(
    [
      escaparCsv("TOTAL DE CONDUTORES / CABOS"),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(dados.resumo.totalGeralCabos.toFixed(2).replace(".", ",")),
      escaparCsv("m"),
    ].join(";"),
  );
  linhas.push("");

  linhas.push([escaparCsv("4. RESUMO DE ÁREAS E PERÍMETROS")].join(";"));
  linhas.push(
    [
      escaparCsv("Categoria"),
      escaparCsv("Tipo de Área"),
      escaparCsv("Quantidade"),
      escaparCsv("Área Total (m²)"),
      escaparCsv("Perímetro Total (m)"),
    ].join(";"),
  );
  for (const a of dados.resumo.areas) {
    linhas.push(
      [
        escaparCsv(a.categoria),
        escaparCsv(a.nome),
        escaparCsv(a.quantidade),
        escaparCsv(a.totalArea.toFixed(2).replace(".", ",")),
        escaparCsv(a.totalPerimetro.toFixed(2).replace(".", ",")),
      ].join(";"),
    );
  }
  linhas.push(
    [
      escaparCsv("TOTAL DE ÁREAS"),
      escaparCsv(""),
      escaparCsv(""),
      escaparCsv(dados.resumo.totalGeralAreas.toFixed(2).replace(".", ",")),
      escaparCsv(""),
    ].join(";"),
  );
  linhas.push("");

  linhas.push([escaparCsv("5. LISTAGEM ITEM A ITEM")].join(";"));
  linhas.push(
    [
      escaparCsv("Item #"),
      escaparCsv("Tipo"),
      escaparCsv("Categoria"),
      escaparCsv("Nome"),
      escaparCsv("Cota / Nível"),
      escaparCsv("Medida Linear (m)"),
      escaparCsv("Área (m²)"),
      escaparCsv("Circuito / Detalhe"),
    ].join(";"),
  );
  for (const item of dados.itens) {
    let detalhe = "";
    if (item.metadadosCabo) {
      const conds = item.metadadosCabo.condutores
        .map((c) => `${c.quantidade}x ${rotuloCondutor(c.tipo)}`)
        .join(", ");
      detalhe = `Circuito: ${item.metadadosCabo.circuito} | Cabo: ${item.metadadosCabo.tipoCabo} (${conds})`;
    } else if (item.tipo === "descida_subida") {
      detalhe = `De ${item.alturaOrigem ?? 2.8}m até ${item.alturaDestino ?? 0.3}m (Δ=${Math.abs((item.alturaOrigem ?? 2.8) - (item.alturaDestino ?? 0.3)).toFixed(2)}m)`;
    }

    linhas.push(
      [
        escaparCsv(item.numero),
        escaparCsv(item.tipo),
        escaparCsv(item.categoria),
        escaparCsv(item.nome),
        escaparCsv(
          item.altura !== undefined
            ? `${item.altura}m`
            : item.nivelId ?? "-",
        ),
        escaparCsv(
          item.comprimentoReal !== undefined
            ? item.comprimentoReal.toFixed(2).replace(".", ",")
            : "-",
        ),
        escaparCsv(
          item.areaReal !== undefined
            ? item.areaReal.toFixed(2).replace(".", ",")
            : "-",
        ),
        escaparCsv(detalhe || item.observacao || "-"),
      ].join(";"),
    );
  }

  return "\uFEFF" + linhas.join("\r\n");
}

export function baixarArquivoTexto(
  conteudo: string,
  nomeArquivo: string,
  tipoMime = "text/csv;charset=utf-8;",
) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function baixarDataUrl(dataUrl: string, nomeArquivo: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportarParaPdfViaImpressao(
  htmlConteudo: string,
  tituloDocumento: string,
) {
  const janelaImpressao = window.open("", "_blank");
  if (!janelaImpressao) {
    alert("Permita pop-ups no navegador para visualizar a impressão do PDF.");
    return;
  }

  janelaImpressao.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${tituloDocumento}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          color: #1e293b;
          margin: 0;
          padding: 0;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
          color: #0369a1;
        }
        .header p {
          margin: 2px 0 0 0;
          color: #64748b;
          font-size: 10px;
        }
        .grid-tabelas {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .secao {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px;
          break-inside: avoid;
        }
        .secao h3 {
          margin: 0 0 6px 0;
          font-size: 12px;
          color: #0f172a;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        th, td {
          padding: 4px 6px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        th {
          background: #f1f5f9;
          font-weight: 600;
          color: #334155;
        }
        .text-right {
          text-align: right;
        }
        .badge-cor {
          display: inline-block;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          margin-right: 4px;
          vertical-align: middle;
        }
        .imagem-container {
          margin-top: 10px;
          text-align: center;
          page-break-before: always;
        }
        .imagem-container img {
          max-width: 100%;
          max-height: 180mm;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
        }
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      ${htmlConteudo}
      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 300);
        });
      </script>
    </body>
    </html>
  `);

  janelaImpressao.document.close();
}
