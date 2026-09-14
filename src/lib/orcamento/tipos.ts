export type ColunaOrcamento = {
  id: string;
  nome: string;
  tipo: "texto" | "numero" | "moeda";
  selecionada: boolean;
  funcao?: FuncaoColunaOrcamento;
  formula?: string;
};

export type FuncaoColunaOrcamento =
  | "codigo" | "descricao" | "unidade" | "quantidade" | "valor_unitario"
  | "valor_total" | "valor_bdi" | "custo_real" | "grupo" | "fonte"
  | "categoria" | "composicao" | "bdi" | "quantidade_executada";

export type LinhaOrcamento = Record<string, string | number | null> & {
  __item_id?: string;
  __tipo?: "item" | "grupo" | "subtotal" | "informativa";
  __grupo?: string | null;
  __aba?: string | null;
  __valor_original?: number | null;
  __valor_total_original?: number | null;
  __valor_calculado?: number | null;
  __composicao_id?: string | null;
  __composicao_versao?: string | null; // ISO timestamptz
};

export type ResultadoImportacao = {
  colunas: ColunaOrcamento[];
  linhas: LinhaOrcamento[];
  erros: Array<{ linha: number; mensagem: string }>;
  duplicadas: string[];
  avisos: string[];
};

export type PlanilhaOrcamento = {
  colunas: ColunaOrcamento[];
  linhas: LinhaOrcamento[];
};

export type ResumoOrcamento = {
  totalPrevisto: number;
  totalReal: number;
  variacao: number;
  quantidadeLinhas: number;
};
