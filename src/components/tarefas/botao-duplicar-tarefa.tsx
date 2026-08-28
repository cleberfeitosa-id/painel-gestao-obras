"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Botao } from "@/components/ui";
import { duplicarTarefa } from "@/app/(protegido)/tarefas/acoes";

interface BotaoDuplicarTarefaProps {
  tarefaId: string;
  titulo: string;
  compacto?: boolean;
}

export function BotaoDuplicarTarefa({
  tarefaId,
  titulo,
  compacto = false,
}: BotaoDuplicarTarefaProps) {
  const router = useRouter();
  const [duplicando, setDuplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function duplicar() {
    setDuplicando(true);
    setErro(null);
    const resultado = await duplicarTarefa(tarefaId);
    if (resultado.erro) {
      setErro(resultado.erro);
      setDuplicando(false);
      return;
    }
    if (resultado.id) {
      router.push(`/tarefas/${resultado.id}`);
      router.refresh();
    } else {
      router.refresh();
      setDuplicando(false);
    }
  }

  return (
    <>
      {compacto ? (
        <button
          type="button"
          onClick={() => void duplicar()}
          disabled={duplicando}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-superficie-400 transition-colors hover:bg-azul-50 hover:text-azul-600 disabled:opacity-50"
          aria-label={`Duplicar tarefa ${titulo}`}
          title="Duplicar tarefa"
        >
          <Copy className="h-4 w-4" />
        </button>
      ) : (
        <Botao
          variante="contorno"
          onClick={() => void duplicar()}
          carregando={duplicando}
        >
          <Copy className="h-4 w-4" />
          Duplicar
        </Botao>
      )}
      {erro && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {erro}
        </div>
      )}
    </>
  );
}
