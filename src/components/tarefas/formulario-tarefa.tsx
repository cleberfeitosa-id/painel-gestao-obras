"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin } from "lucide-react";
import { Botao, Campo, AreaTexto, Selecao } from "@/components/ui";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import type { ObraRow, PerfilRow, TarefaRow } from "@/lib/supabase/database.types";

type ResultadoFormulario = { erro?: string };

export type LocalizacaoInicial = {
  localizacao_tipo: "nenhuma" | "ponto" | "regiao";
  planta_id?: string;
  pagina?: number;
  ponto_x?: number;
  ponto_y?: number;
  regiao?: { vertices: { x: number; y: number }[] };
};

interface FormularioTarefaProps {
  acao: (
    estadoAnterior: ResultadoFormulario,
    formData: FormData,
  ) => Promise<ResultadoFormulario>;
  obras: Pick<ObraRow, "id" | "nome">[];
  responsaveis: Pick<PerfilRow, "id" | "nome">[];
  tarefa?: TarefaRow;
  localizacaoInicial?: LocalizacaoInicial;
}

function BotaoEnviar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      {rotulo}
    </Botao>
  );
}

function ResumoLocalizacao({ localizacao }: { localizacao: LocalizacaoInicial }) {
  if (localizacao.localizacao_tipo === "nenhuma") return null;

  const pagina = localizacao.pagina ? `pagina ${localizacao.pagina}` : "";
  const detalhe =
    localizacao.localizacao_tipo === "ponto"
      ? `Ponto (x: ${localizacao.ponto_x?.toFixed(2)}, y: ${localizacao.ponto_y?.toFixed(2)})`
      : `Regiao com ${localizacao.regiao?.vertices.length ?? 0} vertices`;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 text-sm text-azul-800">
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <p className="font-medium">Localizacao selecionada na planta</p>
        <p className="text-xs text-azul-700">
          {detalhe}
          {pagina ? ` - ${pagina}` : ""}
        </p>
      </div>
    </div>
  );
}

export function FormularioTarefa({
  acao,
  obras,
  responsaveis,
  tarefa,
  localizacaoInicial,
}: FormularioTarefaProps) {
  const [estado, acaoFormulario] = useActionState(acao, {});

  const localizacao = localizacaoInicial ?? {
    localizacao_tipo: tarefa?.localizacao_tipo ?? "nenhuma",
    planta_id: tarefa?.planta_id ?? undefined,
    pagina: tarefa?.pagina ?? undefined,
    ponto_x: tarefa?.ponto_x ?? undefined,
    ponto_y: tarefa?.ponto_y ?? undefined,
    regiao: tarefa?.regiao ?? undefined,
  };

  return (
    <form action={acaoFormulario} className="space-y-6">
      {tarefa && <input type="hidden" name="id" value={tarefa.id} />}

      <input type="hidden" name="localizacao_tipo" value={localizacao.localizacao_tipo} />
      <input type="hidden" name="planta_id" value={localizacao.planta_id ?? ""} />
      <input type="hidden" name="pagina" value={localizacao.pagina ?? ""} />
      <input type="hidden" name="ponto_x" value={localizacao.ponto_x ?? ""} />
      <input type="hidden" name="ponto_y" value={localizacao.ponto_y ?? ""} />
      <input
        type="hidden"
        name="regiao"
        value={localizacao.regiao ? JSON.stringify(localizacao.regiao) : ""}
      />

      {estado.erro && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {estado.erro}
        </div>
      )}

      {localizacao.localizacao_tipo !== "nenhuma" && (
        <ResumoLocalizacao localizacao={localizacao} />
      )}

      <Campo
        rotulo="Titulo"
        obrigatorio
        name="titulo"
        defaultValue={tarefa?.titulo ?? ""}
        placeholder="Ex.: Instalar rede hidraulica"
      />

      <AreaTexto
        rotulo="Descricao"
        name="descricao"
        defaultValue={tarefa?.descricao ?? ""}
        placeholder="Detalhes, escopo e observacoes da tarefa."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Selecao
          rotulo="Obra"
          obrigatorio
          name="obra_id"
          defaultValue={tarefa?.obra_id ?? ""}
        >
          <option value="">Selecione a obra</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Responsavel"
          name="responsavel_id"
          defaultValue={tarefa?.responsavel_id ?? ""}
          dica="Quem executara a tarefa."
        >
          <option value="">Sem responsavel</option>
          {responsaveis.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.nome}
            </option>
          ))}
        </Selecao>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Selecao
          rotulo="Status"
          obrigatorio
          name="status"
          defaultValue={tarefa?.status ?? "pendente"}
        >
          {OPCOES_STATUS_TAREFA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Prioridade"
          obrigatorio
          name="prioridade"
          defaultValue={tarefa?.prioridade ?? "media"}
        >
          {OPCOES_PRIORIDADE.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </Selecao>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          rotulo="Prazo"
          name="prazo"
          type="date"
          defaultValue={tarefa?.prazo ?? ""}
          dica="Data limite para conclusao."
        />
        <Campo
          rotulo="Data planejada"
          name="data_planejada"
          type="date"
          defaultValue={tarefa?.data_planejada ?? ""}
          dica="Data prevista para inicio."
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-superficie-700">
          Comprovacao obrigatoria na conclusao
        </legend>
        <p className="mt-0.5 text-xs text-superficie-500">
          Marque o que deve ser anexado antes de concluir a tarefa.
        </p>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-3 rounded-lg border border-borda px-4 py-3 text-sm text-superficie-700 hover:bg-superficie-50">
            <input
              type="checkbox"
              name="exige_foto"
              defaultChecked={tarefa?.exige_foto ?? false}
              className="h-5 w-5 rounded border-borda text-azul-600 focus:ring-azul-500"
            />
            Exigir foto
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-borda px-4 py-3 text-sm text-superficie-700 hover:bg-superficie-50">
            <input
              type="checkbox"
              name="exige_video"
              defaultChecked={tarefa?.exige_video ?? false}
              className="h-5 w-5 rounded border-borda text-azul-600 focus:ring-azul-500"
            />
            Exigir video
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-borda px-4 py-3 text-sm text-superficie-700 hover:bg-superficie-50">
            <input
              type="checkbox"
              name="exige_arquivo"
              defaultChecked={tarefa?.exige_arquivo ?? false}
              className="h-5 w-5 rounded border-borda text-azul-600 focus:ring-azul-500"
            />
            Exigir arquivo
          </label>
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-3 pt-2">
        <BotaoEnviar rotulo={tarefa ? "Salvar alteracoes" : "Criar tarefa"} />
      </div>
    </form>
  );
}
