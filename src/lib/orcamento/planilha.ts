import type { ColunaOrcamento, FuncaoColunaOrcamento, LinhaOrcamento, ResultadoImportacao } from "./tipos";

export function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.replace(/^\uFEFF/, "").trim() : valor == null ? "" : String(valor).trim();
}

export function numeroBrasileiro(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const original = texto(valor).replace(/\s/g, "");
  if (!original) return null;
  const negativo = original.startsWith("-");
  const limpo = original.replace(/^[+-]/, "").replace(/R\$|%/gi, "");
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, "") : limpo;
  const resultado = Number(`${negativo ? "-" : ""}${normalizado}`);
  return Number.isFinite(resultado) ? resultado : null;
}

export function normalizarCabecalho(valor: unknown): string {
  return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const FUNCOES: Array<[FuncaoColunaOrcamento, RegExp[]]> = [
  ["item", [/^item$|^item_do_orcamento$|^numero_item$|^num_item$/]], ["codigo", [/^codigo$|^cod$|sinapi|composicao/]], ["descricao", [/descricao|servico|insumo|nome/]],
  ["unidade", [/^unidade$|^un$/]], ["quantidade", [/quantidade|qtd|^quant/]], ["valor_unitario", [/valor_unitario|preco_unitario|preco|unitario/]],
  ["valor_total", [/valor_total|total|previsto|orcado/]], ["valor_bdi", [/valor_bdi|com_bdi/]], ["custo_real", [/custo_real|realizado|executado|real/]],
  ["grupo", [/grupo|capitulo|etapa/]], ["fonte", [/fonte|origem/]], ["categoria", [/categoria|tipo/]], ["bdi", [/^bdi$|percentual_bdi/]],
  ["quantidade_executada", [/quantidade_executada|medida|medido/]],
];

export function detectarFuncao(nome: string): FuncaoColunaOrcamento | undefined {
  const chave = normalizarCabecalho(nome);
  return FUNCOES.find(([, padroes]) => padroes.some((padrao) => padrao.test(chave)))?.[0];
}

export function detectarTipoColuna(valores: unknown[]): ColunaOrcamento["tipo"] {
  const amostra = valores.filter((valor) => texto(valor) !== "").slice(0, 25);
  if (amostra.length && amostra.every((valor) => numeroBrasileiro(valor) !== null)) {
    return amostra.some((valor) => /R\$|%/.test(texto(valor))) ? "moeda" : "numero";
  }
  return "texto";
}

export function classificarLinha(linha: Record<string, unknown>): LinhaOrcamento["__tipo"] {
  const valores = Object.values(linha).map(texto).filter(Boolean);
  if (!valores.length) return "informativa";
  const primeira = valores[0].toLowerCase();
  if (/subtotal|total geral|^total$/.test(primeira)) return "subtotal";
  if (valores.length <= 2 && !Object.values(linha).some((v) => numeroBrasileiro(v) !== null)) return "grupo";
  return "item";
}

export function criarColunas(cabecalho: unknown[], linhas: unknown[][]): ColunaOrcamento[] {
  return cabecalho.map((valor, indice) => {
    const nome = texto(valor) || `Coluna ${indice + 1}`;
    return { id: `coluna_${indice}`, nome, tipo: detectarTipoColuna(linhas.map((linha) => linha[indice])), selecionada: true, funcao: detectarFuncao(nome) };
  });
}

export function converterMatriz(cabecalho: unknown[], matriz: unknown[][], aba?: string): ResultadoImportacao {
  const colunas = criarColunas(cabecalho, matriz);
  const erros: ResultadoImportacao["erros"] = [];
  const duplicadas: string[] = [];
  const vistos = new Set<string>();
  const linhas = matriz.map((valores) => {
    const linha: LinhaOrcamento = {};
    colunas.forEach((coluna, colunaIndex) => {
      const valor = valores[colunaIndex];
      if (valor == null || texto(valor) === "") linha[coluna.id] = null;
      else if (coluna.tipo !== "texto") linha[coluna.id] = numeroBrasileiro(valor) ?? texto(valor);
      else linha[coluna.id] = texto(valor);
    });
    linha.__item_id = crypto.randomUUID();
    linha.__tipo = classificarLinha(linha); linha.__aba = aba ?? null;
    const funcaoCodigo = colunas.find((coluna) => coluna.funcao === "codigo");
    const codigo = funcaoCodigo ? texto(linha[funcaoCodigo.id]) : "";
    if (codigo) { if (vistos.has(codigo)) duplicadas.push(codigo); vistos.add(codigo); }
    return linha;
  }).filter((linha, indice) => {
    const vazia = Object.entries(linha).filter(([chave]) => !chave.startsWith("__")).every(([, valor]) => texto(valor) === "");
    if (vazia) return false;
    if (linha.__tipo === "subtotal") return true;
    if (!Object.values(linha).some((valor) => texto(valor) !== "")) erros.push({ linha: indice + 1, mensagem: "Linha vazia." });
    return true;
  });
  return { colunas, linhas, erros, duplicadas, avisos: duplicadas.length ? ["Foram encontrados códigos duplicados; a associação automática foi evitada."] : [] };
}

export function dividirEmLotes<T>(valores: T[], limiteBytes = 500_000): T[][] {
  const lotes: T[][] = []; let atual: T[] = []; let bytes = 2;
  for (const valor of valores) {
    const tamanho = new TextEncoder().encode(JSON.stringify(valor)).byteLength + 1;
    if (tamanho > limiteBytes) throw new Error("Uma linha excede o limite de importacao.");
    if (atual.length && bytes + tamanho > limiteBytes) { lotes.push(atual); atual = []; bytes = 2; }
    atual.push(valor); bytes += tamanho;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
