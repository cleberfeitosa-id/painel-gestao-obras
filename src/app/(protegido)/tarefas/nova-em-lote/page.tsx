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
  localizacao_tipo: z.enum(["ponto", "regiao"]),
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
});

const esquemaParams = z.object({
  obra: z.string().uuid(),
  planta: z.string().uuid(),
  pagina: z.coerce.number().int().positive(),
  localizacoes: z
    .string()
    .transform((valor, ctx) => {
      try {
        return JSON.parse(valor);
      } catch {
        ctx.addIssue({ code: "custom", message: "Localizacoes invalidas." });
        return z.NEVER;
      }
    })
    .pipe(
      z.array(esquemaLocalizacao).min(1, "Adicione pelo menos uma localizacao."),
    ),
});

async function buscarOpcoes() {
  const supabase = await createClient();
  const [{ data: obras }, { data: perfis }, { data: executores }] =
    await Promise.all([
      supabase.from("obras").select("id, nome").order("nome"),
      supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("executores")
        .select("id, nome, obra_id, ativo")
        .order("nome"),
    ]);
  return {
    obras: (obras ?? []) as Pick<ObraRow, "id" | "nome">[],
    responsaveis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    supervisores: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    executores: (executores ?? []) as Pick<
      ExecutorRow,
      "id" | "nome" | "obra_id" | "ativo"
    >[],
  };
}

export default async function NovaEmLotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [opcoes] = await Promise.all([buscarOpcoes()]);

  const resultado = esquemaParams.safeParse(params);
  const localizacoes: LocalizacaoLote[] = resultado.success
    ? resultado.data.localizacoes.map((loc) => ({
        localizacao_tipo: loc.localizacao_tipo,
        planta_id: loc.planta_id,
        pagina: loc.pagina,
        ponto_x: loc.ponto_x ?? undefined,
        ponto_y: loc.ponto_y ?? undefined,
        regiao: loc.regiao ?? undefined,
      }))
    : [];

  const obraEncontrada = resultado.success
    ? opcoes.obras.find((o) => o.id === resultado.data.obra)
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={
            resultado.success && resultado.data.planta
              ? `/obras/${resultado.data.obra}/plantas/${resultado.data.planta}`
              : "/tarefas"
          }
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a planta
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-superficie-900">
          Criar tarefas em lote
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Preencha uma vez e os dados serao replicados para as{" "}
          {localizacoes.length > 0
            ? `${localizacoes.length} ${
                localizacoes.length === 1 ? "localizacao" : "localizacoes"
              }`
            : "localizacoes"}{" "}
          selecionadas.
        </p>
      </div>

      {localizacoes.length === 0 || !obraEncontrada ? (
        <Cartao>
          <CartaoConteudo>
            <p className="text-sm text-superficie-600">
              Nenhuma localizacao valida foi informada. Volte para a planta e
              selecione os pontos ou regioes desejados.
            </p>
          </CartaoConteudo>
        </Cartao>
      ) : (
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
              localizacoesLote={localizacoes}
              obraIdInicial={obraEncontrada.id}
            />
          </CartaoConteudo>
        </Cartao>
      )}
    </div>
  );
}
