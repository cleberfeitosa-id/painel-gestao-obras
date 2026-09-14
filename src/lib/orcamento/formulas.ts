import type { LinhaOrcamento } from "./tipos";

type Token = { tipo: "numero" | "coluna" | "operador" | "abre" | "fecha"; valor: string };

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\s*(\[[^\]]+\]|\d+(?:[.,]\d+)?|[()+\-*/%])/g;
  let posicao = 0; let correspondencia: RegExpExecArray | null;
  while ((correspondencia = regex.exec(formula))) {
    if (correspondencia.index !== posicao) throw new Error("Formula invalida.");
    const valor = correspondencia[1]; posicao = regex.lastIndex;
    if (valor.startsWith("[")) tokens.push({ tipo: "coluna", valor: valor.slice(1, -1) });
    else if (/^\d/.test(valor)) tokens.push({ tipo: "numero", valor: valor.replace(",", ".") });
    else if (valor === "(") tokens.push({ tipo: "abre", valor });
    else if (valor === ")") tokens.push({ tipo: "fecha", valor });
    else tokens.push({ tipo: "operador", valor });
  }
  if (posicao !== formula.length || !tokens.length) throw new Error("Formula invalida.");
  return tokens;
}

export function avaliarFormula(formula: string, linha: LinhaOrcamento): number {
  const tokens = tokenizar(formula); let indice = 0;
  const primario = (): number => {
    const token = tokens[indice++]; if (!token) throw new Error("Formula incompleta.");
    if (token.tipo === "operador" && token.valor === "-") return -primario();
    if (token.tipo === "abre") { const resultado = soma(); if (tokens[indice++]?.tipo !== "fecha") throw new Error("Parenteses invalidos."); return resultado; }
    if (token.tipo === "numero") return Number(token.valor);
    if (token.tipo === "coluna") return Number(linha[token.valor] ?? 0);
    throw new Error("Operando invalido.");
  };
  const produto = (): number => { let resultado = primario(); while (tokens[indice]?.tipo === "operador" && /[*/%]/.test(tokens[indice].valor)) { const op = tokens[indice++].valor; const proximo = primario(); if (op === "*") resultado *= proximo; else if (op === "/") { if (proximo === 0) throw new Error("Divisao por zero."); resultado /= proximo; } else resultado *= proximo / 100; } return resultado; };
  const soma = (): number => { let resultado = produto(); while (tokens[indice]?.tipo === "operador" && /[+-]/.test(tokens[indice].valor)) { const op = tokens[indice++].valor; resultado += op === "+" ? produto() : -produto(); } return resultado; };
  const resultado = soma(); if (indice !== tokens.length || !Number.isFinite(resultado)) throw new Error("Formula invalida."); return resultado;
}

export function aplicarFormulas(linhas: LinhaOrcamento[], formulas: Record<string, string>): LinhaOrcamento[] {
  return linhas.map((linha) => { const resultado = { ...linha }; for (const [coluna, formula] of Object.entries(formulas)) resultado[coluna] = avaliarFormula(formula, resultado); return resultado; });
}
