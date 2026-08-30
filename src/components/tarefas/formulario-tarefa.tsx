"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin } from "lucide-react";
import { Botao, Campo, AreaTexto, Selecao } from "@/components/ui";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import { hojeChave } from "@/lib/datas";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

type ResultadoFormulario = { erro?: string };

export type LocalizacaoInicial = {
  localizacao_tipo: "nenhuma" | "ponto" | "regiao";
  planta_id?: string;
  pagina?: number;
  ponto_x?: number;
  ponto_y?: number;
  regiao?: { vertices: { x: number; y: number }[] };
};

export type LocalizacaoLote = {
  localizacao_tipo: "ponto" | "regiao";
  planta_id: string;
  pagina: number;
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
  executores: Pick<ExecutorRow, "id" | "nome" | "obra_id" | "ativo">[];
  supervisores: Pick<PerfilRow, "id" | "nome">[];
  tarefa?: TarefaRow;
  localizacaoInicial?: LocalizacaoInicial;
  localizacoesLote?: LocalizacaoLote[];
  obraIdInicial?: string;
  loteId?: string;
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
  executores,
  supervisores,
  tarefa,
  localizacaoInicial,
  localizacoesLote,
  obraIdInicial,
  loteId,
}: FormularioTarefaProps) {
  const [estado, acaoFormulario] = useActionState(acao, {});
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? (tarefa ? "" : hojeChave()));
  const [dataPlanejada, setDataPlanejada] = useState(
    tarefa?.data_planejada ?? (tarefa ? "" : hojeChave())
  );
  const [obraId, setObraId] = useState(tarefa?.obra_id ?? obraIdInicial ?? "");
  const [executorId, setExecutorId] = useState(tarefa?.executor_id ?? "");

  const isNovaTarefa = !tarefa;
  const hoje = hojeChave();

  const executoresDaObra = executores.filter(
    (executor) =>
      executor.obra_id === obraId &&
      (executor.ativo || executor.id === tarefa?.executor_id)
  );

  function mudarObra(valor: string) {
    setObraId(valor);
    const executorAtual = executores.find((e) => e.id === executorId);
    if (executorAtual && executorAtual.obra_id !== valor) {
      setExecutorId("");
    }
  }

  // Prazo nao pode ser anterior a hoje (nova tarefa) nem a data planejada.
  const prazoMin = isNovaTarefa
    ? dataPlanejada && dataPlanejada > hoje
      ? dataPlanejada
      : hoje
    : dataPlanejada || undefined;

  const localizacao = localizacaoInicial ?? {
    localizacao_tipo: tarefa?.localizacao_tipo ?? "nenhuma",
    planta_id: tarefa?.planta_id ?? undefined,
    pagina: tarefa?.pagina ?? undefined,
    ponto_x: tarefa?.ponto_x ?? undefined,
    ponto_y: tarefa?.ponto_y ?? undefined,
    regiao: tarefa?.regiao ?? undefined,
  };

  const handlePrazoChange = (valor: string) => {
    setPrazo(valor);
    if (dataPlanejada && valor && dataPlanejada > valor) {
      setDataPlanejada(valor);
    }
  };

  const handleDataPlanejadaChange = (valor: string) => {
    setDataPlanejada(valor);
    if (prazo && valor && valor > prazo) {
      setPrazo(valor);
    }
  };

  return (
    <form action={acaoFormulario} className="space-y-6">
      {tarefa && <input type="hidden" name="id" value={tarefa.id} />}

      {localizacoesLote ? (
        <>
          <input
            type="hidden"
            name="localizacoes"
            value={JSON.stringify(localizacoesLote)}
          />
          {loteId && <input type="hidden" name="lote_id" value={loteId} />}
        </>
      ) : (
        <>
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
        </>
      )}

      {estado.erro && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {estado.erro}
        </div>
      )}

      {localizacoesLote ? (
        <div className="flex items-start gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 text-sm text-azul-800">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">
              {localizacoesLote.length}{" "}
              {localizacoesLote.length === 1
                ? "localizacao selecionada"
                : "localizacoes selecionadas"}
            </p>
            <p className="text-xs text-azul-700">
              Os dados abaixo serao replicados para cada tarefa do lote, uma por
              localizacao.
            </p>
          </div>
        </div>
      ) : (
        localizacao.localizacao_tipo !== "nenhuma" && (
          <ResumoLocalizacao localizacao={localizacao} />
        )
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
        {isNovaTarefa && obraIdInicial ? (
          // Select desabilitado nao envia valor: o hidden garante o obra_id.
          <div>
            <input type="hidden" name="obra_id" value={obraIdInicial} />
            <Selecao
              rotulo="Obra"
              obrigatorio
              name="obra_id_desabilitado"
              value={obraIdInicial}
              disabled
              dica="Obra pré-selecionada automaticamente."
            >
              {obras.map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.nome}
                </option>
              ))}
            </Selecao>
          </div>
        ) : (
          <Selecao
            rotulo="Obra"
            obrigatorio
            name="obra_id"
            value={obraId}
            onChange={(e) => mudarObra(e.target.value)}
          >
            <option value="">Selecione a obra</option>
            {obras.map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.nome}
              </option>
            ))}
          </Selecao>
        )}
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
          rotulo="Executor"
          name="executor_id"
          value={executorId}
          onChange={(e) => setExecutorId(e.target.value)}
          dica="Pessoa que executa a tarefa, sem necessidade de cadastro."
        >
          <option value="">Sem executor definido</option>
          {executoresDaObra.map((executor) => (
            <option key={executor.id} value={executor.id}>
              {executor.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Supervisor"
          name="supervisor_id"
          defaultValue={tarefa?.supervisor_id ?? ""}
          dica="Usuario cadastrado que valida e aprova a execucao."
        >
          <option value="">Sem supervisor</option>
          {supervisores.map((perfil) => (
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
          value={prazo}
          onChange={(e) => handlePrazoChange(e.target.value)}
          min={prazoMin}
          dica="Data limite para conclusao."
        />
        <Campo
          rotulo="Data planejada"
          name="data_planejada"
          type="date"
          value={dataPlanejada}
          onChange={(e) => handleDataPlanejadaChange(e.target.value)}
          min={isNovaTarefa ? hoje : undefined}
          max={prazo || undefined}
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
        <BotaoEnviar
          rotulo={
            localizacoesLote
              ? `Criar ${localizacoesLote.length} ${
                  localizacoesLote.length === 1 ? "tarefa" : "tarefas"
                }`
              : tarefa
                ? "Salvar alteracoes"
                : "Criar tarefa"
          }
        />
      </div>
    </form>
  );
}
