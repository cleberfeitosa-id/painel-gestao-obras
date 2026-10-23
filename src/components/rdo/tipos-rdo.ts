export type AjusteRdo = { x: number; y: number; tamanho: number; fonte: "helvetica" | "times" | "courier" };
export type ConteudoRdo = {
  turnoTempo: string;
  clima: "sol" | "nublado" | "chuva" | "impraticavel";
  tarefas: { manha: string; tarde: string };
  observacoes: { descricao: string; tipo: string }[];
  equipe: { codigo: number; quantidade: string }[];
  alimentacao: { codigo: number; quantidade: string }[];
  ajustes?: Record<string, AjusteRdo>;
};

export const AJUSTES_RDO_PADRAO: Record<string, AjusteRdo> = {
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

export function normalizarConteudoRdo(valor: unknown): ConteudoRdo {
  const antigo = (valor && typeof valor === "object" ? valor : {}) as Partial<ConteudoRdo> & { manha?: string; tarde?: string; ocorrencias?: string; alimentacao?: string | ConteudoRdo["alimentacao"] };
  const equipe = Array.from({ length: 10 }, (_, indice) => ({
    codigo: indice + 1,
    quantidade: antigo.equipe?.find((item) => item.codigo === indice + 1)?.quantidade ?? "",
  }));
  const observacoes = Array.from({ length: 3 }, (_, indice) => antigo.observacoes?.[indice] ?? { descricao: "", tipo: "" });
  const alimentacao = Array.isArray(antigo.alimentacao) ? antigo.alimentacao.slice(0, 1) : [{ codigo: 1, quantidade: typeof antigo.alimentacao === "string" ? antigo.alimentacao : "" }];
  return {
    turnoTempo: antigo.turnoTempo ?? "",
    clima: antigo.clima ?? "sol",
    tarefas: { manha: antigo.tarefas?.manha ?? antigo.manha ?? "", tarde: antigo.tarefas?.tarde ?? antigo.tarde ?? "" },
    observacoes: observacoes.map((item) => ({ descricao: item.descricao ?? "", tipo: item.tipo ?? "" })),
    equipe,
    alimentacao: [{ codigo: 1, quantidade: alimentacao[0]?.quantidade ?? "" }],
    ajustes: { ...AJUSTES_RDO_PADRAO, ...(antigo.ajustes ?? {}) },
  };
}
