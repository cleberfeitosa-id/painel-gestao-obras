"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Campo, Selecao, Botao } from "@/components/ui";
import { hojeChave } from "@/lib/datas";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  PlantaRow,
} from "@/lib/supabase/database.types";

type TipoRelatorio = "diario" | "periodo";

type Props = {
  obras: Pick<ObraRow, "id" | "nome">[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  executores: Pick<ExecutorRow, "id" | "nome">[];
  plantas: (Pick<PlantaRow, "id" | "nome" | "obra_id"> & {
    obras: { nome: string } | null;
  })[];
};

export function FormularioRelatorio({
  obras,
  responsaveis,
  supervisores,
  executores,
  plantas,
}: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoRelatorio>("diario");
  const [data, setData] = useState(hojeChave());
  const [inicio, setInicio] = useState(hojeChave());
  const [fim, setFim] = useState(hojeChave());
  const [obra, setObra] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [executor, setExecutor] = useState("");
  const [planta, setPlanta] = useState("");

  const gerar = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (obra) params.set("obra", obra);
    if (responsavel) params.set("responsavel", responsavel);
    if (supervisor) params.set("supervisor", supervisor);
    if (executor) params.set("executor", executor);
    if (planta) params.set("planta", planta);
    const qs = params.toString();
    const sufixo = qs ? `?${qs}` : "";

    if (tipo === "diario") {
      if (!data) return;
      router.push(`/relatorios/${data}${sufixo}`);
    } else {
      if (!inicio || !fim || fim < inicio) return;
      const p = new URLSearchParams(params);
      p.set("inicio", inicio);
      p.set("fim", fim);
      router.push(`/relatorios/periodo?${p.toString()}`);
    }
  };

  return (
    <form onSubmit={gerar} className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("diario")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            tipo === "diario"
              ? "border-azul-600 bg-azul-600 text-white"
              : "border-borda bg-white text-superficie-600 hover:bg-superficie-50"
          }`}
        >
          Diário
        </button>
        <button
          type="button"
          onClick={() => setTipo("periodo")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            tipo === "periodo"
              ? "border-azul-600 bg-azul-600 text-white"
              : "border-borda bg-white text-superficie-600 hover:bg-superficie-50"
          }`}
        >
          Por período
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tipo === "diario" ? (
          <Campo
            rotulo="Data do relatório"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            max={hojeChave()}
            obrigatorio
          />
        ) : (
          <>
            <Campo
              rotulo="Data inicial"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              max={hojeChave()}
              obrigatorio
            />
            <Campo
              rotulo="Data final"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              max={hojeChave()}
              obrigatorio
            />
          </>
        )}

        <Selecao
          rotulo="Obra"
          value={obra}
          onChange={(e) => {
            setObra(e.target.value);
            setPlanta("");
          }}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Selecao
          rotulo="Responsável"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          dica="Deixe em branco para todos."
        >
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Supervisor"
          value={supervisor}
          onChange={(e) => setSupervisor(e.target.value)}
          dica="Deixe em branco para todos."
        >
          <option value="">Todos os supervisores</option>
          {supervisores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Executor"
          value={executor}
          onChange={(e) => setExecutor(e.target.value)}
          dica="Deixe em branco para todos."
        >
          <option value="">Todos os executores</option>
          {executores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Planta"
          value={planta}
          onChange={(e) => setPlanta(e.target.value)}
          dica="Deixe em branco para todas."
        >
          <option value="">Todas as plantas</option>
          {plantas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.obras?.nome ? ` — ${p.obras.nome}` : ""}
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
