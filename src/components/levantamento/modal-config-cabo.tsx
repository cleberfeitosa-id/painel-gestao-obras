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
  },
];

export function ModalConfigCabo({
  aberto,
  dadosIniciais,
  aoSalvar,
  aoFechar,
}: ModalConfigCaboProps) {
  const [circuito, setCircuito] = useState(dadosIniciais?.circuito ?? "C1");
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
  }

  function salvar() {
    const condutores: { tipo: FuncaoCondutor; quantidade: number }[] = [];
    if (qtdFase > 0) condutores.push({ tipo: "fase", quantidade: qtdFase });
    if (qtdNeutro > 0) condutores.push({ tipo: "neutro", quantidade: qtdNeutro });
    if (qtdTerra > 0) condutores.push({ tipo: "terra", quantidade: qtdTerra });
    if (qtdRetorno > 0)
      condutores.push({ tipo: "retorno", quantidade: qtdRetorno });

    aoSalvar({
      circuito: circuito.trim() || "C1",
      tipoCabo: tipoCabo.trim() || "Cabo 2.5mm²",
      tipoCondutor: tipoCondutor.trim() || "Cobre",
      condutores,
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
