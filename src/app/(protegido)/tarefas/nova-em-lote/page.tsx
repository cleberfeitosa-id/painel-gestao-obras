import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import {
  FormularioTarefa,
  type LocalizacaoLote,
} from "@/components/tarefas/formulario-tarefa";
import { criarTarefasEmLote } from "../acoes";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
} from "@/lib/supabase/database.types";

const esquemaLocalizacao = z.object({
  localizacao_tipo: z.enum([
    "ponto",
    "regiao",
    "distancia",
    "circuito",
    "area",
    "descida",
    "nenhuma",
  ]),
  planta_id: z.string().uuid(),
  pagina: z.number().int().positive(),
  ponto_x: z.number().nullable().optional(),
  ponto_y: z.number().nullable().optional(),
  regiao: z
    .object({
      vertices: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
    })
    .nullable()
    .optional(),
  localizacao_detalhe: z.record(z.string(), z.any()).nullable().optional(),
  levantamento_id: z.string().uuid().nullable().optional(),
  descricao_especifica: z.string().nullable().optional(),
  comprimento: z.number().nullable().optional(),
  area: z.number().nullable().optional(),
  quantidade: z.number().nullable().optional(),
});

const esquemaParams = z.object({
  lote: z.string().uuid(),
  levantamento: z.string().uuid().optional(),
  titulo: z.string().optional(),
  descricao: z.string().optional(),
});

async function buscarOpcoes() {
  const supabase = await createClient();
  const [{ data: obras }, { data: perfis }, { data: executores }, { data: tags }, { data: titulos }, { data: catalogo }] =
    await Promise.all([
      supabase.from("obras").select("id, nome").order("nome"),
      supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("executores")
        .select("id, nome, obra_id, ativo")
        .order("nome"),
      supabase.from("tags_tarefa").select("id, nome").order("nome"),
      supabase.from("tarefas").select("titulo").order("titulo"),
      supabase.from("catalogo_precos").select("id, nome, unidade, medicoes!inner(id, titulo, obra_id)").order("nome"),
    ]);
  return {
    obras: (obras ?? []) as Pick<ObraRow, "id" | "nome">[],
    responsaveis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    supervisores: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    executores: (executores ?? []) as Pick<
      ExecutorRow,
      "id" | "nome" | "obra_id" | "ativo"
    >[],
    tags: (tags ?? []) as { id: string; nome: string }[],
    titulosExistentes: Array.from(
      new Set((titulos ?? []).map((t) => t.titulo)),
    ).sort((a, b) => a.localeCompare(b)),
    catalogoPrecos: (catalogo ?? []) as {
      id: string;
      nome: string;
      unidade: string;
      medicoes: { id: string; titulo: string; obra_id: string };
    }[],
  };
}

export default async function NovaEmLotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [opcoes] = await Promise.all([buscarOpcoes()]);

  const resultado = esquemaParams.safeParse(params);
  const loteId = resultado.success ? resultado.data.lote : null;

  let localizacoes: LocalizacaoLote[] = [];
  let obraEncontrada: Pick<ObraRow, "id" | "nome"> | undefined;
  let plantaId: string | null = null;

  if (loteId) {
    const { data: rascunho } = await supabase
      .from("lote_rascunhos")
      .select("id, obra_id, planta_id, pagina, localizacoes")
      .eq("id", loteId)
      .maybeSingle();

    if (rascunho && rascunho.obra_id) {
      const parse = z
        .array(esquemaLocalizacao)
        .min(1, "Adicione pelo menos uma localizacao.")
        .safeParse(rascunho.localizacoes);
      if (parse.success) {
        localizacoes = parse.data.map((loc) => ({
          localizacao_tipo: loc.localizacao_tipo,
          planta_id: loc.planta_id,
          pagina: loc.pagina,
          ponto_x: loc.ponto_x ?? undefined,
          ponto_y: loc.ponto_y ?? undefined,
          regiao: loc.regiao ?? undefined,
          localizacao_detalhe: loc.localizacao_detalhe ?? undefined,
          levantamento_id: loc.levantamento_id ?? undefined,
          descricao_especifica: loc.descricao_especifica ?? undefined,
          comprimento: loc.comprimento ?? undefined,
          area: loc.area ?? undefined,
          quantidade: loc.quantidade ?? undefined,
        }));
      }
      obraEncontrada = opcoes.obras.find((o) => o.id === rascunho.obra_id);
      plantaId = rascunho.planta_id;
    }
  }

  const obraParaVoltar =
    obraEncontrada && localizacoes.length > 0 ? obraEncontrada : undefined;

  const levantamentoId = params.levantamento || (localizacoes[0]?.levantamento_id);
  const linkVoltar = levantamentoId
    ? `/levantamento/${levantamentoId}`
    : obraParaVoltar && plantaId
      ? `/obras/${obraParaVoltar.id}/plantas/${plantaId}`
      : "/tarefas";

  const textoVoltar = levantamentoId
    ? "Voltar para o levantamento"
    : "Voltar para a planta";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={linkVoltar}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {textoVoltar}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Criar tarefas em lote
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          {localizacoes.length > 0
            ? `Preencha uma vez e os dados serao replicados para as ${localizacoes.length} ${
                localizacoes.length === 1 ? "localizacao" : "localizacoes"
              } selecionadas.`
            : "Selecione os pontos, circuitos ou regioes na planta para criar tarefas em lote."}
        </p>
      </div>

      {obraParaVoltar ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Dados das tarefas</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <FormularioTarefa
              acao={criarTarefasEmLote}
              obras={opcoes.obras}
              responsaveis={opcoes.responsaveis}
              executores={opcoes.executores}
              supervisores={opcoes.supervisores}
              tags={opcoes.tags}
              titulosExistentes={opcoes.titulosExistentes}
              localizacoesLote={localizacoes}
              obraIdInicial={obraParaVoltar.id}
              tituloInicial={params.titulo}
              descricaoInicial={params.descricao}
              loteId={loteId ?? undefined}
              catalogoPrecos={opcoes.catalogoPrecos}
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <Cartao>
          <CartaoConteudo>
            <p className="text-sm text-superficie-600">
              {loteId
                ? "Rascunho de lote nao encontrado ou expirado. Volte para a planta e selecione os pontos ou regioes desejados."
                : "Nenhuma localizacao valida foi informada. Volte para a planta e selecione os pontos ou regioes desejados."}
            </p>
          </CartaoConteudo>
        </Cartao>
      )}
    </div>
  );
}