import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exportarRdoPdf } from "@/lib/pdf/exportador-rdo";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const supabase = await createClient(); const { data } = await supabase.from("rdos").select("*, obras(nome)").eq("id", id).is("excluido_em", null).single(); if (!data) notFound(); const pdf = await exportarRdoPdf(data); return new Response(pdf.buffer as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rdo-${data.data}.pdf"`, "Cache-Control": "no-store" } }); }
