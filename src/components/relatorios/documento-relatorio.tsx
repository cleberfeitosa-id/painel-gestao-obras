import { CheckSquare, Clock, FileText, Map as MapIcon } from "lucide-react";
import {
  Avatar,
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
  EstadoVazio,
  Etiqueta,
  LogoVasconcelos,
} from "@/components/ui";
import { PRIORIDADE_TAREFA, STATUS_TAREFA } from "@/lib/domain/rotulos";
import { formatarDataHora } from "@/lib/datas";
import { MiniaturaPlanta } from "@/components/relatorios/miniatura-planta-dinamica";
import type {
  MarcadorPlanta,
} from "@/components/relatorios/miniatura-planta";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  TarefaAnexoRow,
  TarefaComentarioRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

export interface TarefaRelatorio extends TarefaRow {
  obras: ObraRow;
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
  supervisor: Pick<PerfilRow, "id" | "nome"> | null;
  executor: Pick<ExecutorRow, "id" | "nome"> | null;
  planta: { id: string; nome: string } | null;
  anexos: TarefaAnexoRow[];
  comentarios: TarefaComentarioRow[];
}

export interface RelatorioFiltro {
  rotulo: string;
  valor: string;
}

export interface FiguraPlanta {
  plantaId: string;
  plantaNome: string;
  pagina: number;
  urlPdf: string | null;
  marcadores: MarcadorPlanta[];
}

interface DocumentoRelatorioProps {
  titulo: string;
  subtitulo: string;
  filtros: RelatorioFiltro[];
  geradoEm: Date;
  concluidas: TarefaRelatorio[];
  andamento: TarefaRelatorio[];
  totalAbertas: number;
  totalFotos: number;
  urlsMap: Map<string, string>;
  plantas?: FiguraPlanta[];
  // Filtro de comentarios: se `diaChave` presente, so comentarios daquele dia;
  // senao (periodo), todos os comentarios da tarefa.
  diaChave?: string;
  agruparPorObra: boolean;
}

function emPeriodoOuDia(
  comentario: TarefaComentarioRow,
  diaChave?: string,
): boolean {
  if (!diaChave) return true;
  return comentario.criado_em.slice(0, 10) === diaChave;
}

