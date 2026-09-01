"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import type { FuncaoCondutor, MetadadosCabo } from "@/lib/levantamento/tipos";

interface ModalConfigCaboProps {
  aberto: boolean;
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
    fase: 1,
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#eab308",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
  },
  {
    nome: "Circuito 220V Bifásico (2F + 1T)",
    circuito: "C2",
    tipoCabo: "Cabo Flexível 750V 4.0mm²",
    tipoCondutor: "Cobre",
    fase: 2,
    neutro: 0,
    terra: 1,
    retorno: 0,
    cor: "#a855f7",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
  },
  {
    nome: "Circuito 220V Bifásico + Neutro (2F + 1N + 1T)",
    circuito: "C3",
    tipoCabo: "Cabo Flexível 750V 4.0mm²",
    tipoCondutor: "Cobre",
    fase: 2,
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#10b981",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
  },
  {
    nome: "Iluminação Simples (1F + 1N + 1R)",
    circuito: "ILUM-1",
    tipoCabo: "Cabo Flexível 750V 1.5mm²",
    tipoCondutor: "Cobre",
    fase: 1,
    neutro: 1,
    terra: 0,
    retorno: 1,
    cor: "#06b6d4",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
  },
  {
    nome: "Iluminação Paralela / Three-Way (1F + 1N + 2R)",
    circuito: "ILUM-2",
    tipoCabo: "Cabo Flexível 750V 1.5mm²",
    tipoCondutor: "Cobre",
    fase: 1,
    neutro: 1,
    terra: 0,
    retorno: 2,
    cor: "#3b82f6",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
  },
  {
    nome: "Alimentador Trifásico (3F + 1N + 1T)",
    circuito: "ALIM-QDC",
    tipoCabo: "Cabo EPR / XLPE 1kV 10.0mm²",
    tipoCondutor: "Cobre",
    fase: 3,
    neutro: 1,
    terra: 1,
    retorno: 0,
    cor: "#f97316",
    corFaseR: "#FFFFFF",
    corFaseS: "#000000",
    corFaseT: "#EF4444",
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

export const OPCOES_CORES_FASE = [
  { rotulo: "Branco (Fase R)", valor: "#FFFFFF", classe: "bg-white text-superficie-900 border border-superficie-300" },
  { rotulo: "Preto (Fase S)", valor: "#000000", classe: "bg-black text-white" },
  { rotulo: "Vermelho (Fase T)", valor: "#EF4444", classe: "bg-red-500 text-white" },
];

export function ModalConfigCabo({
  aberto,
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
  const [qtdFase, setQtdFase] = useState(
    dadosIniciais?.condutores.find((c) => c.tipo === "fase")?.quantidade ?? 1,
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
  const [corFaseR, setCorFaseR] = useState(dadosIniciais?.corFaseR ?? "#FFFFFF");
  const [corFaseS, setCorFaseS] = useState(dadosIniciais?.corFaseS ?? "#000000");
  const [corFaseT, setCorFaseT] = useState(dadosIniciais?.corFaseT ?? "#EF4444");
  const [observacao, setObservacao] = useState(
    dadosIniciais?.observacao ?? "",
  );

  function aplicarPreset(idx: number) {
    const p = PRESETS_CABOS[idx];
    if (!p) return;
    setCircuito(p.circuito);
    setTipoCabo(p.tipoCabo);
    setTipoCondutor(p.tipoCondutor);
    setQtdFase(p.fase);
    setQtdNeutro(p.neutro);
    setQtdTerra(p.terra);
    setQtdRetorno(p.retorno);
    if (p.cor) setCorCircuito(p.cor);
    if (p.corFaseR) setCorFaseR(p.corFaseR);
    if (p.corFaseS) setCorFaseS(p.corFaseS);
    if (p.corFaseT) setCorFaseT(p.corFaseT);
  }

  function salvar() {
    const condutores: { tipo: FuncaoCondutor; quantidade: number; cor?: string }[] = [];
    if (qtdFase > 0) {
      condutores.push({ tipo: "fase", quantidade: qtdFase });
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

    aoSalvar({
      circuito: circuito.trim() || "C1",
      tipoCabo: tipoCabo.trim() || "Cabo 2.5mm²",
      tipoCondutor: tipoCondutor.trim() || "Cobre",
      condutores,
      cor: corCircuito,
      corFaseR,
      corFaseS,
      corFaseT,
      observacao: observacao.trim() || undefined,
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Especificação de Cabos e Condutores"
      descricao="Defina o circuito, a bitola do cabo e a quantidade de condutores para este trecho."
      tamanho="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-superficie-700 mb-1">
            Predefinições Rápidas de Circuito:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
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
            Esta cor identifica visualmente todos os trechos deste circuito na planta do levantamento com transparência e traço fino.
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

        <div className="rounded-xl border border-superficie-200 bg-superficie-50 p-3">
          <div className="text-xs font-bold text-superficie-800 uppercase tracking-wider mb-2">
            Condutores Presentes no Trecho:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white p-2.5 rounded-lg border border-superficie-200 text-center">
              <span className="text-xs font-bold text-rose-600 block">Fase</span>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setQtdFase(Math.max(0, qtdFase - 1))}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  -
                </button>
                <span className="font-bold text-sm min-w-4 text-superficie-900">
                  {qtdFase}
                </span>
                <button
                  type="button"
                  onClick={() => setQtdFase(qtdFase + 1)}
                  className="w-6 h-6 rounded bg-superficie-100 hover:bg-superficie-200 text-superficie-700 font-bold text-xs"
                >
                  +
                </button>
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
            </div>
          </div>

          {qtdFase > 0 && (
            <div className="mt-3 pt-3 border-t border-superficie-200 space-y-2">
              <div className="text-xs font-semibold text-superficie-700">
                Cor das Fases (Traço Contínuo):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-superficie-600 mb-1">
                    Fase R
                  </label>
                  <select
                    value={corFaseR}
                    onChange={(e) => setCorFaseR(e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-borda bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none"
                  >
                    <option value="#FFFFFF">Branco (Contrastante)</option>
                    <option value="#000000">Preto</option>
                    <option value="#EF4444">Vermelho</option>
                  </select>
                </div>

                {qtdFase >= 2 && (
                  <div>
                    <label className="block text-[11px] font-medium text-superficie-600 mb-1">
                      Fase S
                    </label>
                    <select
                      value={corFaseS}
                      onChange={(e) => setCorFaseS(e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-borda bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none"
                    >
                      <option value="#000000">Preto</option>
                      <option value="#FFFFFF">Branco (Contrastante)</option>
                      <option value="#EF4444">Vermelho</option>
                    </select>
                  </div>
                )}

                {qtdFase >= 3 && (
                  <div>
                    <label className="block text-[11px] font-medium text-superficie-600 mb-1">
                      Fase T
                    </label>
                    <select
                      value={corFaseT}
                      onChange={(e) => setCorFaseT(e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-borda bg-white px-2 text-superficie-800 focus:border-azul-500 focus:outline-none"
                    >
                      <option value="#EF4444">Vermelho</option>
                      <option value="#000000">Preto</option>
                      <option value="#FFFFFF">Branco (Contrastante)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-superficie-200">
            <div className="text-xs font-semibold text-superficie-700 mb-1.5 flex items-center justify-between">
              <span>Pré-visualização do Traço do Circuito:</span>
              <span className="text-[11px] text-superficie-500 font-normal">
                {qtdFase}F + {qtdNeutro}N + {qtdTerra}T {qtdRetorno > 0 ? `+ ${qtdRetorno}R` : ""}
              </span>
            </div>
            <div className="h-14 rounded-lg bg-superficie-200/80 border border-superficie-300 p-2 flex items-center justify-center relative overflow-hidden">
              <svg className="w-full h-10" viewBox="0 0 300 40">
                <rect x="10" y="8" width="280" height="24" rx="4" fill="#3b82f6" fillOpacity="0.35" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                {(() => {
                  const linhas: { cor: string; dash?: string; label: string; strokeExtra?: boolean }[] = [];
                  if (qtdFase >= 1) linhas.push({ cor: corFaseR, label: "R", strokeExtra: corFaseR === "#FFFFFF" });
                  if (qtdFase >= 2) linhas.push({ cor: corFaseS, label: "S", strokeExtra: corFaseS === "#FFFFFF" });
                  if (qtdFase >= 3) linhas.push({ cor: corFaseT, label: "T", strokeExtra: corFaseT === "#FFFFFF" });
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
                  const espaco = total > 1 ? 20 / (total - 1) : 0;
                  const inicioY = total > 1 ? 10 : 20;

                  return linhas.map((l, i) => {
                    const y = inicioY + i * espaco;
                    return (
                      <g key={i}>
                        {l.strokeExtra && (
                          <line x1="20" y1={y} x2="280" y2={y} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                        )}
                        <line
                          x1="20"
                          y1={y}
                          x2="280"
                          y2={y}
                          stroke={l.cor}
                          strokeWidth="2"
                          strokeDasharray={l.dash}
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] text-superficie-500 mt-1 px-1">
              <span>Fases: contínuo</span>
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
