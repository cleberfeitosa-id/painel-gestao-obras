import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FormularioTarefa, type LocalizacaoInicial } from "@/components/tarefas/formulario-tarefa";
import { criarTarefa } from "../acoes";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
} from "@/lib/supabase/database.types";

const esquemaPonto = z.object({
  obra: z.string().uuid(),
  planta: z.string().uuid(),
  pagina: z.coerce.number().int().positive(),
  tipo: z.literal("ponto"),
  x: z.coerce.number(),
  y: z.coerce.number(),
});

const esquemaRegiao = z.object({
  obra: z.string().uuid(),
  planta: z.string().uuid(),
  pagina: z.coerce.number().int().positive(),
  tipo: z.literal("regiao"),
  regiao: z
    .string()
    .transform((valor, ctx) => {
      try {
        return JSON.parse(valor);
      } catch {
        ctx.addIssue({ code: "custom", message: "Regiao invalida." });
        return z.NEVER;
      }
    })
    .pipe(
      z.object({
        vertices: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .min(3),
      }),
    ),
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

export default async function NovaTarefaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [opcoes] = await Promise.all([buscarOpcoes()]);

  let localizacao: LocalizacaoInicial | undefined;
  let obraIdInicial: string | undefined;

  if (params.obra) {
    const obraEncontrada = opcoes.obras.find((o) => o.id === params.obra);
    if (obraEncontrada) {
      obraIdInicial = obraEncontrada.id;
    }
  }

  if (params.tipo === "ponto") {
    const resultado = esquemaPonto.safeParse(params);
    if (resultado.success) {
      localizacao = {
        localizacao_tipo: "ponto",
        planta_id: resultado.data.planta,
        pagina: resultado.data.pagina,
        ponto_x: resultado.data.x,
        ponto_y: resultado.data.y,
        levantamento_id: params.levantamento,
      };
    }
  } else if (params.tipo === "regiao") {
    const resultado = esquemaRegiao.safeParse(params);
    if (resultado.success) {
      localizacao = {
        localizacao_tipo: "regiao",
        planta_id: resultado.data.planta,
        pagina: resultado.data.pagina,
        regiao: resultado.data.regiao,
        levantamento_id: params.levantamento,
      };
    }
  } else if (
    params.tipo === "distancia" ||
    params.tipo === "circuito" ||
    params.tipo === "area" ||
    params.tipo === "descida"
  ) {
    let detalheParsed: Record<string, unknown> | undefined = undefined;
    if (params.detalhe) {
      try {
        detalheParsed = JSON.parse(params.detalhe) as Record<string, unknown>;
      } catch {}
    }
    localizacao = {
      localizacao_tipo: params.tipo as "distancia" | "circuito" | "area" | "descida",
      planta_id: params.planta,
      pagina: params.pagina ? Number(params.pagina) : 1,
      ponto_x: params.x ? Number(params.x) : undefined,
      ponto_y: params.y ? Number(params.y) : undefined,
      levantamento_id: params.levantamento,
      localizacao_detalhe: detalheParsed,
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={
            params.levantamento
              ? `/levantamento/${params.levantamento}`
              : params.obra && params.planta
                ? `/obras/${params.obra}/plantas/${params.planta}`
                : "/tarefas"
          }
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {params.levantamento
            ? "Voltar para o levantamento"
            : params.obra && params.planta
              ? "Voltar para a planta"
              : "Voltar para tarefas"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">Nova tarefa</h1>
        <p className="mt-1 text-sm text-superficie-500">
          Cadastre uma nova tarefa para acompanhamento.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dados da tarefa</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioTarefa
            acao={criarTarefa}
            obras={opcoes.obras}
            responsaveis={opcoes.responsaveis}
            executores={opcoes.executores}
            supervisores={opcoes.supervisores}
            tags={opcoes.tags}
            titulosExistentes={opcoes.titulosExistentes}
            localizacaoInicial={localizacao}
            obraIdInicial={obraIdInicial}
            tituloInicial={params.titulo}
            descricaoInicial={params.descricao}
            catalogoPrecos={opcoes.catalogoPrecos}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
