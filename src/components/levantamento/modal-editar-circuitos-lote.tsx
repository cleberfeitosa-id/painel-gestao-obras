"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import { formatarMetros } from "@/lib/levantamento/calculos";
import { CORES_CIRCUITO_SUGERIDAS } from "./modal-config-cabo";
import type {
  FaseCabo,
  FuncaoCondutor,
  ItemLevantamento,
  Nivel3D,
} from "@/lib/levantamento/tipos";

export interface DadosEdicaoLoteCircuito {
  alterarCircuito: boolean;
  circuito: string;
  alterarTipoCabo: boolean;
  tipoCabo: string;
  alterarTipoCondutor: boolean;
  tipoCondutor: string;
  alterarNivel: boolean;
  nivelId: string;
  altura: number;
  alterarCondutores: boolean;
  condutores: { tipo: FuncaoCondutor; quantidade: number; cor?: string }[];
  fases: FaseCabo[];
  alterarCor: boolean;
  cor: string;
}

interface ModalEditarCircuitosLoteProps {
  aberto: boolean;
  itensSelecionados: ItemLevantamento[];
  niveis: Nivel3D[];
  aoSalvar: (dados: DadosEdicaoLoteCircuito) => void;
  aoFechar: () => void;
}

export function ModalEditarCircuitosLote({
  aberto,
  itensSelecionados,
  niveis,
  aoSalvar,
  aoFechar,
}: ModalEditarCircuitosLoteProps) {
  const primeiroItem = itensSelecionados[0];
  const primeiroMeta = primeiroItem?.metadadosCabo;

  const [alterarCircuito, setAlterarCircuito] = useState(false);
  const [circuito, setCircuito] = useState(primeiroMeta?.circuito ?? "C1");

  const [alterarTipoCabo, setAlterarTipoCabo] = useState(true);
  const [tipoCabo, setTipoCabo] = useState(
    primeiroMeta?.tipoCabo ?? "Cabo Flexível 750V 2.5mm²",
  );

  const [alterarTipoCondutor, setAlterarTipoCondutor] = useState(true);
  const [tipoCondutor, setTipoCondutor] = useState(
    primeiroMeta?.tipoCondutor ?? "Cobre",
  );

  const [alterarNivel, setAlterarNivel] = useState(true);
  const [nivelId, setNivelId] = useState(
    primeiroMeta?.nivelId ?? primeiroItem?.nivelId ?? "forro_teto",
  );
  const [altura, setAltura] = useState<number>(
    primeiroMeta?.altura ?? primeiroItem?.altura ?? 2.8,
  );

  const [alterarCor, setAlterarCor] = useState(false);
  const [cor, setCor] = useState(
    primeiroMeta?.cor ?? primeiroItem?.cor ?? "#eab308",
  );

  const [alterarCondutores, setAlterarCondutores] = useState(false);
  const [fases, setFases] = useState<FaseCabo[]>(() => {
    if (primeiroMeta?.fases && primeiroMeta.fases.length > 0) {
      return primeiroMeta.fases;
    }
    return [{ nome: "R", cor: "#FFFFFF", quantidade: 1 }];
  });
  const [qtdNeutro, setQtdNeutro] = useState(
    primeiroMeta?.condutores?.find((c) => c.tipo === "neutro")?.quantidade ?? 1,
  );
  const [qtdTerra, setQtdTerra] = useState(
    primeiroMeta?.condutores?.find((c) => c.tipo === "terra")?.quantidade ?? 1,
  );
  const [qtdRetorno, setQtdRetorno] = useState(
    primeiroMeta?.condutores?.find((c) => c.tipo === "retorno")?.quantidade ?? 0,
  );

  function selecionarNivel(id: string) {
    setNivelId(id);
    const n = niveis.find((x) => x.id === id);
    if (n) {
      setAltura(n.cota);
    }
  }

  function salvar() {
    const condutores: { tipo: FuncaoCondutor; quantidade: number; cor?: string }[] = [];
    const totalFases = fases.reduce((acc, f) => acc + f.quantidade, 0);
    if (totalFases > 0) {
      condutores.push({ tipo: "fase", quantidade: totalFases });
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
      alterarCircuito,
      circuito: circuito.trim(),
      alterarTipoCabo,
      tipoCabo: tipoCabo.trim(),
      alterarTipoCondutor,
      tipoCondutor: tipoCondutor.trim(),
      alterarNivel,
      nivelId,
      altura,
      alterarCondutores,
      condutores,
      fases,
      alterarCor,
      cor,
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Edição em Lote de Circuitos (${itensSelecionados.length} selecionados)`}
      descricao="Marque as propriedades que deseja aplicar conjuntamente a todos os trechos de circuito selecionados."
      tamanho="lg"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-sky-950 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={alterarNivel}
                onChange={(e) => setAlterarNivel(e.target.checked)}
                className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
              />
              <span>Atualizar Nível / Cota Z ({formatarMetros(altura)})</span>
            </label>
            <span className="text-[11px] text-sky-700 font-medium">
              (Corrige altura em lote)
            </span>
          </div>

          {alterarNivel && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                rotulo="Altura Personalizada (m)"
                type="number"
                step="0.05"
                value={altura}
                onChange={(e) => setAltura(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-superficie-800 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={alterarTipoCabo}
                onChange={(e) => setAlterarTipoCabo(e.target.checked)}
                className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
              />
              <span>Tipo de Cabo / Bitola</span>
            </label>
            {alterarTipoCabo && (
              <Campo
                rotulo=""
                placeholder="Ex.: Cabo 2.5mm² 750V"
                value={tipoCabo}
                onChange={(e) => setTipoCabo(e.target.value)}
              />
            )}
          </div>

          <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-superficie-800 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={alterarTipoCondutor}
                onChange={(e) => setAlterarTipoCondutor(e.target.checked)}
                className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
              />
              <span>Material do Condutor</span>
            </label>
            {alterarTipoCondutor && (
              <Selecao
                rotulo=""
                value={tipoCondutor}
                onChange={(e) => setTipoCondutor(e.target.value)}
              >
                <option value="Cobre">Cobre</option>
                <option value="Cobre Flexível">Cobre Flexível</option>
                <option value="Cobre Rígido">Cobre Rígido</option>
                <option value="Alumínio">Alumínio</option>
              </Selecao>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-superficie-800 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={alterarCircuito}
                onChange={(e) => setAlterarCircuito(e.target.checked)}
                className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
              />
              <span>Identificação do Circuito</span>
            </label>
            {alterarCircuito && (
              <Campo
                rotulo=""
                placeholder="Ex.: C4, QDC-TUG01"
                value={circuito}
                onChange={(e) => setCircuito(e.target.value)}
              />
            )}
          </div>

          <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-superficie-800 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={alterarCor}
                onChange={(e) => setAlterarCor(e.target.checked)}
                className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
              />
              <span>Cor do Traço na Planta</span>
            </label>
            {alterarCor && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {CORES_CIRCUITO_SUGERIDAS.map((c) => (
                  <button
                    key={c.cor}
                    type="button"
                    onClick={() => setCor(c.cor)}
                    title={c.nome}
                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 border flex items-center justify-center ${
                      cor.toLowerCase() === c.cor.toLowerCase()
                        ? "ring-2 ring-azul-600 ring-offset-1 border-white scale-105"
                        : "border-black/15"
                    }`}
                    style={{ backgroundColor: c.cor }}
                  >
                    {cor.toLowerCase() === c.cor.toLowerCase() && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-superficie-300"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-superficie-800 uppercase tracking-wider">
            <input
              type="checkbox"
              checked={alterarCondutores}
              onChange={(e) => setAlterarCondutores(e.target.checked)}
              className="w-4 h-4 rounded text-azul-600 focus:ring-azul-500"
            />
            <span>Configuração de Condutores e Fases</span>
          </label>

          {alterarCondutores && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-2 rounded-lg border border-superficie-200 text-center">
                  <span className="text-xs font-bold text-rose-600 block">Fases</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (fases.length > 1) {
                          setFases((p) => p.slice(0, -1));
                        } else if (fases[0]?.quantidade && fases[0].quantidade > 1) {
                          setFases([{ ...fases[0], quantidade: fases[0].quantidade - 1 }]);
                        }
                      }}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs">
                      {fases.reduce((acc, f) => acc + f.quantidade, 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (fases.length === 0) {
                          setFases([{ nome: "R", cor: "#FFFFFF", quantidade: 1 }]);
                        } else {
                          const ult = fases.length - 1;
                          setFases((p) =>
                            p.map((f, i) =>
                              i === ult ? { ...f, quantidade: f.quantidade + 1 } : f,
                            ),
                          );
                        }
                      }}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-superficie-200 text-center">
                  <span className="text-xs font-bold text-blue-600 block">Neutro</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setQtdNeutro(Math.max(0, qtdNeutro - 1))}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs">{qtdNeutro}</span>
                    <button
                      type="button"
                      onClick={() => setQtdNeutro(qtdNeutro + 1)}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-superficie-200 text-center">
                  <span className="text-xs font-bold text-emerald-600 block">Terra</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setQtdTerra(Math.max(0, qtdTerra - 1))}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs">{qtdTerra}</span>
                    <button
                      type="button"
                      onClick={() => setQtdTerra(qtdTerra + 1)}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-superficie-200 text-center">
                  <span className="text-xs font-bold text-amber-600 block">Retorno</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setQtdRetorno(Math.max(0, qtdRetorno - 1))}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs">{qtdRetorno}</span>
                    <button
                      type="button"
                      onClick={() => setQtdRetorno(qtdRetorno + 1)}
                      className="w-5 h-5 rounded bg-superficie-100 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            <Layers className="h-4 w-4" />
            Aplicar a {itensSelecionados.length} Circuitos
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
