"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { reverterAprovacaoTarefasEmLote } from "@/app/(protegido)/tarefas/acoes";

interface BotaoReverterAprovacaoEmLoteProps {
  tarefasSelecionadas: string[];
  aoConcluir: () => void;
}

export function BotaoReverterAprovacaoEmLote({
  tarefasSelecionadas,
  aoConcluir,
}: BotaoReverterAprovacaoEmLoteProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [revertendo, setRevertendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = tarefasSelecionadas.length;

  async function confirmar() {
    setRevertendo(true);
    setErro(null);
    const resultado = await reverterAprovacaoTarefasEmLote(tarefasSelecionadas);
    if (resultado.erro) {
      setErro(resultado.erro);
      setRevertendo(false);
      return;
    }
    setRevertendo(false);
    setAberto(false);
    aoConcluir();
    router.refresh();
  }

  return (
    <>
      <Botao
        type="button"
        variante="secundario"
        onClick={() => setAberto(true)}
        disabled={total === 0}
      >
        <Undo2 className="h-4 w-4" />
        Reverter aprovação
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!revertendo) setAberto(false);
        }}
        titulo={total === 1 ? "Reverter aprovação de 1 tarefa" : `Reverter aprovação de ${total} tarefas`}
        descricao="Apenas as tarefas aprovadas, das quais você é supervisor ou tem permissão de gestor, terão a aprovação revertida."
        tamanho="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja reverter a aprovação de{" "}
            {total === 1 ? (
              <strong className="text-superficie-900">a tarefa selecionada</strong>
            ) : (
              <strong className="text-superficie-900">
                as {total} tarefas selecionadas
              </strong>
            )}
            ? Elas voltarão para o status de aprovação pendente.
          </p>

          {erro && (
            <div
              role="alert"
              className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
            >
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setAberto(false)}
              disabled={revertendo}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              onClick={confirmar}
              carregando={revertendo}
            >
              {total === 1 ? "Reverter aprovação" : "Reverter aprovações"}
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
