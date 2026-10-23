"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui";
import { excluirRdo } from "@/app/(protegido)/rdo/acoes";
export function AcoesRdo({ id }: { id: string }) { const router = useRouter(); const [excluindo, startTransition] = useTransition(); const excluir = () => { if (!window.confirm("Excluir este RDO? O historico sera preservado.")) return; startTransition(async () => { const resultado = await excluirRdo(id); if (resultado.erro) window.alert(resultado.erro); else router.push("/rdo"); }); }; return <div className="flex flex-wrap gap-2"><Botao variante="secundario" onClick={() => router.push(`/rdo/${id}/editar`)}><Pencil className="h-4 w-4" />Editar</Botao><a className="inline-flex items-center justify-center gap-2 rounded-lg border border-borda bg-white px-4 py-2 text-sm font-medium text-superficie-700 hover:bg-superficie-50" href={`/rdo/${id}/pdf`}><Download className="h-4 w-4" />Exportar PDF</a><Botao variante="perigo" disabled={excluindo} onClick={excluir}><Trash2 className="h-4 w-4" />{excluindo ? "Excluindo..." : "Excluir"}</Botao></div>; }
