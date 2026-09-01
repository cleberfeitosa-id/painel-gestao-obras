"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirTarefasEmLote } from "@/app/(protegido)/tarefas/acoes";

interface BotaoExcluirEmLoteProps {
  tarefasSelecionadas: string[];
  aoConcluir: () => void;
}

export function BotaoExcluirEmLote({
  tarefasSelecionadas,
  aoConcluir,
}: BotaoExcluirEmLoteProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = tarefasSelecionadas.length;

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirTarefasEmLote(tarefasSelecionadas);
    if (resultado.erro) {
      setErro(resultado.erro);
      setExcluindo(false);
      return;
    }
    setExcluindo(false);
    setAberto(false);
    aoConcluir();
    router.refresh();
  }

  return (
    <>
      <Botao
        type="button"
        variante="perigo"
        onClick={() => setAberto(true)}
        disabled={total === 0}
      >
        <Trash2 className="h-4 w-4" />
        Excluir em lote
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!excluindo) setAberto(false);
        }}
        titulo={total === 1 ? "Excluir 1 tarefa" : `Excluir ${total} tarefas`}
        descricao="Esta ação não pode ser desfeita."
        tamanho="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir{" "}
            {total === 1 ? (
              <strong className="text-superficie-900">a tarefa selecionada</strong>
            ) : (
              <strong className="text-superficie-900">
                as {total} tarefas selecionadas
              </strong>
            )}
            ? Comentários, anexos, medições e aprovações vinculados também serão
            removidos.
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
              disabled={excluindo}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              onClick={confirmar}
              carregando={excluindo}
            >
              {total === 1 ? "Excluir tarefa" : "Excluir tarefas"}
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
