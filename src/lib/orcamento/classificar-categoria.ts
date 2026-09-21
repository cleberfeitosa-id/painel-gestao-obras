export type CategoriaComponente = "mao_de_obra" | "material" | "equipamento" | "outro";

const KEYWORDS_MAO_DE_OBRA = [
  "CARPINTEIRO", "PEDREIRO", "SERVENTE", "ELETRICISTA", "ENCANADOR",
  "AJUDANTE", "ARMADOR", "PINTOR", "AZULEJISTA", "GESSEIRO",
  "TELHADISTA", "OPERADOR", "MOTORISTA", "ENGENHEIRO", "TECNICO",
  "MESTRE", "ENCARREGADO", "APONTADOR", "VIGIA", "BOMBEIRO",
  "SOLDADOR", "LUBRIFICADOR", "SERRALHEIRO", "MONTADOR",
  "CALHEIRO", "FUNILEIRO", "VIDRACEIRO", "LADRILLHADOR",
  "ALMOXARIFE", "TOMBADOR", "COZINHEIRO",
  "CAIXEIRO", "OFICIAL", "MEIO OFICIAL",
];

const KEYWORDS_EQUIPAMENTO = [
  "GUINCHO", "BETONEIRA", "ANDAIME", "COMPACTADOR", "VIBRADOR",
  "SERRA", "CORTADORA", "BOMBA", "GERADOR", "TRATOR",
  "CAMINHAO", "RETROESCAVADEIRA", "ESCAVADEIRA", "PA CARREGADEIRA",
  "MOTONIVELADORA", "ROL", "COMPRESSOR", "MARTELETE",
  "FURADEIRA", "PARAFUSADEIRA", "ESMERILHADEIRA", "LIXADEIRA",
  "ASPIRADOR", "LAVADORA", "ELEVADOR",
  "PONT ROLANTE", "EMPILHADEIRA", "REBOQUE", "CARRINHO",
  "GUINDASTE", "GRUA", "PLATAFORMA", "CADEIRINHA",
  "BALANCIM", "SOLDADEIRA", "MAQUINA", "EQUIPAMENTO",
  "CUSTO HORARIO", "CUSTOS HORARIOS",
];

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function temKeyword(texto: string, keywords: string[]): boolean {
  const normalizado = " " + normalizar(texto) + " ";
  for (const kw of keywords) {
    const kwNormalizado = normalizar(kw);
    if (normalizado.includes(" " + kwNormalizado + " ")) return true;
  }
  return false;
}

function ehAuxiliarProfissional(texto: string): boolean {
  return /\bAUXILIAR\s+DE\s+(ELETRICISTA|ENCANADOR|PEDREIRO|SERVICOS?|OBRA|MANUTENCAO)\b/i.test(
    normalizar(texto),
  );
}

function ehExplicitamenteEquipamento(classificacao: string): boolean {
  const c = normalizar(classificacao);
  return c === "equipamento" || c.includes("equipamento");
}

export function classificarCategoria(
  tipo: string,
  classificacao: string,
  nome: string,
): CategoriaComponente {
  const t = normalizar(texto(tipo));
  const c = texto(classificacao);
  const n = texto(nome);

  const categoriaNormalizada = normalizar(c).replace(/[\s-]+/g, "_");
  if (categoriaNormalizada === "mao_de_obra" || categoriaNormalizada === "mobra" || categoriaNormalizada === "mao_de_obra_com_encargos") {
    return "mao_de_obra";
  }
  if (categoriaNormalizada === "equipamento") return "equipamento";
  if (categoriaNormalizada === "material" || categoriaNormalizada === "insumo") return "material";

  if (t === "composicao") return "outro";

  // A categoria da planilha SINAPI pode vir como "Outros" mesmo quando
  // a descricao identifica claramente um profissional. A descricao tem
  // precedencia para nao perder o custo de mao de obra.
  if (temKeyword(n, KEYWORDS_MAO_DE_OBRA) || ehAuxiliarProfissional(n)) return "mao_de_obra";
  if (ehExplicitamenteEquipamento(c) || temKeyword(n, KEYWORDS_EQUIPAMENTO)) return "equipamento";

  const ehInsumo = t === "insumo";
  const ehCompAuxiliar = t === "composicao auxiliar" || t === "composição auxiliar";

  if (ehInsumo) {
    return "material";
  }

  if (ehCompAuxiliar) {
    return "mao_de_obra";
  }
  return "material";
}
