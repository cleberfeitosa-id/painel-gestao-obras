"use client";

import { useState, useTransition } from "react";
import { Botao, Modal, AreaTexto } from "@/components/ui";
import { avaliarTarefa, reverterAprovacao } from "@/app/(protegido)/tarefas/acoes";
import type { AprovacaoTarefa as AprovacaoTarefaTipo } from "@/lib/supabase/database.types";

interface AprovacaoTarefaProps {
  tarefaId: string;
  aprovacao: AprovacaoTarefaTipo;
  podeAvaliar: boolean;
  podeReverter: boolean;
}

export function AprovacaoTarefa({
  tarefaId,
  aprovacao,
  podeAvaliar,
  podeReverter,
}: AprovacaoTarefaProps) {
  const [modalReprovar, setModalReprovar] = useState(false);
  const [modalReverter, setModalReverter] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (!podeAvaliar && !(aprovacao === "aprovado" && podeReverter)) return null;

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

  function reverter() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await reverterAprovacao(tarefaId);
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setModalReverter(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {podeAvaliar && (
          <>
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
          </>
        )}
        {aprovacao === "aprovado" && podeReverter && (
          <Botao
            type="button"
            variante="contorno"
            onClick={() => setModalReverter(true)}
            disabled={pendente}
          >
            Reverter aprovação
          </Botao>
        )}
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

      <Modal
        aberto={modalReverter}
        aoFechar={() => setModalReverter(false)}
        titulo="Reverter aprovação"
        descricao="A tarefa voltará a ficar aguardando validação e precisará de uma nova aprovação."
      >
        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setModalReverter(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="primario"
              onClick={reverter}
              carregando={pendente}
            >
              Reverter aprovação
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
