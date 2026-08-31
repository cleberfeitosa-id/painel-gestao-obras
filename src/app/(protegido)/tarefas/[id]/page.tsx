import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Camera,
  Video,
  FileText,
  MessageSquare,
  Paperclip,
  Calendar,
  Building2,
  Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_TAREFA, PRIORIDADE_TAREFA, APROVACAO_TAREFA } from "@/lib/domain/rotulos";
import { situacaoPrazo, formatarData, formatarDataHora } from "@/lib/datas";
import { urlsAssinadas, urlAssinada, BUCKET_ANEXOS, BUCKET_PLANTAS } from "@/lib/armazenamento";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Etiqueta,
  Avatar,
  Botao,
} from "@/components/ui";
import { AlterarStatus } from "@/components/tarefas/alterar-status";
import { Comentarios } from "@/components/tarefas/comentarios";
import { Anexos } from "@/components/tarefas/anexos";
import { AprovacaoTarefa } from "@/components/tarefas/aprovacao-tarefa";
import { BotaoExcluirTarefa } from "@/components/tarefas/botao-excluir-tarefa";
import { BotaoDuplicarTarefa } from "@/components/tarefas/botao-duplicar-tarefa";
import { MiniVisualizadorPlantaDinamico } from "@/components/tarefas/mini-visualizador-planta-dinamico";
import type { TarefaPlanta } from "@/components/plantas/tipos";
import type {
  TarefaRow,
  PerfilRow,
  ObraRow,
  ExecutorRow,
  TarefaComentarioRow,
  TarefaAnexoRow,
  RegiaoPdf,
} from "@/lib/supabase/database.types";

interface TarefaComDados extends Omit<TarefaRow, "avaliado_por"> {
  obras: Pick<ObraRow, "id" | "nome">;
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
  executor: Pick<ExecutorRow, "id" | "nome"> | null;
  supervisor: Pick<PerfilRow, "id" | "nome"> | null;
  avaliado_por: Pick<PerfilRow, "id" | "nome"> | null;
}

interface ComentarioComAutor extends TarefaComentarioRow {
  autor: Pick<PerfilRow, "id" | "nome"> | null;
}

interface AnexoComAutor extends TarefaAnexoRow {
  enviado_por_nome: string | null;
}

const COR_PRAZO: Record<string, string> = {
  atrasado: "text-red-600",
  hoje: "text-amber-600",
  proximo: "text-amber-600",
  ok: "text-superficie-500",
  sem_prazo: "text-superficie-400",
};

async function buscarTarefa(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select(
      "*, obras!inner(id, nome), responsavel:perfis!tarefas_responsavel_id_fkey(id, nome), executor:executores!tarefas_executor_id_fkey(id, nome), supervisor:perfis!tarefas_supervisor_id_fkey(id, nome), avaliado_por:perfis!tarefas_avaliado_por_fkey(id, nome)",
    )
    .eq("id", id)
    .single();
  return data as TarefaComDados | null;
}

async function buscarComplementos(id: string) {
  const supabase = await createClient();
  const [{ data: comentarios }, { data: anexos }] = await Promise.all([
    supabase
      .from("tarefa_comentarios")
      .select("*, autor:perfis!tarefa_comentarios_autor_id_fkey(id, nome)")
      .eq("tarefa_id", id)
      .order("criado_em", { ascending: true }),
    supabase
      .from("tarefa_anexos")
      .select("*, enviado_por_nome:perfis!tarefa_anexos_enviado_por_fkey(nome)")
      .eq("tarefa_id", id)
      .order("criado_em", { ascending: true }),
  ]);

  const anexosLista = (anexos ?? []) as AnexoComAutor[];
  const urls = await urlsAssinadas(
    BUCKET_ANEXOS,
    anexosLista.map((a) => a.caminho),
  );

  return {
    comentarios: (comentarios ?? []) as ComentarioComAutor[],
    anexos: anexosLista,
    urls,
  };
}

