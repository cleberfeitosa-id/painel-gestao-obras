import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Cartao,
  CartaoCabecalho,
  CartaoConteudo,
  CartaoTitulo,
  EstadoVazio,
} from "@/components/ui";
import type { PlantaRow } from "@/lib/supabase/database.types";

interface PlantaComObra extends PlantaRow {
  obras: { id: string; nome: string } | null;
}

export default async function PlantasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plantas")
    .select("*, obras(id, nome)")
    .order("criado_em", { ascending: false });

  const plantas = (data ?? []) as PlantaComObra[];

  const porObra = new Map<string, { nome: string; plantas: PlantaComObra[] }>();
  for (const planta of plantas) {
    const grupo =
      porObra.get(planta.obra_id) ?? {
        nome: planta.obras?.nome ?? "Obra",
        plantas: [],
      };
    grupo.plantas.push(planta);
    porObra.set(planta.obra_id, grupo);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-superficie-900">Plantas</h1>
        <p className="mt-1 text-sm text-superficie-500">
          Todas as plantas em PDF enviadas para as obras.
        </p>
      </div>

      {plantas.length === 0 ? (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<FileText className="h-8 w-8" />}
              titulo="Nenhuma planta enviada"
              descricao="As plantas aparecerao aqui quando forem enviadas pelas obras."
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <div className="space-y-6">
          {[...porObra.entries()].map(([obraId, grupo]) => (
            <Cartao key={obraId}>
              <CartaoCabecalho>
                <CartaoTitulo>{grupo.nome}</CartaoTitulo>
              </CartaoCabecalho>
              <CartaoConteudo className="p-0">
                <ul className="divide-y divide-superficie-100">
                  {grupo.plantas.map((planta) => (
                    <li key={planta.id}>
                      <Link
                        href={`/obras/${obraId}/plantas/${planta.id}`}
                        className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-superficie-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-superficie-900">
                            {planta.nome}
                          </p>
                          {planta.descricao && (
                            <p className="truncate text-xs text-superficie-500">
                              {planta.descricao}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-superficie-400">
                          {planta.total_paginas}{" "}
                          {planta.total_paginas === 1 ? "pagina" : "paginas"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CartaoConteudo>
            </Cartao>
          ))}
        </div>
      )}
    </div>
  );
}