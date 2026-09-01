"use client";

import { useState, useTransition } from "react";
import { Check, Edit2, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { Botao, Campo, Modal } from "@/components/ui";
import { formatarData } from "@/lib/datas";
import {
  atualizarTag,
  criarTag,
  excluirTag,
} from "@/app/(protegido)/tarefas/acoes";

export interface ItemTag {
  id: string;
  nome: string;
  criado_em: string;
  criado_por?: { nome: string } | null;
}

interface GerenciadorTagsProps {
  tagsIniciais: ItemTag[];
  podeEditar: boolean;
}

export function GerenciadorTags({
  tagsIniciais,
  podeEditar,
}: GerenciadorTagsProps) {
  const [tags, setTags] = useState<ItemTag[]>(tagsIniciais);
  const [busca, setBusca] = useState("");
  const [novoNomeTag, setNovoNomeTag] = useState("");
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);
  const [sucessoCriacao, setSucessoCriacao] = useState<string | null>(null);

  const [tagEmEdicaoId, setTagEmEdicaoId] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [tagParaExcluir, setTagParaExcluir] = useState<ItemTag | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  function handleCriarTag(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNomeTag.trim()) return;

    setErroCriacao(null);
    setSucessoCriacao(null);

    startTransition(async () => {
      const res = await criarTag(novoNomeTag.trim());
      if ("erro" in res) {
        setErroCriacao(res.erro);
      } else {
        const nova: ItemTag = {
          id: res.id,
          nome: res.nome,
          criado_em: new Date().toISOString(),
          criado_por: { nome: "Você" },
        };
        setTags((prev) =>
          [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)),
        );
        setNovoNomeTag("");
        setSucessoCriacao(`Tag "${res.nome}" criada com sucesso!`);
        setTimeout(() => setSucessoCriacao(null), 3000);
      }
    });
  }

  function iniciarEdicao(tag: ItemTag) {
    setTagEmEdicaoId(tag.id);
    setNomeEmEdicao(tag.nome);
    setErroEdicao(null);
  }

  function cancelarEdicao() {
    setTagEmEdicaoId(null);
    setNomeEmEdicao("");
    setErroEdicao(null);
  }

  function handleSalvarEdicao(tagId: string) {
    if (!nomeEmEdicao.trim()) return;

    setErroEdicao(null);
    startTransition(async () => {
      const res = await atualizarTag(tagId, nomeEmEdicao.trim());
      if ("erro" in res) {
        setErroEdicao(res.erro);
      } else {
        setTags((prev) =>
          prev
            .map((t) => (t.id === tagId ? { ...t, nome: res.nome } : t))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
        setTagEmEdicaoId(null);
        setNomeEmEdicao("");
      }
    });
  }

  function handleExcluirTag() {
    if (!tagParaExcluir) return;

    setErroExclusao(null);
    startTransition(async () => {
      const res = await excluirTag(tagParaExcluir.id);
      if (res.erro) {
        setErroExclusao(res.erro);
      } else {
        setTags((prev) => prev.filter((t) => t.id !== tagParaExcluir.id));
        setTagParaExcluir(null);
      }
    });
  }

  const tagsFiltradas = tags.filter((t) =>
    t.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {podeEditar && (
        <div className="p-4 bg-white rounded-2xl border border-superficie-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-superficie-900">
            <Plus className="h-4 w-4 text-azul-600" />
            <span>Criar Nova Tag</span>
          </div>

          <form
            onSubmit={handleCriarTag}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="flex-1">
              <Campo
                rotulo=""
                placeholder="Nome da nova tag (ex.: Elétrica, Pintura, Urgente...)"
                value={novoNomeTag}
                onChange={(e) => setNovoNomeTag(e.target.value)}
                maxLength={60}
              />
            </div>
            <Botao
              type="submit"
              variante="primario"
              carregando={isPending}
              disabled={!novoNomeTag.trim()}
              className="h-10 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Tag
            </Botao>
          </form>

          {erroCriacao && (
            <div
              role="alert"
              className="p-2.5 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200"
            >
              {erroCriacao}
            </div>
          )}

          {sucessoCriacao && (
            <div className="p-2.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
              {sucessoCriacao}
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-white rounded-2xl border border-superficie-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-superficie-100">
          <div>
            <h2 className="text-base font-bold text-superficie-900">
              Tags Cadastradas ({tags.length})
            </h2>
            <p className="text-xs text-superficie-500">
              Gerencie os marcadores disponíveis para organização de tarefas.
            </p>
          </div>

          {tags.length > 5 && (
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-superficie-400" />
              <input
                type="text"
                placeholder="Filtrar tags..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-superficie-200 bg-superficie-50 focus:bg-white focus:border-azul-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {tagsFiltradas.length === 0 ? (
          <div className="py-12 text-center text-superficie-400 text-xs">
            <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-superficie-700">
              {busca ? "Nenhuma tag encontrada para a busca" : "Nenhuma tag cadastrada"}
            </p>
            {podeEditar && !busca && (
              <p className="mt-1 text-[11px]">
                Utilize o campo acima para adicionar a primeira tag.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-superficie-100">
            {tagsFiltradas.map((tag) => {
              const emEdicao = tagEmEdicaoId === tag.id;

              return (
                <li
                  key={tag.id}
                  className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:bg-superficie-50/50 px-2 rounded-xl"
                >
                  {emEdicao ? (
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nomeEmEdicao}
                          onChange={(e) => setNomeEmEdicao(e.target.value)}
                          maxLength={60}
                          autoFocus
                          className="flex-1 h-9 px-3 text-xs font-semibold rounded-lg border border-azul-500 bg-white text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleSalvarEdicao(tag.id)}
                          disabled={isPending || !nomeEmEdicao.trim()}
                          className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Salvar alterações"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Salvar</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          disabled={isPending}
                          className="h-9 px-2.5 rounded-lg bg-superficie-100 hover:bg-superficie-200 text-superficie-700 text-xs font-semibold flex items-center cursor-pointer transition-colors"
                          title="Cancelar edição"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {erroEdicao && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          {erroEdicao}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-superficie-100 text-superficie-800 border border-superficie-200">
                          <Tag className="h-3 w-3 text-superficie-500" />
                          <span>{tag.nome}</span>
                        </span>
                        <span className="text-[11px] text-superficie-400">
                          Criada por {tag.criado_por?.nome ?? "Sistema"} em{" "}
                          {formatarData(tag.criado_em)}
                        </span>
                      </div>

                      {podeEditar && (
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(tag)}
                            className="p-1.5 rounded-lg text-superficie-500 hover:text-azul-600 hover:bg-azul-50 border border-transparent hover:border-azul-200 transition-colors cursor-pointer"
                            title={`Editar tag "${tag.nome}"`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTagParaExcluir(tag);
                              setErroExclusao(null);
                            }}
                            className="p-1.5 rounded-lg text-superficie-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title={`Excluir tag "${tag.nome}"`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        aberto={!!tagParaExcluir}
        aoFechar={() => !isPending && setTagParaExcluir(null)}
        titulo="Excluir Tag"
        descricao={`Tem certeza que deseja excluir a tag "${tagParaExcluir?.nome}"? Tarefas que utilizam esta tag continuarão existindo, mas ficarão desvinculadas dela.`}
      >
        <div className="space-y-4 pt-2">
          {erroExclusao && (
            <div
              role="alert"
              className="p-2.5 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200"
            >
              {erroExclusao}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setTagParaExcluir(null)}
              disabled={isPending}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              carregando={isPending}
              onClick={handleExcluirTag}
            >
              Excluir Tag
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
