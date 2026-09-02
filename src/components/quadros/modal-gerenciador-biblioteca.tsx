"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Search,
  Check,
  Package,
  Layers,
  Shield,
  Zap,
} from "lucide-react";
import { Modal, Botao } from "@/components/ui";
import {
  COMPONENTES_CATALOGO_PADRAO,
  type DimensaoPadraoComponente,
} from "@/lib/quadros/tipos";

interface ModalGerenciadorBibliotecaProps {
  aberto: boolean;
  aoFechar: () => void;
  catalogo: Record<string, DimensaoPadraoComponente>;
  aoAtualizarCatalogo: (novoCatalogo: Record<string, DimensaoPadraoComponente>) => void;
}

export function ModalGerenciadorBiblioteca({
  aberto,
  aoFechar,
  catalogo,
  aoAtualizarCatalogo,
}: ModalGerenciadorBibliotecaProps) {
  if (!aberto) return null;

  return (
    <ModalGerenciadorConteudo
      aoFechar={aoFechar}
      catalogo={catalogo}
      aoAtualizarCatalogo={aoAtualizarCatalogo}
    />
  );
}

function ModalGerenciadorConteudo({
  aoFechar,
  catalogo,
  aoAtualizarCatalogo,
}: Omit<ModalGerenciadorBibliotecaProps, "aberto">) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [editandoChave, setEditandoChave] = useState<string | null>(null);
  const [modoCriar, setModoCriar] = useState(false);

  const [formTipo, setFormTipo] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCategoria, setFormCategoria] = useState<
    "disjuntor" | "protecao" | "conexao" | "estrutura" | "barramento" | "outros"
  >("disjuntor");
  const [formLarguraMm, setFormLarguraMm] = useState(17.5);
  const [formAlturaMm, setFormAlturaMm] = useState(83);
  const [formProfundidadeMm, setFormProfundidadeMm] = useState(70);
  const [formOrientacao, setFormOrientacao] = useState<"vertical" | "horizontal">("vertical");
  const [formModulosDin, setFormModulosDin] = useState<number | undefined>(1);
  const [formRequerTrilho, setFormRequerTrilho] = useState(true);
  const [formCorrenteA, setFormCorrenteA] = useState<number | undefined>(16);
  const [formCurva, setFormCurva] = useState<"B" | "C" | "D" | undefined>("C");
  const [formPolos, setFormPolos] = useState<1 | 2 | 3 | 4 | undefined>(1);
  const [formTensaoV, setFormTensaoV] = useState<number | undefined>(220);
  const [formCor, setFormCor] = useState("");
  const [formNorma, setFormNorma] = useState("NBR IEC 60898");
  const [formDescricao, setFormDescricao] = useState("");

  function iniciarCriacao() {
    setModoCriar(true);
    setEditandoChave(null);
    const idUnico = `comp_${Date.now().toString(36)}`;
    setFormTipo(idUnico);
    setFormNome("");
    setFormCategoria("disjuntor");
    setFormLarguraMm(17.5);
    setFormAlturaMm(83);
    setFormProfundidadeMm(70);
    setFormOrientacao("vertical");
    setFormModulosDin(1);
    setFormRequerTrilho(true);
    setFormCorrenteA(16);
    setFormCurva("C");
    setFormPolos(1);
    setFormTensaoV(220);
    setFormCor("");
    setFormNorma("NBR IEC 60898");
    setFormDescricao("");
  }

  function iniciarEdicao(chave: string, item: DimensaoPadraoComponente) {
    setEditandoChave(chave);
    setModoCriar(false);
    setFormTipo(item.tipo);
    setFormNome(item.nome);
    setFormCategoria(item.categoria);
    setFormLarguraMm(item.larguraMm);
    setFormAlturaMm(item.alturaMm);
    setFormProfundidadeMm(item.profundidadeMm);
    setFormOrientacao(item.orientacao || "vertical");
    setFormModulosDin(item.modulosDin);
    setFormRequerTrilho(item.requerTrilhoDin);
    setFormCorrenteA(item.correntDefaultA);
    setFormCurva(item.curvaDisjuntor);
    setFormPolos(item.polos);
    setFormTensaoV(item.tensaoV);
    setFormCor(item.corPersonalizada || "");
    setFormNorma(item.normaReferencia);
    setFormDescricao(item.descricaoPadrao);
  }

  function cancelarForm() {
    setModoCriar(false);
    setEditandoChave(null);
  }

  function salvarComponente(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim()) return;

    const chave = editandoChave || formTipo || `comp_${Date.now().toString(36)}`;
    const novoItem: DimensaoPadraoComponente = {
      tipo: chave,
      nome: formNome.trim(),
      categoria: formCategoria,
      larguraMm: Number(formLarguraMm) || 17.5,
      alturaMm: Number(formAlturaMm) || 83,
      profundidadeMm: Number(formProfundidadeMm) || 70,
      orientacao: formOrientacao,
      modulosDin: formModulosDin ? Number(formModulosDin) : undefined,
      requerTrilhoDin: formRequerTrilho,
      correntDefaultA: formCorrenteA ? Number(formCorrenteA) : undefined,
      curvaDisjuntor: formCategoria === "disjuntor" ? formCurva : undefined,
      polos: formPolos,
      tensaoV: formTensaoV,
      corPersonalizada: formCor.trim() || undefined,
      normaReferencia: formNorma.trim() || "NBR 5410",
      descricaoPadrao: formDescricao.trim() || formNome.trim(),
      personalizado: true,
    };

    const novoCatalogo = {
      ...catalogo,
      [chave]: novoItem,
    };

    aoAtualizarCatalogo(novoCatalogo);
    try {
      localStorage.setItem("painel_gestao_catalogo_quadros_v1", JSON.stringify(novoCatalogo));
    } catch {}

    cancelarForm();
  }

  function excluirComponente(chave: string) {
    if (!confirm("Tem certeza que deseja remover este componente da biblioteca?")) return;
    const novoCatalogo = { ...catalogo };
    delete novoCatalogo[chave];
    aoAtualizarCatalogo(novoCatalogo);
    try {
      localStorage.setItem("painel_gestao_catalogo_quadros_v1", JSON.stringify(novoCatalogo));
    } catch {}
    if (editandoChave === chave) cancelarForm();
  }

  function restaurarPadroes() {
    if (!confirm("Deseja restaurar a biblioteca para os componentes padrão de fábrica? Itens personalizados serão redefinidos.")) {
      return;
    }
    aoAtualizarCatalogo(COMPONENTES_CATALOGO_PADRAO);
    try {
      localStorage.removeItem("painel_gestao_catalogo_quadros_v1");
    } catch {}
    cancelarForm();
  }

  const itensFiltrados = Object.entries(catalogo).filter(([, item]) => {
    const combinaCategoria =
      categoriaAtiva === "todos"
        ? true
        : categoriaAtiva === "personalizados"
          ? item.personalizado
          : item.categoria === categoriaAtiva;

    const termo = busca.toLowerCase().trim();
    const combinaBusca =
      !termo ||
      item.nome.toLowerCase().includes(termo) ||
      item.tipo.toLowerCase().includes(termo) ||
      item.descricaoPadrao.toLowerCase().includes(termo) ||
      item.normaReferencia.toLowerCase().includes(termo);

    return combinaCategoria && combinaBusca;
  });

  return (
    <Modal
      aberto={true}
      aoFechar={aoFechar}
      titulo="Gerenciador da Biblioteca de Componentes"
      descricao="Cadastre novos componentes elétricos, edite dimensões, orientação e propriedades, ou exclua itens do catálogo."
      tamanho="xl"
    >
      <div className="flex flex-col h-[600px] max-h-[75vh] -mx-6 -my-4">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-borda bg-superficie-50 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-superficie-400" />
              <input
                type="text"
                placeholder="Buscar componente, norma ou tipo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-borda bg-white text-xs text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Botao
              type="button"
              variante="contorno"
              tamanho="sm"
              onClick={restaurarPadroes}
              title="Restaurar componentes padrão do catálogo"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Padrões
            </Botao>
            <Botao
              type="button"
              variante="primario"
              tamanho="sm"
              onClick={iniciarCriacao}
            >
              <Plus className="h-4 w-4" />
              Novo Componente
            </Botao>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-borda text-xs overflow-x-auto shrink-0">
          {[
            { id: "todos", label: "Todos os Itens", icone: Package },
            { id: "disjuntor", label: "Disjuntores", icone: Zap },
            { id: "protecao", label: "Proteção DR / DPS", icone: Shield },
            { id: "conexao", label: "Conexão & Bornes", icone: Check },
            { id: "estrutura", label: "Trilhos & Canaletas", icone: Layers },
            { id: "barramento", label: "Barramentos", icone: Layers },
            { id: "outros", label: "Outros", icone: Package },
          ].map((cat) => {
            const Icone = cat.icone;
            const ativo = categoriaAtiva === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaAtiva(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  ativo
                    ? "bg-azul-600 text-white shadow-sm"
                    : "text-superficie-600 hover:bg-superficie-100 hover:text-superficie-900"
                }`}
              >
                <Icone className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {itensFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-superficie-500">
                <Package className="h-10 w-10 text-superficie-400 mb-2 stroke-[1.5]" />
                <p className="text-sm font-semibold text-superficie-700">Nenhum componente encontrado</p>
                <p className="text-xs text-superficie-400 mt-1">
                  Tente alterar os termos da busca ou clique em &quot;Novo Componente&quot; para adicionar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {itensFiltrados.map(([chave, item]) => {
                  const selecionado = editandoChave === chave;
                  return (
                    <div
                      key={chave}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                        selecionado
                          ? "border-azul-600 bg-azul-50/50 shadow-sm"
                          : "border-borda bg-white hover:border-superficie-400 hover:shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-xs text-superficie-900">{item.nome}</h4>
                              {item.personalizado && (
                                <span className="text-[10px] bg-purple-100 text-purple-800 font-medium px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-superficie-500 mt-0.5 line-clamp-1">
                              {item.descricaoPadrao}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(chave, item)}
                              className="p-1 rounded-md text-superficie-500 hover:text-azul-600 hover:bg-superficie-100 transition-colors"
                              title="Editar propriedades"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirComponente(chave)}
                              className="p-1 rounded-md text-superficie-500 hover:text-perigo hover:bg-superficie-100 transition-colors"
                              title="Excluir da biblioteca"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 p-2 bg-superficie-50 rounded-lg text-[11px] text-superficie-600">
                          <div>
                            <span className="text-[10px] text-superficie-400 block">Dimensões (L×A×P)</span>
                            <span className="font-semibold text-superficie-800">
                              {item.larguraMm}×{item.alturaMm}×{item.profundidadeMm}mm
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-superficie-400 block">Orientação</span>
                            <span className="font-semibold text-superficie-800 capitalize">
                              {item.orientacao || "Vertical"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-superficie-400 block">Trilho DIN</span>
                            <span className="font-semibold text-superficie-800">
                              {item.requerTrilhoDin ? `Sim (${item.modulosDin ?? 1}M)` : "Não"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-borda/60 text-[10px] text-superficie-500 font-mono">
                        <span>{item.normaReferencia}</span>
                        {item.correntDefaultA && <span>In: {item.correntDefaultA}A</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(modoCriar || editandoChave) && (
            <div className="w-80 md:w-96 bg-superficie-50 border-l border-borda p-4 overflow-y-auto flex flex-col shrink-0">
              <div className="flex items-center justify-between pb-3 border-b border-borda mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-superficie-800">
                  {modoCriar ? "Novo Componente" : "Editar Componente"}
                </h3>
                <button
                  type="button"
                  onClick={cancelarForm}
                  className="text-xs text-superficie-500 hover:text-superficie-900"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={salvarComponente} className="space-y-3 text-xs">
                <div>
                  <label className="block text-superficie-700 font-medium mb-1">
                    Nome do Componente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Minidisjuntor 2P 40A Curva C"
                    className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900 focus:ring-2 focus:ring-azul-500"
                  />
                </div>

                <div>
                  <label className="block text-superficie-700 font-medium mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) =>
                      setFormCategoria(
                        e.target.value as "disjuntor" | "protecao" | "conexao" | "estrutura" | "barramento" | "outros"
                      )
                    }
                    className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs text-superficie-900"
                  >
                    <option value="disjuntor">Disjuntor / Seccionador</option>
                    <option value="protecao">Proteção (DR, DPS, Relé)</option>
                    <option value="conexao">Conexão (Bornes, Terminais)</option>
                    <option value="estrutura">Estrutura (Trilhos, Canaletas)</option>
                    <option value="barramento">Barramento</option>
                    <option value="outros">Outros Equipamentos</option>
                  </select>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-borda space-y-2">
                  <span className="block font-semibold text-superficie-800 text-[11px]">
                    Dimensões Físicas (mm)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-superficie-500 mb-0.5">Largura (L)</label>
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        required
                        value={formLarguraMm}
                        onChange={(e) => setFormLarguraMm(Number(e.target.value))}
                        className="w-full rounded border border-borda px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-superficie-500 mb-0.5">Altura (A)</label>
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        required
                        value={formAlturaMm}
                        onChange={(e) => setFormAlturaMm(Number(e.target.value))}
                        className="w-full rounded border border-borda px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-superficie-500 mb-0.5">Profundidade (P)</label>
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        required
                        value={formProfundidadeMm}
                        onChange={(e) => setFormProfundidadeMm(Number(e.target.value))}
                        className="w-full rounded border border-borda px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Orientação
                    </label>
                    <select
                      value={formOrientacao}
                      onChange={(e) => setFormOrientacao(e.target.value as "vertical" | "horizontal")}
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs text-superficie-900"
                    >
                      <option value="vertical">Vertical (Padrão)</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Fixação em Trilho DIN
                    </label>
                    <select
                      value={formRequerTrilho ? "sim" : "nao"}
                      onChange={(e) => setFormRequerTrilho(e.target.value === "sim")}
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs text-superficie-900"
                    >
                      <option value="sim">Sim (Trilho TS35)</option>
                      <option value="nao">Não (Fundo de Painel)</option>
                    </select>
                  </div>
                </div>

                {formRequerTrilho && (
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Módulos DIN (Passo de 17.5mm)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={formModulosDin ?? ""}
                      onChange={(e) => setFormModulosDin(Number(e.target.value) || undefined)}
                      placeholder="Ex: 1, 2, 3, 4"
                      className="w-full rounded-lg border border-borda bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Corrente In (A)
                    </label>
                    <input
                      type="number"
                      value={formCorrenteA ?? ""}
                      onChange={(e) => setFormCorrenteA(Number(e.target.value) || undefined)}
                      placeholder="Ex: 32"
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Polos
                    </label>
                    <select
                      value={formPolos ?? 1}
                      onChange={(e) => setFormPolos(Number(e.target.value) as 1 | 2 | 3 | 4)}
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs"
                    >
                      <option value={1}>1 Polo (1P)</option>
                      <option value={2}>2 Polos (2P)</option>
                      <option value={3}>3 Polos (3P)</option>
                      <option value={4}>4 Polos (4P)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-superficie-700 font-medium mb-1">
                      Curva
                    </label>
                    <select
                      value={formCurva ?? "C"}
                      onChange={(e) => setFormCurva(e.target.value as "B" | "C" | "D")}
                      className="w-full rounded-lg border border-borda bg-white px-2 py-1 text-xs"
                    >
                      <option value="B">Curva B</option>
                      <option value="C">Curva C</option>
                      <option value="D">Curva D</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-superficie-700 font-medium mb-1">
                    Norma Técnica de Referência
                  </label>
                  <input
                    type="text"
                    value={formNorma}
                    onChange={(e) => setFormNorma(e.target.value)}
                    placeholder="Ex: NBR NM 60898 / DIN 43880"
                    className="w-full rounded-lg border border-borda bg-white px-2.5 py-1 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-superficie-700 font-medium mb-1">
                    Descrição Detalhada
                  </label>
                  <textarea
                    rows={2}
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Descrição para a lista de materiais..."
                    className="w-full rounded-lg border border-borda bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-azul-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Botao type="button" variante="contorno" tamanho="sm" onClick={cancelarForm}>
                    Cancelar
                  </Botao>
                  <Botao type="submit" variante="primario" tamanho="sm">
                    {modoCriar ? "Adicionar Componente" : "Salvar Alterações"}
                  </Botao>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-borda bg-superficie-50 shrink-0">
          <span className="text-xs text-superficie-500">
            Total de {Object.keys(catalogo).length} componentes cadastrados na biblioteca.
          </span>
          <Botao type="button" variante="primario" tamanho="sm" onClick={aoFechar}>
            Concluir
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
