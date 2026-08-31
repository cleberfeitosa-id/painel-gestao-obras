"use client";

import { useState, useTransition } from "react";
import { Pencil, Save } from "lucide-react";
import { Botao, Campo, Modal } from "@/components/ui";
import { atualizarMedicao } from "@/app/(protegido)/obras/[id]/medicoes/acoes";

interface EditarMedicaoModalProps {
  medicaoId: string;
  titulo: string;
}

export function EditarMedicaoModal({ medicaoId, titulo }: EditarMedicaoModalProps) {
  const [aberto, setAberto] = useState(false);
  const [tituloAtual, setTituloAtual] = useState(titulo);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrir() {
    setTituloAtual(titulo);
    setErro(null);
    setAberto(true);
  }

  function salvar() {
    if (!tituloAtual.trim()) {
      setErro("Informe o titulo da medicao.");
      return;
    }
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarMedicao({
        medicaoId,
        titulo: tituloAtual.trim(),
      });
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
        aria-label={`Renomear medição ${titulo}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Renomear medição"
        descricao="Altere o título deste contrato de medição."
      >
        <div className="space-y-4">
          <Campo
            rotulo="Título"
            value={tituloAtual}
            onChange={(e) => setTituloAtual(e.target.value)}
            placeholder="Ex.: Medição 01 — Fundações"
            autoFocus
          />
          {erro && (
            <p className="text-sm text-perigo" role="alert">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao type="button" onClick={salvar} carregando={pendente}>
              <Save className="h-3.5 w-3.5" />
              Salvar
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
