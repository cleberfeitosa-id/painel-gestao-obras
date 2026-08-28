"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";
import { OPCOES_STATUS_OBRA } from "@/lib/domain/rotulos";

export function FiltrosObras() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");

  const aplicar = useCallback(
    (status: string, termo: string) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (termo.trim()) params.set("busca", termo.trim());
      const query = params.toString();
      router.push(query ? `/obras?${query}` : "/obras");
    },
    [router],
  );

  const limpar = () => {
    setBusca("");
    aplicar("", "");
  };

  const temFiltros = Boolean(searchParams.get("status") || searchParams.get("busca"));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Campo
          rotulo="Buscar"
          name="busca"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, codigo ou cliente"
          dica="Pressione Enter para buscar."
        />
      </div>
      <Selecao
        rotulo="Status"
        name="status"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => aplicar(e.target.value, busca)}
      >
        <option value="">Todos os status</option>
        {OPCOES_STATUS_OBRA.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </Selecao>
      <div className="flex gap-2">
        <Botao
          type="button"
          variante="primario"
          onClick={() => aplicar(searchParams.get("status") ?? "", busca)}
        >
          <Search className="h-4 w-4" />
          Buscar
        </Botao>
        {temFiltros && (
          <Botao type="button" variante="contorno" onClick={limpar}>
            <X className="h-4 w-4" />
            Limpar
          </Botao>
        )}
      </div>
    </div>
  );
}
