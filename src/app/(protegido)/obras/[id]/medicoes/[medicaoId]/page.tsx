import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn, formatarMoeda } from "@/lib/utils";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo } from "@/components/ui";
import { FiltrosMedicao } from "@/components/medicao/filtros-medicao";
import { TabelaMedicao } from "@/components/medicao/tabela-medicao";
import { ValorContrato } from "@/components/medicao/valor-contrato";
import { EditarMedicaoModal } from "@/components/medicao/editar-medicao-modal";
import { ListaPagamentos, type ItemPagamento } from "@/components/medicao/lista-pagamentos";
import { GraficosProgressoMedicao } from "@/components/medicao/graficos-progresso-medicao";
import type {
  CatalogoPrecoRow,
  MedicaoRow,
  PlantaRow,
  PerfilRow,
  StatusTarefa,
  TarefaMedicaoRow,
} from "@/lib/supabase/database.types";

export interface TarefaMedicao {
  id: string;
  titulo: string;
  quantidade: number | null;
  status: StatusTarefa;
  prazo: string | null;
  planta: { nome: string } | null;
  responsavel: { nome: string } | null;
  catalogoId: string | null;
}

export interface ItemMedicao {
  catalogoId: string;
  nome: string;
  unidade: string;
  valorUnitario: number;
  quantidadeTotal: number;
  quantidadeExecutada: number;
  quantidadePendente: number;
  valorTotal: number;
  valorExecutado: number;
  valorPendente: number;
  pesoPercentual: number;
  progressoPercentual: number;
  contribuicaoProgresso: number;
  tarefas: TarefaMedicao[];
}

interface TarefaComRelacoes {
  id: string;
  titulo: string;
  status: StatusTarefa;
  prazo: string | null;
  planta_id: string | null;
  responsavel_id: string | null;
  plantas: { nome: string } | null;
  perfis: { nome: string } | null;
  tarefa_medicoes: (TarefaMedicaoRow & { catalogo_precos: CatalogoPrecoRow })[];
}

async function buscarDados(
  obraId: string,
  medicaoId: string,
  filtros: { planta?: string; responsavel?: string; de?: string; ate?: string },
) {
  const supabase = await createClient();

  let consulta = supabase
    .from("tarefas")
    .select(
      `id, titulo, status, prazo, planta_id, responsavel_id, plantas(nome), perfis!tarefas_responsavel_id_fkey(nome),
       tarefa_medicoes(catalogo_id, quantidade, catalogo_precos!inner(id, nome, unidade, valor_unitario, medicao_id))`,
    )
    .eq("obra_id", obraId)
    .eq("tarefa_medicoes.catalogo_precos.medicao_id", medicaoId);

  if (filtros.planta) consulta = consulta.eq("planta_id", filtros.planta);
  if (filtros.responsavel) {
    consulta = consulta.eq("responsavel_id", filtros.responsavel);
  }
  if (filtros.de) consulta = consulta.gte("prazo", filtros.de);
  if (filtros.ate) consulta = consulta.lte("prazo", filtros.ate);

  const [{ data: medicao }, { data: catalogo }, { data: tarefas }, { data: plantas }, { data: perfis }, { data: pagamentos }] =
    await Promise.all([
      supabase
        .from("medicoes")
        .select("id, obra_id, titulo, valor_contrato")
        .eq("id", medicaoId)
        .single(),
      supabase
        .from("catalogo_precos")
        .select("*")
        .eq("medicao_id", medicaoId)
        .order("nome"),
      consulta.order("titulo"),
      supabase.from("plantas").select("id, nome").eq("obra_id", obraId).order("nome"),
      supabase.from("perfis").select("id, nome").order("nome"),
      supabase
        .from("medicao_pagamentos")
        .select("id, valor, data_pagamento, descricao")
        .eq("medicao_id", medicaoId)
        .order("data_pagamento", { ascending: false }),
    ]);

  return {
    medicao: (medicao ?? null) as Pick<MedicaoRow, "id" | "obra_id" | "titulo" | "valor_contrato"> | null,
    catalogo: (catalogo ?? []) as CatalogoPrecoRow[],
    tarefas: (tarefas ?? []) as TarefaComRelacoes[],
    plantas: (plantas ?? []) as Pick<PlantaRow, "id" | "nome">[],
    perfis: (perfis ?? []) as Pick<PerfilRow, "id" | "nome">[],
    pagamentos: (pagamentos ?? []) as ItemPagamento[],
  };
}

