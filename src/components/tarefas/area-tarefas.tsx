"use client";

import { useState } from "react";
import { ListaTarefas } from "./lista-tarefas";
import { PlantaLateralDinamica } from "./planta-lateral-dinamica";
import type { TarefaComDados } from "@/app/(protegido)/tarefas/page";
import type { PerfilRow, ExecutorRow, PlantaRow, PlantaCalibracaoRow } from "@/lib/supabase/database.types";
import type { TarefaPlanta } from "@/components/plantas/tipos";

interface AreaTarefasProps {
  tarefas: TarefaComDados[];
  podeExcluir: boolean;
  temFiltros: boolean;
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  tags: { id: string; nome: string }[];
  catalogoPrecos: {
    id: string;
    nome: string;
    unidade: string;
    medicoes: { id: string; titulo: string; obra_id: string };
  }[];
  dadosPlanta?: {
    planta: PlantaRow;
    calibracoes: PlantaCalibracaoRow[];
    urlPdf: string;
  } | null;
  tarefasPlanta?: TarefaPlanta[];
  paginaInicial?: number;
}

export function AreaTarefas({
  tarefas,
  podeExcluir,
  temFiltros,
  responsaveis,
  supervisores,
  executores,
  tags,
  catalogoPrecos,
  dadosPlanta,
  tarefasPlanta,
  paginaInicial = 1,
}: AreaTarefasProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [tarefaDestaque, setTarefaDestaque] = useState<string | null>(null);

  const limparSelecao = () => setSelecionadas(new Set());
  
  const toggleSelecao = (tarefaId: string) => {
    setSelecionadas((atual) => {
      const novas = new Set(atual);
      if (novas.has(tarefaId)) {
        novas.delete(tarefaId);
      } else {
        novas.add(tarefaId);
      }
      return novas;
    });
  };

  const alternarVarias = (tarefasIds: string[], selecionar: boolean) => {
    setSelecionadas((atual) => {
      const novas = new Set(atual);
      tarefasIds.forEach((id) => {
        if (selecionar) novas.add(id);
        else novas.delete(id);
      });
      return novas;
    });
  };

  const toggleTodas = () => {
    if (selecionadas.size === tarefas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(tarefas.map((t) => t.id)));
    }
  };

  const temPlanta = Boolean(dadosPlanta && tarefasPlanta);

  return (
    <div className={temPlanta ? "xl:grid xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-6" : ""}>
      <div className="min-w-0">
        <ListaTarefas
          tarefas={tarefas}
          podeExcluir={podeExcluir}
          temFiltros={temFiltros}
          responsaveis={responsaveis}
          supervisores={supervisores}
          executores={executores}
          tags={tags}
          catalogoPrecos={catalogoPrecos}
          selecionadas={selecionadas}
          aoAlternarSelecao={toggleSelecao}
          aoAlternarVarias={alternarVarias}
          aoAlternarTodas={toggleTodas}
          aoLimparSelecao={limparSelecao}
          tarefaDestaque={tarefaDestaque}
          aoDestaque={setTarefaDestaque}
        />
      </div>

      {temPlanta && (
        <div className="hidden xl:block mt-6 xl:mt-0">
          <PlantaLateralDinamica
            planta={dadosPlanta!.planta}
            calibracoes={dadosPlanta!.calibracoes}
            urlPdf={dadosPlanta!.urlPdf}
            tarefas={tarefasPlanta!}
            paginaInicial={paginaInicial}
            selecionadas={selecionadas}
            aoAlternarSelecao={toggleSelecao}
            tarefaDestaque={tarefaDestaque}
            aoDestaque={setTarefaDestaque}
          />
        </div>
      )}
    </div>
  );
}
