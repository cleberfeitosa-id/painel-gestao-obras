"use client";

import { useActionState, useState } from "react";
import { Edit2 } from "lucide-react";
import { Botao, Modal, Selecao, Campo } from "@/components/ui";
import { atualizarTarefasEmLote } from "@/app/(protegido)/tarefas/acoes";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import type { PerfilRow, ExecutorRow } from "@/lib/supabase/database.types";

interface BotaoEdicaoEmLoteProps {
  tarefaIds: string[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  tags: { id: string; nome: string }[];
  aoConcluir: () => void;
}

export function BotaoEdicaoEmLote({
  tarefaIds,
  responsaveis,
  supervisores,
  executores,
  tags,
  aoConcluir,
}: BotaoEdicaoEmLoteProps) {
  const [aberto, setAberto] = useState(false);

  const [estado, acaoFormulario, pending] = useActionState(
    async (estadoAnterior: any, formData: FormData) => {
      const resultado = await atualizarTarefasEmLote(tarefaIds, formData);
      if (!resultado.erro) {
        setAberto(false);
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
        aoFechar={() => !pending && setAberto(false)}
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

          <div className="flex justify-end gap-2 pt-4">
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
