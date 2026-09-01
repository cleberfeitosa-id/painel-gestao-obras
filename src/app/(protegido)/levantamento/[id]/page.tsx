import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PLANTAS, urlAssinada } from "@/lib/armazenamento";
import { AreaLevantamento } from "@/components/levantamento/area-levantamento";
import type {
  LevantamentoRow,
  ObraRow,
  PlantaCalibracaoRow,
  PlantaRow,
} from "@/lib/supabase/database.types";

interface LevantamentoDetalhePageProps {
  params: Promise<{ id: string }>;
}

export default async function LevantamentoDetalhePage({
  params,
}: LevantamentoDetalhePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: levantamento },
    { data: perfil },
    { data: obrasData },
    { data: plantasData },
  ] = await Promise.all([
    supabase
      .from("levantamentos")
      .select("*, obras(id, nome), plantas(*)")
      .eq("id", id)
      .single(),
    user
      ? supabase.from("perfis").select("papel").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("obras").select("*").order("nome"),
    supabase.from("plantas").select("*").order("nome"),
  ]);

  if (!levantamento || !levantamento.plantas) {
    notFound();
  }

  const planta = levantamento.plantas as unknown as PlantaRow;
  const { data: calibracoesData } = await supabase
    .from("planta_calibracoes")
    .select("*")
    .eq("planta_id", levantamento.planta_id);

  const urlPdf = await urlAssinada(BUCKET_PLANTAS, planta.arquivo_path);
  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "gestor";

  const obras = (obrasData ?? []) as ObraRow[];
  const plantas = (plantasData ?? []) as PlantaRow[];
  const calibracoes = (calibracoesData ?? []) as PlantaCalibracaoRow[];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/levantamento"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-azul-600 hover:text-azul-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para a lista de levantamentos
        </Link>
      </div>

      <AreaLevantamento
        obras={obras}
        plantas={plantas}
        obraInicialId={levantamento.obra_id}
        plantaInicialId={levantamento.planta_id}
        paginaInicial={levantamento.pagina}
        levantamentoInicial={levantamento as unknown as LevantamentoRow}
        calibracoesIniciais={calibracoes}
        urlPdfInicial={urlPdf}
        podeEditar={podeEditar}
      />
    </div>
  );
}
