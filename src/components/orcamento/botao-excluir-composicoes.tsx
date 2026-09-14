"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui";
import { excluirComposicoesEmLote } from "@/app/(protegido)/obras/[id]/orcamentos/composicoes/acoes";

export function BotaoExcluirComposicoes({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    const ids = [...document.querySelectorAll<HTMLInputElement>("input[data-composicao-id]:checked")].map((item) => item.dataset.composicaoId).filter((id): id is string => Boolean(id));
    if (!ids.length || !window.confirm("Excluir as composicoes selecionadas? Os componentes vinculados tambem serao removidos.")) return;
    setExcluindo(true);
    setErro(null);
    const resultado = await excluirComposicoesEmLote(ids, obraId);
    if (resultado.erro) setErro(resultado.erro);
    else router.refresh();
    setExcluindo(false);
  }

  return <div className="flex items-center gap-3"><Botao variante="perigo" type="button" onClick={excluir} disabled={excluindo}><Trash2 className="h-4 w-4" />{excluindo ? "Excluindo..." : "Excluir selecionadas"}</Botao>{erro && <span role="alert" className="text-sm text-perigo">{erro}</span>}</div>;
}
