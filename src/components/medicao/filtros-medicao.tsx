"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";
import type { PlantaRow } from "@/lib/supabase/database.types";

interface FiltrosMedicaoProps {
  plantas: Pick<PlantaRow, "id" | "nome">[];
  ativos: { planta?: string; de?: string; ate?: string };
}

export function FiltrosMedicao({
  plantas,
  ativos,
}: FiltrosMedicaoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const aplicar = useCallback(
    (chave: string, valor: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor) params.set(chave, valor);
      else params.delete(chave);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const limpar = () => router.push(pathname);

  const temFiltros = Boolean(
    ativos.planta || ativos.de || ativos.ate,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Selecao
        rotulo="Planta"
        value={ativos.planta ?? ""}
        onChange={(e) => aplicar("planta", e.target.value)}
      >
        <option value="">Todas as plantas</option>
        {plantas.map((planta) => (
          <option key={planta.id} value={planta.id}>
            {planta.nome}
          </option>
        ))}
      </Selecao>
      <Campo
        rotulo="Período de"
        type="date"
        value={ativos.de ?? ""}
        onChange={(e) => aplicar("de", e.target.value)}
      />
      <Campo
        rotulo="Período até"
        type="date"
        value={ativos.ate ?? ""}
        onChange={(e) => aplicar("ate", e.target.value)}
      />
      <div className="flex items-end">
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
