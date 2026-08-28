"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirTarefa } from "@/app/(protegido)/tarefas/acoes";

interface BotaoExcluirTarefaProps {
  tarefaId: string;
  titulo: string;
  redirecionarAposExcluir?: string;
  compacto?: boolean;
}

export function BotaoExcluirTarefa({
  tarefaId,
  titulo,
  redirecionarAposExcluir,
  compacto = false,
}: BotaoExcluirTarefaProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirTarefa(tarefaId);
    if (resultado.erro) {
      setErro(resultado.erro);
      setExcluindo(false);
      return;
    }
    setAberto(false);
    if (redirecionarAposExcluir) {
      router.push(redirecionarAposExcluir);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {compacto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-perigo/10 hover:text-perigo"
          aria-label={`Excluir tarefa ${titulo}`}
          title="Excluir tarefa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Botao variante="perigo" onClick={() => setAberto(true)}>
          <Trash2 className="h-4 w-4" />
          Excluir
        </Botao>
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Excluir tarefa"
        descricao="Esta acao nao pode ser desfeita."
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir a tarefa{" "}
            <strong className="text-superficie-900">{titulo}</strong>?
            Comentarios, anexos e aprovacoes vinculados tambem serao removidos.
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
              variante="fantasma"
              onClick={() => setAberto(false)}
              disabled={excluindo}
            >
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmar} carregando={excluindo}>
              Excluir tarefa
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
