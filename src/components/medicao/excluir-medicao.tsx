"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirMedicao } from "@/app/(protegido)/obras/[id]/medicoes/acoes";

interface ExcluirMedicaoProps {
  medicaoId: string;
  obraId: string;
  titulo: string;
}

export function ExcluirMedicao({ medicaoId, obraId, titulo }: ExcluirMedicaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function confirmar() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await excluirMedicao({ medicaoId, obraId });
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Botao
        type="button"
        variante="fantasma"
        tamanho="sm"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        aria-label={`Excluir medição ${titulo}`}
      >
        <Trash2 className="h-3.5 w-3.5 text-perigo" />
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!pendente) setAberto(false);
        }}
        titulo="Excluir medição"
        descricao={`A medição “${titulo}” e seus vínculos de tarefas serão removidos. Esta ação não pode ser desfeita.`}
      >
        {erro && <p className="mb-4 text-sm text-perigo" role="alert">{erro}</p>}
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="contorno" onClick={() => setAberto(false)} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="button" variante="perigo" onClick={confirmar} carregando={pendente}>
            Excluir medição
          </Botao>
        </div>
      </Modal>
    </>
  );
}
