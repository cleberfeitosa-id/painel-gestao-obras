import {
  COMPONENTES_CATALOGO_PADRAO,
  type ElementoQuadro,
  type ItemListaMateriais,
  type QuadroEletricoLayout,
  type QuadroTemplateItem,
} from "./tipos";

export interface ResultadoValidacaoLayout {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

export function validarLayoutQuadro(
  layout: QuadroEletricoLayout,
  areaUtil: { larguraMm: number; alturaMm: number; profundidadeMm: number },
): ResultadoValidacaoLayout {
  const erros: string[] = [];
  const avisos: string[] = [];

  const { larguraMm, alturaMm } = areaUtil;

  for (const el of layout.elementos) {
    if (el.x < 0 || el.x + el.larguraMm > larguraMm) {
      erros.push(
        `Componente ${el.tag} (${el.descricao}) ultrapassa a largura da área útil (${el.x + el.larguraMm}mm > ${larguraMm}mm).`,
      );
    }
    if (el.y < 0 || el.y + el.alturaMm > alturaMm) {
      erros.push(
        `Componente ${el.tag} (${el.descricao}) ultrapassa a altura da área útil (${el.y + el.alturaMm}mm > ${alturaMm}mm).`,
      );
    }

    const catalogo = COMPONENTES_CATALOGO_PADRAO[el.tipo];
    if (catalogo?.requerTrilhoDin && !el.trilhoId) {
      const trilhoAbaixo = layout.trilhos.find(
        (t) =>
          el.x >= t.x - 5 &&
          el.x + el.larguraMm <= t.x + t.larguraMm + 5 &&
          Math.abs(el.y + el.alturaMm / 2 - (t.y + t.alturaMm / 2)) <= 35,
      );

      if (!trilhoAbaixo) {
        avisos.push(
          `Componente ${el.tag} (${el.descricao}) é de fixação DIN e deve estar posicionado sobre um trilho DIN.`,
        );
      }
    }
  }

  for (let i = 0; i < layout.elementos.length; i++) {
    for (let j = i + 1; j < layout.elementos.length; j++) {
      const a = layout.elementos[i];
      const b = layout.elementos[j];

      const sobrepoeX = a.x < b.x + b.larguraMm && a.x + a.larguraMm > b.x;
      const sobrepoeY = a.y < b.y + b.alturaMm && a.y + a.alturaMm > b.y;

      if (sobrepoeX && sobrepoeY) {
        erros.push(
          `Sobreposição física detectada entre ${a.tag} (${a.descricao}) e ${b.tag} (${b.descricao}).`,
        );
      }
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

export function gerarListaMateriaisQuadro(
  layout: QuadroEletricoLayout,
  quadroInfo: {
    tag: string;
    nome?: string | null;
    tipoQuadro: string;
    larguraMm: number;
    alturaMm: number;
    profundidadeMm: number;
    grauProtecao?: string | null;
  },
): ItemListaMateriais[] {
  const itens: ItemListaMateriais[] = [];

  itens.push({
    item: `Invólucro / Caixa ${quadroInfo.tipoQuadro}`,
    especificacao: `Quadro ${quadroInfo.larguraMm}x${quadroInfo.alturaMm}x${quadroInfo.profundidadeMm}mm com chapa metálica de montagem interna, ${quadroInfo.grauProtecao ?? "IP54"}`,
    quantidade: 1,
    unidade: "un",
    norma: "NBR IEC 61439-1/3",
    detalhes: `Quadro Tag ${quadroInfo.tag}${quadroInfo.nome ? ` - ${quadroInfo.nome}` : ""}`,
  });

  const agrupadoElementos = new Map<
    string,
    { elemento: ElementoQuadro; quantidade: number }
  >();

  for (const el of layout.elementos) {
    const chave = `${el.tipo}|${el.correnteNominal ?? ""}|${el.curvaDisjuntor ?? ""}|${el.polos ?? ""}|${el.larguraMm}`;
    const atual = agrupadoElementos.get(chave);
    if (atual) {
      atual.quantidade += 1;
    } else {
      agrupadoElementos.set(chave, { elemento: el, quantidade: 1 });
    }
  }

  for (const { elemento, quantidade } of agrupadoElementos.values()) {
    const cat = COMPONENTES_CATALOGO_PADRAO[elemento.tipo];
    const spec = [
      cat?.nome ?? elemento.descricao,
      elemento.correnteNominal ? `${elemento.correnteNominal}A` : null,
      elemento.curvaDisjuntor ? `Curva ${elemento.curvaDisjuntor}` : null,
      elemento.polos ? `${elemento.polos}P` : null,
      elemento.sensibilidadeDrMa ? `IΔn ${elemento.sensibilidadeDrMa}mA` : null,
      `${elemento.larguraMm}x${elemento.alturaMm}x${elemento.profundidadeMm}mm`,
    ]
      .filter(Boolean)
      .join(" - ");

    itens.push({
      item: cat?.nome ?? elemento.tag,
      especificacao: spec,
      quantidade,
      unidade: "un",
      norma: cat?.normaReferencia ?? "NBR 5410",
      detalhes: elemento.descricao || cat?.descricaoPadrao || "",
    });
  }

  if (layout.trilhos.length > 0) {
    const totalComprimentoMm = layout.trilhos.reduce(
      (acc, t) => acc + t.larguraMm,
      0,
    );
    itens.push({
      item: "Trilho DIN 35mm (TS35 / EN 60715)",
      especificacao: `Trilhos perfurados metálicos (total: ${(totalComprimentoMm / 1000).toFixed(2)}m em ${layout.trilhos.length} barras)`,
      quantidade: layout.trilhos.length,
      unidade: "barras",
      norma: "EN 60715 / IEC 60715",
      detalhes: `Comprimento individual: ${layout.trilhos.map((t) => `${t.larguraMm}mm`).join(", ")}`,
    });
  }

  if (layout.canaletas.length > 0) {
    const totalComprimentoCanaletaMm = layout.canaletas.reduce(
      (acc, c) => acc + (c.orientacao === "horizontal" ? c.larguraMm : c.alturaMm),
      0,
    );
    itens.push({
      item: "Canaleta Perfurada PVC Antichama",
      especificacao: `Canaletas de fiação com tampa (total: ${(totalComprimentoCanaletaMm / 1000).toFixed(2)}m em ${layout.canaletas.length} trechos)`,
      quantidade: layout.canaletas.length,
      unidade: "trechos",
      norma: "IEC 61084 / NBR 15715",
      detalhes: `${layout.canaletas.filter((c) => c.orientacao === "horizontal").length} horizontais, ${layout.canaletas.filter((c) => c.orientacao === "vertical").length} verticais`,
    });
  }

  for (const barramento of layout.barramentos) {
    const numBarras = barramento.tipo === "trifasico" ? 3 : barramento.tipo === "tetrapolar" ? 4 : barramento.tipo === "bifasico" ? 2 : 1;
    const larguraBarra = barramento.larguraBarraIndividualMm || Math.round(barramento.larguraTroncoMm / (numBarras || 1));
    const espacamento = barramento.espacamentoDerivacoesMm || 35;
    
    itens.push({
      item: `Barramento Espinha de Peixe ${barramento.tipo === "trifasico" ? "Trifásico (3 Barras)" : barramento.tipo === "tetrapolar" ? "Tetrapolar (4 Barras)" : barramento.tipo === "bifasico" ? "Bifásico (2 Barras)" : "Monofásico"}`,
      especificacao: `Barramento em cobre eletrolítico ${barramento.correnteSuportadaA}A (${numBarras}x ${larguraBarra}mm x ${barramento.alturaMm}mm), ${barramento.derivacoes.length} derivações a cada ${espacamento}mm`,
      quantidade: 1,
      unidade: "cj",
      norma: "NBR IEC 61439-1 / DIN 43670",
      detalhes: `Barramento Tronco ${numBarras} barras verticais paralelas com derivações horizontais para disjuntores`,
    });
  }

  for (const bar of layout.barramentosNeutroTerra ?? []) {
    const rotuloTipo = bar.tipo === "terra" ? "Barramento de Proteção Terra (PE)" : "Barramento de Neutro Isolado (N)";
    const circuitosConectados = bar.furos.filter((f) => f.circuitoConectadoNome).length;
    itens.push({
      item: rotuloTipo,
      especificacao: `Barramento em ${bar.material === "latao" ? "latão" : "cobre eletrolítico"} ${bar.comprimentoMm}x${bar.larguraMm}x${bar.profundidadeMm}mm com ${bar.furos.length} furos (Ø ${bar.diametroFuroPadraoMm}mm), In ${bar.correnteSuportadaA}A`,
      quantidade: 1,
      unidade: "un",
      norma: bar.tipo === "terra" ? "NBR 5410 / IEC 60947-7-2" : "NBR 5410 / IEC 60947-7-1",
      detalhes: `Tag ${bar.tag} (${circuitosConectados} circuitos conectados)`,
    });
  }

  return itens;
}

export function gerarTemplatesPadrao(): Array<Omit<QuadroTemplateItem, "id">> {
  return [
    {
      nome: "QDC Residencial 24 Módulos DIN",
      descricao: "Quadro de Distribuição de Circuitos para residências com 2 trilhos DIN de 12 módulos cada, canaletas laterais e IDR geral",
      tipo_quadro: "QDC",
      largura_mm: 450,
      altura_mm: 600,
      profundidade_mm: 150,
      largura_util_mm: 390,
      altura_util_mm: 540,
      margem_lateral_mm: 30,
      margem_topo_mm: 30,
      corrente_nominal: 63,
      tensao_nominal: "127/220V",
      grau_protecao: "IP40",
      material_caixa: "Aço tratado com pintura eletrostática",
      publico: true,
      layout: {
        trilhos: [
          {
            id: "trilho-1",
            tag: "TRILHO-1",
            x: 40,
            y: 80,
            larguraMm: 310,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
          {
            id: "trilho-2",
            tag: "TRILHO-2",
            x: 40,
            y: 280,
            larguraMm: 310,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
        ],
        canaletas: [
          {
            id: "can-vert-esq",
            tag: "CAN-V1",
            orientacao: "vertical",
            x: 5,
            y: 10,
            larguraMm: 30,
            alturaMm: 520,
            profundidadeMm: 50,
          },
          {
            id: "can-vert-dir",
            tag: "CAN-V2",
            orientacao: "vertical",
            x: 355,
            y: 10,
            larguraMm: 30,
            alturaMm: 520,
            profundidadeMm: 50,
          },
          {
            id: "can-horiz-topo",
            tag: "CAN-H1",
            orientacao: "horizontal",
            x: 35,
            y: 10,
            larguraMm: 320,
            alturaMm: 30,
            profundidadeMm: 50,
          },
          {
            id: "can-horiz-meio",
            tag: "CAN-H2",
            orientacao: "horizontal",
            x: 35,
            y: 200,
            larguraMm: 320,
            alturaMm: 30,
            profundidadeMm: 50,
          },
        ],
        elementos: [
          {
            id: "disj-geral",
            tipo: "disjuntor_bipolar",
            tag: "Q-GERAL",
            descricao: "Disjuntor Geral Bipolar 50A",
            x: 45,
            y: 56,
            larguraMm: 35,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-1",
            posicaoModuloNoTrilho: 0,
            correnteNominal: 50,
            curvaDisjuntor: "C",
            polos: 2,
          },
          {
            id: "dps-f1",
            tipo: "dps_mono",
            tag: "DPS-1",
            descricao: "DPS Classe II Fase 1",
            x: 85,
            y: 56,
            larguraMm: 17.5,
            alturaMm: 83,
            profundidadeMm: 65,
            trilhoId: "trilho-1",
            posicaoModuloNoTrilho: 2,
            correnteNominal: 40,
          },
          {
            id: "dps-f2",
            tipo: "dps_mono",
            tag: "DPS-2",
            descricao: "DPS Classe II Fase 2",
            x: 103,
            y: 56,
            larguraMm: 17.5,
            alturaMm: 83,
            profundidadeMm: 65,
            trilhoId: "trilho-1",
            posicaoModuloNoTrilho: 3,
            correnteNominal: 40,
          },
          {
            id: "idr-geral",
            tipo: "idr_bipolar",
            tag: "IDR-GERAL",
            descricao: "Interruptor DR Geral 2P 40A 30mA",
            x: 125,
            y: 56,
            larguraMm: 35,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-1",
            posicaoModuloNoTrilho: 4,
            correnteNominal: 40,
            sensibilidadeDrMa: 30,
            polos: 2,
          },
          {
            id: "disj-c1",
            tipo: "disjuntor_mono",
            tag: "C1",
            descricao: "Circuito Iluminação Sala/Cozinha 10A",
            x: 45,
            y: 256,
            larguraMm: 17.5,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-2",
            posicaoModuloNoTrilho: 0,
            correnteNominal: 10,
            curvaDisjuntor: "B",
            polos: 1,
          },
          {
            id: "disj-c2",
            tipo: "disjuntor_mono",
            tag: "C2",
            descricao: "Circuito Tomadas Uso Geral (TUG) 16A",
            x: 63,
            y: 256,
            larguraMm: 17.5,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-2",
            posicaoModuloNoTrilho: 1,
            correnteNominal: 16,
            curvaDisjuntor: "C",
            polos: 1,
          },
          {
            id: "disj-c3",
            tipo: "disjuntor_bipolar",
            tag: "C3",
            descricao: "Circuito Chuveiro Elétrico 32A",
            x: 81,
            y: 256,
            larguraMm: 35,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-2",
            posicaoModuloNoTrilho: 2,
            correnteNominal: 32,
            curvaDisjuntor: "B",
            polos: 2,
          },
        ],
        barramentos: [],
      },
    },
    {
      nome: "QGBT Trifásico com Barramento Espinha de Peixe",
      descricao: "Quadro Geral de Baixa Tensão trifásico com barramento central espinha de peixe para alimentação dos disjuntores em ambos os lados e canaletas perimetrais",
      tipo_quadro: "QGBT",
      largura_mm: 700,
      altura_mm: 1000,
      profundidade_mm: 250,
      largura_util_mm: 640,
      altura_util_mm: 940,
      margem_lateral_mm: 30,
      margem_topo_mm: 30,
      corrente_nominal: 160,
      tensao_nominal: "220/380V",
      grau_protecao: "IP54",
      material_caixa: "Aço tratado com pintura eletrostática a pó",
      publico: true,
      layout: {
        trilhos: [
          {
            id: "trilho-esq-1",
            tag: "TR-E1",
            x: 45,
            y: 250,
            larguraMm: 220,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
          {
            id: "trilho-dir-1",
            tag: "TR-D1",
            x: 375,
            y: 250,
            larguraMm: 220,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
          {
            id: "trilho-esq-2",
            tag: "TR-E2",
            x: 45,
            y: 450,
            larguraMm: 220,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
          {
            id: "trilho-dir-2",
            tag: "TR-D2",
            x: 375,
            y: 450,
            larguraMm: 220,
            alturaMm: 35,
            profundidadeMm: 7.5,
          },
        ],
        canaletas: [
          {
            id: "can-lateral-esq",
            tag: "CAN-LE",
            orientacao: "vertical",
            x: 5,
            y: 10,
            larguraMm: 35,
            alturaMm: 920,
            profundidadeMm: 60,
          },
          {
            id: "can-lateral-dir",
            tag: "CAN-LD",
            orientacao: "vertical",
            x: 600,
            y: 10,
            larguraMm: 35,
            alturaMm: 920,
            profundidadeMm: 60,
          },
        ],
        barramentos: [
          {
            id: "barramento-central",
            tag: "BAR-TRIPOLAR-160A",
            tipo: "trifasico",
            correnteSuportadaA: 160,
            secaoTroncoMm2: 80,
            material: "cobre_eletrolitico",
            x: 290,
            y: 180,
            larguraTroncoMm: 60,
            alturaMm: 500,
            derivacoes: [
              {
                id: "der-1",
                yOffsetMm: 70,
                fase: "R",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
              {
                id: "der-2",
                yOffsetMm: 140,
                fase: "S",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
              {
                id: "der-3",
                yOffsetMm: 210,
                fase: "T",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
              {
                id: "der-4",
                yOffsetMm: 280,
                fase: "R",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
              {
                id: "der-5",
                yOffsetMm: 350,
                fase: "S",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
              {
                id: "der-6",
                yOffsetMm: 420,
                fase: "T",
                larguraDerivacaoMm: 40,
                lado: "ambos",
                correnteNominalA: 63,
              },
            ],
          },
        ],
        elementos: [
          {
            id: "mccb-geral",
            tipo: "disjuntor_caixa_moldada_3p",
            tag: "Q-GERAL-MCCB",
            descricao: "Disjuntor Geral Caixa Moldada 3P 160A",
            x: 268,
            y: 20,
            larguraMm: 105,
            alturaMm: 165,
            profundidadeMm: 85,
            correnteNominal: 160,
            polos: 3,
          },
          {
            id: "dps-tetra",
            tipo: "dps_tri_tetra",
            tag: "DPS-3P+N",
            descricao: "Conjunto DPS Classe II 3P+N 20/40kA",
            x: 50,
            y: 226,
            larguraMm: 70,
            alturaMm: 83,
            profundidadeMm: 65,
            trilhoId: "trilho-esq-1",
            correnteNominal: 40,
          },
          {
            id: "disj-qdc-1",
            tipo: "disjuntor_tripolar",
            tag: "Q-ALIM-QDC01",
            descricao: "Alimentador QDC Pav. Térreo 50A",
            x: 380,
            y: 226,
            larguraMm: 52.5,
            alturaMm: 83,
            profundidadeMm: 70,
            trilhoId: "trilho-dir-1",
            correnteNominal: 50,
            curvaDisjuntor: "C",
            polos: 3,
          },
        ],
      },
    },
  ];
}