async function buscarDadosPlantaTarefa(plantaId: string, pagina: number) {
  const supabase = await createClient();
  const [{ data: planta }, { data: tarefasPlanta }] = await Promise.all([
    supabase
      .from("plantas")
      .select("id, nome, arquivo_path")
      .eq("id", plantaId)
      .single(),
    supabase
      .from("tarefas")
      .select(
        "id, titulo, status, prioridade, aprovacao, prazo, pagina, localizacao_tipo, ponto_x, ponto_y, regiao, responsavel:perfis!tarefas_responsavel_id_fkey(nome), executor:executores!tarefas_executor_id_fkey(id, nome), tags_tarefa(id, nome)",
      )
      .eq("planta_id", plantaId)
      .eq("pagina", pagina),
  ]);

  if (!planta) return null;

  const urlPdf = await urlAssinada(BUCKET_PLANTAS, planta.arquivo_path);
  if (!urlPdf) return null;

  const tarefasFormatadas: TarefaPlanta[] = (tarefasPlanta ?? []).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    aprovacao: t.aprovacao,
    prazo: t.prazo,
    pagina: t.pagina,
    localizacao_tipo: t.localizacao_tipo,
    ponto_x: t.ponto_x,
    ponto_y: t.ponto_y,
    regiao: t.regiao as RegiaoPdf | null,
    responsavel: t.responsavel,
    executor: t.executor,
    tags_tarefa: t.tags_tarefa,
  }));

  return {
    plantaId: planta.id,
    plantaNome: planta.nome,
    urlPdf,
    tarefas: tarefasFormatadas,
  };
}

async function buscarUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: "", eAdmin: false, eGestor: false };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    eAdmin: perfil?.papel === "admin",
    eGestor: perfil?.papel === "admin" || perfil?.papel === "gestor",
  };
}

