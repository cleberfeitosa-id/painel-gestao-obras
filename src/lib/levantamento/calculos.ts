import type { Calibracao } from "@/lib/pdf/coordenadas";
import {
  distanciaEmPontos,
  medirArea,
  medirPerimetro,
} from "@/lib/pdf/coordenadas";
import type {
  FuncaoCondutor,
  ItemLevantamento,
  Nivel3D,
  ResumoItemArea,
  ResumoItemCabo,
  ResumoItemCaboPorTipo,
  ResumoItemDescidaSubida,
  ResumoItemDistancia,
  ResumoItemElemento,
  ResumoLevantamento,
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

      if (item.metadadosCabo && item.metadadosCabo.condutores.length > 0) {
        const meta = item.metadadosCabo;
        for (const condutor of meta.condutores) {
          if (condutor.quantidade > 0) {
            const compCondutor = compLinear * condutor.quantidade;
            totalGeralCabos += compCondutor;

            const chaveCaboCircuito = `${meta.circuito}_${meta.tipoCabo}_${condutor.tipo}`;
            const existenteCabo = mapaCabosCircuito.get(chaveCaboCircuito);
            if (existenteCabo) {
              existenteCabo.quantidadeCondutores += condutor.quantidade;
              existenteCabo.comprimentoTotal += compCondutor;
            } else {
              mapaCabosCircuito.set(chaveCaboCircuito, {
                circuito: meta.circuito,
                tipoCabo: meta.tipoCabo,
                tipoCondutor: meta.tipoCondutor,
                funcao: condutor.tipo,
                quantidadeCondutores: condutor.quantidade,
                comprimentoTotal: compCondutor,
              });
            }

            const chaveCaboTipo = `${meta.tipoCabo}_${condutor.tipo}`;
            const existenteTipo = mapaCabosTipo.get(chaveCaboTipo);
            if (existenteTipo) {
              existenteTipo.comprimentoTotal += compCondutor;
            } else {
              mapaCabosTipo.set(chaveCaboTipo, {
                tipoCabo: meta.tipoCabo,
                funcao: condutor.tipo,
                comprimentoTotal: compCondutor,
              });
            }
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
      a.circuito.localeCompare(b.circuito) || a.funcao.localeCompare(b.funcao),
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
