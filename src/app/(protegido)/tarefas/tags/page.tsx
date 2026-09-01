import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GerenciadorTags, type ItemTag } from "@/components/tarefas/gerenciador-tags";

export default async function GerenciarTagsPage() {
  const supabase = await createClient();

  const [
    { data: tags },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("tags_tarefa")
      .select("id, nome, criado_em, criado_por(nome)")
      .order("nome"),
    supabase.auth.getUser(),
  ]);

  let podeEditar = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", user.id)
      .single();
    podeEditar = perfil?.papel === "admin" || perfil?.papel === "gestor";
  }

  const listTags = (tags ?? []) as ItemTag[];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/tarefas"
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para tarefas
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-superficie-900">
            Gerenciar Tags
          </h1>
        </div>
        <p className="mt-1 text-sm text-superficie-500">
          Vocabulário de tags globais para categorizar e filtrar tarefas em todas as obras.
        </p>
      </div>

      <GerenciadorTags tagsIniciais={listTags} podeEditar={podeEditar} />
    </div>
  );
}
