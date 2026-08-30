"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirTag } from "@/app/(protegido)/tarefas/acoes";

interface BotaoExcluirTagProps {
  tagId: string;
  nome: string;
}

export function BotaoExcluirTag({ tagId, nome }: BotaoExcluirTagProps) {
  const [aberto, setAberto] = useState(false);

  const [estado, acaoFormulario, pending] = useActionState(
    async (_estadoAnterior: any, _formData: FormData) => {
      const resultado = await excluirTag(tagId);
      if (!resultado.erro) {
        setAberto(false);
      }
      return resultado;
    },
    {}
  );

  return (
    <>
      <Botao
        type="button"
        variante="perigo"
        onClick={() => setAberto(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Excluir {nome}</span>
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => !pending && setAberto(false)}
        titulo="Excluir tag"
        descricao={`Tem certeza que deseja excluir a tag "${nome}"? Tarefas que utilizam esta tag ficarao sem tag associada.`}
      >
        <form action={acaoFormulario} className="space-y-4 pt-4">
          {estado.erro && (
            <div role="alert" className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo">
              {estado.erro}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setAberto(false)}
              disabled={pending}
            >
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={pending}>
              Excluir
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
