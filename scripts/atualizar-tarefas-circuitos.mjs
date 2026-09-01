#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function carregarEnvLocal() {
  const env = {};
  let conteudo;
  try {
    conteudo = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return env;
  }
  for (const linha of conteudo.split("\n")) {
    const match = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let valor = match[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    env[match[1]] = valor;
  }
  return env;
}

const env = carregarEnvLocal();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecreta = env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !chaveSecreta) {
  console.error("Necessário NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local");
  process.exit(1);
}

function obterNomeCorCabo(hex) {
  if (!hex) return "Padrão";
  const h = hex.trim().toUpperCase();
  switch (h) {
    case "#FFFFFF":
    case "#FFF":
      return "Branco";
    case "#000000":
    case "#000":
      return "Preto";
    case "#EF4444":
    case "#DC2626":
    case "#B91C1C":
    case "#F87171":
      return "Vermelho";
    case "#2563EB":
    case "#3B82F6":
    case "#1D4ED8":
    case "#60A5FA":
    case "#1E3A8A":
      return "Azul";
    case "#16A34A":
    case "#10B981":
    case "#22C55E":
    case "#15803D":
    case "#059669":
      return "Verde";
    case "#F59E0B":
    case "#EAB308":
    case "#D97706":
    case "#FBBF24":
    case "#CA8A04":
      return "Amarelo";
    case "#F97316":
    case "#EA580C":
    case "#FB923C":
    case "#C2410C":
      return "Laranja";
    case "#A855F7":
    case "#9333EA":
    case "#7E22CE":
    case "#C084FC":
      return "Roxo";
    case "#EC4899":
    case "#DB2777":
    case "#F472B6":
      return "Rosa";
    case "#06B6D4":
    case "#0891B2":
    case "#22D3EE":
      return "Ciano";
    case "#64748B":
    case "#475569":
    case "#94A3B8":
    case "#334155":
      return "Cinza";
    case "#854D0E":
    case "#713F12":
    case "#A16207":
      return "Marrom";
    default:
      return hex;
  }
}

function rotuloCondutor(funcao) {
  switch (funcao) {
    case "fase":
      return "Fase";
    case "neutro":
      return "Neutro";
    case "terra":
      return "Terra";
    case "retorno":
      return "Retorno";
    default:
      return funcao;
  }
}

