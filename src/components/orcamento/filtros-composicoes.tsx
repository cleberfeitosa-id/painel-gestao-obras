"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";

const OPCOES_VINCULO = [
  { valor: "com", rotulo: "Com código" },
  { valor: "sem", rotulo: "Sem código" },
];

const OPCOES_ORDENAR = [
  { valor: "codigo", rotulo: "Código" },
  { valor: "nome", rotulo: "Nome" },
  { valor: "custo", rotulo: "Custo (maior primeiro)" },
  { valor: "recentes", rotulo: "Mais recentes" },
];

const chaves = ["busca", "vinculo", "ordenar", "pagina"];

export function FiltrosComposicoes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");

  const aplicar = useCallback(
    (mudancas: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const chave of chaves) {
        const valor = mudancas[chave] ?? searchParams.get(chave) ?? "";
        if (valor) params.set(chave, valor);
      }
      const query = params.toString();
      router.push(query ? `?${query}` : ".");
    },
    [router, searchParams],
  );

  const limpar = () => {
    setBusca("");
    router.push(".");
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
                aplicar({ busca, pagina: "1" });
              }
            }}
            placeholder="Código ou nome"
            dica="Pressione Enter para buscar."
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
          <Selecao
            rotulo="Vínculo"
            name="vinculo"
            value={searchParams.get("vinculo") ?? ""}
            onChange={(e) => aplicar({ vinculo: e.target.value, pagina: "1" })}
          >
            <option value="">Todos</option>
            {OPCOES_VINCULO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Ordenar por"
            name="ordenar"
            value={searchParams.get("ordenar") ?? ""}
            onChange={(e) => aplicar({ ordenar: e.target.value, pagina: "1" })}
          >
            <option value="">Padrão (Código)</option>
            {OPCOES_ORDENAR.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="flex gap-2">
          <Botao type="button" variante="primario" onClick={() => aplicar({ busca, pagina: "1" })}>
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