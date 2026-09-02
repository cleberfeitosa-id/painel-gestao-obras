import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorQuadroDinamico } from "@/components/quadros/editor-quadro-dinamico";
import { buscarCircuitosObra } from "@/app/(protegido)/obras/[id]/quadros/acoes";
import type { QuadroEletricoRow, ObraRow, PapelUsuario } from "@/lib/supabase/database.types";
import type { QuadroEletricoLayout, CircuitoVinculado } from "@/lib/quadros/tipos";

async function buscarQuadroEObra(quadroId: string, obraId: string) {
  const supabase = await createClient();
  const [{ data: quadro }, { data: obra }] = await Promise.all([
    supabase
      .from("quadros_eletricos")
      .select("*")
      .eq("id", quadroId)
      .eq("obra_id", obraId)
      .single(),
    supabase
      .from("obras")
      .select("id, nome")
      .eq("id", obraId)
      .single(),
  ]);

  return {
    quadro: quadro as QuadroEletricoRow | null,
    obra: obra as Pick<ObraRow, "id" | "nome"> | null,
  };
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

export default async function DetalheQuadroPage({
  params,
}: {
  params: Promise<{ id: string; quadroId: string }>;
}) {
  const { id: obraId, quadroId } = await params;
  const [{ quadro, obra }, circuitosDisponiveis, papel] = await Promise.all([
    buscarQuadroEObra(quadroId, obraId),
    buscarCircuitosObra(obraId),
    buscarPapel(),
  ]);

  if (!quadro || !obra) notFound();

  const podeEditar = papel === "admin" || papel === "gestor";

  const layout = ((quadro.layout || {}) as unknown) as QuadroEletricoLayout;
  const circuitosVinculados = ((quadro.circuitos_vinculados || []) as unknown) as CircuitoVinculado[];

  return (
    <EditorQuadroDinamico
      obraId={obra.id}
      obraNome={obra.nome}
      quadro={{
        id: quadro.id,
        tag: quadro.tag,
        nome: quadro.nome,
        tipo_quadro: quadro.tipo_quadro,
        largura_mm: Number(quadro.largura_mm),
        altura_mm: Number(quadro.altura_mm),
        profundidade_mm: Number(quadro.profundidade_mm),
        largura_util_mm: Number(quadro.largura_util_mm),
        altura_util_mm: Number(quadro.altura_util_mm),
        margem_lateral_mm: Number(quadro.margem_lateral_mm),
        margem_topo_mm: Number(quadro.margem_topo_mm),
        corrente_nominal: quadro.corrente_nominal ? Number(quadro.corrente_nominal) : null,
        tensao_nominal: quadro.tensao_nominal,
        grau_protecao: quadro.grau_protecao,
        material_caixa: quadro.material_caixa,
        layout,
        circuitos_vinculados: circuitosVinculados,
      }}
      circuitosDisponiveis={circuitosDisponiveis}
      podeEditar={podeEditar}
    />
  );
}
