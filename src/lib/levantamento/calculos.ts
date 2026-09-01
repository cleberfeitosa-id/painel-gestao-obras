import type { Calibracao } from "@/lib/pdf/coordenadas";
import {
  distanciaEmPontos,
  medirArea,
  medirPerimetro,
} from "@/lib/pdf/coordenadas";
import {
  CORES_PADRAO_CONDUTOR,
  type FuncaoCondutor,
  type ItemLevantamento,
  type Nivel3D,
  type ResumoItemArea,
  type ResumoItemCabo,
  type ResumoItemCaboPorTipo,
  type ResumoItemDescidaSubida,
  type ResumoItemDistancia,
  type ResumoItemElemento,
  type ResumoLevantamento,
} from "./tipos";

export function calcularDistanciaPontos(
  pontos: { x: number; y: number }[],
  calibracao: Calibracao | null,
): number {
  if (pontos.length < 2) return 0;
  let totalPontos = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    totalPontos += distanciaEmPontos(pontos[i], pontos[i + 1]);
  }
  if (!calibracao || calibracao.unidadesPorPonto <= 0) {
    return totalPontos;
  }
  return totalPontos * calibracao.unidadesPorPonto;
}

export function calcularAreaPoligono(
  pontos: { x: number; y: number }[],
  calibracao: Calibracao | null,
): { area: number; perimetro: number } {
  if (pontos.length < 3) return { area: 0, perimetro: 0 };
  const cal: Calibracao = calibracao && calibracao.unidadesPorPonto > 0
    ? calibracao
    : { unidadesPorPonto: 1, unidade: "pt" };

  const area = medirArea(pontos, cal);
  const perimetro = medirPerimetro(pontos, cal);
  return { area, perimetro };
}

