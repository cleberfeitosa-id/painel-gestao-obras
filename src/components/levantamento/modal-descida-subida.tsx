"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import { formatarMetros } from "@/lib/levantamento/calculos";
import type { Nivel3D } from "@/lib/levantamento/tipos";

interface ModalDescidaSubidaProps {
  aberto: boolean;
  niveis: Nivel3D[];
  dadosIniciais?: {
    nome?: string;
    subtipo?: string;
    nivelOrigemId?: string;
    alturaOrigem?: number;
    nivelDestinoId?: string;
    alturaDestino?: number;
  };
  aoSalvar: (dados: {
    nome: string;
    subtipo: string;
    cor: string;
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
  dadosIniciais,
  aoSalvar,
  aoFechar,
}: ModalDescidaSubidaProps) {
  const [nome, setNome] = useState(
    dadosIniciais?.nome ?? "Descida de Eletroduto (Forro → Tomada Média)",
  );
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
      (niveis.find((n) => n.id === "tomada_media")?.id ?? niveis[2]?.id ?? "tomada_media"),
  );
  const [alturaDestino, setAlturaDestino] = useState<number>(
    dadosIniciais?.alturaDestino ??
      (niveis.find((n) => n.id === "tomada_media")?.cota ?? 1.2),
  );

  function selecionarOrigem(id: string) {
    setNivelOrigemId(id);
    const n = niveis.find((x) => x.id === id);
    if (n) {
      setAlturaOrigem(n.cota);
      const destNome = niveis.find((x) => x.id === nivelDestinoId)?.nome ?? "";
      setNome(`Descida/Subida (${n.nome} → ${destNome})`);
    }
  }

  function selecionarDestino(id: string) {
    setNivelDestinoId(id);
    const n = niveis.find((x) => x.id === id);
    if (n) {
      setAlturaDestino(n.cota);
      const origNome = niveis.find((x) => x.id === nivelOrigemId)?.nome ?? "";
      setNome(`Descida/Subida (${origNome} → ${n.nome})`);
    }
  }

  const alturaDelta = Math.abs(alturaOrigem - alturaDestino);

  function salvar() {
    aoSalvar({
      nome: nome.trim() || "Descida de Eletroduto",
      subtipo: "descida_eletroduto",
      cor: "#a855f7",
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
        <Campo
          rotulo="Descrição / Identificação"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

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
