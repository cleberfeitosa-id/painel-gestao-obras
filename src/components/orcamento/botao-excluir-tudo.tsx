"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirTodosOrcamentosEComposicoes } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";

interface BotaoExcluirTudoProps {
  obraId?: string;
  orcamentos: number;
  composicoes: number;
}

export function BotaoExcluirTudo({
  obraId,
  orcamentos,
  composicoes,
}: BotaoExcluirTudoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temDados = orcamentos > 0 || composicoes > 0;

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirTodosOrcamentosEComposicoes({ obraId });
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
      <Botao
        variante="perigo"
        onClick={() => setAberto(true)}
        disabled={!temDados}
        title={
          temDados
            ? "Excluir todos os orçamentos e composições importados"
            : "Nenhum dado para excluir"
        }
      >
        <Trash2 className="h-4 w-4" />
        Limpar dados importados
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Limpar todos os dados importados?"
        descricao="Esta ação não pode ser desfeita."
        tamanho="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-aviso/30 bg-aviso/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-aviso" />
            <div className="text-sm text-superficie-700">
              <p className="font-medium text-superficie-900">Atenção</p>
              <p className="mt-1">
                Todos os orçamentos e composições importados serão excluídos
                permanentemente:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {orcamentos > 0 && (
                  <li>
                    <strong>{orcamentos}</strong>{" "}
                    {orcamentos === 1 ? "orçamento" : "orçamentos"}
                  </li>
                )}
                {composicoes > 0 && (
                  <li>
                    <strong>{composicoes}</strong>{" "}
                    {composicoes === 1 ? "composição" : "composições"}
                  </li>
                )}
              </ul>
              {!obraId && (
                <p className="mt-2 font-semibold text-aviso">
                  Isso afetará todas as obras do sistema.
                </p>
              )}
            </div>
          </div>

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
            <Botao
              variante="perigo"
              onClick={confirmar}
              carregando={excluindo}
            >
              {excluindo ? "Excluindo..." : "Sim, excluir tudo"}
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}