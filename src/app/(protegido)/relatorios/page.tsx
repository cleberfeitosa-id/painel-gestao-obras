import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CheckSquare, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarData, chaveDia, addDays, paraData } from "@/lib/datas";
import { FormularioRelatorio } from "@/components/relatorios/formulario-relatorio";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  EstadoVazio,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  PlantaRow,
} from "@/lib/supabase/database.types";

interface AtividadeDia {
  dataChave: string;
  tarefasConcluidas: number;
  fotos: number;
}

export default async function RelatoriosIndexPage() {
  const supabase = await createClient();

  const hoje = new Date();
  const inicioChave = chaveDia(addDays(hoje, -13));
  const fimChave = chaveDia(addDays(hoje, 1));

  const [
    { data: obras },
    { data: tarefasConcluidas },
    { data: anexosFotos },
    { data: perfis },
    { data: executores },
    { data: plantas },
  ] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase
      .from("tarefas")
      .select("concluida_em")
      .eq("status", "concluido")
      .not("concluida_em", "is", null)
      .gte("concluida_em", `${inicioChave}T00:00:00`)
      .lt("concluida_em", `${fimChave}T00:00:00`),
    supabase
      .from("tarefa_anexos")
      .select("criado_em")
      .eq("tipo", "imagem")
      .gte("criado_em", `${inicioChave}T00:00:00`)
      .lt("criado_em", `${fimChave}T00:00:00`),
    supabase.from("perfis").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("executores").select("id, nome").order("nome"),
    supabase.from("plantas").select("id, nome, obra_id, obras!inner(nome)").order("nome"),
  ]);

  const listaObras = (obras ?? []) as Pick<ObraRow, "id" | "nome">[];
  const listaResponsaveis = (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[];
  const listaSupervisores = (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[];
  const listaExecutores = (executores ?? []) as Pick<ExecutorRow, "id" | "nome">[];
  const listaPlantas = (plantas ?? []) as (Pick<PlantaRow, "id" | "nome" | "obra_id"> & {
    obras: { nome: string } | null;
  })[];

  const atividadesPorDia = new Map<string, AtividadeDia>();
  for (let i = 13; i >= 0; i--) {
    const chave = chaveDia(addDays(hoje, -i));
    atividadesPorDia.set(chave, {
      dataChave: chave,
      tarefasConcluidas: 0,
      fotos: 0,
    });
  }

  for (const tarefa of tarefasConcluidas ?? []) {
    const chave = chaveDia(tarefa.concluida_em!);
    const atual = atividadesPorDia.get(chave);
    if (atual) atual.tarefasConcluidas += 1;
  }

  for (const anexo of anexosFotos ?? []) {
    const chave = chaveDia(anexo.criado_em);
    const atual = atividadesPorDia.get(chave);
    if (atual) atual.fotos += 1;
  }

  const diasOrdenados = Array.from(atividadesPorDia.values()).sort((a, b) =>
    a.dataChave > b.dataChave ? 1 : -1,
  );

  const temAtividade = diasOrdenados.some(
    (d) => d.tarefasConcluidas > 0 || d.fotos > 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-superficie-900">
          Relatório Diário de Obra
        </h1>
        <p className="mt-1 text-sm text-superficie-500">
          Gere o RDO selecionando a data e, opcionalmente, uma obra.
        </p>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Gerar novo relatório</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioRelatorio
            obras={listaObras}
            responsaveis={listaResponsaveis}
            supervisores={listaSupervisores}
            executores={listaExecutores}
            plantas={listaPlantas}
          />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-azul-600" />
            <CartaoTitulo>Últimos 14 dias</CartaoTitulo>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          {temAtividade ? (
            <div className="space-y-2">
              {diasOrdenados.map((dia) => {
                const temMovimento =
                  dia.tarefasConcluidas > 0 || dia.fotos > 0;
                return (
                  <Link
                    key={dia.dataChave}
                    href={`/relatorios/${dia.dataChave}`}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors",
                      temMovimento
                        ? "border-borda bg-white hover:bg-superficie-50"
                        : "border-borda/50 bg-superficie-50/50",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          temMovimento
                            ? "bg-azul-50 text-azul-700"
                            : "bg-superficie-100 text-superficie-400",
                        )}
                      >
                        <Calendar className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-medium",
                            temMovimento
                              ? "text-superficie-900"
                              : "text-superficie-400",
                          )}
                        >
                          {formatarData(dia.dataChave)}
                        </p>
                        <p
                          className={cn(
                            "text-xs capitalize",
                            temMovimento
                              ? "text-superficie-500"
                              : "text-superficie-400",
                          )}
                        >
                          {format(paraData(dia.dataChave), "EEEE", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          dia.tarefasConcluidas > 0
                            ? "text-emerald-700"
                            : "text-superficie-400",
                        )}
                      >
                        <CheckSquare className="h-4 w-4" aria-hidden="true" />
                        {dia.tarefasConcluidas} concluída
                        {dia.tarefasConcluidas !== 1 ? "s" : ""}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          dia.fotos > 0
                            ? "text-azul-700"
                            : "text-superficie-400",
                        )}
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        {dia.fotos} foto{dia.fotos !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EstadoVazio
              icone={<Calendar className="h-8 w-8" />}
              titulo="Nenhuma atividade nos últimos 14 dias"
              descricao="Quando houver tarefas concluídas ou registros fotográficos, eles aparecerão aqui com links diretos para o relatório do dia."
            />
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}