function formatarMetros(valor, casas = 2) {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} m`;
}

function formatarDescricao(dados) {
  const circuitoId = dados.circuito ? `Circuito ${dados.circuito}` : "Circuito Elétrico";
  const tipoCabo = dados.tipoCabo || "Cabo Flexível 750V 2.5mm²";
  const tipoCondutor = dados.tipoCondutor || "Cobre";
  const compLinear = dados.comprimento || 0;
  const alturaTrecho = dados.altura !== undefined ? dados.altura : 2.8;

  const listaCondutores = [];

  if (dados.fases && dados.fases.length > 0) {
    for (const f of dados.fases) {
      if (f.quantidade > 0) {
        const cor = f.cor || "#FFFFFF";
        listaCondutores.push({
          funcaoRotulo: `Fase ${f.nome}`,
          corHex: cor,
          corNome: obterNomeCorCabo(cor),
          quantidade: f.quantidade,
          comprimentoTotal: compLinear * f.quantidade,
        });
      }
    }
    for (const cond of dados.condutores || []) {
      if (cond.tipo !== "fase" && cond.quantidade > 0) {
        const corPadrao =
          cond.tipo === "neutro"
            ? "#2563EB"
            : cond.tipo === "terra"
              ? "#16A34A"
              : "#F59E0B";
        const cor = cond.cor || corPadrao;
        listaCondutores.push({
          funcaoRotulo: rotuloCondutor(cond.tipo),
          corHex: cor,
          corNome: obterNomeCorCabo(cor),
          quantidade: cond.quantidade,
          comprimentoTotal: compLinear * cond.quantidade,
        });
      }
    }
  } else if (dados.condutores && dados.condutores.length > 0) {
    for (const cond of dados.condutores) {
      if (cond.quantidade > 0) {
        if (cond.tipo === "fase") {
          if (cond.fase) {
            const cor = cond.cor || dados.corFase || "#FFFFFF";
            listaCondutores.push({
              funcaoRotulo: `Fase ${cond.fase}`,
              corHex: cor,
              corNome: obterNomeCorCabo(cor),
              quantidade: cond.quantidade,
              comprimentoTotal: compLinear * cond.quantidade,
            });
          } else if (cond.quantidade === 1) {
            const cor = dados.corFaseR || dados.corFase || cond.cor || "#FFFFFF";
            listaCondutores.push({
              funcaoRotulo: "Fase R",
              corHex: cor,
              corNome: obterNomeCorCabo(cor),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
          } else if (cond.quantidade === 2) {
            const corR = dados.corFaseR || dados.corFase || "#FFFFFF";
            const corS = dados.corFaseS || "#000000";
            listaCondutores.push({
              funcaoRotulo: "Fase R",
              corHex: corR,
              corNome: obterNomeCorCabo(corR),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
            listaCondutores.push({
              funcaoRotulo: "Fase S",
              corHex: corS,
              corNome: obterNomeCorCabo(corS),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
          } else if (cond.quantidade === 3) {
            const corR = dados.corFaseR || dados.corFase || "#FFFFFF";
            const corS = dados.corFaseS || "#000000";
            const corT = dados.corFaseT || "#EF4444";
            listaCondutores.push({
              funcaoRotulo: "Fase R",
              corHex: corR,
              corNome: obterNomeCorCabo(corR),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
            listaCondutores.push({
              funcaoRotulo: "Fase S",
              corHex: corS,
              corNome: obterNomeCorCabo(corS),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
            listaCondutores.push({
              funcaoRotulo: "Fase T",
              corHex: corT,
              corNome: obterNomeCorCabo(corT),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
          } else {
            const cor = cond.cor || dados.corFase || "#FFFFFF";
            listaCondutores.push({
              funcaoRotulo: "Fase",
              corHex: cor,
              corNome: obterNomeCorCabo(cor),
              quantidade: cond.quantidade,
              comprimentoTotal: compLinear * cond.quantidade,
            });
          }
        } else {
          const corPadrao =
            cond.tipo === "neutro"
              ? "#2563EB"
              : cond.tipo === "terra"
                ? "#16A34A"
                : "#F59E0B";
          const cor = cond.cor || corPadrao;
          listaCondutores.push({
            funcaoRotulo: rotuloCondutor(cond.tipo),
            corHex: cor,
            corNome: obterNomeCorCabo(cor),
            quantidade: cond.quantidade,
            comprimentoTotal: compLinear * cond.quantidade,
          });
        }
      }
    }
  }

  const totalCondutores = listaCondutores.reduce((acc, c) => acc + c.quantidade, 0);
  const totalGeralMetros = listaCondutores.reduce((acc, c) => acc + c.comprimentoTotal, 0);

  const linhas = [];

  if (dados.nomeLevantamento) {
    linhas.push(`Levantamento: ${dados.nomeLevantamento}`);
  }

  const cotaTexto = dados.nivelNome ? `${dados.nivelNome} (${formatarMetros(alturaTrecho)})` : formatarMetros(alturaTrecho);
  linhas.push(`${circuitoId} (${tipoCabo}${tipoCondutor ? `, ${tipoCondutor}` : ""}) — Trecho: ${formatarMetros(compLinear)} — Cota: ${cotaTexto}`);
  
  linhas.push("Cabos a passar:");
  if (listaCondutores.length === 0) {
    linhas.push("• Nenhum condutor especificado");
  } else {
    for (const c of listaCondutores) {
      const qtdTexto = c.quantidade > 1 ? `${c.quantidade}x ` : "";
      linhas.push(`• ${qtdTexto}${c.funcaoRotulo} (${c.corNome}): ${formatarMetros(c.comprimentoTotal)}`);
    }
  }
  linhas.push(`Total de fiação: ${formatarMetros(totalGeralMetros)} (${totalCondutores} condutores)`);

  if (dados.observacao) {
    linhas.push(`Obs: ${dados.observacao}`);
  }

  return linhas.join("\n");
}

async function chamar(rota, opcoes = {}) {
  const resposta = await fetch(`${supabaseUrl}${rota}`, {
    ...opcoes,
    headers: {
      apikey: chaveSecreta,
      Authorization: `Bearer ${chaveSecreta}`,
      "Content-Type": "application/json",
      ...opcoes.headers,
    },
  });
  if (!resposta.ok) {
    const text = await resposta.text();
    throw new Error(`${rota}: ${resposta.status} ${text}`);
  }
  if (resposta.status === 204) return null;
  return resposta.json();
}

async function main() {
  console.log("Buscando tarefas de circuito...");
  const tarefas = await chamar("/rest/v1/tarefas?select=id,titulo,descricao,localizacao_tipo,localizacao_detalhe,levantamento_id&localizacao_tipo=eq.circuito");
  console.log(`Encontradas ${tarefas.length} tarefas de circuito.`);

  const levIds = Array.from(
    new Set(tarefas.map((t) => t.levantamento_id).filter(Boolean)),
  );
  const mapaNomesLev = new Map();
  for (const id of levIds) {
    try {
      const levs = await chamar(`/rest/v1/levantamentos?select=id,nome&id=eq.${id}`);
      if (levs && levs[0]) {
        mapaNomesLev.set(id, levs[0].nome);
      }
    } catch {}
  }

  let atualizadas = 0;
  for (const t of tarefas) {
    const detalhe = t.localizacao_detalhe || {};
    const nomeLev = t.levantamento_id ? mapaNomesLev.get(t.levantamento_id) : undefined;
    const novaDescricao = formatarDescricao({
      nomeLevantamento: nomeLev,
      circuito: detalhe.circuito || t.titulo,
      tipoCabo: detalhe.tipoCabo,
      tipoCondutor: detalhe.tipoCondutor,
      comprimento: typeof detalhe.comprimento === "number" ? detalhe.comprimento : undefined,
      altura: typeof detalhe.altura === "number" ? detalhe.altura : undefined,
      condutores: detalhe.condutores,
      fases: detalhe.fases,
      corFase: detalhe.corFase,
      corFaseR: detalhe.corFaseR,
      corFaseS: detalhe.corFaseS,
      corFaseT: detalhe.corFaseT,
      observacao: detalhe.observacao,
    });

    await chamar(`/rest/v1/tarefas?id=eq.${t.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ descricao: novaDescricao }),
    });

    atualizadas++;
    console.log(`[${atualizadas}/${tarefas.length}] Tarefa ${t.id} (Circuito ${detalhe.circuito || t.titulo}) atualizada.`);
  }

  console.log(`\nSucesso! Todas as ${atualizadas} tarefas de circuito foram atualizadas com especificações detalhadas de cabos, cores e comprimentos.`);
}

main().catch(console.error);
