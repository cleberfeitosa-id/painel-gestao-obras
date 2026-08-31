"use client";

import { useActionState, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Botao, Modal, Selecao, Campo } from "@/components/ui";
import { atualizarTarefasEmLote } from "@/app/(protegido)/tarefas/acoes";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import type { PerfilRow, ExecutorRow } from "@/lib/supabase/database.types";

interface BotaoEdicaoEmLoteProps {
  tarefasSelecionadas: { id: string; obra_id: string }[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  tags: { id: string; nome: string }[];
  catalogoPrecos: {
    id: string;
    nome: string;
    unidade: string;
    medicoes: { id: string; titulo: string; obra_id: string };
  }[];
  aoConcluir: () => void;
}

type MedicaoItem = { catalogo_id: string; quantidade: number };

export function BotaoEdicaoEmLote({
  tarefasSelecionadas,
  responsaveis,
  supervisores,
  executores,
  tags,
  catalogoPrecos,
  aoConcluir,
}: BotaoEdicaoEmLoteProps) {
  const [aberto, setAberto] = useState(false);
  const [medicoesLista, setMedicoesLista] = useState<MedicaoItem[]>([]);

  const tarefaIds = tarefasSelecionadas.map(t => t.id);
  const obraIdsUnicos = Array.from(new Set(tarefasSelecionadas.map((t) => t.obra_id)));
  const obrasMultiplas = obraIdsUnicos.length > 1;

  const catalogoDaObra = obrasMultiplas
    ? []
    : catalogoPrecos?.filter((item) => item.medicoes.obra_id === obraIdsUnicos[0]) ?? [];

  const catalogoPorMedicao = catalogoDaObra.reduce<Record<string, typeof catalogoDaObra>>((acc, item) => {
    const chave = item.medicoes.titulo ?? "Sem medicao";
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(item);
    return acc;
  }, {});

  function adicionarMedicao() {
    setMedicoesLista((atual) => [...atual, { catalogo_id: "", quantidade: 0 }]);
  }

  function removerMedicao(indice: number) {
    setMedicoesLista((atual) => atual.filter((_, i) => i !== indice));
  }

  function atualizarMedicao(indice: number, campo: keyof MedicaoItem, valor: string | number) {
    setMedicoesLista((atual) =>
      atual.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item,
      ),
    );
  }

  const [estado, acaoFormulario, pending] = useActionState(
    async (estadoAnterior: any, formData: FormData) => {
      const resultado = await atualizarTarefasEmLote(tarefaIds, formData);
      if (!resultado.erro) {
        setAberto(false);
        setMedicoesLista([]);
        aoConcluir();
      }
      return resultado;
    },
    {}
  );

  return (
    <>
      <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>
        <Edit2 className="h-4 w-4" />
        Editar em lote
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!pending) {
            setAberto(false);
            setMedicoesLista([]);
          }
        }}
        titulo={`Editar ${tarefaIds.length} tarefas`}
        descricao="Preencha apenas os campos que deseja alterar em todas as tarefas selecionadas."
        tamanho="md"
      >
        <form action={acaoFormulario} className="space-y-4 pt-4">
          {estado.erro && (
            <div role="alert" className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo">
              {estado.erro}
            </div>
          )}

          <div className="grid gap-4">
            <Campo rotulo="Titulo" name="titulo" defaultValue="" placeholder="Nao alterar" dica="Deixe em branco para manter os titulos atuais." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Status" name="status" defaultValue="">
              <option value="">Nao alterar</option>
              {OPCOES_STATUS_TAREFA.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </Selecao>
            <Selecao rotulo="Prioridade" name="prioridade" defaultValue="">
              <option value="">Nao alterar</option>
              {OPCOES_PRIORIDADE.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </Selecao>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Responsavel" name="responsavel_id" defaultValue="">
              <option value="">Nao alterar</option>
              <option value="remover">Remover responsavel</option>
              {responsaveis.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Selecao>
            <Selecao rotulo="Supervisor" name="supervisor_id" defaultValue="">
              <option value="">Nao alterar</option>
              <option value="remover">Remover supervisor</option>
              {supervisores.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Selecao>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Executor" name="executor_id" defaultValue="">
              <option value="">Nao alterar</option>
              <option value="remover">Remover executor</option>
              {executores.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </Selecao>
            <Selecao rotulo="Tag" name="tag_id" defaultValue="">
              <option value="">Nao alterar</option>
              <option value="remover">Remover tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </Selecao>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Prazo" name="prazo" type="date" defaultValue="" />
            <Campo rotulo="Data planejada" name="data_planejada" type="date" defaultValue="" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data de inicio" name="data_inicio" type="date" defaultValue="" />
            <Campo rotulo="Data de fim" name="data_fim" type="date" defaultValue="" />
          </div>

          {!obrasMultiplas && catalogoDaObra.length > 0 && (
            <fieldset className="border-t border-borda pt-4">
              <legend className="text-sm font-medium text-superficie-700 mb-1 px-1">
                Adicionar ou substituir medições
              </legend>
              <p className="text-xs text-superficie-500 mb-3 px-1">
                Atenção: isto irá substituir todas as medições atuais das tarefas selecionadas.
              </p>
              <div className="space-y-3">
                {medicoesLista.map((medicao, indice) => (
                  <div
                    key={indice}
                    className="flex items-end gap-2 rounded-lg border border-borda bg-superficie-50 px-3 py-2"
                  >
                    <Selecao
                      rotulo="Item"
                      obrigatorio
                      value={medicao.catalogo_id}
                      onChange={(e) => atualizarMedicao(indice, "catalogo_id", e.target.value)}
                      className="flex-1 bg-white"
                    >
                      <option value="">Selecione o item</option>
                      {Object.entries(catalogoPorMedicao).map(([medicaoTitulo, itens]) => (
                        <optgroup key={medicaoTitulo} label={medicaoTitulo}>
                          {itens.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome}{item.unidade ? ` (${item.unidade})` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Selecao>
                    <Campo
                      rotulo="Quantidade"
                      obrigatorio
                      type="number"
                      min={0}
                      step="any"
                      value={medicao.quantidade || ""}
                      onChange={(e) => atualizarMedicao(indice, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-28 bg-white"
                    />
                    <Botao
                      type="button"
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => removerMedicao(indice)}
                      className="mb-0.5 text-perigo hover:text-perigo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Botao>
                  </div>
                ))}
                <Botao
                  type="button"
                  variante="contorno"
                  tamanho="sm"
                  onClick={adicionarMedicao}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar medição
                </Botao>
              </div>
              <input
                type="hidden"
                name="medicoes"
                value={JSON.stringify(medicoesLista.filter((m) => m.catalogo_id))}
              />
            </fieldset>
          )}

          {obrasMultiplas && (
            <div className="rounded-lg border border-borda bg-superficie-50 px-4 py-3 text-sm text-superficie-600">
              <p>As medições não podem ser editadas em lote para tarefas de obras diferentes.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-borda">
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)} disabled={pending}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" carregando={pending}>
              Salvar alteracoes
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
