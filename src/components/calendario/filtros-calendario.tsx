"use client";

import { useRouter } from "next/navigation";
import { Selecao } from "@/components/ui";
import type { ObraRow, PerfilRow } from "@/lib/supabase/database.types";

type Props = {
  obras: Pick<ObraRow, "id" | "nome">[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  obraAtual: string;
  responsavelAtual: string;
  mes: string;
  vista: string;
};

export function FiltrosCalendario({
  obras,
  responsaveis,
  obraAtual,
  responsavelAtual,
  mes,
  vista,
}: Props) {
  const router = useRouter();

  const aplicar = (chave: "obra" | "responsavel", valor: string) => {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    if (vista) params.set("vista", vista);
    if (chave === "obra" && valor) params.set("obra", valor);
    if (chave === "responsavel" && valor) params.set("responsavel", valor);
    const qs = params.toString();
    router.push(qs ? `/calendario?${qs}` : "/calendario");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Selecao
          rotulo="Obra"
          name="obra"
          value={obraAtual}
          onChange={(e) => aplicar("obra", e.target.value)}
        >
          <option value="">Todas as obras</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </Selecao>
      </div>
      <div className="flex-1">
        <Selecao
          rotulo="Responsavel"
          name="responsavel"
          value={responsavelAtual}
          onChange={(e) => aplicar("responsavel", e.target.value)}
        >
          <option value="">Todos os responsaveis</option>
          {responsaveis.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.nome}
            </option>
          ))}
        </Selecao>
      </div>
    </div>
  );
}
