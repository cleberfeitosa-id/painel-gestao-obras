import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Botao } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AreaCompatibilizacao } from "@/components/compatibilizacao/area-compatibilizacao";

interface CompatibilizacaoDetalhePageProps {
  params: Promise<{ id: string; compatId: string }>;
}

interface PlantaCompatibilizada {
  planta_id: string;
  plantas: {
    arquivo_path: string;
    nome: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export default async function CompatibilizacaoDetalhePage({ params }: CompatibilizacaoDetalhePageProps) {
  const { id, compatId } = await params;
  const supabase = await createClient();

  const { data: compatibilizacao } = await supabase
    .from("compatibilizacoes")
    .select("*, compatibilizacao_plantas(*, plantas(*))")
    .eq("id", compatId)
    .single();

  if (!compatibilizacao) notFound();

  const compatPlantas = (compatibilizacao.compatibilizacao_plantas || []) as unknown as PlantaCompatibilizada[];

  // Buscar todas as tarefas de todas as plantas incluídas na compatibilização
  const plantaIds = compatPlantas.map((cp) => cp.planta_id);
  
  let tarefas: Record<string, unknown>[] = [];
  if (plantaIds.length > 0) {
    const { data } = await supabase
      .from("tarefas")
      .select("*, executores(id, nome)")
      .in("planta_id", plantaIds);
    tarefas = (data || []) as unknown as Record<string, unknown>[];
  }

  const { data: choquesData } = await supabase
    .from("compatibilizacao_choques")
    .select("*")
    .eq("compatibilizacao_id", compatId);

  const choques = choquesData || [];

  const { data: plantasDisponiveis } = await supabase
    .from("plantas")
    .select("*")
    .eq("obra_id", id)
    .order("nome");
    
  const { urlAssinada } = await import("@/lib/armazenamento");
  
  const plantasComUrls = await Promise.all(
    compatPlantas.map(async (cp) => {
      const resultado = await urlAssinada("plantas", cp.plantas.arquivo_path, 3600);
      const urlPdf = resultado as string;
      return { ...cp, urlPdf, dimensoes: null };
    })
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <Link href={`/obras/${id}/compatibilizacoes`}>
          <Botao variante="fantasma" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Botao>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{compatibilizacao.nome}</h1>
          <p className="text-sm text-muted-foreground">Compatibilização de plantas</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <AreaCompatibilizacao
          obraId={id}
          compatibilizacao={compatibilizacao}
          plantasPreCarregadas={plantasComUrls}
          plantasDisponiveis={plantasDisponiveis || []}
          tarefas={tarefas}
          choques={choques}
        />
      </div>
    </div>
  );
}
