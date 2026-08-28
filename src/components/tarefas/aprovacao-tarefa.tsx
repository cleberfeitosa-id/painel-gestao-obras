"use client";

import { useState, useTransition } from "react";
import { Botao, Modal, AreaTexto } from "@/components/ui";
import { avaliarTarefa } from "@/app/(protegido)/tarefas/acoes";

interface AprovacaoTarefaProps {
  tarefaId: string;
  podeAvaliar: boolean;
}

export function AprovacaoTarefa({ tarefaId, podeAvaliar }: AprovacaoTarefaProps) {
  const [modalReprovar, setModalReprovar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (!podeAvaliar) return null;

  function aprovar() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await avaliarTarefa(tarefaId, "aprovado");
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  function reprovar() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await avaliarTarefa(tarefaId, "reprovado", motivo);
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setModalReprovar(false);
        setMotivo("");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Botao
          type="button"
          variante="primario"
          onClick={aprovar}
          carregando={pendente}
        >
          Aprovar
        </Botao>
        <Botao
          type="button"
          variante="perigo"
          onClick={() => setModalReprovar(true)}
          disabled={pendente}
        >
          Reprovar
        </Botao>
      </div>

      {erro && (
        <p className="text-xs text-perigo" role="alert">
          {erro}
        </p>
      )}

      <Modal
        aberto={modalReprovar}
        aoFechar={() => setModalReprovar(false)}
        titulo="Reprovar tarefa"
        descricao="Informe o motivo da reprovação. A tarefa voltará para 'Em execução'."
      >
        <div className="space-y-4">
          <AreaTexto
            rotulo="Motivo"
            obrigatorio
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o que precisa ser ajustado."
          />
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setModalReprovar(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              onClick={reprovar}
              carregando={pendente}
              disabled={!motivo.trim()}
            >
              Reprovar tarefa
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}