"use client";

import { useActionState, useState } from "react";
import { Edit2 } from "lucide-react";
import { Botao, Modal, Campo } from "@/components/ui";
import { atualizarCompatibilizacao } from "@/app/(protegido)/obras/[id]/compatibilizacoes/acoes";

interface EditarCompatibilizacaoModalProps {
  compatibilizacaoId: string;
  obraId: string;
  nomeInicial: string;
}

export function EditarCompatibilizacaoModal({ compatibilizacaoId, obraId, nomeInicial }: EditarCompatibilizacaoModalProps) {
  const [estado, acao, pendente] = useActionState(atualizarCompatibilizacao, null);
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Botao 
        variante="fantasma" 
        tamanho="sm" 
        className="h-8 w-8 p-0 text-superficie-600 hover:bg-superficie-100 hover:text-superficie-900"
        onClick={() => setAberto(true)}
      >
        <Edit2 className="h-4 w-4" />
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Editar Compatibilização"
        tamanho="sm"
      >
        <form action={acao} className="space-y-4" onSubmit={() => setTimeout(() => { if (!estado?.erro) setAberto(false) }, 500)}>
          <input type="hidden" name="id" value={compatibilizacaoId} />
          <input type="hidden" name="obra_id" value={obraId} />

          <Campo
            rotulo="Nome da Compatibilização"
            name="nome"
            defaultValue={nomeInicial}
            required
            placeholder="Ex: Arquitetura vs Elétrica"
          />

          {estado?.erro && (
            <div className="rounded-md border border-perigo bg-perigo/5 p-3 text-sm text-perigo">
              {estado.erro}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={pendente}>
              Salvar Alterações
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}
