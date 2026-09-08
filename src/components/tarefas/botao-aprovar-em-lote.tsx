"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { aprovarTarefasEmLote } from "@/app/(protegido)/tarefas/acoes";

interface BotaoAprovarEmLoteProps {
  tarefasSelecionadas: string[];
  aoConcluir: () => void;
}

export function BotaoAprovarEmLote({
  tarefasSelecionadas,
  aoConcluir,
}: BotaoAprovarEmLoteProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = tarefasSelecionadas.length;

  async function confirmar() {
    setAprovando(true);
    setErro(null);
    const resultado = await aprovarTarefasEmLote(tarefasSelecionadas);
    if (resultado.erro) {
      setErro(resultado.erro);
      setAprovando(false);
      return;
    }
    setAprovando(false);
    setAberto(false);
    aoConcluir();
    router.refresh();
  }

  return (
    <>
      <Botao
        type="button"
        variante="primario"
        onClick={() => setAberto(true)}
        disabled={total === 0}
      >
        <CheckCircle2 className="h-4 w-4" />
        Aprovar selecionadas
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!aprovando) setAberto(false);
        }}
        titulo={total === 1 ? "Aprovar 1 tarefa" : `Aprovar ${total} tarefas`}
        descricao="Apenas as tarefas concluídas e pendentes de aprovação, das quais você é supervisor ou tem permissão de gestor, serão aprovadas."
        tamanho="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja aprovar{" "}
            {total === 1 ? (
              <strong className="text-superficie-900">a tarefa selecionada</strong>
            ) : (
              <strong className="text-superficie-900">
                as {total} tarefas selecionadas
              </strong>
            )}
            ?
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
              disabled={aprovando}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="primario"
              onClick={confirmar}
              carregando={aprovando}
            >
              {total === 1 ? "Aprovar tarefa" : "Aprovar tarefas"}
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
