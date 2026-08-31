import { BUCKET_PLANTAS, urlAssinada } from "@/lib/armazenamento";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MarcadorPlanta } from "@/components/relatorios/miniatura-planta";
import type {
  FiguraPlanta,
  TarefaRelatorio,
} from "@/components/relatorios/documento-relatorio";

// Monta, a partir das tarefas do relatorio, figuras "identificadas" das plantas
// (com pinos e regioes numerados) que possuem tarefas localizadas associadas.
export async function montarSnapshotsDePlantas(
  supabase: SupabaseClient<Database>,
  tarefas: TarefaRelatorio[],
): Promise<FiguraPlanta[]> {
  const localizadas = tarefas.filter(
    (t) => t.planta_id && t.planta && t.localizacao_tipo !== "nenhuma",
  );
  if (localizadas.length === 0) return [];

  const plantaIds = Array.from(
    new Set(localizadas.map((t) => t.planta_id!)),
  );

  const { data: plantas } = await supabase
    .from("plantas")
    .select("id, nome, arquivo_path")
    .in("id", plantaIds);

  const plantasPorId = new Map((plantas ?? []).map((p) => [p.id, p]));

  const numeros = new Map<string, number>();
  const figuras = new Map<string, FiguraPlanta>();

  for (const tarefa of localizadas) {
    const pagina = tarefa.pagina ?? 1;
    const chave = `${tarefa.planta_id}::${pagina}`;
    const figura = figuras.get(chave) ?? {
      plantaId: tarefa.planta_id!,
      plantaNome: tarefa.planta?.nome ?? "",
      pagina,
      urlPdf: null,
      marcadores: [] as MarcadorPlanta[],
    };
    const numero = (numeros.get(tarefa.planta_id!) ?? 0) + 1;
    numeros.set(tarefa.planta_id!, numero);
    figura.marcadores.push({
      numero,
      titulo: tarefa.titulo,
      localizacao_tipo: tarefa.localizacao_tipo,
      ponto_x: tarefa.ponto_x,
      ponto_y: tarefa.ponto_y,
      regiao: tarefa.regiao,
      status: tarefa.status,
      aprovacao: tarefa.aprovacao,
    });
    figuras.set(chave, figura);
  }

  const resultado: FiguraPlanta[] = [];
  for (const figura of figuras.values()) {
    const planta = plantasPorId.get(figura.plantaId);
    if (!planta) continue;
    const urlPdf = await urlAssinada(BUCKET_PLANTAS, planta.arquivo_path);
    if (!urlPdf) continue;
    resultado.push({ ...figura, urlPdf });
  }

  return resultado.sort((a, b) => {
    if (a.plantaNome !== b.plantaNome) return a.plantaNome.localeCompare(b.plantaNome);
    return a.pagina - b.pagina;
  });
}
