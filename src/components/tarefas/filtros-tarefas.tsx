"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import type { ExecutorRow, ObraRow, PerfilRow } from "@/lib/supabase/database.types";

interface FiltrosTarefasProps {
  obras: Pick<ObraRow, "id" | "nome">[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  plantas: { id: string; nome: string }[];
  tags: { id: string; nome: string }[];
}

const OPCOES_PRAZO = [
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "hoje", rotulo: "Vencem hoje" },
  { valor: "semana", rotulo: "Esta semana" },
  { valor: "sem_prazo", rotulo: "Sem prazo" },
];

const OPCOES_LOCALIZACAO = [
  { valor: "com_local", rotulo: "Com localizacao" },
  { valor: "sem_local", rotulo: "Sem localizacao" },
];

const OPCOES_ORDENAR = [
  { valor: "prazo", rotulo: "Prazo" },
  { valor: "prioridade", rotulo: "Prioridade" },
  { valor: "criacao", rotulo: "Criacao" },
];

export function FiltrosTarefas({
  obras,
  responsaveis,
  supervisores,
  executores,
  plantas,
  tags,
}: FiltrosTarefasProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");

  const aplicar = useCallback(
    (mudancas: Record<string, string>) => {
      const params = new URLSearchParams();
      const chaves = [
        "busca",
        "obra",
        "responsavel",
        "supervisor",
        "executor",
        "status",
        "prioridade",
        "prazo",
        "planta",
        "pagina",
        "tag",
        "localizacao",
        "ordenar",
      ];
      for (const chave of chaves) {
        const valor = mudancas[chave] ?? searchParams.get(chave) ?? "";
        if (valor) params.set(chave, valor);
      }
      const query = params.toString();
      router.push(query ? `/tarefas?${query}` : "/tarefas");
    },
    [router, searchParams],
  );

  const limpar = () => {
    setBusca("");
    router.push("/tarefas");
  };

  const ativos = chaves.filter((c) => searchParams.get(c));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Campo
            rotulo="Buscar"
            name="busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicar({ busca });
              }
            }}
            placeholder="Titulo ou descricao"
            dica="Pressione Enter para buscar."
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
          <Selecao
            rotulo="Obra"
            name="obra"
            value={searchParams.get("obra") ?? ""}
            onChange={(e) => aplicar({ obra: e.target.value })}
          >
            <option value="">Todas as obras</option>
            {obras.map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Planta"
            name="planta"
            value={searchParams.get("planta") ?? ""}
            onChange={(e) => aplicar({ planta: e.target.value })}
          >
            <option value="">Todas as plantas</option>
            {plantas.map((planta) => (
              <option key={planta.id} value={planta.id}>
                {planta.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Tag"
            name="tag"
            value={searchParams.get("tag") ?? ""}
            onChange={(e) => aplicar({ tag: e.target.value })}
          >
            <option value="">Todas as tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Responsavel"
            name="responsavel"
            value={searchParams.get("responsavel") ?? ""}
            onChange={(e) => aplicar({ responsavel: e.target.value })}
          >
            <option value="">Todos os responsaveis</option>
            {responsaveis.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Supervisor"
            name="supervisor"
            value={searchParams.get("supervisor") ?? ""}
            onChange={(e) => aplicar({ supervisor: e.target.value })}
          >
            <option value="">Todos os supervisores</option>
            {supervisores.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Executor"
            name="executor"
            value={searchParams.get("executor") ?? ""}
            onChange={(e) => aplicar({ executor: e.target.value })}
          >
            <option value="">Todos os executores</option>
            {executores.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Status"
            name="status"
            value={searchParams.get("status") ?? ""}
            onChange={(e) => aplicar({ status: e.target.value })}
          >
            <option value="">Todos os status</option>
            {OPCOES_STATUS_TAREFA.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Prioridade"
            name="prioridade"
            value={searchParams.get("prioridade") ?? ""}
            onChange={(e) => aplicar({ prioridade: e.target.value })}
          >
            <option value="">Todas as prioridades</option>
            {OPCOES_PRIORIDADE.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Prazo"
            name="prazo"
            value={searchParams.get("prazo") ?? ""}
            onChange={(e) => aplicar({ prazo: e.target.value })}
          >
            <option value="">Qualquer prazo</option>
            {OPCOES_PRAZO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Localizacao"
            name="localizacao"
            value={searchParams.get("localizacao") ?? ""}
            onChange={(e) => aplicar({ localizacao: e.target.value })}
          >
            <option value="">Qualquer localizacao</option>
            {OPCOES_LOCALIZACAO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Ordenar por"
            name="ordenar"
            value={searchParams.get("ordenar") ?? ""}
            onChange={(e) => aplicar({ ordenar: e.target.value })}
          >
            <option value="">Relevancia</option>
            {OPCOES_ORDENAR.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="flex gap-2">
          <Botao
            type="button"
            variante="primario"
            onClick={() => aplicar({ busca })}
          >
            <Search className="h-4 w-4" />
            Buscar
          </Botao>
          {ativos.length > 0 && (
            <Botao type="button" variante="contorno" onClick={limpar}>
              <X className="h-4 w-4" />
              Limpar
            </Botao>
          )}
        </div>
      </div>

      {ativos.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-superficie-500">
          <SlidersHorizontal className="h-4 w-4" />
          <span>
            {ativos.length} {ativos.length === 1 ? "filtro ativo" : "filtros ativos"}
          </span>
        </div>
      )}
    </div>
  );
}

const chaves = [
  "busca",
  "obra",
  "responsavel",
  "supervisor",
  "executor",
  "status",
  "prioridade",
  "prazo",
  "planta",
  "pagina",
  "tag",
  "localizacao",
  "ordenar",
];
