"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importarComposicoes } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";
import { classificarCategoria } from "@/lib/orcamento/classificar-categoria";
import { Botao, Cartao, CartaoCabecalho, CartaoConteudo } from "@/components/ui";

type Linha = Array<unknown>;
type ComponenteImportado = { codigo?: string; nome: string; categoria: "mao_de_obra" | "material" | "equipamento" | "outro"; unidade: string; quantidade: number; custoUnitario: number };

function texto(valor: unknown) { return String(valor ?? "").trim(); }
function corrigirTexto(valor: unknown): string {
  const original = texto(valor);
  if (!/[ÃÂ�]/.test(original)) return original;
  try {
    const bytes = Uint8Array.from([...original].map((caractere) => caractere.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return original;
  }
}
function numero(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const bruto = texto(valor).replace(/[^0-9,.-]/g, "");
  const normalizado = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(/\.(?=.*\.)/g, "");
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : 0;
}
function indicePorNome(cabecalho: string[], padroes: RegExp[], fallback: number) {
  for (const padrao of padroes) {
    const indice = cabecalho.findIndex((nome) => padrao.test(nome));
    if (indice >= 0) return indice;
  }
  return fallback;
}
function chaveCabecalho(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function colunaTipoLinha(matriz: Linha[], largura: number) {
  const marcadores = new Set(["composicao", "composicao auxiliar", "insumo"]);
  let melhor = -1;
  let maior = 0;
  for (let coluna = 0; coluna < largura; coluna += 1) {
    const quantidade = matriz.reduce((total, linha) => total + (marcadores.has(chaveCabecalho(linha[coluna])) ? 1 : 0), 0);
    if (quantidade > maior) { maior = quantidade; melhor = coluna; }
  }
  return melhor;
}

export function ImportarComposicoes({ obraId }: { obraId: string }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cabecalho, setCabecalho] = useState(0);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, iniciarTransicao] = useTransition();
  const router = useRouter();

  async function lerArquivo(arquivo: File) {
    const XLSX = await import("@e965/xlsx");
    const conteudo = arquivo.name.toLowerCase().endsWith(".csv") ? await arquivo.text() : await arquivo.arrayBuffer();
    const workbook = XLSX.read(conteudo, { dense: true, raw: true, cellText: true, type: typeof conteudo === "string" ? "string" : "array" });
    const aba = workbook.Sheets[workbook.SheetNames[0]];
    if (!aba) return setMensagem("A planilha nao possui uma aba legivel.");
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: null });
    setLinhas(matriz);
    const primeiroCabecalho = matriz.findIndex((linha) => linha.filter((valor) => texto(valor)).length >= 4);
    const indice = primeiroCabecalho >= 0 ? primeiroCabecalho : 0;
    setCabecalho(indice);
    setColunas((matriz[indice] ?? []).map((valor, coluna) => corrigirTexto(valor) || `Coluna ${coluna + 1}`));
    setMensagem(null);
  }

  function importar() {
    const nomes = colunas.map((coluna) => coluna.toLowerCase());
    const codigo = indicePorNome(nomes, [/codigo.*compos/, /c[oó]digo/], 0);
    const nome = indicePorNome(nomes, [/descri.*compos/, /^descri/, /nome/], 1);
    const unidade = indicePorNome(nomes, [/^un(?:d|id|idade)?\.?$/, /unidade/], 2);
    const nomeComponente = indicePorNome(nomes, [/descri.*item/, /descri/, /componente/], nome);
    const unidadeComponente = indicePorNome(nomes, [/unidade.*item/, /unidade/, /^und/], unidade);
    const quantidade = indicePorNome(nomes, [/coeficiente/, /quant/, /qtd/], 0);
    const custo = indicePorNome(nomes, [/valor.*unit/, /pre[cç]o.*unit/, /custo.*total/, /total/], 0);
    // Coluna de codigo do componente/insumo. Nunca deve coincidir com a coluna de
    // codigo da composicao: se apontassem para a mesma coluna, cada linha com um
    // codigo diferente (ex.: insumos com codigos proprios) seria interpretada como
    // uma nova composicao em vez de um componente da composicao atual.
    let codigoItem = indicePorNome(nomes, [/codigo.*item/, /item.*codigo/], -1);
    if (codigoItem < 0) {
      const generico = indicePorNome(nomes, [/^codigo$/], -1);
      codigoItem = generico >= 0 && generico !== codigo ? generico : -1;
    }
    const tipo = indicePorNome(nomes, [/tipo.*item/, /^tipo$/, /categoria/], -1);
    const classificacao = indicePorNome(nomes, [/classifica[cç][aã]o/, /classe/], -1);
    const descricaoComponenteEhSeparada = nomeComponente !== nome;
    const tipoLinha = colunaTipoLinha(linhas.slice(cabecalho + 1), nomes.length);
    const grupos = new Map<string, { nome: string; unidade: string; componentes: ComponenteImportado[] }>();
    const codigosVistos = new Set<string>();
    let linhasResumo = 0;
    for (const linha of linhas.slice(cabecalho + 1)) {
      const codigoValor = texto(linha[codigo]);
      const nomeValor = texto(linha[nome]);
      if (!codigoValor || !nomeValor) continue;
      const tipoValor = tipo >= 0 ? texto(linha[tipo]) : "";
      const tipoLinhaValor = tipoLinha >= 0 ? chaveCabecalho(linha[tipoLinha]) : "";
      const codigoItemValor = codigoItem >= 0 ? texto(linha[codigoItem]) : "";
      const temQuantidade = texto(linha[quantidade]) !== "";
      const temCusto = texto(linha[custo]) !== "";
      const temDescricaoItem = descricaoComponenteEhSeparada && texto(linha[nomeComponente]) !== "";
      const primeiraLinhaDoCodigo = !codigosVistos.has(codigoValor);
      const ehTipoComposicao = /composi[cç][aã]o/.test(tipoValor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
      const ehLinhaComposicao = tipoLinhaValor === "composicao"
        && (tipoLinha !== tipo || chaveCabecalho(nomes[tipo]) === "tipo");
      // O preco da linha-pai ja representa toda a composicao. Uma composicao
      // auxiliar legitima possui codigo do item e coeficiente, por isso nao
      // cai nesta regra mesmo quando o tipo tambem e COMPOSICAO.
      const linhaResumo = ehLinhaComposicao
        || (ehTipoComposicao && !codigoItemValor && !temQuantidade)
        || (primeiraLinhaDoCodigo && !codigoItemValor && !temQuantidade && !temDescricaoItem)
        || (!codigoItemValor && !temQuantidade && !temCusto && !tipoValor);
      codigosVistos.add(codigoValor);
      if (linhaResumo) {
        linhasResumo += 1;
        const grupoResumo = grupos.get(codigoValor);
        if (grupoResumo) grupoResumo.nome = nomeValor;
        else grupos.set(codigoValor, { nome: nomeValor, unidade: texto(linha[unidade]) || "un", componentes: [] });
        continue;
      }
      const grupo = grupos.get(codigoValor) ?? { nome: nomeValor, unidade: texto(linha[unidade]) || "un", componentes: [] };
      if (ehLinhaComposicao) grupo.nome = nomeValor;
      const nomeItem = texto(linha[nomeComponente]) || nomeValor;
      const quantidadeValor = numero(linha[quantidade]);
      const custoUnitarioValor = numero(linha[custo]);
      const tipoComponente = tipo >= 0 ? texto(linha[tipo]) : "";
      const classificacaoComponente = classificacao >= 0 ? texto(linha[classificacao]) : "";
      grupo.componentes.push({
        codigo: codigoItemValor || undefined,
        nome: nomeItem,
        categoria: classificarCategoria(tipoComponente, classificacaoComponente, nomeItem),
        unidade: texto(linha[unidadeComponente]) || grupo.unidade,
        quantidade: quantidadeValor,
        custoUnitario: custoUnitarioValor,
      });
      grupos.set(codigoValor, grupo);
    }
    const composicoes = [...grupos.entries()].map(([codigoValor, grupo]) => ({ codigo: codigoValor, ...grupo }));
    iniciarTransicao(async () => {
      const resultado = await importarComposicoes({ obraId, composicoes });
      setMensagem(resultado.erro ?? `${resultado.quantidade ?? 0} composições importadas. ${linhasResumo > 0 ? `${linhasResumo} linhas-resumo foram excluídas do cálculo; o custo usa os coeficientes dos insumos e composições auxiliares.` : "O custo foi calculado pela soma dos componentes."}`);
      if (!resultado.erro) router.refresh();
    });
  }

  return <Cartao className="border-azul-200"><CartaoCabecalho><h2 className="text-lg font-semibold">Importar composições</h2><p className="text-sm text-superficie-500">Escolha uma planilha analítica e agrupe as linhas pelo código da composição.</p></CartaoCabecalho><CartaoConteudo className="space-y-3"><input className="block w-full rounded border-2 border-dashed border-azul-300 bg-azul-50 px-3 py-4 text-sm" type="file" accept=".xlsx,.xls,.csv" onChange={(evento) => { const arquivo = evento.target.files?.[0]; if (arquivo) void lerArquivo(arquivo); }} />{linhas.length > 0 && <><label className="block text-sm font-medium">Linha de cabeçalho<select className="mt-1 w-full rounded border border-borda px-3 py-2" value={cabecalho} onChange={(evento) => { const indice = Number(evento.target.value); setCabecalho(indice); setColunas((linhas[indice] ?? []).map((valor, coluna) => texto(valor) || `Coluna ${coluna + 1}`)); }}><option value={cabecalho}>Linha {cabecalho + 1}</option>{linhas.slice(0, 80).map((linha, indice) => <option key={indice} value={indice}>Linha {indice + 1}: {linha.filter((valor) => texto(valor)).slice(0, 4).map(texto).join(" · ") || "vazia"}</option>)}</select></label><Botao type="button" onClick={importar} disabled={salvando}>{salvando ? "Importando..." : "Importar composições"}</Botao></>}{mensagem && <p className="text-sm text-superficie-600">{mensagem}</p>}</CartaoConteudo></Cartao>;
}
