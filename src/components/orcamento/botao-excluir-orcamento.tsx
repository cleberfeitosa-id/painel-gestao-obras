"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirOrcamento } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";

interface BotaoExcluirOrcamentoProps {
  orcamentoId: string;
  obraId: string;
  nome: string;
  compacto?: boolean;
  temItensVinculados?: boolean;
}

export function BotaoExcluirOrcamento({
  orcamentoId,
  obraId,
  nome,
  compacto = false,
  temItensVinculados = false,
}: BotaoExcluirOrcamentoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirOrcamento(orcamentoId, obraId);
    if (resultado.erro) {
      setErro(resultado.erro);
      setExcluindo(false);
      return;
    }
    setAberto(false);
    router.refresh();
  }

  return (
    <>
      {compacto ? (
        <button
          type="button"
          onClick={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            setAberto(true);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-perigo/10 hover:text-perigo"
          aria-label={`Excluir orçamento ${nome}`}
          title="Excluir orçamento"
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
        titulo="Excluir orçamento"
        descricao="Esta acao nao pode ser desfeita."
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir o orçamento{" "}
            <strong className="text-superficie-900">{nome}</strong>?
          </p>
          {temItensVinculados && (
            <p className="text-sm text-amber-600">
              Este orçamento possui itens vinculados a medições e não poderá
              ser excluído até que sejam desvinculados.
            </p>
          )}
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
              Excluir orçamento
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}