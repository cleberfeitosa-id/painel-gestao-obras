import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PLANTAS, urlAssinada } from "@/lib/armazenamento";
import { Botao } from "@/components/ui";
import { AreaPlanta } from "@/components/plantas/area-planta";
import { BotaoExcluirPlanta } from "@/components/plantas/botao-excluir-planta";
import { EditarPlantaModal } from "@/components/plantas/editar-planta-modal";
import type {
  ExecutorFiltro,
  TarefaObraAssociacao,
  TarefaPlanta,
} from "@/components/plantas/tipos";
import type {
  PlantaCalibracaoRow,
  PlantaRow,
  RegiaoPdf,
} from "@/lib/supabase/database.types";

interface PlantaComObra extends PlantaRow {
  obras: { id: string; nome: string } | null;
}

export default async function DetalhePlantaPage({
  params,
}: {
  params: Promise<{ id: string; plantaId: string }>;
}) {
  const { id, plantaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: planta },
    { data: calibracoes },
    { data: tarefas },
    { data: tarefasObra },
    { data: perfil },
    { data: executores },
    { data: tags },
  ] = await Promise.all([
    supabase
      .from("plantas")
      .select("*, obras(id, nome)")
      .eq("id", plantaId)
      .single(),
    supabase
      .from("planta_calibracoes")
      .select("*")
      .eq("planta_id", plantaId),
    supabase
      .from("tarefas")
      .select(
        "id, titulo, status, prioridade, aprovacao, prazo, pagina, localizacao_tipo, ponto_x, ponto_y, regiao, responsavel:perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(id, nome), tags_tarefa(id, nome)",
      )
      .eq("planta_id", plantaId),
    supabase
      .from("tarefas")
      .select("id, titulo, localizacao_tipo, planta_id, pagina, ponto_x, ponto_y, regiao, plantas!tarefas_planta_id_fkey(nome)")
      .eq("obra_id", id),
    user
      ? supabase.from("perfis").select("papel").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("executores")
      .select("id, nome")
      .eq("obra_id", id)
      .eq("ativo", true)
      .order("nome"),
    supabase.from("tags_tarefa").select("id, nome").order("nome"),
  ]);

  if (!planta || planta.obra_id !== id) notFound();

  const urlPdf = await urlAssinada(BUCKET_PLANTAS, planta.arquivo_path);
  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "gestor";

  const tarefasPlanta: TarefaPlanta[] = (tarefas ?? []).map((tarefa) => ({
    id: tarefa.id,
    titulo: tarefa.titulo,
    status: tarefa.status,
    prioridade: tarefa.prioridade,
    aprovacao: tarefa.aprovacao,
    prazo: tarefa.prazo,
    pagina: tarefa.pagina,
    localizacao_tipo: tarefa.localizacao_tipo,
    ponto_x: tarefa.ponto_x,
    ponto_y: tarefa.ponto_y,
    regiao: tarefa.regiao as RegiaoPdf | null,
    responsavel: tarefa.responsavel,
    executor: tarefa.executor,
    tags_tarefa: tarefa.tags_tarefa,
  }));

  const tarefasObraLista: TarefaObraAssociacao[] = (tarefasObra ?? []).map(
    (tarefa) => ({
      id: tarefa.id,
      titulo: tarefa.titulo,
      localizacao_tipo: tarefa.localizacao_tipo,
      planta_id: tarefa.planta_id,
      planta_nome: tarefa.plantas?.nome ?? null,
      pagina: tarefa.pagina,
      ponto_x: tarefa.ponto_x,
      ponto_y: tarefa.ponto_y,
      regiao: tarefa.regiao as RegiaoPdf | null,
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a obra
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-superficie-900">
                {planta.nome}
              </h1>
              {podeEditar && (
                <EditarPlantaModal plantaId={planta.id} nomeAtual={planta.nome} />
              )}
            </div>
            <p className="mt-1 text-sm text-superficie-500">
              {planta.obras?.nome ?? "Obra"} · {planta.total_paginas}{" "}
              {planta.total_paginas === 1 ? "pagina" : "paginas"}
            </p>
          </div>
          {podeEditar && (
            <div className="flex gap-2">
              <Link href={`/tarefas/nova?obra=${id}`}>
                <Botao variante="primario">
                  <Plus className="h-4 w-4" />
                  Nova tarefa
                </Botao>
              </Link>
              <Link href={`/obras/${id}/plantas/nova`}>
                <Botao variante="contorno">
                  <Plus className="h-4 w-4" />
                  Nova planta
                </Botao>
              </Link>
              <BotaoExcluirPlanta
                plantaId={planta.id}
                obraId={id}
                nome={planta.nome}
              />
            </div>
          )}
        </div>
      </div>

      <AreaPlanta
        obraId={id}
        obraNome={planta.obras?.nome ?? "Obra"}
        planta={planta}
        urlPdf={urlPdf}
        calibracoes={(calibracoes ?? []) as PlantaCalibracaoRow[]}
        tarefas={tarefasPlanta}
        tarefasObra={tarefasObraLista}
        executores={(executores ?? []) as ExecutorFiltro[]}
        tags={(tags ?? []) as { id: string; nome: string }[]}
        podeEditar={podeEditar}
      />
    </div>
  );
}