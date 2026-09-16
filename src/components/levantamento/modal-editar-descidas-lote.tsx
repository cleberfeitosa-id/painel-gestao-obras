"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import type { ItemLevantamento, Nivel3D } from "@/lib/levantamento/tipos";

export interface DadosEdicaoLoteDescida {
  alterarNome: boolean;
  nome: string;
  alterarCircuito: boolean;
  circuito: string;
  alterarCor: boolean;
  cor: string;
  alterarOrigem: boolean;
  nivelOrigemId: string;
  alturaOrigem: number;
  alterarDestino: boolean;
  nivelDestinoId: string;
  alturaDestino: number;
}

interface Props {
  aberto: boolean;
  itensSelecionados: ItemLevantamento[];
  niveis: Nivel3D[];
  aoSalvar: (dados: DadosEdicaoLoteDescida) => void;
  aoFechar: () => void;
}

export function ModalEditarDescidasLote({ aberto, itensSelecionados, niveis, aoSalvar, aoFechar }: Props) {
  const primeiro = itensSelecionados[0];
  const [alterarNome, setAlterarNome] = useState(false);
  const [nome, setNome] = useState(primeiro?.nome ?? "Descida de Eletroduto");
  const [alterarCircuito, setAlterarCircuito] = useState(false);
  const [circuito, setCircuito] = useState(primeiro?.circuito ?? "");
  const [alterarCor, setAlterarCor] = useState(false);
  const [cor, setCor] = useState(primeiro?.cor ?? "#a855f7");
  const [alterarOrigem, setAlterarOrigem] = useState(true);
  const [nivelOrigemId, setNivelOrigemId] = useState(primeiro?.nivelOrigemId ?? "forro_teto");
  const [alturaOrigem, setAlturaOrigem] = useState(primeiro?.alturaOrigem ?? 2.8);
  const [alterarDestino, setAlterarDestino] = useState(true);
  const [nivelDestinoId, setNivelDestinoId] = useState(primeiro?.nivelDestinoId ?? "tomada_baixa");
  const [alturaDestino, setAlturaDestino] = useState(primeiro?.alturaDestino ?? 0.3);

  function escolherNivel(id: string, origem: boolean) {
    const nivel = niveis.find((item) => item.id === id);
    if (origem) {
      setNivelOrigemId(id);
      if (nivel) setAlturaOrigem(nivel.cota);
    } else {
      setNivelDestinoId(id);
      if (nivel) setAlturaDestino(nivel.cota);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={`Edição em lote de descidas (${itensSelecionados.length})`} descricao="Aplique somente as propriedades marcadas às prumadas selecionadas." tamanho="lg">
      <div className="space-y-4">
        {[
          ["Nome / identificação", alterarNome, setAlterarNome, nome, setNome],
          ["Circuito vinculado", alterarCircuito, setAlterarCircuito, circuito, setCircuito],
        ].map(([label, checked, setChecked, value, setValue]) => (
          <div key={label as string} className="rounded-xl border border-superficie-200 bg-superficie-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-superficie-800">
              <input type="checkbox" checked={checked as boolean} onChange={(event) => (setChecked as (value: boolean) => void)(event.target.checked)} />
              {label as string}
            </label>
            {checked as boolean && <Campo rotulo="" value={value as string} onChange={(event) => (setValue as (value: string) => void)(event.target.value)} />}
          </div>
        ))}

        <div className="rounded-xl border border-superficie-200 bg-superficie-50 p-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-superficie-800">
            <input type="checkbox" checked={alterarCor} onChange={(event) => setAlterarCor(event.target.checked)} /> Cor do traço
          </label>
          {alterarCor && <input type="color" value={cor} onChange={(event) => setCor(event.target.value)} className="mt-2 h-9 w-full cursor-pointer rounded border" />}
        </div>

        {[
          { origem: true, checked: alterarOrigem, setChecked: setAlterarOrigem, id: nivelOrigemId, altura: alturaOrigem, setAltura: setAlturaOrigem, titulo: "Nível de origem" },
          { origem: false, checked: alterarDestino, setChecked: setAlterarDestino, id: nivelDestinoId, altura: alturaDestino, setAltura: setAlturaDestino, titulo: "Nível de destino" },
        ].map((campo) => (
          <div key={campo.titulo} className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
              <input type="checkbox" checked={campo.checked} onChange={(event) => campo.setChecked(event.target.checked)} /> {campo.titulo}
            </label>
            {campo.checked && <div className="grid gap-2 sm:grid-cols-2"><Selecao rotulo="Nível" value={campo.id} onChange={(event) => escolherNivel(event.target.value, campo.origem)}>{niveis.map((nivel) => <option key={nivel.id} value={nivel.id}>{nivel.nome}</option>)}</Selecao><Campo rotulo="Altura (m)" type="number" step="0.05" value={campo.altura} onChange={(event) => campo.setAltura(Number(event.target.value))} /></div>}
          </div>
        ))}

        <div className="flex justify-end gap-3"><Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao><Botao onClick={() => aoSalvar({ alterarNome, nome: nome.trim(), alterarCircuito, circuito: circuito.trim(), alterarCor, cor, alterarOrigem, nivelOrigemId, alturaOrigem, alterarDestino, nivelDestinoId, alturaDestino })}><ArrowDownUp className="h-4 w-4" /> Aplicar</Botao></div>
      </div>
    </Modal>
  );
}
