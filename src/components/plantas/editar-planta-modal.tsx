"use client";

import { useState, useTransition } from "react";
import { Edit2, Save } from "lucide-react";
import { Botao, Modal, Campo } from "@/components/ui";
import { atualizarPlanta } from "@/app/(protegido)/obras/[id]/plantas/acoes";

interface EditarPlantaModalProps {
  plantaId: string;
  nomeAtual: string;
}

export function EditarPlantaModal({ plantaId, nomeAtual }: EditarPlantaModalProps) {
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
      setErro("Informe o nome da planta.");
      return;
    }

    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarPlanta({ plantaId, nome: nome.trim() });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setAberto(false);
      }
    });
  }

  return (
    <>
      <Botao
        type="button"
        variante="fantasma"
        tamanho="sm"
        onClick={abrir}
        aria-label="Editar nome da planta"
        className="text-superficie-400 hover:text-azul-600 px-2 py-1.5"
      >
        <Edit2 className="h-4 w-4" />
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Editar planta">
        {erro && (
          <div className="mb-4 rounded-lg border border-perigo/50 bg-perigo/5 px-4 py-3 text-sm text-perigo" role="alert">
            {erro}
          </div>
        )}
        <div className="space-y-4">
          <Campo
            rotulo="Nome da planta"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Térreo - Elétrica"
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
