"use client";

import { useState } from "react";
import { Check, Edit2, Plus, Settings2, Trash2, X } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import type {
  CategoriaPredefinicao,
  Nivel3D,
  TipoElementoLevantamento,
  TipoGeometriaLevantamento,
} from "@/lib/levantamento/tipos";

interface GerenciadorCategoriasModalProps {
  aberto: boolean;
  categorias: CategoriaPredefinicao[];
  niveis: Nivel3D[];
  aoSalvar: (novasCategorias: CategoriaPredefinicao[]) => void;
  aoFechar: () => void;
}

export function GerenciadorCategoriasModal({
  aberto,
  categorias,
  niveis,
  aoSalvar,
  aoFechar,
}: GerenciadorCategoriasModalProps) {
  const [listaCategorias, setListaCategorias] =
    useState<CategoriaPredefinicao[]>(categorias);
  const [categoriaAtiva, setCategoriaAtiva] = useState(
    categorias[0]?.nome ?? "Elétrica",
  );

  const [novoNomeCat, setNovoNomeCat] = useState("");
  const [editandoCatNome, setEditandoCatNome] = useState<string | null>(null);
  const [catRenomeada, setCatRenomeada] = useState("");

  const [novoElementoNome, setNovoElementoNome] = useState("");
  const [novoElementoCor, setNovoElementoCor] = useState("#38bdf8");
  const [novoElementoTipo, setNovoElementoTipo] =
    useState<TipoGeometriaLevantamento>("ponto");
  const [novoElementoNivel, setNovoElementoNivel] = useState(
    niveis[0]?.id ?? "piso",
  );
  const [novoElementoAltura, setNovoElementoAltura] = useState(
    String(niveis[0]?.cota ?? "0.3"),
  );

  const [editandoElementoId, setEditandoElementoId] = useState<string | null>(
    null,
  );
  const [editElementoNome, setEditElementoNome] = useState("");
  const [editElementoCor, setEditElementoCor] = useState("#38bdf8");
  const [editElementoTipo, setEditElementoTipo] =
    useState<TipoGeometriaLevantamento>("ponto");
  const [editElementoNivel, setEditElementoNivel] = useState(
    niveis[0]?.id ?? "piso",
  );
  const [editElementoAltura, setEditElementoAltura] = useState("0.3");

  const catAtual = listaCategorias.find((c) => c.nome === categoriaAtiva);

  function adicionarCategoria() {
    if (!novoNomeCat.trim()) return;
    const nome = novoNomeCat.trim();
    if (listaCategorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      alert("Já existe uma categoria com este nome.");
      return;
    }
    setListaCategorias((prev) => [...prev, { nome, elementos: [] }]);
    setCategoriaAtiva(nome);
    setNovoNomeCat("");
  }

  function salvarRenomearCategoria() {
    if (!editandoCatNome || !catRenomeada.trim()) return;
    const nomeNovo = catRenomeada.trim();
    setListaCategorias((prev) =>
      prev.map((c) =>
        c.nome === editandoCatNome
          ? {
              ...c,
              nome: nomeNovo,
              elementos: c.elementos.map((el) => ({
                ...el,
                categoria: nomeNovo,
              })),
            }
          : c,
      ),
    );
    if (categoriaAtiva === editandoCatNome) {
      setCategoriaAtiva(nomeNovo);
    }
    setEditandoCatNome(null);
    setCatRenomeada("");
  }

  function removerCategoria(nome: string) {
    if (
      !confirm(
        `Tem certeza que deseja excluir a categoria "${nome}" e todos os seus elementos?`,
      )
    )
      return;
    const filtrada = listaCategorias.filter((c) => c.nome !== nome);
    setListaCategorias(filtrada);
    if (categoriaAtiva === nome) {
      setCategoriaAtiva(filtrada[0]?.nome ?? "");
    }
  }

  function adicionarElemento() {
    if (!novoElementoNome.trim() || !catAtual) return;
    const nivelObj = niveis.find((n) => n.id === novoElementoNivel);
    const altNum = Number(novoElementoAltura.replace(",", "."));
    const alt = isNaN(altNum) ? (nivelObj?.cota ?? 0) : altNum;

    const novo: TipoElementoLevantamento = {
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nome: novoElementoNome.trim(),
      cor: novoElementoCor,
      categoria: catAtual.nome,
      tipoGeometria: novoElementoTipo,
      nivelPadraoId: novoElementoNivel,
      alturaPadrao: alt,
    };

    setListaCategorias((prev) =>
      prev.map((c) =>
        c.nome === catAtual.nome
          ? { ...c, elementos: [...c.elementos, novo] }
          : c,
      ),
    );
    setNovoElementoNome("");
  }

  function iniciarEdicaoElemento(el: TipoElementoLevantamento) {
    setEditandoElementoId(el.id);
    setEditElementoNome(el.nome);
    setEditElementoCor(el.cor);
    setEditElementoTipo(el.tipoGeometria);
    setEditElementoNivel(el.nivelPadraoId ?? niveis[0]?.id ?? "piso");
    setEditElementoAltura(String(el.alturaPadrao ?? 0.3));
  }

  function salvarEdicaoElemento() {
    if (!editandoElementoId || !editElementoNome.trim() || !catAtual) return;
    const alturaNum = Number(editElementoAltura.replace(",", "."));
    const alt = isNaN(alturaNum) ? 0.3 : alturaNum;

    setListaCategorias((prev) =>
      prev.map((c) =>
        c.nome === catAtual.nome
          ? {
              ...c,
              elementos: c.elementos.map((el) =>
                el.id === editandoElementoId
                  ? {
                      ...el,
                      nome: editElementoNome.trim(),
                      cor: editElementoCor,
                      tipoGeometria: editElementoTipo,
                      nivelPadraoId: editElementoNivel,
                      alturaPadrao: alt,
                    }
                  : el,
              ),
            }
          : c,
      ),
    );
    setEditandoElementoId(null);
  }

  function cancelarEdicaoElemento() {
    setEditandoElementoId(null);
  }

  function removerElemento(elId: string) {
    if (!catAtual) return;
    setListaCategorias((prev) =>
      prev.map((c) =>
        c.nome === catAtual.nome
          ? { ...c, elementos: c.elementos.filter((e) => e.id !== elId) }
          : c,
      ),
    );
  }

  function salvar() {
    aoSalvar(listaCategorias);
    try {
      localStorage.setItem(
        "painel_levantamento_catalogo_personalizado",
        JSON.stringify(listaCategorias),
      );
    } catch {}
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Gerenciador de Categorias e Elementos de Levantamento"
      descricao="Crie novas disciplinas, edite nomes de elementos, altere cores, níveis associados e tipos de medição."
      tamanho="lg"
    >
      <div className="space-y-4">
        <div className="flex gap-2 items-end">
          <Campo
            rotulo="Nova Categoria / Disciplina"
            placeholder="Ex.: Ar Condicionado, CFTV"
            value={novoNomeCat}
            onChange={(e) => setNovoNomeCat(e.target.value)}
          />
          <Botao variante="primario" onClick={adicionarCategoria}>
            <Plus className="h-4 w-4" />
            Adicionar Categoria
          </Botao>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-superficie-200 pb-2">
          {listaCategorias.map((c) => (
            <button
              key={c.nome}
              type="button"
              onClick={() => {
                setCategoriaAtiva(c.nome);
                setEditandoElementoId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                categoriaAtiva === c.nome
                  ? "bg-azul-600 text-white shadow-sm"
                  : "bg-superficie-100 text-superficie-700 hover:bg-superficie-200"
              }`}
            >
              {c.nome} ({c.elementos.length})
            </button>
          ))}
        </div>

        {catAtual && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-superficie-50 border border-superficie-200">
              {editandoCatNome === catAtual.nome ? (
                <div className="flex gap-2 items-center flex-1 pr-2">
                  <input
                    type="text"
                    value={catRenomeada}
                    onChange={(e) => setCatRenomeada(e.target.value)}
                    className="flex-1 rounded-lg border border-azul-500 px-2 py-1 text-sm bg-white"
                  />
                  <Botao tamanho="sm" onClick={salvarRenomearCategoria}>
                    Salvar
                  </Botao>
                  <Botao
                    tamanho="sm"
                    variante="fantasma"
                    onClick={() => setEditandoCatNome(null)}
                  >
                    Cancelar
                  </Botao>
                </div>
              ) : (
                <>
                  <div className="font-bold text-superficie-900 text-sm">
                    Disciplina: {catAtual.nome}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoCatNome(catAtual.nome);
                        setCatRenomeada(catAtual.nome);
                      }}
                      className="p-1.5 rounded-lg text-superficie-600 hover:bg-superficie-200 text-xs flex items-center gap-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Renomear
                    </button>
                    {listaCategorias.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerCategoria(catAtual.nome)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Categoria
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-3 rounded-xl border border-superficie-200 bg-superficie-50 space-y-2">
              <span className="text-xs font-bold text-superficie-800 uppercase tracking-wider block">
                Novo Elemento em &quot;{catAtual.nome}&quot;:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_70px_40px_auto] gap-2 items-end">
                <Campo
                  rotulo="Nome do Elemento"
                  placeholder="Ex.: Sensor de Presença"
                  value={novoElementoNome}
                  onChange={(e) => setNovoElementoNome(e.target.value)}
                />
                <Selecao
                  rotulo="Tipo"
                  value={novoElementoTipo}
                  onChange={(e) =>
                    setNovoElementoTipo(
                      e.target.value as TipoGeometriaLevantamento,
                    )
                  }
                >
                  <option value="ponto">Ponto / Contagem</option>
                  <option value="distancia">Distância Linear</option>
                  <option value="tubulacao_cabo">Trecho com Cabos</option>
                  <option value="area">Área / Polígono</option>
                  <option value="descida_subida">Descida/Subida 3D</option>
                </Selecao>
                <Selecao
                  rotulo="Nível"
                  value={novoElementoNivel}
                  onChange={(e) => {
                    setNovoElementoNivel(e.target.value);
                    const n = niveis.find((x) => x.id === e.target.value);
                    if (n) setNovoElementoAltura(String(n.cota));
                  }}
                >
                  {niveis.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nome} ({n.cota}m)
                    </option>
                  ))}
                </Selecao>
                <Campo
                  rotulo="Cota (m)"
                  placeholder="0.3"
                  value={novoElementoAltura}
                  onChange={(e) => setNovoElementoAltura(e.target.value)}
                />
                <div>
                  <label className="text-xs font-medium text-superficie-700 block mb-1">
                    Cor
                  </label>
                  <input
                    type="color"
                    value={novoElementoCor}
                    onChange={(e) => setNovoElementoCor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-superficie-300 p-0 cursor-pointer"
                  />
                </div>
                <Botao variante="primario" onClick={adicionarElemento}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Botao>
              </div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              <span className="text-xs font-semibold text-superficie-600 uppercase tracking-wider block">
                Elementos Cadastrados ({catAtual.elementos.length}):
              </span>
              {catAtual.elementos.map((el) => {
                const emEdicao = editandoElementoId === el.id;

                if (emEdicao) {
                  return (
                    <div
                      key={el.id}
                      className="p-3 rounded-xl border-2 border-azul-500 bg-azul-50/50 space-y-2"
                    >
                      <div className="text-xs font-bold text-azul-900">
                        Editando Elemento
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editElementoNome}
                          onChange={(e) => setEditElementoNome(e.target.value)}
                          placeholder="Nome do elemento"
                          className="rounded-lg border border-superficie-300 px-2.5 py-1.5 text-xs bg-white"
                        />
                        <select
                          value={editElementoTipo}
                          onChange={(e) =>
                            setEditElementoTipo(
                              e.target.value as TipoGeometriaLevantamento,
                            )
                          }
                          className="rounded-lg border border-superficie-300 px-2.5 py-1.5 text-xs bg-white"
                        >
                          <option value="ponto">Ponto / Contagem</option>
                          <option value="distancia">Distância Linear</option>
                          <option value="tubulacao_cabo">Trecho com Cabos</option>
                          <option value="area">Área / Polígono</option>
                          <option value="descida_subida">Descida/Subida 3D</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_40px_auto] gap-2 items-center">
                        <select
                          value={editElementoNivel}
                          onChange={(e) => {
                            setEditElementoNivel(e.target.value);
                            const n = niveis.find((x) => x.id === e.target.value);
                            if (n) setEditElementoAltura(String(n.cota));
                          }}
                          className="rounded-lg border border-superficie-300 px-2.5 py-1.5 text-xs bg-white"
                        >
                          {niveis.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.nome} ({n.cota}m)
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.05"
                          value={editElementoAltura}
                          onChange={(e) => setEditElementoAltura(e.target.value)}
                          placeholder="Altura (m)"
                          className="rounded-lg border border-superficie-300 px-2 py-1.5 text-xs bg-white"
                        />
                        <input
                          type="color"
                          value={editElementoCor}
                          onChange={(e) => setEditElementoCor(e.target.value)}
                          className="w-9 h-8 rounded border border-superficie-300 p-0 cursor-pointer"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={salvarEdicaoElemento}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs flex items-center gap-1 font-semibold"
                          >
                            <Check className="h-3.5 w-3.5" /> Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelarEdicaoElemento}
                            className="p-1.5 rounded-lg bg-superficie-200 text-superficie-700 hover:bg-superficie-300 text-xs"
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
                    key={el.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-superficie-200 bg-white"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: el.cor }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-superficie-900 truncate">
                          {el.nome}
                        </div>
                        <div className="text-[10px] text-superficie-500">
                          Tipo: {el.tipoGeometria} · Altura: {el.alturaPadrao ?? 0}m
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoElemento(el)}
                        className="p-1 text-superficie-500 hover:text-azul-600 rounded hover:bg-azul-50"
                        title="Editar elemento"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removerElemento(el.id)}
                        className="p-1 text-superficie-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Excluir elemento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            <Settings2 className="h-4 w-4" />
            Salvar Alterações
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
