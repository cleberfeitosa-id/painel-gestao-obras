"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import { formatarMetros } from "@/lib/levantamento/calculos";
import type { Nivel3D } from "@/lib/levantamento/tipos";

export interface ItemCircuitoDisponivel {
  circuito: string;
  cor?: string;
}

interface ModalDescidaSubidaProps {
  aberto: boolean;
  niveis: Nivel3D[];
  circuitosDisponiveis?: (string | ItemCircuitoDisponivel)[];
  dadosIniciais?: {
    nome?: string;
    subtipo?: string;
    cor?: string;
    circuito?: string;
    nivelOrigemId?: string;
    alturaOrigem?: number;
    nivelDestinoId?: string;
    alturaDestino?: number;
  };
  aoSalvar: (dados: {
    nome: string;
    subtipo: string;
    cor: string;
    circuito?: string;
    nivelOrigemId?: string;
    alturaOrigem: number;
    nivelDestinoId?: string;
    alturaDestino: number;
  }) => void;
  aoFechar: () => void;
}

export function ModalDescidaSubida({
  aberto,
  niveis,
  circuitosDisponiveis = [],
  dadosIniciais,
  aoSalvar,
  aoFechar,
}: ModalDescidaSubidaProps) {
  const circuitosNormalizados: ItemCircuitoDisponivel[] = circuitosDisponiveis.map(
    (c) => (typeof c === "string" ? { circuito: c } : c),
  );

  const [nome, setNome] = useState(
    dadosIniciais?.nome ?? "Descida de Eletroduto (Forro → Tomada Baixa)",
  );
  const [circuito, setCircuito] = useState(dadosIniciais?.circuito ?? "");
  const [cor, setCor] = useState(dadosIniciais?.cor ?? "#a855f7");
  const [nivelOrigemId, setNivelOrigemId] = useState(
    dadosIniciais?.nivelOrigemId ??
      (niveis.find((n) => n.id === "forro_teto")?.id ?? niveis[niveis.length - 1]?.id ?? "forro_teto"),
  );
  const [alturaOrigem, setAlturaOrigem] = useState<number>(
    dadosIniciais?.alturaOrigem ??
      (niveis.find((n) => n.id === "forro_teto")?.cota ?? 2.8),
  );

  const [nivelDestinoId, setNivelDestinoId] = useState(
    dadosIniciais?.nivelDestinoId ??
      (niveis.find((n) => n.id === "tomada_baixa")?.id ?? niveis[1]?.id ?? "tomada_baixa"),
  );
  const [alturaDestino, setAlturaDestino] = useState<number>(
    dadosIniciais?.alturaDestino ??
      (niveis.find((n) => n.id === "tomada_baixa")?.cota ?? 0.3),
  );

  function selecionarCircuito(novoCircuito: string) {
    setCircuito(novoCircuito);
    if (novoCircuito) {
      setNome(`Descida Circuito ${novoCircuito}`);
      const circInfo = circuitosNormalizados.find((c) => c.circuito === novoCircuito);
      if (circInfo?.cor) {
        setCor(circInfo.cor);
      }
    } else {
      setNome("Descida de Eletroduto");
      setCor("#a855f7");
    }
  }

  function aplicarPresetDescida(origemId: string, destinoId: string, label: string) {
    setNivelOrigemId(origemId);
    const orig = niveis.find((n) => n.id === origemId);
    if (orig) setAlturaOrigem(orig.cota);

    setNivelDestinoId(destinoId);
    const dest = niveis.find((n) => n.id === destinoId);
    if (dest) setAlturaDestino(dest.cota);

    setNome(circuito ? `Descida Circuito ${circuito} (${label})` : `Descida (${label})`);
  }

  function selecionarOrigem(id: string) {
    setNivelOrigemId(id);
    const n = niveis.find((x) => x.id === id);
    if (n) {
      setAlturaOrigem(n.cota);
      const destNome = niveis.find((x) => x.id === nivelDestinoId)?.nome ?? "";
      setNome(circuito ? `Descida Circuito ${circuito} (${n.nome} → ${destNome})` : `Descida/Subida (${n.nome} → ${destNome})`);
    }
  }

  function selecionarDestino(id: string) {
    setNivelDestinoId(id);
    const n = niveis.find((x) => x.id === id);
    if (n) {
      setAlturaDestino(n.cota);
      const origNome = niveis.find((x) => x.id === nivelOrigemId)?.nome ?? "";
      setNome(circuito ? `Descida Circuito ${circuito} (${origNome} → ${n.nome})` : `Descida/Subida (${origNome} → ${n.nome})`);
    }
  }

  const alturaDelta = Math.abs(alturaOrigem - alturaDestino);

  function salvar() {
    aoSalvar({
      nome: nome.trim() || "Descida de Eletroduto",
      subtipo: "descida_eletroduto",
      cor: cor || "#a855f7",
      circuito: circuito.trim() || undefined,
      nivelOrigemId,
      alturaOrigem,
      nivelDestinoId,
      alturaDestino,
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Descida / Subida Vertical 3D de Eletroduto"
      descricao="Defina os níveis de origem e destino para o trecho vertical na planta."
      tamanho="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-superficie-700 mb-1.5">
            Predefinições Rápidas de Descida:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                aplicarPresetDescida("forro_teto", "tomada_baixa", "Forro → Tomada Baixa")
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:border-purple-500 hover:bg-purple-50/50 text-xs transition-colors"
            >
              <div className="font-semibold text-purple-900">Forro (2.80m) ➔ Tomada Baixa (0.30m)</div>
              <div className="text-[10px] text-superficie-500">Descida vertical de 2.50m</div>
            </button>
            <button
              type="button"
              onClick={() =>
                aplicarPresetDescida("forro_teto", "tomada_media", "Forro → Média / Interruptor")
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:border-purple-500 hover:bg-purple-50/50 text-xs transition-colors"
            >
              <div className="font-semibold text-purple-900">Forro (2.80m) ➔ Média / Interruptor (1.20m)</div>
              <div className="text-[10px] text-superficie-500">Descida vertical de 1.60m</div>
            </button>
            <button
              type="button"
              onClick={() =>
                aplicarPresetDescida("forro_teto", "tomada_alta", "Forro → Tomada Alta")
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:border-purple-500 hover:bg-purple-50/50 text-xs transition-colors"
            >
              <div className="font-semibold text-purple-900">Forro (2.80m) ➔ Tomada Alta (2.20m)</div>
              <div className="text-[10px] text-superficie-500">Descida vertical de 0.60m</div>
            </button>
            <button
              type="button"
              onClick={() =>
                aplicarPresetDescida("piso", "tomada_baixa", "Piso → Tomada Baixa")
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-superficie-200 hover:border-purple-500 hover:bg-purple-50/50 text-xs transition-colors"
            >
              <div className="font-semibold text-purple-900">Piso (0.00m) ➔ Tomada Baixa (0.30m)</div>
              <div className="text-[10px] text-superficie-500">Subida vertical de 0.30m</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-superficie-100">
          <Campo
            rotulo="Descrição / Identificação"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />

          {circuitosNormalizados.length > 0 ? (
            <Selecao
              rotulo="Vincular ao Circuito (Opcional)"
              value={circuito}
              onChange={(e) => selecionarCircuito(e.target.value)}
            >
              <option value="">Nenhum (Eletroduto Geral)</option>
              {circuitosNormalizados.map((c) => (
                <option key={c.circuito} value={c.circuito}>
                  Circuito {c.circuito}
                </option>
              ))}
            </Selecao>
          ) : (
            <Campo
              rotulo="Circuito Vinculado (Opcional)"
              placeholder="Ex.: C1, C4"
              value={circuito}
              onChange={(e) => selecionarCircuito(e.target.value)}
            />
          )}
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl border border-superficie-200 bg-superficie-50">
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-black/20 shadow-xs inline-block shrink-0"
              style={{ backgroundColor: cor }}
            />
            <div>
              <span className="text-xs font-semibold text-superficie-800 block">
                Cor da Descida (2D e 3D):
              </span>
              <span className="text-[11px] text-superficie-500">
                {circuito ? `Herdada do Circuito ${circuito}` : "Cor personalizada da descida"}
              </span>
            </div>
          </div>
          <label
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-superficie-300 bg-white hover:bg-superficie-100 cursor-pointer text-xs text-superficie-700 font-medium"
            title="Alterar cor da descida"
          >
            <span>Alterar</span>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2 p-3 rounded-xl border border-sky-200 bg-sky-50/50">
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">
              Nível de Origem (Cota Superior/Inicial)
            </span>
            <Selecao
              rotulo="Nível"
              value={nivelOrigemId}
              onChange={(e) => selecionarOrigem(e.target.value)}
            >
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome} ({formatarMetros(n.cota)})
                </option>
              ))}
            </Selecao>
            <Campo
              rotulo="Altura Personalizada (m)"
              type="number"
              step="0.05"
              value={alturaOrigem}
              onChange={(e) => setAlturaOrigem(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2 p-3 rounded-xl border border-purple-200 bg-purple-50/50">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">
              Nível de Destino (Cota Inferior/Final)
            </span>
            <Selecao
              rotulo="Nível"
              value={nivelDestinoId}
              onChange={(e) => selecionarDestino(e.target.value)}
            >
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome} ({formatarMetros(n.cota)})
                </option>
              ))}
            </Selecao>
            <Campo
              rotulo="Altura Personalizada (m)"
              type="number"
              step="0.05"
              value={alturaDestino}
              onChange={(e) => setAlturaDestino(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-superficie-100 border border-superficie-200">
          <div>
            <span className="text-xs text-superficie-600 block">
              Comprimento Vertical do Tubo / Eletroduto:
            </span>
            <span className="text-lg font-bold text-azul-700">
              {formatarMetros(alturaDelta)}
            </span>
          </div>
          <div className="text-xs text-superficie-500">
            Será somado automaticamente nas tubulações
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            <ArrowDownUp className="h-4 w-4" />
            Inserir Descida/Subida
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
