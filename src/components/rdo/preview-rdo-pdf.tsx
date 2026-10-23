"use client";

import { Document, Page, pdfjs } from "react-pdf";
import type { AjusteRdo, ConteudoRdo } from "@/components/rdo/tipos-rdo";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Campo = { id: string; rotulo: string };
type Props = { dados: ConteudoRdo; ajustes: Record<string, AjusteRdo>; selecionado: string; selecionarCampoAction: (id: string) => void; obterValorCampoAction: (id: string, dados: ConteudoRdo) => string; ajustarCampoAction: (id: string, ajuste: AjusteRdo) => void; campos: Campo[] };

export default function PreviewRdoPdf({ dados, ajustes, selecionado, selecionarCampoAction, obterValorCampoAction, ajustarCampoAction, campos }: Props) {
  const escala = 560 / 744;
  const familia = { helvetica: "Helvetica, Arial, sans-serif", times: "Times New Roman, serif", courier: "Courier New, monospace" } as const;
  return <div className="relative mx-auto w-full max-w-[560px] overflow-hidden border border-borda bg-superficie-100 shadow-sm"><Document file="/rdo/modelo"><Page pageNumber={1} width={560} renderTextLayer={false} renderAnnotationLayer={false} /></Document>{campos.map((campo) => { const pos = ajustes[campo.id]; const valor = obterValorCampoAction(campo.id, dados); if (!pos || !valor) return null; return <button key={campo.id} type="button" onPointerDown={(event) => { event.preventDefault(); selecionarCampoAction(campo.id); const inicioX = event.clientX; const inicioY = event.clientY; const inicial = { ...pos }; const mover = (movimento: PointerEvent) => { const dx = (movimento.clientX - inicioX) / escala; const dy = (movimento.clientY - inicioY) / escala; ajustarCampoAction(campo.id, { ...inicial, x: Math.max(0, Math.min(744, inicial.x + dx)), y: Math.max(0, Math.min(1052.55, inicial.y - dy)) }); }; const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); }; window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar); }} data-rdo-campo={campo.id} className={`absolute max-w-[72%] truncate border border-dashed px-1 text-left leading-tight ${selecionado === campo.id ? "border-azul-600 bg-azul-100/60 text-azul-900" : "border-transparent text-superficie-900 hover:border-azul-400"}`} style={{ left: `${(pos.x / 744) * 100}%`, bottom: `${(pos.y / 1052.55) * 100}%`, fontSize: `${Math.max(5, pos.tamanho * escala)}px`, fontFamily: familia[pos.fonte] }}>{valor}</button>; })}</div>;
}
