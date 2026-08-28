import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FormularioTarefa } from "@/components/tarefas/formulario-tarefa";
import { atualizarTarefa } from "../../acoes";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

async function buscarDados(id: string) {
  const supabase = await createClient();
  const [{ data: tarefa }, { data: obras }, { data: perfis }, { data: executores }] =
    await Promise.all([
      supabase.from("tarefas").select("*").eq("id", id).single(),
      supabase.from("obras").select("id, nome").order("nome"),
      supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("executores")
        .select("id, nome, obra_id, ativo")
        .order("nome"),
    ]);
  return {
    tarefa: (tarefa ?? null) as TarefaRow | null,
    obras: (obras ?? []) as Pick<ObraRow, "id" | "nome">[],
    responsaveis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    supervisores: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    executores: (executores ?? []) as Pick<
      ExecutorRow,
      "id" | "nome" | "obra_id" | "ativo"
    >[],
  };
}

export default async function EditarTarefaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tarefa, obras, responsaveis, executores, supervisores } =
    await buscarDados(id);

  if (!tarefa) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/tarefas/${tarefa.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a tarefa
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Editar tarefa
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Atualize os dados da tarefa.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dados da tarefa</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioTarefa
            acao={atualizarTarefa}
            obras={obras}
            responsaveis={responsaveis}
            executores={executores}
            supervisores={supervisores}
            tarefa={tarefa}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
