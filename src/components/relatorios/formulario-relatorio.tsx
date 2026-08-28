"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";
import { hojeChave } from "@/lib/datas";
import type { ObraRow } from "@/lib/supabase/database.types";

type Props = {
  obras: Pick<ObraRow, "id" | "nome">[];
};

export function FormularioRelatorio({ obras }: Props) {
  const router = useRouter();
  const [data, setData] = useState(hojeChave());
  const [obra, setObra] = useState("");

  const gerar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const params = new URLSearchParams();
    if (obra) params.set("obra", obra);
    const qs = params.toString();
    router.push(`/relatorios/${data}${qs ? `?${qs}` : ""}`);
  };

  return (
    <form onSubmit={gerar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Data do relatório"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          max={hojeChave()}
          obrigatorio
        />
        <Selecao
          rotulo="Obra"
          value={obra}
          onChange={(e) => setObra(e.target.value)}
          dica="Deixe em branco para todas as obras."
        >
          <option value="">Todas as obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Selecao>
      </div>
      <div>
        <Botao type="submit" variante="primario">
          <FileText className="h-4 w-4" />
          Gerar relatório
        </Botao>
      </div>
    </form>
  );
}
