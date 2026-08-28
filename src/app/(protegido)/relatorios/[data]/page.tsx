import Link from "next/link";
import { z } from "zod";
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  Clock,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  chaveDia,
  formatarDataExtensa,
  formatarDataHora,
  paraData,
} from "@/lib/datas";
import { BUCKET_ANEXOS, urlsAssinadas } from "@/lib/armazenamento";
import {
  Avatar,
  Botao,
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
  EstadoVazio,
  Etiqueta,
} from "@/components/ui";
import { PRIORIDADE_TAREFA, STATUS_TAREFA } from "@/lib/domain/rotulos";
import { BotaoImprimir } from "./botao-imprimir";
import type {
  ObraRow,
  PerfilRow,
  TarefaAnexoRow,
  TarefaComentarioRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

interface TarefaComRelacoes extends TarefaRow {
  obras: ObraRow;
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
  anexos: TarefaAnexoRow[];
  comentarios: TarefaComentarioRow[];
}

// A validacao de calendario usa chaveDia(paraData(valor)) === valor: datas
// como 2026-02-30 sao normalizadas pelo parseISO e nao passam no retorno.
const esquemaData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((valor) => {
    const data = paraData(valor);
    return !Number.isNaN(data.getTime()) && chaveDia(data) === valor;
  }, "Data inválida.");

const SELECAO_TAREFA =
  "*, obras!inner(*), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome), anexos:tarefa_anexos(*), comentarios:tarefa_comentarios(*)";

function ComentariosTarefa({
  comentarios,
  diaChave,
}: {
  comentarios: TarefaComentarioRow[];
  diaChave: string;
}) {
  const doDia = comentarios.filter((c) => chaveDia(c.criado_em) === diaChave);
  if (doDia.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-superficie-700">
        Comentários do dia
      </p>
      {doDia.map((comentario) => (
        <div
          key={comentario.id}
          className="rounded-lg border border-borda bg-superficie-50 p-3 text-sm"
        >
          <p className="whitespace-pre-wrap text-superficie-900">
            {comentario.texto}
          </p>
          <p className="mt-1 text-xs text-superficie-500">
            {formatarDataHora(comentario.criado_em)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImagensTarefa({
  anexos,
  urlsMap,
}: {
  anexos: TarefaAnexoRow[];
  urlsMap: Map<string, string>;
}) {
  const imagens = anexos.filter((a) => a.tipo === "imagem");
  if (imagens.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {imagens.map((anexo) => {
        const url = urlsMap.get(anexo.caminho);
        return (
          <figure key={anexo.id} className="quebra-evitar">
            {url ? (
              <img
                src={url}
                alt={anexo.nome_arquivo}
                className="aspect-square w-full rounded-lg border border-borda object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-borda bg-superficie-100 text-superficie-400">
                Imagem indisponível
              </div>
            )}
            <figcaption className="mt-1 truncate text-xs text-superficie-500">
              {anexo.nome_arquivo} — {formatarDataHora(anexo.criado_em)}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function BlocoTarefa({
  tarefa,
  urlsMap,
  diaChave,
}: {
  tarefa: TarefaComRelacoes;
  urlsMap: Map<string, string>;
  diaChave: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-superficie-900">{tarefa.titulo}</p>
          <p className="mt-0.5 text-sm text-superficie-500">
            {tarefa.obras.nome}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tarefa.responsavel && (
            <span className="flex items-center gap-1.5 text-xs text-superficie-600">
              <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
              {tarefa.responsavel.nome}
            </span>
          )}
          <Etiqueta className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}>
            {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
          </Etiqueta>
          <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
            {STATUS_TAREFA[tarefa.status].rotulo}
          </Etiqueta>
        </div>
      </div>

      {tarefa.status === "concluido" && tarefa.concluida_em && (
        <p className="text-sm text-superficie-600">
          <strong>Concluída em:</strong> {formatarDataHora(tarefa.concluida_em)}
        </p>
      )}

      {tarefa.descricao && (
        <p className="whitespace-pre-wrap text-sm text-superficie-700">
          {tarefa.descricao}
        </p>
      )}

      <ComentariosTarefa comentarios={tarefa.comentarios} diaChave={diaChave} />
      <ImagensTarefa anexos={tarefa.anexos} urlsMap={urlsMap} />
    </div>
  );
}

function SecaoTarefas({
  titulo,
  icone,
  corIcone,
  tarefas,
  urlsMap,
  diaChave,
}: {
  titulo: string;
  icone: React.ReactNode;
  corIcone: string;
  tarefas: TarefaComRelacoes[];
  urlsMap: Map<string, string>;
  diaChave: string;
}) {
  if (tarefas.length === 0) return null;

  return (
    <Cartao>
      <CartaoCabecalho>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${corIcone}`}
          >
            {icone}
          </span>
          <CartaoTitulo>{titulo}</CartaoTitulo>
          <span className="ml-auto text-sm text-superficie-500">
            {tarefas.length} tarefa{tarefas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo className="space-y-4">
        {tarefas.map((tarefa) => (
          <div
            key={tarefa.id}
            className="quebra-evitar rounded-lg border border-borda p-4"
          >
            <BlocoTarefa
              tarefa={tarefa}
              urlsMap={urlsMap}
              diaChave={diaChave}
            />
          </div>
        ))}
      </CartaoConteudo>
    </Cartao>
  );
}

function agruparPorObra(tarefas: TarefaComRelacoes[]) {
  const mapa = new Map<string, TarefaComRelacoes[]>();
  for (const tarefa of tarefas) {
    const atual = mapa.get(tarefa.obra_id) ?? [];
    atual.push(tarefa);
    mapa.set(tarefa.obra_id, atual);
  }
  return mapa;
}

function EstadoDataInvalida({ descricao }: { descricao: string }) {
  return (
    <div className="space-y-6">
      <Link
        href="/relatorios"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar aos relatórios
      </Link>
      <Cartao>
        <EstadoVazio
          icone={<Calendar className="h-8 w-8" />}
          titulo="Data inválida"
          descricao={descricao}
          acao={
            <Link href="/relatorios">
              <Botao variante="primario">Ir para os relatórios</Botao>
            </Link>
          }
        />
      </Cartao>
    </div>
  );
}

export default async function RelatorioDiarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { data: dataParam } = await params;
  const { obra: obraId } = await searchParams;

  const resultado = esquemaData.safeParse(dataParam);
  if (!resultado.success) {
    return (
      <EstadoDataInvalida descricao="O endereço informado não corresponde a uma data válida no formato AAAA-MM-DD." />
    );
  }

  const dataChave = resultado.data;
  const data = paraData(dataChave);
  const dataInicio = `${dataChave}T00:00:00`;
  const dataFim = `${chaveDia(addDays(data, 1))}T00:00:00`;

  const supabase = await createClient();

  let queryConcluidas = supabase
    .from("tarefas")
    .select(SELECAO_TAREFA)
    .eq("status", "concluido")
    .gte("concluida_em", dataInicio)
    .lt("concluida_em", dataFim);

  let queryAnexosDia = supabase
    .from("tarefa_anexos")
    .select("tarefa_id, tarefas!inner(obra_id)")
    .gte("criado_em", dataInicio)
    .lt("criado_em", dataFim);

  let queryComentariosDia = supabase
    .from("tarefa_comentarios")
    .select("tarefa_id, tarefas!inner(obra_id)")
    .gte("criado_em", dataInicio)
    .lt("criado_em", dataFim);

  let queryAbertas = supabase
    .from("tarefas")
    .select("*", { count: "exact", head: true })
    .neq("status", "concluido");

  if (obraId) {
    queryConcluidas = queryConcluidas.eq("obra_id", obraId);
    queryAnexosDia = queryAnexosDia.eq("tarefas.obra_id", obraId);
    queryComentariosDia = queryComentariosDia.eq("tarefas.obra_id", obraId);
    queryAbertas = queryAbertas.eq("obra_id", obraId);
  }

  const [
    { data: concluidasBrutas },
    { data: anexosDia },
    { data: comentariosDia },
    { count: totalAbertas },
  ] = await Promise.all([
    queryConcluidas,
    queryAnexosDia,
    queryComentariosDia,
    queryAbertas,
  ]);

  let obraFiltro = "Todas as obras";
  if (obraId) {
    const { data: obra } = await supabase
      .from("obras")
      .select("nome")
      .eq("id", obraId)
      .maybeSingle();
    obraFiltro = obra?.nome ?? "Obra não encontrada";
  }

  const concluidas = (concluidasBrutas ?? []) as TarefaComRelacoes[];

  const idsComAtividade = new Set<string>();
  for (const anexo of anexosDia ?? []) idsComAtividade.add(anexo.tarefa_id);
  for (const comentario of comentariosDia ?? [])
    idsComAtividade.add(comentario.tarefa_id);
  for (const tarefa of concluidas) idsComAtividade.delete(tarefa.id);

  const idsAndamento = Array.from(idsComAtividade);

  let andamento: TarefaComRelacoes[] = [];
  if (idsAndamento.length > 0) {
    let queryAndamento = supabase
      .from("tarefas")
      .select(SELECAO_TAREFA)
      .in("id", idsAndamento)
      .neq("status", "concluido");
    if (obraId) queryAndamento = queryAndamento.eq("obra_id", obraId);
    const { data: andamentoBruto } = await queryAndamento;
    andamento = (andamentoBruto ?? []) as TarefaComRelacoes[];
  }

  const todasTarefas = [...concluidas, ...andamento];
  const caminhosImagens = todasTarefas.flatMap((tarefa) =>
    tarefa.anexos
      .filter((anexo) => anexo.tipo === "imagem")
      .map((anexo) => anexo.caminho),
  );
  const urlsMap = await urlsAssinadas(BUCKET_ANEXOS, caminhosImagens, 3600);

  const totalConcluidas = concluidas.length;
  const totalAndamento = andamento.length;
  const totalFotos = caminhosImagens.length;
  const temConteudo =
    totalConcluidas > 0 || totalAndamento > 0 || totalFotos > 0;

  const concluidasPorObra = agruparPorObra(concluidas);
  const andamentoPorObra = agruparPorObra(andamento);

  return (
    <BotaoImprimir>
      <div className="nao-imprimir">
        <Link
          href="/relatorios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar aos relatórios
        </Link>
      </div>

      <header className="border-b border-borda pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-azul-700">
          Vasconcelos Engenharia
        </p>
        <h1 className="mt-1 text-2xl font-bold text-superficie-900">
          Relatório Diário de Obra (RDO)
        </h1>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-superficie-500">Data</dt>
            <dd className="font-medium capitalize text-superficie-900">
              {formatarDataExtensa(data)}
            </dd>
          </div>
          <div>
            <dt className="text-superficie-500">Obra</dt>
            <dd className="font-medium text-superficie-900">{obraFiltro}</dd>
          </div>
          <div>
            <dt className="text-superficie-500">Gerado em</dt>
            <dd className="font-medium text-superficie-900">
              {formatarDataHora(new Date())}
            </dd>
          </div>
        </dl>
      </header>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Resumo do dia</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Tarefas concluídas</p>
              <p className="text-2xl font-bold text-emerald-900">
                {totalConcluidas}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">Em andamento</p>
              <p className="text-2xl font-bold text-amber-900">
                {totalAndamento}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">Em aberto</p>
              <p className="text-2xl font-bold text-slate-900">
                {totalAbertas ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-azul-200 bg-azul-50 p-4">
              <p className="text-sm text-azul-700">Registros fotográficos</p>
              <p className="text-2xl font-bold text-azul-900">{totalFotos}</p>
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      {temConteudo ? (
        <>
          {!obraId ? (
            <>
              {Array.from(concluidasPorObra.entries()).map(
                ([obraIdChave, tarefas]) => (
                  <SecaoTarefas
                    key={obraIdChave}
                    titulo={`Atividades concluídas — ${tarefas[0].obras.nome}`}
                    icone={<CheckSquare className="h-5 w-5" />}
                    corIcone="bg-emerald-100 text-emerald-700"
                    tarefas={tarefas}
                    urlsMap={urlsMap}
                    diaChave={dataChave}
                  />
                ),
              )}
              {Array.from(andamentoPorObra.entries()).map(
                ([obraIdChave, tarefas]) => (
                  <SecaoTarefas
                    key={obraIdChave}
                    titulo={`Atividades em andamento — ${tarefas[0].obras.nome}`}
                    icone={<Clock className="h-5 w-5" />}
                    corIcone="bg-amber-100 text-amber-700"
                    tarefas={tarefas}
                    urlsMap={urlsMap}
                    diaChave={dataChave}
                  />
                ),
              )}
            </>
          ) : (
            <>
              <SecaoTarefas
                titulo="Atividades concluídas"
                icone={<CheckSquare className="h-5 w-5" />}
                corIcone="bg-emerald-100 text-emerald-700"
                tarefas={concluidas}
                urlsMap={urlsMap}
                diaChave={dataChave}
              />
              <SecaoTarefas
                titulo="Atividades em andamento"
                icone={<Clock className="h-5 w-5" />}
                corIcone="bg-amber-100 text-amber-700"
                tarefas={andamento}
                urlsMap={urlsMap}
                diaChave={dataChave}
              />
            </>
          )}
        </>
      ) : (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<FileText className="h-8 w-8" />}
              titulo="Nenhuma atividade neste dia"
              descricao={
                obraId
                  ? "Não houve tarefas concluídas, em andamento com registros, nem fotos para esta obra nesta data."
                  : "Não houve tarefas concluídas, em andamento com registros, nem fotos em nenhuma obra nesta data."
              }
            />
          </CartaoConteudo>
        </Cartao>
      )}
    </BotaoImprimir>
  );
}