export default async function MedicaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; medicaoId: string }>;
  searchParams: Promise<{ planta?: string; responsavel?: string; de?: string; ate?: string }>;
}) {
  const { id, medicaoId } = await params;
  const filtros = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (!perfil || (perfil.papel !== "admin" && perfil.papel !== "gestor")) {
    redirect(`/obras/${id}`);
  }

  const { medicao, catalogo, tarefas, plantas, perfis, pagamentos } = await buscarDados(
    id,
    medicaoId,
    filtros,
  );
  if (!medicao) notFound();

  const itens = new Map<string, ItemMedicao>();
  for (const c of catalogo) {
    itens.set(c.id, {
      catalogoId: c.id,
      nome: c.nome,
      unidade: c.unidade,
      valorUnitario: c.valor_unitario,
      quantidadeTotal: 0,
      quantidadeExecutada: 0,
      quantidadePendente: 0,
      valorTotal: 0,
      valorExecutado: 0,
      valorPendente: 0,
      pesoPercentual: 0,
      progressoPercentual: 0,
      contribuicaoProgresso: 0,
      tarefas: [],
    });
  }

  let valorExecutado = 0;
  let valorPendente = 0;
  let valorTotalCadastrado = 0;

  for (const tarefa of tarefas) {
    for (const medicaoTarefa of tarefa.tarefa_medicoes) {
      const catalogoItem = medicaoTarefa.catalogo_precos;
      if (!catalogoItem) continue;

      const item = itens.get(catalogoItem.id) ?? {
        catalogoId: catalogoItem.id,
        nome: catalogoItem.nome,
        unidade: catalogoItem.unidade,
        valorUnitario: catalogoItem.valor_unitario,
        quantidadeTotal: 0,
        quantidadeExecutada: 0,
        quantidadePendente: 0,
        valorTotal: 0,
        valorExecutado: 0,
        valorPendente: 0,
        pesoPercentual: 0,
        progressoPercentual: 0,
        contribuicaoProgresso: 0,
        tarefas: [],
      };

      item.tarefas.push({
        id: tarefa.id,
        titulo: tarefa.titulo,
        quantidade: medicaoTarefa.quantidade,
        status: tarefa.status,
        prazo: tarefa.prazo,
        planta: tarefa.plantas,
        responsavel: tarefa.perfis,
        catalogoId: catalogoItem.id,
      });

      const qtd = medicaoTarefa.quantidade ?? 0;
      const valor = qtd * item.valorUnitario;
      item.quantidadeTotal += qtd;
      item.valorTotal += valor;
      valorTotalCadastrado += valor;

      if (tarefa.status === "concluido") {
        item.quantidadeExecutada += qtd;
        item.valorExecutado += valor;
        valorExecutado += valor;
      } else {
        item.quantidadePendente += qtd;
        item.valorPendente += valor;
        valorPendente += valor;
      }

      itens.set(catalogoItem.id, item);
    }
  }

  for (const item of itens.values()) {
    item.pesoPercentual =
      valorTotalCadastrado > 0 ? (item.valorTotal / valorTotalCadastrado) * 100 : 0;
    item.progressoPercentual =
      item.valorTotal > 0 ? (item.valorExecutado / item.valorTotal) * 100 : 0;
    item.contribuicaoProgresso =
      valorTotalCadastrado > 0 ? (item.valorExecutado / valorTotalCadastrado) * 100 : 0;
  }

  const listaItens = [...itens.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const temFiltros = Boolean(
    filtros.planta || filtros.responsavel || filtros.de || filtros.ate,
  );

  const valorPago = pagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
  const saldoRestante =
    medicao.valor_contrato != null ? medicao.valor_contrato - valorPago : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/obras/${medicao.obra_id}/medicoes`}
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para as medições
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-superficie-900">{medicao.titulo}</h1>
          <EditarMedicaoModal medicaoId={medicao.id} titulo={medicao.titulo} />
          <span className="text-sm text-superficie-500">Medição</span>
        </div>
        <p className="mt-1 text-sm text-superficie-500">
          Valores unitários do catálogo, quantidades medidas por tarefa e
          progressão do valor a remunerar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ValorContrato medicaoId={medicao.id} valorContrato={medicao.valor_contrato} />
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Valor pago</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-emerald-600">
              {formatarMoeda(valorPago)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Soma dos pagamentos realizados
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Saldo do contrato</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p
              className={cn(
                "text-2xl font-bold",
                saldoRestante == null
                  ? "text-superficie-900"
                  : saldoRestante < 0
                    ? "text-perigo"
                    : "text-azul-600",
              )}
            >
              {formatarMoeda(saldoRestante)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              {medicao.valor_contrato != null
                ? "Valor do contrato deduzido o valor pago"
                : "Defina o valor do contrato para calcular o saldo"}
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Valor executado</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-emerald-600">
              {formatarMoeda(valorExecutado)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Soma das tarefas concluídas
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Valor pendente</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-amber-600">
              {formatarMoeda(valorPendente)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Tarefas ainda não concluídas
            </p>
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Valor total cadastrado</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <p className="text-2xl font-bold text-superficie-900">
              {formatarMoeda(valorTotalCadastrado)}
            </p>
            <p className="mt-1 text-xs text-superficie-500">
              Caso todas as tarefas sejam concluídas
            </p>
          </CartaoConteudo>
        </Cartao>
      </div>

      <GraficosProgressoMedicao
        itens={listaItens}
        valorExecutado={valorExecutado}
        valorPendente={valorPendente}
        valorTotalCadastrado={valorTotalCadastrado}
        valorContrato={medicao.valor_contrato}
      />

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo>Pagamentos</CartaoTitulo>
            <span className="text-xs text-superficie-500">
              {pagamentos.length}{" "}
              {pagamentos.length === 1 ? "pagamento registrado" : "pagamentos registrados"}
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <ListaPagamentos
            medicaoId={medicao.id}
            pagamentos={pagamentos}
          />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Filtros</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FiltrosMedicao
            plantas={plantas}
            responsaveis={perfis}
            ativos={filtros}
          />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center justify-between">
            <CartaoTitulo>Itens de medição</CartaoTitulo>
            <span className="text-xs text-superficie-500">
              {listaItens.length}{" "}
              {listaItens.length === 1 ? "item" : "itens"}
            </span>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="p-0">
          <TabelaMedicao
            medicaoId={medicao.id}
            itens={listaItens}
            catalogo={catalogo}
            temFiltros={temFiltros}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
