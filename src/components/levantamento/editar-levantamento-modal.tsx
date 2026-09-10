"use client";

import { useState, useTransition } from "react";
import { Edit2, Save } from "lucide-react";
import { Botao, Modal, Campo } from "@/components/ui";
import { atualizarLevantamento } from "@/app/(protegido)/levantamento/acoes";

interface EditarLevantamentoModalProps {
  levantamentoId: string;
  nomeAtual: string;
  aoRenomeado?: (novoNome: string) => void;
}

export function EditarLevantamentoModal({
  levantamentoId,
  nomeAtual,
  aoRenomeado,
}: EditarLevantamentoModalProps) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrir() {
    setNome(nomeAtual);
    setErro(null);
    setAberto(true);
  }

  function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome do levantamento.");
      return;
    }

    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarLevantamento({
        levantamentoId,
        nome: nome.trim(),
      });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        aoRenomeado?.(nome.trim());
        setAberto(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="text-superficie-400 hover:text-azul-600 p-1 rounded hover:bg-azul-50 transition-colors"
        title="Editar nome do levantamento"
        onClick={abrir}
        aria-label="Editar nome do levantamento"
      >
        <Edit2 className="h-4 w-4" />
      </button>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Editar levantamento">
        {erro && (
          <div className="mb-4 rounded-lg border border-perigo/50 bg-perigo/5 px-4 py-3 text-sm text-perigo" role="alert">
            {erro}
          </div>
        )}
        <div className="space-y-4">
          <Campo
            rotulo="Nome do levantamento"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pavimento Térreo - Elétrica"
            autoFocus
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Botao variante="contorno" onClick={() => setAberto(false)}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={pendente || nome.trim() === nomeAtual}>
            <Save className="h-3.5 w-3.5" />
            Salvar
          </Botao>
        </div>
      </Modal>
    </>
  );
}