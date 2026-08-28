"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao, Modal } from "@/components/ui";
import { excluirPlanta } from "@/app/(protegido)/obras/[id]/plantas/acoes";

interface BotaoExcluirPlantaProps {
  plantaId: string;
  obraId: string;
  nome: string;
}

export function BotaoExcluirPlanta({
  plantaId,
  obraId,
  nome,
}: BotaoExcluirPlantaProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirPlanta(plantaId);
    if ("ok" in resultado) {
      router.push(`/obras/${obraId}`);
      router.refresh();
    } else {
      setErro(resultado.erro);
      setExcluindo(false);
    }
  }

  return (
    <>
      <Botao variante="perigo" onClick={() => setAberto(true)}>
        <Trash2 className="h-4 w-4" />
        Excluir
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Excluir planta"
        descricao="Esta acao nao pode ser desfeita."
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-superficie-600">
            Tem certeza que deseja excluir a planta{" "}
            <strong className="text-superficie-900">{nome}</strong>? As tarefas
            vinculadas a ela serao mantidas, mas perderao a localizacao na
            planta.
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
              Excluir planta
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}