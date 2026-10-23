"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Move, Type } from "lucide-react";
import { Campo, Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo, Selecao } from "@/components/ui";
import type { AjusteRdo, ConteudoRdo } from "@/components/rdo/tipos-rdo";

const PdfPreview = dynamic(() => import("./preview-rdo-pdf"), { ssr: false });

const CAMPOS: Array<{ id: keyof ConteudoRdo | string; rotulo: string }> = [
  { id: "turnoTempo", rotulo: "Turno / tempo" },
  { id: "tarefaManha", rotulo: "Tarefas da manhã" },
  { id: "tarefaTarde", rotulo: "Tarefas da tarde" },
  { id: "observacao1Descricao", rotulo: "Observação 1 — descrição" },
  { id: "observacao1Tipo", rotulo: "Observação 1 — ocorrência" },
  { id: "observacao2Descricao", rotulo: "Observação 2 — descrição" },
  { id: "observacao2Tipo", rotulo: "Observação 2 — ocorrência" },
  { id: "observacao3Descricao", rotulo: "Observação 3 — descrição" },
  { id: "observacao3Tipo", rotulo: "Observação 3 — ocorrência" },
  { id: "alimentacao1", rotulo: "Alimentação — quantidade" },
];

function valorCampo(id: string, dados: ConteudoRdo) {
  if (id === "turnoTempo") return dados.turnoTempo;
  if (id === "tarefaManha") return dados.tarefas.manha;
  if (id === "tarefaTarde") return dados.tarefas.tarde;
  if (id === "alimentacao1") return dados.alimentacao[0]?.quantidade ?? "";
  const match = id.match(/^observacao([123])(Descricao|Tipo)$/);
  if (!match) return "";
  const linha = dados.observacoes[Number(match[1]) - 1];
  return match[2] === "Descricao" ? linha?.descricao ?? "" : linha?.tipo ?? "";
}

export function PreviewRdo({ dados, ajustes, aoAjustarAction }: { dados: ConteudoRdo; ajustes: Record<string, AjusteRdo>; aoAjustarAction: (id: string, ajuste: AjusteRdo) => void }) {
  const [selecionado, setSelecionado] = useState("tarefaManha");
  const ajuste = ajustes[selecionado];
  return <div className="space-y-4"><Cartao><CartaoCabecalho><div className="flex items-center justify-between gap-3"><CartaoTitulo>Pré-visualização fiel ao PDF</CartaoTitulo><span className="text-xs text-superficie-400">1 página</span></div></CartaoCabecalho><CartaoConteudo><PdfPreview dados={dados} ajustes={ajustes} selecionado={selecionado} selecionarCampoAction={setSelecionado} obterValorCampoAction={valorCampo} ajustarCampoAction={aoAjustarAction} campos={CAMPOS} /></CartaoConteudo></Cartao>{ajuste && <Cartao><CartaoCabecalho><div className="flex items-center gap-2"><Move className="h-4 w-4 text-azul-600" /><CartaoTitulo>Ajustar: {CAMPOS.find((campo) => campo.id === selecionado)?.rotulo}</CartaoTitulo></div></CartaoCabecalho><CartaoConteudo><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo rotulo="X (pt)" type="number" value={ajuste.x} onChange={(e) => aoAjustarAction(selecionado, { ...ajuste, x: Number(e.target.value) })} /><Campo rotulo="Y (pt)" type="number" value={ajuste.y} onChange={(e) => aoAjustarAction(selecionado, { ...ajuste, y: Number(e.target.value) })} /><Campo rotulo="Fonte (pt)" type="number" value={ajuste.tamanho} onChange={(e) => aoAjustarAction(selecionado, { ...ajuste, tamanho: Number(e.target.value) })} /><Selecao rotulo="Família" value={ajuste.fonte} onChange={(e) => aoAjustarAction(selecionado, { ...ajuste, fonte: e.target.value as AjusteRdo["fonte"] })}><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></Selecao></div><p className="mt-3 flex items-center gap-2 text-xs text-superficie-500"><Type className="h-3.5 w-3.5" />Arraste o texto diretamente no PDF ou ajuste X, Y, fonte e tamanho.</p></CartaoConteudo></Cartao>}</div>;
}
