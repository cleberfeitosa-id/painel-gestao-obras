"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { apagarCompatibilizacaoDireto } from "@/app/(protegido)/obras/[id]/compatibilizacoes/acoes";

interface BotaoExcluirProps {
  compatibilizacaoId: string;
  obraId: string;
  nome: string;
}

export function BotaoExcluirCompatibilizacao({ compatibilizacaoId, obraId, nome }: BotaoExcluirProps) {
  const [estado, acao, pendente] = useActionState(apagarCompatibilizacaoDireto, null);
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Botao 
        variante="fantasma" 
        tamanho="sm" 
        className="h-8 w-8 p-0 text-perigo hover:bg-perigo/10 hover:text-perigo"
        onClick={() => setAberto(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Excluir Compatibilização"
        tamanho="sm"
      >
        <form action={acao} className="space-y-4">
          <input type="hidden" name="id" value={compatibilizacaoId} />
          <input type="hidden" name="obra_id" value={obraId} />

          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir a compatibilização <strong>{nome}</strong>?
          </p>
          <p className="text-sm text-perigo">
            Esta ação não pode ser desfeita. Todos os choques associados serão apagados. As plantas e tarefas não serão afetadas.
          </p>

          {estado?.erro && (
            <div className="rounded-md border border-perigo bg-perigo/5 p-3 text-sm text-perigo">
              {estado.erro}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={pendente}>
              Excluir
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