function ComentariosTarefa({
  comentarios,
  diaChave,
}: {
  comentarios: TarefaComentarioRow[];
  diaChave?: string;
}) {
  const doPeriodo = comentarios.filter((c) => emPeriodoOuDia(c, diaChave));
  if (doPeriodo.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-superficie-700">
        {diaChave ? "Comentários do dia" : "Comentários"}
      </p>
      {doPeriodo.map((comentario) => (
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
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 imprensa-grid-imagens">
      {imagens.map((anexo) => {
        const url = urlsMap.get(anexo.caminho);
        return (
          <figure
            key={anexo.id}
            className="quebra-evitar flex flex-col overflow-hidden rounded-lg border border-borda"
          >
            {url ? (
              <img
                src={url}
                alt={anexo.nome_arquivo}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-superficie-100 text-xs text-superficie-400">
                Imagem indisponível
              </div>
            )}
            <figcaption className="truncate px-1 py-1 text-[10px] leading-tight text-superficie-500">
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
  tarefa: TarefaRelatorio;
  urlsMap: Map<string, string>;
  diaChave?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-superficie-900">{tarefa.titulo}</p>
          <p className="mt-0.5 text-sm text-superficie-500">
            {tarefa.obras.nome}
          </p>
          {tarefa.planta && (
            <p className="text-xs text-superficie-400">
              Planta: {tarefa.planta.nome}
              {tarefa.pagina != null ? ` — pág. ${tarefa.pagina}` : ""}
            </p>
          )}
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

      <div className="grid gap-2 text-sm text-superficie-600 sm:grid-cols-3">
        {tarefa.responsavel && (
          <p>
            <strong>Responsável:</strong> {tarefa.responsavel.nome}
          </p>
        )}
        {tarefa.supervisor && (
          <p>
            <strong>Supervisor:</strong> {tarefa.supervisor.nome}
          </p>
        )}
        {tarefa.executor && (
          <p>
            <strong>Executor:</strong> {tarefa.executor.nome}
          </p>
        )}
      </div>

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
  tarefas: TarefaRelatorio[];
  urlsMap: Map<string, string>;
  diaChave?: string;
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
      <CartaoConteudo className="lista-tarefas space-y-4">
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

function agruparGruposPorObra(tarefas: TarefaRelatorio[]) {
  const mapa = new Map<string, TarefaRelatorio[]>();
  for (const tarefa of tarefas) {
    const atual = mapa.get(tarefa.obra_id) ?? [];
    atual.push(tarefa);
    mapa.set(tarefa.obra_id, atual);
  }
  return mapa;
}

export function DocumentoRelatorio({
  titulo,
  subtitulo,
  filtros,
  geradoEm,
  concluidas,
  andamento,
  totalAbertas,
  totalFotos,
  urlsMap,
  diaChave,
  agruparPorObra,
  plantas = [],
}: DocumentoRelatorioProps) {
  const temConteudo =
    concluidas.length > 0 || andamento.length > 0 || totalFotos > 0;

  const concluidasPorObra = agruparGruposPorObra(concluidas);
  const andamentoPorObra = agruparGruposPorObra(andamento);

  return (
    <>
      <header className="border-b border-borda pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <LogoVasconcelos variante="completa" className="h-14 w-auto" />
          <div className="text-left sm:text-right">
            <span className="inline-block rounded-md border border-borda bg-superficie-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-superficie-600">
              Relatório Gerencial de Obras
            </span>
          </div>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-superficie-900">{titulo}</h1>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {filtros.map((f) => (
            <div key={f.rotulo}>
              <dt className="text-superficie-500">{f.rotulo}</dt>
              <dd className="font-medium capitalize text-superficie-900">
                {f.valor}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-superficie-500">Gerado em</dt>
            <dd className="font-medium text-superficie-900">
              {formatarDataHora(geradoEm)}
            </dd>
          </div>
        </dl>
      </header>

      {plantas.length > 0 && (
        <Cartao>
          <CartaoCabecalho>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-azul-50 text-azul-700">
                <MapIcon className="h-5 w-5" />
              </span>
              <CartaoTitulo>Localização em plantas</CartaoTitulo>
              <span className="ml-auto text-sm text-superficie-500">
                {plantas.length} página{plantas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CartaoCabecalho>
          <CartaoConteudo className="grid gap-6 lg:grid-cols-2">
            {plantas.map((figura) => (
              <MiniaturaPlanta
                key={`${figura.plantaId}-${figura.pagina}`}
                urlPdf={figura.urlPdf ?? ""}
                titulo={`${figura.plantaNome}${figura.pagina > 1 ? ` — pág. ${figura.pagina}` : ""}`}
                pageNumber={figura.pagina}
                marcadores={figura.marcadores}
              />
            ))}
          </CartaoConteudo>
        </Cartao>
      )}

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Resumo do {subtitulo}</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Tarefas concluídas</p>
              <p className="text-2xl font-bold text-emerald-900">
                {concluidas.length}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">Em andamento</p>
              <p className="text-2xl font-bold text-amber-900">
                {andamento.length}
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
          {!agruparPorObra ? (
            <>
              <SecaoTarefas
                titulo="Atividades concluídas"
                icone={<CheckSquare className="h-5 w-5" />}
                corIcone="bg-emerald-100 text-emerald-700"
                tarefas={concluidas}
                urlsMap={urlsMap}
                diaChave={diaChave}
              />
              <SecaoTarefas
                titulo="Atividades em andamento"
                icone={<Clock className="h-5 w-5" />}
                corIcone="bg-amber-100 text-amber-700"
                tarefas={andamento}
                urlsMap={urlsMap}
                diaChave={diaChave}
              />
            </>
          ) : (
            <>
              {Array.from(concluidasPorObra.entries()).map(
                ([chave, tarefas]) => (
                  <SecaoTarefas
                    key={chave}
                    titulo={`Atividades concluídas — ${tarefas[0].obras.nome}`}
                    icone={<CheckSquare className="h-5 w-5" />}
                    corIcone="bg-emerald-100 text-emerald-700"
                    tarefas={tarefas}
                    urlsMap={urlsMap}
                    diaChave={diaChave}
                  />
                ),
              )}
              {Array.from(andamentoPorObra.entries()).map(([chave, tarefas]) => (
                <SecaoTarefas
                  key={chave}
                  titulo={`Atividades em andamento — ${tarefas[0].obras.nome}`}
                  icone={<Clock className="h-5 w-5" />}
                  corIcone="bg-amber-100 text-amber-700"
                  tarefas={tarefas}
                  urlsMap={urlsMap}
                  diaChave={diaChave}
                />
              ))}
            </>
          )}
        </>
      ) : (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<FileText className="h-8 w-8" />}
              titulo="Nenhuma atividade no período"
              descricao="Não houve tarefas concluídas, em andamento com registros, nem fotos para os filtros informados."
            />
          </CartaoConteudo>
        </Cartao>
      )}
    </>
  );
}
