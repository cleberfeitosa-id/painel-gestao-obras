import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListaQuadros } from "@/components/quadros/lista-quadros";
import type { QuadroEletricoRow, ObraRow, PapelUsuario } from "@/lib/supabase/database.types";

async function buscarObra(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();
  return data as Pick<ObraRow, "id" | "nome"> | null;
}

async function buscarQuadros(obraId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quadros_eletricos")
    .select("*")
    .eq("obra_id", obraId)
    .order("tag", { ascending: true });
  return (data ?? []) as QuadroEletricoRow[];
}

async function buscarPapel(): Promise<PapelUsuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  return perfil?.papel ?? null;
}

export default async function QuadrosObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [obra, quadros, papel] = await Promise.all([
    buscarObra(id),
    buscarQuadros(id),
    buscarPapel(),
  ]);

  if (!obra) notFound();

  const podeEditar = papel === "admin" || papel === "gestor";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${obra.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para {obra.nome}
        </Link>
      </div>

      <ListaQuadros
        obraId={obra.id}
        obraNome={obra.nome}
        quadros={quadros}
        podeEditar={podeEditar}
      />
    </div>
  );
}
