"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { excluirCompra } from "@/app/(protegido)/obras/[id]/compras/acoes";
import { Botao, Modal } from "@/components/ui";

export function ExcluirCompra({ compraId, obraId, fornecedor }: { compraId: string; obraId: string; fornecedor: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function excluir() { setErro(null); iniciar(async () => { const resultado = await excluirCompra(compraId, obraId); if (resultado.erro) setErro(resultado.erro); else { setAberto(false); router.refresh(); } }); }
  return <><Botao type="button" variante="fantasma" tamanho="sm" onClick={() => { setErro(null); setAberto(true); }} aria-label="Excluir compra"><Trash2 className="h-3.5 w-3.5 text-perigo" />Excluir</Botao><Modal aberto={aberto} aoFechar={() => { if (!pendente) setAberto(false); }} titulo="Excluir compra" descricao={`A compra de ${fornecedor ?? "fornecedor não informado"} e todos os seus itens serão removidos.`}><div className="space-y-4">{erro && <p role="alert" className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo">{erro}</p>}<div className="flex justify-end gap-2"><Botao type="button" variante="contorno" onClick={() => setAberto(false)} disabled={pendente}>Cancelar</Botao><Botao type="button" variante="perigo" onClick={excluir} carregando={pendente}>Excluir compra</Botao></div></div></Modal></>;
}
