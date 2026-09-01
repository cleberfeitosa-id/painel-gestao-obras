import { createClient } from "@/lib/supabase/server";
import {
  ListaLevantamentos,
  type LevantamentoComRelacoes,
} from "@/components/levantamento/lista-levantamentos";
import type {
  ObraRow,
  PlantaCalibracaoRow,
  PlantaRow,
} from "@/lib/supabase/database.types";

interface LevantamentoPageProps {
  searchParams: Promise<{
    obra?: string;
  }>;
}

export default async function LevantamentoPage({
  searchParams,
}: LevantamentoPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: perfil },
    { data: obrasData },
    { data: plantasData },
    { data: levantamentosData },
    { data: calibracoesData },
  ] = await Promise.all([
    user
      ? supabase.from("perfis").select("papel").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("obras").select("*").order("nome"),
    supabase.from("plantas").select("*").order("nome"),
    supabase
      .from("levantamentos")
      .select("*, obras(id, nome), plantas(id, nome, total_paginas)")
      .order("atualizado_em", { ascending: false }),
    supabase.from("planta_calibracoes").select("*"),
  ]);

  const obras = (obrasData ?? []) as ObraRow[];
  const plantas = (plantasData ?? []) as PlantaRow[];
  const levantamentos = (levantamentosData ?? []) as LevantamentoComRelacoes[];
  const calibracoes = (calibracoesData ?? []) as PlantaCalibracaoRow[];
  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "gestor";

  return (
    <ListaLevantamentos
      levantamentos={levantamentos}
      obras={obras}
      plantas={plantas}
      calibracoes={calibracoes}
      obraFiltroId={params.obra}
      podeEditar={podeEditar}
    />
  );
}
