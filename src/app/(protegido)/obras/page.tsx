import Link from "next/link";
import { HardHat, Plus, MapPin, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_OBRA } from "@/lib/domain/rotulos";
import {
  Cartao,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Botao,
  Avatar,
} from "@/components/ui";
import { FiltrosObras } from "@/components/obras/filtros-obras";
import type { ObraRow, PerfilRow, StatusObra } from "@/lib/supabase/database.types";

interface ObraComDados extends ObraRow {
  responsavel: Pick<PerfilRow, "id" | "nome"> | null;
}

async function buscarObras(status?: StatusObra, busca?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("obras")
    .select("*, responsavel:perfis!obras_responsavel_id_fkey(id, nome)")
    .order("criado_em", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (busca) {
    query = query.or(
      `nome.ilike.%${busca}%,codigo.ilike.%${busca}%,cliente.ilike.%${busca}%`,
    );
  }

  const { data } = await query;
  return (data ?? []) as ObraComDados[];
}

async function buscarContagemTarefas(obraIds: string[]) {
  if (obraIds.length === 0) return new Map<string, { abertas: number; total: number }>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("obra_id, status")
    .in("obra_id", obraIds);

  const mapa = new Map<string, { abertas: number; total: number }>();
  for (const tarefa of data ?? []) {
    const atual = mapa.get(tarefa.obra_id) ?? { abertas: 0, total: 0 };
    atual.total += 1;
    if (tarefa.status !== "concluido") atual.abertas += 1;
    mapa.set(tarefa.obra_id, atual);
  }
  return mapa;
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; busca?: string }>;
}) {
  const params = await searchParams;
  const statusValido: StatusObra[] = [
    "planejamento",
    "em_andamento",
    "pausada",
    "concluida",
  ];
  const status = statusValido.includes(params.status as StatusObra)
    ? (params.status as StatusObra)
    : undefined;
  const busca = params.busca;

  const obras = await buscarObras(status, busca);
  const contagens = await buscarContagemTarefas(obras.map((o) => o.id));

  const temFiltros = Boolean(status || busca);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Obras</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Gerencie os canteiros e projetos da empresa.
          </p>
        </div>
        <Link href="/obras/nova">
          <Botao variante="primario">
            <Plus className="h-4 w-4" />
            Nova obra
          </Botao>
        </Link>
      </div>

      <Cartao>
        <CartaoConteudo>
          <FiltrosObras />
        </CartaoConteudo>
      </Cartao>

      {obras.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={<HardHat className="h-8 w-8" />}
            titulo={
              temFiltros
                ? "Nenhuma obra encontrada"
                : "Nenhuma obra cadastrada"
            }
            descricao={
              temFiltros
                ? "Ajuste os filtros ou o termo de busca para encontrar obras."
                : "Comece cadastrando sua primeira obra para acompanhar tarefas e plantas."
            }
            acao={
              !temFiltros ? (
                <Link href="/obras/nova">
                  <Botao variante="primario">
                    <Plus className="h-4 w-4" />
                    Cadastrar obra
                  </Botao>
                </Link>
              ) : undefined
            }
          />
        </Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {obras.map((obra) => {
            const contagem = contagens.get(obra.id);
            const statusInfo = STATUS_OBRA[obra.status];
            return (
              <Link key={obra.id} href={`/obras/${obra.id}`} className="group">
                <Cartao className="h-full transition-shadow group-hover:shadow-md">
                  <CartaoConteudo className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-superficie-900">
                          {obra.nome}
                        </p>
                        {obra.codigo && (
                          <p className="mt-0.5 text-xs text-superficie-500">
                            {obra.codigo}
                          </p>
                        )}
                      </div>
                      <Etiqueta className={statusInfo.classe}>
                        {statusInfo.rotulo}
                      </Etiqueta>
                    </div>

                    {obra.cliente && (
                      <p className="text-sm text-superficie-600">
                        {obra.cliente}
                      </p>
                    )}

                    {(obra.cidade || obra.estado) && (
                      <p className="flex items-center gap-1.5 text-xs text-superficie-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {[obra.cidade, obra.estado].filter(Boolean).join(" - ")}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between border-t border-borda pt-3">
                      <div className="flex items-center gap-2">
                        {obra.responsavel ? (
                          <>
                            <Avatar
                              nome={obra.responsavel.nome}
                              tamanho="sm"
                            />
                            <span className="text-xs text-superficie-600">
                              {obra.responsavel.nome}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-superficie-400">
                            Sem responsavel
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {contagem && (
                          <span className="text-xs text-superficie-500">
                            {contagem.abertas}/{contagem.total} tarefas abertas
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-superficie-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </CartaoConteudo>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