export function calcularResumoLevantamento(
  itens: ItemLevantamento[],
  calibracao: Calibracao | null,
  niveis: Nivel3D[],
): ResumoLevantamento {
  const mapaNiveis = new Map(niveis.map((n) => [n.id, n.nome]));

  const mapaElementos = new Map<string, ResumoItemElemento>();
  const mapaDistancias = new Map<string, ResumoItemDistancia>();
  const mapaCabosCircuito = new Map<string, ResumoItemCabo>();
  const mapaCabosTipo = new Map<string, ResumoItemCaboPorTipo>();
  const mapaAreas = new Map<string, ResumoItemArea>();
  const mapaDescidas = new Map<string, ResumoItemDescidaSubida>();

  let totalGeralElementos = 0;
  let totalGeralDistancias = 0;
  let totalGeralCabos = 0;
  let totalGeralAreas = 0;

  for (const item of itens) {
    if (item.tipo === "ponto") {
      totalGeralElementos += 1;
      const chave = `${item.subtipo}_${item.nivelId ?? "padrao"}`;
      const nivelNome = item.nivelId ? mapaNiveis.get(item.nivelId) : undefined;
      const existente = mapaElementos.get(chave);
      if (existente) {
        existente.quantidade += 1;
      } else {
        mapaElementos.set(chave, {
          subtipo: item.subtipo,
          nome: item.nome,
          categoria: item.categoria,
          cor: item.cor,
          quantidade: 1,
          nivelNome,
        });
      }
    } else if (item.tipo === "distancia" || item.tipo === "tubulacao_cabo") {
      const compLinear =
        item.comprimentoReal ?? calcularDistanciaPontos(item.pontos, calibracao);
      totalGeralDistancias += compLinear;

      const chaveDist = item.subtipo;
      const existenteDist = mapaDistancias.get(chaveDist);
      if (existenteDist) {
        existenteDist.totalMetros += compLinear;
        existenteDist.quantidadeTrechos += 1;
      } else {
        mapaDistancias.set(chaveDist, {
          subtipo: item.subtipo,
          nome: item.nome,
          categoria: item.categoria,
          cor: item.cor,
          totalMetros: compLinear,
          quantidadeTrechos: 1,
        });
      }

      if (item.metadadosCabo && (item.metadadosCabo.condutores.length > 0 || (item.metadadosCabo.fases && item.metadadosCabo.fases.length > 0))) {
        const meta = item.metadadosCabo;
        const listaCondutores: {
          funcao: FuncaoCondutor;
          fase?: string;
          corCabo?: string;
          quantidade: number;
        }[] = [];

        if (meta.fases && meta.fases.length > 0) {
          for (const f of meta.fases) {
            if (f.quantidade > 0) {
              listaCondutores.push({
                funcao: "fase",
                fase: f.nome,
                corCabo: f.cor || CORES_PADRAO_CONDUTOR.faseR,
                quantidade: f.quantidade,
              });
            }
          }
          for (const cond of meta.condutores) {
            if (cond.tipo !== "fase" && cond.quantidade > 0) {
              const corPadrao =
                cond.tipo === "neutro"
                  ? CORES_PADRAO_CONDUTOR.neutro
                  : cond.tipo === "terra"
                    ? CORES_PADRAO_CONDUTOR.terra
                    : CORES_PADRAO_CONDUTOR.retorno;
              listaCondutores.push({
                funcao: cond.tipo,
                corCabo: cond.cor || corPadrao,
                quantidade: cond.quantidade,
              });
            }
          }
        } else {
          for (const cond of meta.condutores) {
            if (cond.quantidade > 0) {
              if (cond.tipo === "fase") {
                if (cond.fase) {
                  listaCondutores.push({
                    funcao: "fase",
                    fase: cond.fase,
                    corCabo: cond.cor || meta.corFase || CORES_PADRAO_CONDUTOR.faseR,
                    quantidade: cond.quantidade,
                  });
                } else if (cond.quantidade === 1) {
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "R",
                    corCabo: meta.corFaseR || meta.corFase || cond.cor || CORES_PADRAO_CONDUTOR.faseR,
                    quantidade: 1,
                  });
                } else if (cond.quantidade === 2) {
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "R",
                    corCabo: meta.corFaseR || meta.corFase || CORES_PADRAO_CONDUTOR.faseR,
                    quantidade: 1,
                  });
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "S",
                    corCabo: meta.corFaseS || CORES_PADRAO_CONDUTOR.faseS,
                    quantidade: 1,
                  });
                } else if (cond.quantidade === 3) {
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "R",
                    corCabo: meta.corFaseR || meta.corFase || CORES_PADRAO_CONDUTOR.faseR,
                    quantidade: 1,
                  });
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "S",
                    corCabo: meta.corFaseS || CORES_PADRAO_CONDUTOR.faseS,
                    quantidade: 1,
                  });
                  listaCondutores.push({
                    funcao: "fase",
                    fase: "T",
                    corCabo: meta.corFaseT || CORES_PADRAO_CONDUTOR.faseT,
                    quantidade: 1,
                  });
                } else {
                  listaCondutores.push({
                    funcao: "fase",
                    corCabo: cond.cor || meta.corFase || CORES_PADRAO_CONDUTOR.faseR,
                    quantidade: cond.quantidade,
                  });
                }
              } else {
                const corPadrao =
                  cond.tipo === "neutro"
                    ? CORES_PADRAO_CONDUTOR.neutro
                    : cond.tipo === "terra"
                      ? CORES_PADRAO_CONDUTOR.terra
                      : CORES_PADRAO_CONDUTOR.retorno;
                listaCondutores.push({
                  funcao: cond.tipo,
                  corCabo: cond.cor || corPadrao,
                  quantidade: cond.quantidade,
                });
              }
            }
          }
        }

        for (const itemCabo of listaCondutores) {
          const compCondutor = compLinear * itemCabo.quantidade;
          totalGeralCabos += compCondutor;

          const chaveCaboCircuito = `${meta.circuito}_${meta.tipoCabo}_${itemCabo.funcao}_${itemCabo.fase ?? ""}_${itemCabo.corCabo ?? ""}`;
          const existenteCabo = mapaCabosCircuito.get(chaveCaboCircuito);
          if (existenteCabo) {
            existenteCabo.quantidadeCondutores += itemCabo.quantidade;
            existenteCabo.comprimentoTotal += compCondutor;
          } else {
            mapaCabosCircuito.set(chaveCaboCircuito, {
              circuito: meta.circuito,
              corCircuito: meta.cor,
              tipoCabo: meta.tipoCabo,
              tipoCondutor: meta.tipoCondutor,
              funcao: itemCabo.funcao,
              fase: itemCabo.fase,
              corCabo: itemCabo.corCabo,
              quantidadeCondutores: itemCabo.quantidade,
              comprimentoTotal: compCondutor,
            });
          }

          const chaveCaboTipo = `${meta.tipoCabo}_${itemCabo.funcao}_${itemCabo.corCabo ?? ""}`;
          const existenteTipo = mapaCabosTipo.get(chaveCaboTipo);
          if (existenteTipo) {
            existenteTipo.comprimentoTotal += compCondutor;
          } else {
            mapaCabosTipo.set(chaveCaboTipo, {
              tipoCabo: meta.tipoCabo,
              funcao: itemCabo.funcao,
              corCabo: itemCabo.corCabo,
              comprimentoTotal: compCondutor,
            });
          }
        }
      }
    } else if (item.tipo === "descida_subida") {
      const altOrigem = item.alturaOrigem ?? 2.8;
      const altDestino = item.alturaDestino ?? 0.3;
      const alturaDelta = Math.abs(altOrigem - altDestino);
      totalGeralDistancias += alturaDelta;

      const chaveDesc = item.subtipo;
      const existenteDesc = mapaDescidas.get(chaveDesc);
      if (existenteDesc) {
        existenteDesc.alturaTotal += alturaDelta;
        existenteDesc.quantidade += 1;
      } else {
        mapaDescidas.set(chaveDesc, {
          nome: item.nome,
          subtipo: item.subtipo,
          cor: item.cor,
          alturaTotal: alturaDelta,
          quantidade: 1,
        });
      }
    } else if (item.tipo === "area") {
      let areaValor = item.areaReal ?? 0;
      let perimValor = item.perimetroReal ?? 0;
      if (areaValor === 0 && item.pontos.length >= 3) {
        const res = calcularAreaPoligono(item.pontos, calibracao);
        areaValor = res.area;
        perimValor = res.perimetro;
      }
      totalGeralAreas += areaValor;

      const chaveArea = item.subtipo;
      const existenteArea = mapaAreas.get(chaveArea);
      if (existenteArea) {
        existenteArea.totalArea += areaValor;
        existenteArea.totalPerimetro += perimValor;
        existenteArea.quantidade += 1;
      } else {
        mapaAreas.set(chaveArea, {
          subtipo: item.subtipo,
          nome: item.nome,
          categoria: item.categoria,
          cor: item.cor,
          totalArea: areaValor,
          totalPerimetro: perimValor,
          quantidade: 1,
        });
      }
    }
  }

  return {
    elementos: Array.from(mapaElementos.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    ),
    distancias: Array.from(mapaDistancias.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    ),
    cabos: Array.from(mapaCabosCircuito.values()).sort((a, b) =>
      a.circuito.localeCompare(b.circuito, undefined, { numeric: true }) ||
      a.funcao.localeCompare(b.funcao) ||
      (a.fase ?? "").localeCompare(b.fase ?? "")
    ),
    cabosPorTipo: Array.from(mapaCabosTipo.values()).sort((a, b) =>
      a.tipoCabo.localeCompare(b.tipoCabo) || a.funcao.localeCompare(b.funcao),
    ),
    areas: Array.from(mapaAreas.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    ),
    descidasSubidas: Array.from(mapaDescidas.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    ),
    totalGeralElementos,
    totalGeralDistancias,
    totalGeralCabos,
    totalGeralAreas,
  };
}

