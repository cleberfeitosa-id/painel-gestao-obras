"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirComposicao } from "@/app/(protegido)/obras/[id]/orcamentos/composicoes/acoes";

interface BotaoExcluirComposicaoProps {
  composicaoId: string;
  titulo: string;
  obraId: string;
  compacto?: boolean;
}

export function BotaoExcluirComposicao({
  composicaoId,
  titulo,
  obraId,
  compacto = false,
}: BotaoExcluirComposicaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirComposicao(composicaoId, obraId);
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
          onClick={() => setAberto(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-perigo/10 hover:text-perigo"
          aria-label={`Excluir composição ${titulo}`}
          title="Excluir composição"
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
        titulo="Excluir composição"
        descricao="Esta ação não pode ser desfeita."
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir a composição{" "}
            <strong className="text-superficie-900">{titulo}</strong>?
            Os componentes vinculados também serão removidos.
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
            <Botao variante="fantasma" onClick={() => setAberto(false)} disabled={excluindo}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmar} carregando={excluindo}>
              Excluir composição
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}