export default async function DetalheTarefaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tarefa, complementos, usuario] = await Promise.all([
    buscarTarefa(id),
    buscarComplementos(id),
    buscarUsuario(),
  ]);

  if (!tarefa) notFound();

  const dadosPlanta =
    tarefa.localizacao_tipo !== "nenhuma" && tarefa.planta_id && tarefa.pagina
      ? await buscarDadosPlantaTarefa(tarefa.planta_id, tarefa.pagina)
      : null;

  const supabase = await createClient();
  const { data: plantasObra } =
    !dadosPlanta && tarefa.obra_id
      ? await supabase
          .from("plantas")
          .select("id, nome")
          .eq("obra_id", tarefa.obra_id)
          .order("criado_em")
      : { data: null };

  const prazoInfo = situacaoPrazo(tarefa.prazo, tarefa.status === "concluido");
  const podeEscrever = usuario.eGestor || tarefa.responsavel_id === usuario.id;
  const podeAvaliar =
    tarefa.supervisor_id === usuario.id &&
    tarefa.status === "concluido" &&
    tarefa.aprovacao === "pendente";
  const podeReverter = usuario.eGestor || tarefa.supervisor_id === usuario.id;

  const temFoto = complementos.anexos.some((a) => a.tipo === "imagem");
  const temVideo = complementos.anexos.some((a) => a.tipo === "video");
  const temArquivo = complementos.anexos.some((a) => a.tipo === "arquivo");

  const requisitos = [
    {
      rotulo: "Foto",
      exigido: tarefa.exige_foto,
      satisfeito: temFoto,
      icone: <Camera className="h-4 w-4" />,
    },
    {
      rotulo: "Video",
      exigido: tarefa.exige_video,
      satisfeito: temVideo,
      icone: <Video className="h-4 w-4" />,
    },
    {
      rotulo: "Arquivo",
      exigido: tarefa.exige_arquivo,
      satisfeito: temArquivo,
      icone: <FileText className="h-4 w-4" />,
    },
  ].filter((r) => r.exigido);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <Link
          href={
            tarefa.localizacao_tipo !== "nenhuma" && tarefa.planta_id
              ? `/obras/${tarefa.obra_id}/plantas/${tarefa.planta_id}`
              : "/tarefas"
          }
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tarefa.localizacao_tipo !== "nenhuma" && tarefa.planta_id
            ? "Voltar para a planta"
            : "Voltar para tarefas"}
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-superficie-900 break-words">
                {tarefa.titulo}
              </h1>
              <Etiqueta className={STATUS_TAREFA[tarefa.status].classe}>
                {STATUS_TAREFA[tarefa.status].rotulo}
              </Etiqueta>
              <Etiqueta className={PRIORIDADE_TAREFA[tarefa.prioridade].classe}>
                {PRIORIDADE_TAREFA[tarefa.prioridade].rotulo}
              </Etiqueta>
              <Etiqueta className={APROVACAO_TAREFA[tarefa.aprovacao].classe}>
                {APROVACAO_TAREFA[tarefa.aprovacao].rotulo}
              </Etiqueta>
            </div>
            <p className="mt-1 text-sm text-superficie-500">
              Criada em {formatarDataHora(tarefa.criado_em)}
            </p>
          </div>
          {podeEscrever && (
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/tarefas/${tarefa.id}/editar`}>
                <Botao variante="contorno">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Botao>
              </Link>
              {usuario.eGestor && (
                <>
                  <BotaoDuplicarTarefa
                    tarefaId={tarefa.id}
                    titulo={tarefa.titulo}
                  />
                  <BotaoExcluirTarefa
                    tarefaId={tarefa.id}
                    titulo={tarefa.titulo}
                    redirecionarAposExcluir="/tarefas"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Cartao className="min-w-0 overflow-hidden">
            <CartaoCabecalho>
              <CartaoTitulo>Informacoes</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo className="min-w-0 max-w-full overflow-hidden">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Obra
                  </dt>
                  <dd className="mt-1">
                    <Link
                      href={`/obras/${tarefa.obra_id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
                    >
                      <Building2 className="h-4 w-4" />
                      {tarefa.obras.nome}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Responsavel
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {tarefa.responsavel ? (
                      <>
                        <Avatar nome={tarefa.responsavel.nome} tamanho="sm" />
                        <span className="text-sm text-superficie-900">
                          {tarefa.responsavel.nome}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-superficie-400">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Executor
                  </dt>
                  <dd className="mt-1 text-sm text-superficie-900">
                    {tarefa.executor ? tarefa.executor.nome : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Supervisor
                  </dt>
                  <dd className="mt-1 text-sm text-superficie-900">
                    {tarefa.supervisor ? tarefa.supervisor.nome : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Prazo
                  </dt>
                  <dd className={`mt-1 text-sm font-medium ${COR_PRAZO[prazoInfo.situacao]}`}>
                    {prazoInfo.texto}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Data planejada
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-superficie-900">
                    <Calendar className="h-4 w-4 text-superficie-400" />
                    {formatarData(tarefa.data_planejada)}
                  </dd>
                </div>
              </dl>

              {tarefa.descricao && (
                <div className="mt-4 border-t border-borda pt-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Descricao
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-superficie-700">
                    {tarefa.descricao}
                  </dd>
                </div>
              )}

              {tarefa.localizacao_tipo !== "nenhuma" && tarefa.planta_id ? (
                <div className="mt-4 border-t border-borda pt-4 min-w-0 max-w-full">
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Localizacao na planta
                  </dt>
                  <dd className="mt-1">
                    <Link
                      href={`/obras/${tarefa.obra_id}/plantas/${tarefa.planta_id}?associar=${tarefa.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-600 hover:text-azul-700"
                      title="Abrir no visualizador completo"
                    >
                      <MapPin className="h-4 w-4" />
                      {tarefa.localizacao_tipo === "ponto"
                        ? `Ponto (x: ${tarefa.ponto_x?.toFixed(2)}, y: ${tarefa.ponto_y?.toFixed(2)})`
                        : `Regiao com ${tarefa.regiao?.vertices.length ?? 0} vertices`}
                      {tarefa.pagina ? ` - pagina ${tarefa.pagina}` : ""}
                    </Link>
                  </dd>

                  {dadosPlanta && (
                    <div className="mt-3 w-full min-w-0 max-w-full overflow-hidden">
                      <MiniVisualizadorPlantaDinamico
                        obraId={tarefa.obra_id}
                        plantaId={dadosPlanta.plantaId}
                        plantaNome={dadosPlanta.plantaNome}
                        urlPdf={dadosPlanta.urlPdf}
                        pagina={tarefa.pagina ?? 1}
                        tarefaAtualId={tarefa.id}
                        tarefas={dadosPlanta.tarefas}
                        podeEditar={podeEscrever}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 border-t border-borda pt-4 min-w-0 max-w-full">
                  <dt className="text-xs font-medium uppercase tracking-wider text-superficie-500">
                    Localizacao na planta
                  </dt>
                  <dd className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-superficie-500">Sem localização vinculada</span>
                    {podeEscrever && plantasObra && plantasObra.length > 0 && (
                      <Link
                        href={`/obras/${tarefa.obra_id}/plantas/${plantasObra[0].id}?associar=${tarefa.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-azul-200 bg-azul-50 px-3 py-1.5 text-xs font-medium text-azul-700 hover:bg-azul-100 hover:border-azul-300 transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Definir localização no mapa
                      </Link>
                    )}
                  </dd>
                </div>
              )}
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-superficie-400" />
                <CartaoTitulo>Comentarios</CartaoTitulo>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo>
              <Comentarios
                tarefaId={tarefa.id}
                comentarios={complementos.comentarios}
                usuarioId={usuario.id}
                eAdmin={usuario.eAdmin}
              />
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-superficie-400" />
                <CartaoTitulo>Anexos</CartaoTitulo>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo>
              <Anexos
                tarefaId={tarefa.id}
                anexos={complementos.anexos}
                urls={complementos.urls}
                usuarioId={usuario.id}
                podeEscrever={podeEscrever}
              />
            </CartaoConteudo>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Status</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <AlterarStatus
                tarefaId={tarefa.id}
                status={tarefa.status}
                podeEscrever={podeEscrever}
                exigeFoto={tarefa.exige_foto}
                exigeVideo={tarefa.exige_video}
                exigeArquivo={tarefa.exige_arquivo}
                temFoto={temFoto}
                temVideo={temVideo}
                temArquivo={temArquivo}
              />
              {tarefa.concluida_em && (
                <p className="mt-3 text-xs text-superficie-500">
                  Concluida em {formatarDataHora(tarefa.concluida_em)}
                </p>
              )}
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Aprovação</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta className={APROVACAO_TAREFA[tarefa.aprovacao].classe}>
                  {APROVACAO_TAREFA[tarefa.aprovacao].rotulo}
                </Etiqueta>
                {tarefa.avaliado_em && (
                  <span className="text-xs text-superficie-500">
                    {formatarDataHora(tarefa.avaliado_em)}
                  </span>
                )}
              </div>

              {tarefa.aprovacao === "reprovado" && tarefa.motivo_reprovacao && (
                <div className="mt-3 rounded-lg border border-perigo/30 bg-perigo/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-perigo">
                    Motivo da reprovação
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-superficie-700">
                    {tarefa.motivo_reprovacao}
                  </p>
                </div>
              )}

              {tarefa.avaliado_por && (
                <p className="mt-3 text-xs text-superficie-500">
                  Avaliada por {tarefa.avaliado_por.nome}
                </p>
              )}

              <div className="mt-4">
                <AprovacaoTarefa
                  tarefaId={tarefa.id}
                  aprovacao={tarefa.aprovacao}
                  podeAvaliar={podeAvaliar}
                  podeReverter={podeReverter}
                />
              </div>
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Comprovacao obrigatoria</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              {requisitos.length === 0 ? (
                <p className="text-sm text-superficie-500">
                  Nenhuma comprovacao obrigatoria definida.
                </p>
              ) : (
                <ul className="space-y-2">
                  {requisitos.map((r) => (
                    <li
                      key={r.rotulo}
                      className="flex items-center justify-between rounded-lg border border-borda px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 text-superficie-700">
                        {r.icone}
                        {r.rotulo}
                      </span>
                      {r.satisfeito ? (
                        <span className="font-medium text-emerald-600">
                          Anexado
                        </span>
                      ) : (
                        <span className="font-medium text-red-600">Faltando</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CartaoConteudo>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
