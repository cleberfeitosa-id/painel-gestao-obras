"use client";

import { useState } from "react";
import { Check, Edit2, Layers, Plus, Trash2, X } from "lucide-react";
import { Botao, Campo, Modal } from "@/components/ui";
import { formatarMetros } from "@/lib/levantamento/calculos";
import type { Nivel3D } from "@/lib/levantamento/tipos";

interface GerenciadorNiveisModalProps {
  aberto: boolean;
  niveis: Nivel3D[];
  aoSalvar: (novosNiveis: Nivel3D[]) => void;
  aoFechar: () => void;
}

export function GerenciadorNiveisModal({
  aberto,
  niveis,
  aoSalvar,
  aoFechar,
}: GerenciadorNiveisModalProps) {
  const [lista, setLista] = useState<Nivel3D[]>(niveis);
  const [novoNome, setNovoNome] = useState("");
  const [novaCota, setNovaCota] = useState("1.5");
  const [novaCor, setNovaCor] = useState("#38bdf8");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCota, setEditCota] = useState("1.5");
  const [editCor, setEditCor] = useState("#38bdf8");

  function iniciarEdicao(nivel: Nivel3D) {
    setEditandoId(nivel.id);
    setEditNome(nivel.nome);
    setEditCota(String(nivel.cota));
    setEditCor(nivel.cor);
  }

  function salvarEdicao() {
    if (!editandoId || !editNome.trim()) return;
    const cotaNum = Number(editCota.replace(",", "."));
    if (isNaN(cotaNum)) return;

    setLista((prev) =>
      prev
        .map((n) =>
          n.id === editandoId
            ? { ...n, nome: editNome.trim(), cota: cotaNum, cor: editCor }
            : n,
        )
        .sort((a, b) => a.cota - b.cota),
    );
    setEditandoId(null);
  }

  function cancelarEdicao() {
    setEditandoId(null);
  }

  function adicionar() {
    if (!novoNome.trim()) return;
    const cotaNum = Number(novaCota.replace(",", "."));
    if (isNaN(cotaNum)) return;

    const id = `nivel_${Date.now()}`;
    setLista((prev) =>
      [...prev, { id, nome: novoNome.trim(), cota: cotaNum, cor: novaCor }].sort(
        (a, b) => a.cota - b.cota,
      ),
    );
    setNovoNome("");
    setNovaCota("1.5");
  }

  function remover(id: string) {
    setLista((prev) => prev.filter((n) => n.id !== id));
  }

  function salvar() {
    aoSalvar(lista);
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Gerenciador de Níveis e Alturas 3D"
      descricao="Defina as alturas (cotas em metros relativas ao piso) para associar a tomadas, interruptores, forros e tubulações."
      tamanho="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-superficie-200 bg-superficie-50 p-3 space-y-3">
          <span className="text-xs font-bold text-superficie-800 uppercase tracking-wider block">
            Adicionar Novo Nível:
          </span>
          <div className="grid grid-cols-[1fr_90px_40px_auto] gap-2 items-end">
            <Campo
              rotulo="Nome do Nível"
              placeholder="Ex.: Bancada Cozinha"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <Campo
              rotulo="Cota (m)"
              type="number"
              step="0.05"
              value={novaCota}
              onChange={(e) => setNovaCota(e.target.value)}
            />
            <div>
              <label className="text-xs font-medium text-superficie-700 block mb-1">
                Cor
              </label>
              <input
                type="color"
                value={novaCor}
                onChange={(e) => setNovaCor(e.target.value)}
                className="w-10 h-9 rounded-lg border border-superficie-300 p-0 cursor-pointer"
              />
            </div>
            <Botao variante="primario" onClick={adicionar}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Botao>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <span className="text-xs font-semibold text-superficie-600 uppercase tracking-wider block">
            Níveis Cadastrados ({lista.length}):
          </span>
          {lista.map((nivel) => {
            const emEdicao = editandoId === nivel.id;

            if (emEdicao) {
              return (
                <div
                  key={nivel.id}
                  className="p-2.5 rounded-lg border-2 border-azul-500 bg-azul-50/50 space-y-2"
                >
                  <div className="grid grid-cols-[1fr_80px_40px_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      placeholder="Nome do nível"
                      className="rounded-lg border border-superficie-300 px-2 py-1 text-xs bg-white"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={editCota}
                      onChange={(e) => setEditCota(e.target.value)}
                      placeholder="Cota (m)"
                      className="rounded-lg border border-superficie-300 px-2 py-1 text-xs bg-white"
                    />
                    <input
                      type="color"
                      value={editCor}
                      onChange={(e) => setEditCor(e.target.value)}
                      className="w-8 h-7 rounded border border-superficie-300 p-0 cursor-pointer"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={salvarEdicao}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Confirmar edição"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicao}
                        className="p-1 rounded bg-superficie-300 text-superficie-800 hover:bg-superficie-400"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={nivel.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-superficie-200 bg-white hover:border-superficie-300"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: nivel.cor }}
                  />
                  <div>
                    <div className="text-sm font-medium text-superficie-900">
                      {nivel.nome}
                    </div>
                    <div className="text-xs text-superficie-500 font-mono">
                      Altura: {formatarMetros(nivel.cota)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(nivel)}
                    className="p-1.5 rounded-lg text-superficie-600 hover:text-azul-600 hover:bg-azul-50"
                    title="Editar Nível"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(nivel.id)}
                    className="p-1.5 rounded-lg text-superficie-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Remover Nível"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            <Layers className="h-4 w-4" />
            Salvar Níveis
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