export function rotuloCondutor(funcao: FuncaoCondutor): string {
  switch (funcao) {
    case "fase":
      return "Fase";
    case "neutro":
      return "Neutro";
    case "terra":
      return "Terra";
    case "retorno":
      return "Retorno";
  }
}

export function obterNomeCorCabo(hex?: string): string {
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

export function formatarMetros(valor: number, casas = 2): string {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} m`;
}

export function formatarMetrosQuadrados(valor: number, casas = 2): string {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} m²`;
}

export interface DadosDescricaoCircuito {
  nomeLevantamento?: string;
  circuito?: string;
  tipoCabo?: string;
  tipoCondutor?: string;
  comprimento?: number;
  altura?: number;
  nivelNome?: string;
  condutores?: {
    tipo: FuncaoCondutor;
    quantidade: number;
    cor?: string;
    secaoMm2?: string;
    fase?: string;
  }[];
  fases?: {
    nome: string;
    cor: string;
    quantidade: number;
  }[];
  corFase?: string;
  corFaseR?: string;
  corFaseS?: string;
  corFaseT?: string;
  observacao?: string;
}

export function formatarDescricaoTarefaCircuito(
  dados: DadosDescricaoCircuito,
): string {
  const circuitoId = dados.circuito ? `Circuito ${dados.circuito}` : "Circuito Elétrico";
  const tipoCabo = dados.tipoCabo || "Cabo Flexível 750V 2.5mm²";
  const tipoCondutor = dados.tipoCondutor || "Cobre";
  const compLinear = dados.comprimento ?? 0;
  const alturaTrecho = dados.altura !== undefined ? dados.altura : 2.8;

  const listaCondutores: {
    funcaoRotulo: string;
    corHex: string;
    corNome: string;
    quantidade: number;
    comprimentoTotal: number;
  }[] = [];

  if (dados.fases && dados.fases.length > 0) {
    for (const f of dados.fases) {
      if (f.quantidade > 0) {
        const cor = f.cor || CORES_PADRAO_CONDUTOR.faseR;
        listaCondutores.push({
          funcaoRotulo: `Fase ${f.nome}`,
          corHex: cor,
          corNome: obterNomeCorCabo(cor),
          quantidade: f.quantidade,
          comprimentoTotal: compLinear * f.quantidade,
        });
      }
    }
    for (const cond of dados.condutores ?? []) {
      if (cond.tipo !== "fase" && cond.quantidade > 0) {
        const corPadrao =
          cond.tipo === "neutro"
            ? CORES_PADRAO_CONDUTOR.neutro
            : cond.tipo === "terra"
              ? CORES_PADRAO_CONDUTOR.terra
              : CORES_PADRAO_CONDUTOR.retorno;
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
            const cor = cond.cor || dados.corFase || CORES_PADRAO_CONDUTOR.faseR;
            listaCondutores.push({
              funcaoRotulo: `Fase ${cond.fase}`,
              corHex: cor,
              corNome: obterNomeCorCabo(cor),
              quantidade: cond.quantidade,
              comprimentoTotal: compLinear * cond.quantidade,
            });
          } else if (cond.quantidade === 1) {
            const cor = dados.corFaseR || dados.corFase || cond.cor || CORES_PADRAO_CONDUTOR.faseR;
            listaCondutores.push({
              funcaoRotulo: "Fase R",
              corHex: cor,
              corNome: obterNomeCorCabo(cor),
              quantidade: 1,
              comprimentoTotal: compLinear,
            });
          } else if (cond.quantidade === 2) {
            const corR = dados.corFaseR || dados.corFase || CORES_PADRAO_CONDUTOR.faseR;
            const corS = dados.corFaseS || CORES_PADRAO_CONDUTOR.faseS;
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
            const corR = dados.corFaseR || dados.corFase || CORES_PADRAO_CONDUTOR.faseR;
            const corS = dados.corFaseS || CORES_PADRAO_CONDUTOR.faseS;
            const corT = dados.corFaseT || CORES_PADRAO_CONDUTOR.faseT;
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
            const cor = cond.cor || dados.corFase || CORES_PADRAO_CONDUTOR.faseR;
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
              ? CORES_PADRAO_CONDUTOR.neutro
              : cond.tipo === "terra"
                ? CORES_PADRAO_CONDUTOR.terra
                : CORES_PADRAO_CONDUTOR.retorno;
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

  const linhas: string[] = [];

  if (dados.nomeLevantamento) {
    linhas.push(`Levantamento: ${dados.nomeLevantamento}`);
  }

  const cotaTexto = dados.nivelNome
    ? `${dados.nivelNome} (${formatarMetros(alturaTrecho)})`
    : formatarMetros(alturaTrecho);

  linhas.push(
    `${circuitoId} (${tipoCabo}${tipoCondutor ? `, ${tipoCondutor}` : ""}) — Trecho: ${formatarMetros(compLinear)} — Cota: ${cotaTexto}`,
  );

  linhas.push("Cabos a passar:");
  if (listaCondutores.length === 0) {
    linhas.push("• Nenhum condutor especificado");
  } else {
    for (const c of listaCondutores) {
      const qtdTexto = c.quantidade > 1 ? `${c.quantidade}x ` : "";
      linhas.push(
        `• ${qtdTexto}${c.funcaoRotulo} (${c.corNome}): ${formatarMetros(c.comprimentoTotal)}`,
      );
    }
  }
  linhas.push(
    `Total de fiação: ${formatarMetros(totalGeralMetros)} (${totalCondutores} condutores)`,
  );

  if (dados.observacao) {
    linhas.push(`Obs: ${dados.observacao}`);
  }

  return linhas.join("\n");
}
