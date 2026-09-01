"use client";

import { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import { formatarMetros } from "@/lib/levantamento/calculos";
import { NIVEIS_PADRAO, type Nivel3D } from "@/lib/levantamento/tipos";
import type {
  FaseCabo,
  FuncaoCondutor,
  MetadadosCabo,
} from "@/lib/levantamento/tipos";

interface ModalConfigCaboProps {
  aberto: boolean;
  niveis?: Nivel3D[];
  dadosIniciais?: MetadadosCabo;
  aoSalvar: (dados: MetadadosCabo) => void;
  aoFechar: () => void;
}

const PRESETS_CABOS = [
  {
    nome: "Circuito 127V Monofásico (1F + 1N + 1T)",
    circuito: "C1",
    tipoCabo: "Cabo Flexível 750V 2.5mm²",
    tipoCondutor: "Cobre",
    fases: [{ nome: "R", cor: "#FFFFFF", quantidade: 1 }],
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#eab308",
  },
  {
    nome: "Circuito 220V Bifásico (2F + 1T)",
    circuito: "C2",
    tipoCabo: "Cabo Flexível 750V 4.0mm²",
    tipoCondutor: "Cobre",
    fases: [
      { nome: "R", cor: "#FFFFFF", quantidade: 1 },
      { nome: "S", cor: "#000000", quantidade: 1 },
    ],
    neutro: 0,
    terra: 1,
    retorno: 0,
    cor: "#a855f7",
  },
  {
    nome: "Circuito 220V Bifásico + Neutro (2F + 1N + 1T)",
    circuito: "C3",
    tipoCabo: "Cabo Flexível 750V 4.0mm²",
    tipoCondutor: "Cobre",
    fases: [
      { nome: "R", cor: "#FFFFFF", quantidade: 1 },
      { nome: "S", cor: "#000000", quantidade: 1 },
    ],
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#10b981",
  },
  {
    nome: "Iluminação Simples (1F + 1N + 1R)",
    circuito: "ILUM-1",
    tipoCabo: "Cabo Flexível 750V 1.5mm²",
    tipoCondutor: "Cobre",
    fases: [{ nome: "R", cor: "#FFFFFF", quantidade: 1 }],
    neutro: 1,
    terra: 0,
    retorno: 1,
    cor: "#06b6d4",
  },
  {
    nome: "Iluminação Paralela / Three-Way (1F + 1N + 2R)",
    circuito: "ILUM-2",
    tipoCabo: "Cabo Flexível 750V 1.5mm²",
    tipoCondutor: "Cobre",
    fases: [{ nome: "R", cor: "#FFFFFF", quantidade: 1 }],
    neutro: 1,
    terra: 0,
    retorno: 2,
    cor: "#3b82f6",
  },
  {
    nome: "Alimentador Trifásico (3F + 1N + 1T)",
    circuito: "ALIM-QDC",
    tipoCabo: "Cabo EPR / XLPE 1kV 10.0mm²",
    tipoCondutor: "Cobre",
    fases: [
      { nome: "R", cor: "#FFFFFF", quantidade: 1 },
      { nome: "S", cor: "#000000", quantidade: 1 },
      { nome: "T", cor: "#EF4444", quantidade: 1 },
    ],
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#f97316",
  },
];

export const CORES_CIRCUITO_SUGERIDAS = [
  { nome: "Amarelo", cor: "#eab308" },
  { nome: "Laranja", cor: "#f97316" },
  { nome: "Azul", cor: "#3b82f6" },
  { nome: "Verde", cor: "#10b981" },
  { nome: "Roxo", cor: "#a855f7" },
  { nome: "Rosa", cor: "#ec4899" },
  { nome: "Ciano", cor: "#06b6d4" },
  { nome: "Vermelho", cor: "#ef4444" },
  { nome: "Índigo", cor: "#6366f1" },
  { nome: "Teal", cor: "#14b8a6" },
  { nome: "Ardósia", cor: "#64748b" },
];

export const CORES_FASE_SUGERIDAS = [
  { nome: "Branco (Fase R)", cor: "#FFFFFF" },
  { nome: "Preto (Fase S)", cor: "#000000" },
  { nome: "Vermelho (Fase T)", cor: "#EF4444" },
  { nome: "Cinza", cor: "#64748b" },
  { nome: "Marrom", cor: "#854d0e" },
  { nome: "Amarelo", cor: "#eab308" },
  { nome: "Laranja", cor: "#f97316" },
  { nome: "Azul Escuro", cor: "#1e3a8a" },
];

export const OPCOES_LETRAS_FASE = ["R", "S", "T", "A", "B", "C"];

function extrairFasesIniciais(dados?: MetadadosCabo): FaseCabo[] {
  if (dados?.fases && dados.fases.length > 0) {
    return dados.fases.map((f) => ({
      nome: f.nome || "R",
      cor: f.cor || "#FFFFFF",
      quantidade: Math.max(1, f.quantidade || 1),
    }));
  }
  const condFase = dados?.condutores?.find((c) => c.tipo === "fase");
  const qtd = condFase?.quantidade ?? 1;
  if (qtd <= 0) return [];
  if (qtd === 1) {
    return [
      {
        nome: "R",
        cor: dados?.corFaseR || dados?.corFase || "#FFFFFF",
        quantidade: 1,
      },
    ];
  }
  if (qtd === 2) {
    return [
      {
        nome: "R",
        cor: dados?.corFaseR || dados?.corFase || "#FFFFFF",
        quantidade: 1,
      },
      { nome: "S", cor: dados?.corFaseS || "#000000", quantidade: 1 },
    ];
  }
  return [
    {
      nome: "R",
      cor: dados?.corFaseR || dados?.corFase || "#FFFFFF",
      quantidade: 1,
    },
    { nome: "S", cor: dados?.corFaseS || "#000000", quantidade: 1 },
    { nome: "T", cor: dados?.corFaseT || "#EF4444", quantidade: 1 },
  ];
}

export function ModalConfigCabo({
  aberto,
  niveis = NIVEIS_PADRAO,
  dadosIniciais,
  aoSalvar,
  aoFechar,
}: ModalConfigCaboProps) {
  const [circuito, setCircuito] = useState(dadosIniciais?.circuito ?? "C1");
  const [corCircuito, setCorCircuito] = useState(
    dadosIniciais?.cor ?? "#eab308",
  );
  const [tipoCabo, setTipoCabo] = useState(
    dadosIniciais?.tipoCabo ?? "Cabo Flexível 750V 2.5mm²",
  );
  const [tipoCondutor, setTipoCondutor] = useState(
    dadosIniciais?.tipoCondutor ?? "Cobre",
  );
  const [nivelId, setNivelId] = useState(
    dadosIniciais?.nivelId ?? "forro_teto",
  );
  const [altura, setAltura] = useState<number>(
    dadosIniciais?.altura ?? 2.8,
  );
  const [fases, setFases] = useState<FaseCabo[]>(() =>
    extrairFasesIniciais(dadosIniciais),
  );
  const [qtdNeutro, setQtdNeutro] = useState(
    dadosIniciais?.condutores.find((c) => c.tipo === "neutro")?.quantidade ?? 1,
  );
  const [qtdTerra, setQtdTerra] = useState(
    dadosIniciais?.condutores.find((c) => c.tipo === "terra")?.quantidade ?? 1,
  );
  const [qtdRetorno, setQtdRetorno] = useState(
    dadosIniciais?.condutores.find((c) => c.tipo === "retorno")?.quantidade ??
      0,
  );
  const [observacao, setObservacao] = useState(
    dadosIniciais?.observacao ?? "",
  );

  const totalCondutoresFase = fases.reduce((acc, f) => acc + f.quantidade, 0);

  function aplicarPreset(idx: number) {
    const p = PRESETS_CABOS[idx];
    if (!p) return;
    setCircuito(p.circuito);
    setTipoCabo(p.tipoCabo);
    setTipoCondutor(p.tipoCondutor);
    setFases(
      p.fases.map((f) => ({
        nome: f.nome,
        cor: f.cor,
        quantidade: f.quantidade,
      })),
    );
    setQtdNeutro(p.neutro);
    setQtdTerra(p.terra);
    setQtdRetorno(p.retorno);
    if (p.cor) setCorCircuito(p.cor);
  }

  function aplicarAtalhoFase(opcao: "R" | "S" | "T" | "RS" | "RT" | "ST" | "RST") {
    switch (opcao) {
      case "R":
        setFases([{ nome: "R", cor: "#FFFFFF", quantidade: 1 }]);
        break;
      case "S":
        setFases([{ nome: "S", cor: "#000000", quantidade: 1 }]);
        break;
      case "T":
        setFases([{ nome: "T", cor: "#EF4444", quantidade: 1 }]);
        break;
      case "RS":
        setFases([
          { nome: "R", cor: "#FFFFFF", quantidade: 1 },
          { nome: "S", cor: "#000000", quantidade: 1 },
        ]);
        break;
      case "RT":
        setFases([
          { nome: "R", cor: "#FFFFFF", quantidade: 1 },
          { nome: "T", cor: "#EF4444", quantidade: 1 },
        ]);
        break;
      case "ST":
        setFases([
          { nome: "S", cor: "#000000", quantidade: 1 },
          { nome: "T", cor: "#EF4444", quantidade: 1 },
        ]);
        break;
      case "RST":
        setFases([
          { nome: "R", cor: "#FFFFFF", quantidade: 1 },
          { nome: "S", cor: "#000000", quantidade: 1 },
          { nome: "T", cor: "#EF4444", quantidade: 1 },
        ]);
        break;
    }
  }

  function adicionarFase() {
    const letrasUsadas = new Set(fases.map((f) => f.nome.toUpperCase()));
    let proximaLetra = "R";
    let corSugerida = "#FFFFFF";

    if (!letrasUsadas.has("R")) {
      proximaLetra = "R";
      corSugerida = "#FFFFFF";
    } else if (!letrasUsadas.has("S")) {
      proximaLetra = "S";
      corSugerida = "#000000";
    } else if (!letrasUsadas.has("T")) {
      proximaLetra = "T";
      corSugerida = "#EF4444";
    } else if (!letrasUsadas.has("A")) {
      proximaLetra = "A";
      corSugerida = "#64748b";
    } else if (!letrasUsadas.has("B")) {
      proximaLetra = "B";
      corSugerida = "#854d0e";
    } else if (!letrasUsadas.has("C")) {
      proximaLetra = "C";
      corSugerida = "#f97316";
    } else {
      proximaLetra = `F${fases.length + 1}`;
      corSugerida = "#64748b";
    }

    setFases((prev) => [
      ...prev,
      { nome: proximaLetra, cor: corSugerida, quantidade: 1 },
    ]);
  }

  function atualizarFase(
    idx: number,
    campo: keyof FaseCabo,
    valor: string | number,
  ) {
    setFases((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        return {
          ...f,
          [campo]:
            campo === "quantidade"
              ? Math.max(1, typeof valor === "number" ? valor : Number(valor) || 1)
              : valor,
        };
      }),
    );
  }

  function removerFase(idx: number) {
    setFases((prev) => prev.filter((_, i) => i !== idx));
  }

  function incrementarUltimaFaseOuAdicionar() {
    if (fases.length === 0) {
      adicionarFase();
    } else {
      const ultimoIdx = fases.length - 1;
      atualizarFase(ultimoIdx, "quantidade", fases[ultimoIdx].quantidade + 1);
    }
  }

  function decrementarUltimaFase() {
    if (fases.length === 0) return;
    const ultimoIdx = fases.length - 1;
    if (fases[ultimoIdx].quantidade > 1) {
      atualizarFase(ultimoIdx, "quantidade", fases[ultimoIdx].quantidade - 1);
    } else {
      removerFase(ultimoIdx);
    }
  }

    function selecionarNivel(id: string) {
      setNivelId(id);
      const n = niveis.find((x) => x.id === id);
      if (n) {
        setAltura(n.cota);
      }
    }

    function salvar() {
      const condutores: { tipo: FuncaoCondutor; quantidade: number; cor?: string }[] = [];
      if (totalCondutoresFase > 0) {
        condutores.push({ tipo: "fase", quantidade: totalCondutoresFase });
      }
      if (qtdNeutro > 0) {
        condutores.push({ tipo: "neutro", quantidade: qtdNeutro, cor: "#2563EB" });
      }
      if (qtdTerra > 0) {
        condutores.push({ tipo: "terra", quantidade: qtdTerra, cor: "#16A34A" });
      }
      if (qtdRetorno > 0) {
        condutores.push({ tipo: "retorno", quantidade: qtdRetorno, cor: "#F59E0B" });
      }

      const faseR = fases.find((f) => f.nome.toUpperCase() === "R") || fases[0];
      const faseS = fases.find((f) => f.nome.toUpperCase() === "S") || fases[1];
      const faseT = fases.find((f) => f.nome.toUpperCase() === "T") || fases[2];

      aoSalvar({
        circuito: circuito.trim() || "C1",
        tipoCabo: tipoCabo.trim() || "Cabo 2.5mm²",
        tipoCondutor: tipoCondutor.trim() || "Cobre",
        nivelId,
        altura,
        condutores,
        fases,
        cor: corCircuito,
        corFase: faseR?.cor || "#FFFFFF",
        corFaseR: faseR?.cor || "#FFFFFF",
        corFaseS: faseS?.cor || "#000000",
        corFaseT: faseT?.cor || "#EF4444",
        observacao: observacao.trim() || undefined,
      });
    }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Especificação de Cabos e Condutores"
      descricao="Defina o circuito, a bitola do cabo, as fases presentes e a quantidade de condutores por fase."
      tamanho="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-superficie-700 mb-1">
            Predefinições Rápidas de Circuito:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PRESETS_CABOS.map((p, idx) => (
              <button
                key={p.nome}
                type="button"
                onClick={() => aplicarPreset(idx)}
                className="text-left px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:border-azul-500 hover:bg-azul-50/50 text-xs text-superficie-800 transition-colors"
              >
                <div className="font-semibold text-azul-700">{p.circuito}</div>
                <div className="text-[11px] text-superficie-600 truncate">
                  {p.nome}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-superficie-100">
          <Campo
            rotulo="Identificação do Circuito"
            obrigatorio
            placeholder="Ex.: C1, QDC-TUG01"
            value={circuito}
            onChange={(e) => setCircuito(e.target.value)}
          />

          <Campo
            rotulo="Tipo de Cabo / Bitola"
            obrigatorio
            placeholder="Ex.: Cabo 2.5mm² 750V"
            value={tipoCabo}
            onChange={(e) => setTipoCabo(e.target.value)}
          />
        </div>

        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-sky-900 uppercase tracking-wider">
              Nível / Elevação do Circuito (Cota Z):
            </label>
            <span className="text-xs font-bold text-sky-700 font-mono">
              {formatarMetros(altura)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Selecao
              rotulo="Nível de Referência"
              value={nivelId}
              onChange={(e) => selecionarNivel(e.target.value)}
            >
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome} ({formatarMetros(n.cota)})
                </option>
              ))}
              <option value="custom">Personalizado (Outro)</option>
            </Selecao>
            <Campo
              rotulo="Altura / Cota (m)"
              type="number"
              step="0.05"
              value={altura}
              onChange={(e) => setAltura(Number(e.target.value))}
            />
          </div>
          <p className="text-[11px] text-sky-700">
            Define a cota onde este circuito e seus eletrodutos estão posicionados (ex.: Forro / Teto a 2.80m).
          </p>
        </div>

        <div className="rounded-xl border border-superficie-200 bg-superficie-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-superficie-800 uppercase tracking-wider">
              Cor do Traço do Circuito no Levantamento:
            </label>
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full border border-black/20 shadow-xs inline-block"
                style={{ backgroundColor: corCircuito }}
              />
              <span className="text-xs font-mono font-semibold text-superficie-700">
                {corCircuito.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {CORES_CIRCUITO_SUGERIDAS.map((c) => (
              <button
                key={c.cor}
                type="button"
                onClick={() => setCorCircuito(c.cor)}
                title={c.nome}
                className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 border flex items-center justify-center ${
                  corCircuito.toLowerCase() === c.cor.toLowerCase()
                    ? "ring-2 ring-azul-600 ring-offset-1 border-white scale-105"
                    : "border-black/15"
                }`}
                style={{ backgroundColor: c.cor }}
              >
                {corCircuito.toLowerCase() === c.cor.toLowerCase() && (
                  <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                )}
              </button>
            ))}
            <label
              className="flex items-center gap-1 px-2 py-1 h-7 rounded-lg border border-superficie-300 bg-white hover:bg-superficie-50 cursor-pointer text-[11px] text-superficie-700 font-medium"
              title="Escolher cor personalizada"
            >
              <span>Personalizada</span>
              <input
                type="color"
                value={corCircuito}
                onChange={(e) => setCorCircuito(e.target.value)}
                className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </label>
          </div>
          <p className="text-[11px] text-superficie-500">
            Esta cor identifica visualmente todos os trechos deste circuito na planta do levantamento.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Selecao
            rotulo="Material do Condutor"
            value={tipoCondutor}
            onChange={(e) => setTipoCondutor(e.target.value)}
          >
            <option value="Cobre Flexível">Cobre Flexível</option>
            <option value="Cobre Rígido">Cobre Rígido</option>
            <option value="Alumínio">Alumínio</option>
          </Selecao>

          <Campo
            rotulo="Observação / Detalhe"
            placeholder="Opcional"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-superficie-200 bg-superficie-50 p-3 space-y-3">
          <div className="text-xs font-bold text-superficie-800 uppercase tracking-wider">
            Condutores Presentes no Trecho:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white p-2.5 rounded-lg border border-superficie-200 text-center">
              <span className="text-xs font-bold text-rose-600 block">
                Fases ({totalCondutoresFase} cond.)
              </span>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={decrementarUltimaFase}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                  title="Diminuir condutores da fase"
                >
                  -
                </button>
                <span className="font-bold text-sm min-w-4 text-superficie-900">
                  {totalCondutoresFase}
                </span>
                <button
                  type="button"
                  onClick={incrementarUltimaFaseOuAdicionar}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                  title="Aumentar condutores da fase"
                >
                  +
                </button>
              </div>
              <div className="text-[10px] text-superficie-500 mt-1 truncate">
                {fases.length === 0
                  ? "Nenhuma"
                  : fases
                      .map(
                        (f) =>
                          `${f.quantidade > 1 ? `${f.quantidade}x ` : ""}${f.nome}`,
                      )
                      .join(", ")}
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-superficie-200 text-center">
              <span className="text-xs font-bold text-blue-600 block">Neutro</span>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setQtdNeutro(Math.max(0, qtdNeutro - 1))}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  -
                </button>
                <span className="font-bold text-sm min-w-4 text-superficie-900">
                  {qtdNeutro}
                </span>
                <button
                  type="button"
                  onClick={() => setQtdNeutro(qtdNeutro + 1)}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  +
                </button>
              </div>
              <div className="text-[10px] text-superficie-500 mt-1">Azul</div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-superficie-200 text-center">
              <span className="text-xs font-bold text-emerald-600 block">Terra</span>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setQtdTerra(Math.max(0, qtdTerra - 1))}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  -
                </button>
                <span className="font-bold text-sm min-w-4 text-superficie-900">
                  {qtdTerra}
                </span>
                <button
                  type="button"
                  onClick={() => setQtdTerra(qtdTerra + 1)}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  +
                </button>
              </div>
              <div className="text-[10px] text-superficie-500 mt-1">Verde</div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-superficie-200 text-center">
              <span className="text-xs font-bold text-amber-600 block">Retorno</span>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setQtdRetorno(Math.max(0, qtdRetorno - 1))}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  -
                </button>
                <span className="font-bold text-sm min-w-4 text-superficie-900">
                  {qtdRetorno}
                </span>
                <button
                  type="button"
                  onClick={() => setQtdRetorno(qtdRetorno + 1)}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  +
                </button>
              </div>
              <div className="text-[10px] text-superficie-500 mt-1">Amarelo</div>
            </div>
          </div>

          <div className="pt-2 border-t border-superficie-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-superficie-800 uppercase tracking-wider block">
                  Gestão de Fases e Condutores por Fase:
                </span>
                <span className="text-[11px] text-superficie-500">
                  Escolha a identificação da fase (R, S, T, etc.), a cor e a quantidade de condutores por fase.
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={adicionarFase}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Fase
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-[11px] text-superficie-600 bg-white/60 p-1.5 rounded-lg border border-superficie-200">
              <span className="font-medium text-superficie-700 mr-1">Atalhos rápidos:</span>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("R")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Mono (R)
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("S")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Mono (S)
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("T")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Mono (T)
              </button>
              <span className="text-superficie-300">|</span>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("RS")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Bifásico (R+S)
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("RT")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Bifásico (R+T)
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("ST")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Bifásico (S+T)
              </button>
              <span className="text-superficie-300">|</span>
              <button
                type="button"
                onClick={() => aplicarAtalhoFase("RST")}
                className="px-2 py-0.5 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-800 text-[10px] font-semibold"
              >
                Trifásico (R+S+T)
              </button>
            </div>

            {fases.length === 0 ? (
              <div className="p-3 text-center text-xs text-superficie-500 bg-white rounded-lg border border-dashed border-superficie-300">
                Nenhuma fase configurada. Clique em &quot;Adicionar Fase&quot; ou selecione um atalho acima.
              </div>
            ) : (
              <div className="space-y-2">
                {fases.map((fase, idx) => {
                  const isCustomName = !OPCOES_LETRAS_FASE.includes(fase.nome);
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white border border-superficie-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: fase.cor }}
                          />
                          <span className="text-xs font-bold text-superficie-800">
                            Fase #{idx + 1}:
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={isCustomName ? "custom" : fase.nome}
                            onChange={(e) => {
                              if (e.target.value === "custom") {
                                atualizarFase(idx, "nome", "F1");
                              } else {
                                atualizarFase(idx, "nome", e.target.value);
                              }
                            }}
                            className="h-8 text-xs font-semibold rounded-md border border-superficie-300 bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none"
                          >
                            {OPCOES_LETRAS_FASE.map((letra) => (
                              <option key={letra} value={letra}>
                                Fase {letra}
                              </option>
                            ))}
                            <option value="custom">Outro (Personalizado)</option>
                          </select>

                          {isCustomName && (
                            <input
                              type="text"
                              value={fase.nome}
                              onChange={(e) =>
                                atualizarFase(idx, "nome", e.target.value)
                              }
                              placeholder="Nome"
                              className="w-16 h-8 text-xs font-semibold rounded-md border border-superficie-300 bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none uppercase"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-1 bg-superficie-50 px-2 py-1 rounded-md border border-superficie-200">
                          <span className="text-[11px] text-superficie-600 font-medium">
                            Condutores:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              atualizarFase(
                                idx,
                                "quantidade",
                                Math.max(1, fase.quantidade - 1),
                              )
                            }
                            className="w-5 h-5 rounded bg-white hover:bg-superficie-200 border border-superficie-300 text-superficie-700 font-bold text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-bold text-xs min-w-4 text-center text-superficie-900">
                            {fase.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              atualizarFase(idx, "quantidade", fase.quantidade + 1)
                            }
                            className="w-5 h-5 rounded bg-white hover:bg-superficie-200 border border-superficie-300 text-superficie-700 font-bold text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <select
                            value={fase.cor}
                            onChange={(e) =>
                              atualizarFase(idx, "cor", e.target.value)
                            }
                            className="h-8 text-xs rounded-md border border-superficie-300 bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none max-w-[130px]"
                          >
                            {CORES_FASE_SUGERIDAS.map((c) => (
                              <option key={c.cor} value={c.cor}>
                                {c.nome}
                              </option>
                            ))}
                          </select>

                          <label
                            className="w-8 h-8 rounded-md border border-superficie-300 bg-white hover:bg-superficie-50 cursor-pointer flex items-center justify-center shrink-0"
                            title="Escolher cor personalizada para esta fase"
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-black/20 inline-block shadow-2xs"
                              style={{ backgroundColor: fase.cor }}
                            />
                            <input
                              type="color"
                              value={fase.cor}
                              onChange={(e) =>
                                atualizarFase(idx, "cor", e.target.value)
                              }
                              className="sr-only"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => removerFase(idx)}
                            className="w-8 h-8 rounded-md text-superficie-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition-colors"
                            title="Remover esta fase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-superficie-200">
            <div className="text-xs font-semibold text-superficie-700 mb-1.5 flex items-center justify-between">
              <span>Pré-visualização do Traço do Circuito:</span>
              <span className="text-[11px] text-superficie-600 font-medium">
                {totalCondutoresFase}F (
                {fases.length === 0
                  ? "0"
                  : fases
                      .map(
                        (f) =>
                          `${f.quantidade > 1 ? `${f.quantidade}x` : ""}${f.nome}`,
                      )
                      .join("+")}
                ) + {qtdNeutro}N + {qtdTerra}T
                {qtdRetorno > 0 ? ` + ${qtdRetorno}R` : ""}
              </span>
            </div>
            <div className="h-16 rounded-lg bg-superficie-200/80 border border-superficie-300 p-2 flex items-center justify-center relative overflow-hidden">
              <svg className="w-full h-12" viewBox="0 0 300 48">
                <rect
                  x="10"
                  y="6"
                  width="280"
                  height="36"
                  rx="4"
                  fill="#3b82f6"
                  fillOpacity="0.35"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                {(() => {
                  const linhas: {
                    cor: string;
                    dash?: string;
                    label: string;
                    strokeExtra?: boolean;
                  }[] = [];

                  for (const f of fases) {
                    for (let i = 0; i < f.quantidade; i++) {
                      const isWhite =
                        f.cor.toUpperCase() === "#FFFFFF" ||
                        f.cor.toUpperCase() === "#FFF" ||
                        f.cor.toLowerCase() === "white";
                      linhas.push({
                        cor: f.cor,
                        label: f.quantidade > 1 ? `${f.nome}${i + 1}` : f.nome,
                        strokeExtra: isWhite,
                      });
                    }
                  }
                  for (let i = 0; i < qtdNeutro; i++) {
                    linhas.push({ cor: "#2563EB", dash: "8 4", label: "N" });
                  }
                  for (let i = 0; i < qtdTerra; i++) {
                    linhas.push({ cor: "#16A34A", dash: "3 3", label: "T" });
                  }
                  for (let i = 0; i < qtdRetorno; i++) {
                    linhas.push({ cor: "#F59E0B", label: "Ret" });
                  }
                  const total = linhas.length;
                  const espaco = total > 1 ? 26 / (total - 1) : 0;
                  const inicioY = total > 1 ? 11 : 24;

                  return linhas.map((l, i) => {
                    const y = inicioY + i * espaco;
                    return (
                      <g key={i}>
                        {l.strokeExtra && (
                          <line
                            x1="25"
                            y1={y}
                            x2="280"
                            y2={y}
                            stroke="#0f172a"
                            strokeWidth="3"
                            strokeLinecap="round"
                            opacity="0.7"
                          />
                        )}
                        <line
                          x1="25"
                          y1={y}
                          x2="280"
                          y2={y}
                          stroke={l.cor}
                          strokeWidth="2"
                          strokeDasharray={l.dash}
                          strokeLinecap="round"
                        />
                        <text
                          x="20"
                          y={y + 3}
                          fontSize="8"
                          fill="#334155"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {l.label}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] text-superficie-500 mt-1 px-1">
              <span>Fases: contínuo (cor e fase personalizáveis)</span>
              <span>Neutro: tracejado longo (Azul)</span>
              <span>Terra: tracejado curto (Verde)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            <Zap className="h-4 w-4" />
            Salvar Especificação
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
