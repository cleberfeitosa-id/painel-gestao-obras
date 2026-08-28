"use client";

import { useState, useTransition } from "react";
import { Botao, Selecao, Modal } from "@/components/ui";
import { OPCOES_STATUS_TAREFA, STATUS_TAREFA } from "@/lib/domain/rotulos";
import type { StatusTarefa } from "@/lib/supabase/database.types";
import { alterarStatus } from "@/app/(protegido)/tarefas/acoes";

interface AlterarStatusProps {
  tarefaId: string;
  status: StatusTarefa;
  podeEscrever: boolean;
  exigeFoto: boolean;
  exigeVideo: boolean;
  exigeArquivo: boolean;
  temFoto: boolean;
  temVideo: boolean;
  temArquivo: boolean;
}

export function AlterarStatus({
  tarefaId,
  status,
  podeEscrever,
  exigeFoto,
  exigeVideo,
  exigeArquivo,
  temFoto,
  temVideo,
  temArquivo,
}: AlterarStatusProps) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (!podeEscrever) {
    return (
      <span className="inline-flex items-center rounded-lg bg-superficie-100 px-3 py-2 text-sm font-medium text-superficie-700">
        {STATUS_TAREFA[status].rotulo}
      </span>
    );
  }

  const requisitos = [
    { rotulo: "Foto", exigido: exigeFoto, satisfeito: temFoto },
    { rotulo: "Video", exigido: exigeVideo, satisfeito: temVideo },
    { rotulo: "Arquivo", exigido: exigeArquivo, satisfeito: temArquivo },
  ].filter((r) => r.exigido);

  const faltantes = requisitos.filter((r) => !r.satisfeito);

  function mudar(novoStatus: StatusTarefa) {
    if (novoStatus === status) return;
    if (novoStatus === "concluido" && faltantes.length > 0) {
      setConfirmar(true);
      return;
    }
    executar(novoStatus);
  }

  function executar(novoStatus: StatusTarefa) {
    setConfirmar(false);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await alterarStatus(tarefaId, novoStatus);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Selecao
        rotulo="Status"
        value={status}
        onChange={(e) => mudar(e.target.value as StatusTarefa)}
        disabled={pendente}
        className="w-48"
      >
        {OPCOES_STATUS_TAREFA.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </Selecao>

      {erro && (
        <p className="text-xs text-perigo" role="alert">
          {erro}
        </p>
      )}

      <Modal
        aberto={confirmar}
        aoFechar={() => setConfirmar(false)}
        titulo="Concluir tarefa"
        descricao="Esta tarefa exige comprovacao antes de ser concluida."
      >
        <div className="space-y-4">
          <ul className="space-y-2">
            {requisitos.map((r) => (
              <li
                key={r.rotulo}
                className="flex items-center justify-between rounded-lg border border-borda px-4 py-3 text-sm"
              >
                <span className="text-superficie-700">{r.rotulo}</span>
                {r.satisfeito ? (
                  <span className="font-medium text-emerald-600">Anexado</span>
                ) : (
                  <span className="font-medium text-red-600">Faltando</span>
                )}
              </li>
            ))}
          </ul>

          {faltantes.length > 0 ? (
            <p className="text-sm text-superficie-600">
              Anexe {faltantes.map((f) => f.rotulo.toLowerCase()).join(", ")} antes
              de concluir a tarefa.
            </p>
          ) : (
            <p className="text-sm text-superficie-600">
              Toda a comprovacao obrigatoria foi anexada. Confirma a conclusao?
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setConfirmar(false)}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="primario"
              disabled={faltantes.length > 0}
              onClick={() => executar("concluido")}
            >
              Concluir
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
