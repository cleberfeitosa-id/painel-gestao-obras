"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Botao, Campo, AreaTexto, Selecao } from "@/components/ui";
import { criarTag } from "@/app/(protegido)/tarefas/acoes";
import { OPCOES_STATUS_TAREFA, OPCOES_PRIORIDADE } from "@/lib/domain/rotulos";
import { hojeChave } from "@/lib/datas";
import type {
  ExecutorRow,
  ObraRow,
  PerfilRow,
  TarefaRow,
} from "@/lib/supabase/database.types";

export type CatalogoComMedicao = {
  id: string;
  nome: string;
  unidade: string;
  medicoes: { id: string; titulo: string; obra_id: string };
};

type MedicaoItem = { catalogo_id: string; quantidade: number };

type ResultadoFormulario = { erro?: string };

export type LocalizacaoInicial = {
  localizacao_tipo: "nenhuma" | "ponto" | "regiao" | "distancia" | "circuito" | "area" | "descida";
  planta_id?: string;
  pagina?: number;
  ponto_x?: number;
  ponto_y?: number;
  regiao?: { vertices: { x: number; y: number }[] };
  levantamento_id?: string;
  localizacao_detalhe?: Record<string, unknown>;
};

export type LocalizacaoLote = {
  localizacao_tipo:
    | "ponto"
    | "regiao"
    | "distancia"
    | "circuito"
    | "area"
    | "descida"
    | "nenhuma";
  planta_id: string;
  pagina: number;
  ponto_x?: number;
  ponto_y?: number;
  regiao?: { vertices: { x: number; y: number }[] };
  localizacao_detalhe?: Record<string, unknown>;
  levantamento_id?: string;
  descricao_especifica?: string;
  comprimento?: number;
  area?: number;
  quantidade?: number;
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
  tags?: { id: string; nome: string }[];
  titulosExistentes?: string[];
  tarefa?: TarefaRow;
  localizacaoInicial?: LocalizacaoInicial;
  localizacoesLote?: LocalizacaoLote[];
  obraIdInicial?: string;
  tituloInicial?: string;
  descricaoInicial?: string;
  loteId?: string;
  catalogoPrecos?: CatalogoComMedicao[];
  medicoes?: MedicaoItem[];
}

function BotaoEnviar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      {rotulo}
    </Botao>
  );
}

function ResumoLocalizacao({
  localizacao,
  tarefaId,
  obraId,
}: {
  localizacao: LocalizacaoInicial;
  tarefaId?: string;
  obraId?: string;
}) {
  if (localizacao.localizacao_tipo === "nenhuma") return null;

  const pagina = localizacao.pagina ? `página ${localizacao.pagina}` : "";
  let detalhe = "";

  if (localizacao.localizacao_tipo === "ponto") {
    detalhe = `Ponto (x: ${localizacao.ponto_x?.toFixed(2)}, y: ${localizacao.ponto_y?.toFixed(2)})`;
  } else if (localizacao.localizacao_tipo === "regiao") {
    detalhe = `Região com ${localizacao.regiao?.vertices.length ?? 0} vértices`;
  } else if (localizacao.localizacao_tipo === "distancia") {
    const comp = localizacao.localizacao_detalhe?.comprimento;
    detalhe = `Distância linear: ${typeof comp === "number" ? `${comp.toFixed(2)} m` : "Trecho medido"}`;
  } else if (localizacao.localizacao_tipo === "circuito") {
    const circ = localizacao.localizacao_detalhe?.circuito;
    const comp = localizacao.localizacao_detalhe?.comprimento;
    detalhe = `Circuito ${circ ? `"${circ}"` : ""} (${typeof comp === "number" ? `${comp.toFixed(2)} m` : ""})`;
  } else if (localizacao.localizacao_tipo === "area") {
    const ar = localizacao.localizacao_detalhe?.area;
    detalhe = `Área medida: ${typeof ar === "number" ? `${ar.toFixed(2)} m²` : "Polígono delimitado"}`;
  } else if (localizacao.localizacao_tipo === "descida") {
    const comp = localizacao.localizacao_detalhe?.comprimento;
    detalhe = `Descida/Subida (${typeof comp === "number" ? `${comp.toFixed(2)} m` : "trecho vertical"})`;
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 text-sm text-azul-800">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <p className="font-medium">Localização vinculada à planta / levantamento</p>
          <p className="text-xs text-azul-700">
            {detalhe}
            {pagina ? ` - ${pagina}` : ""}
          </p>
        </div>
      </div>
      {tarefaId && localizacao.planta_id && obraId && (
        <a
          href={`/obras/${obraId}/plantas/${localizacao.planta_id}?associar=${tarefaId}`}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-azul-300 bg-white px-2 py-1 text-xs font-medium text-azul-700 hover:bg-azul-50 transition-colors"
          title="Abrir planta para editar a localização visualmente"
        >
          <MapPin className="h-3 w-3" />
          <span>Editar no mapa</span>
        </a>
      )}
    </div>
  );
}

export function FormularioTarefa({
  acao,
  obras,
  responsaveis,
  executores,
  supervisores,
  tags,
  titulosExistentes,
  tarefa,
  localizacaoInicial,
  localizacoesLote,
  obraIdInicial,
  tituloInicial,
  descricaoInicial,
  loteId,
  catalogoPrecos,
  medicoes,
}: FormularioTarefaProps) {
  const [estado, acaoFormulario] = useActionState(acao, {});
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? (tarefa ? "" : hojeChave()));
  const [dataPlanejada, setDataPlanejada] = useState(
    tarefa?.data_planejada ?? (tarefa ? "" : hojeChave())
  );
  // Data de inicio/fim do gantt: preenchidas automaticamente a partir de
  // dataPlanejada/prazo nas versoes iniciais, mas sobrescritas pelo usuario
  // se ele editar manualmente (ganttManual impede o auto-sync posterior).
  const ganttManual = useRef(
    Boolean(tarefa?.data_inicio || tarefa?.data_fim),
  );
  const [dataInicio, setDataInicio] = useState(
    tarefa?.data_inicio ?? tarefa?.data_planejada ?? ""
  );
  const [dataFim, setDataFim] = useState(
    tarefa?.data_fim ?? tarefa?.prazo ?? ""
  );
  const [obraId, setObraId] = useState(tarefa?.obra_id ?? obraIdInicial ?? "");
  const [executorId, setExecutorId] = useState(tarefa?.executor_id ?? "");
  
  const [listaTags, setListaTags] = useState(tags ?? []);
  const [tagSelecionada, setTagSelecionada] = useState(tarefa?.tag_id ?? "");
  const [criandoTag, setCriandoTag] = useState(false);

  const [medicoesLista, setMedicoesLista] = useState<MedicaoItem[]>(medicoes ?? []);

  const isNovaTarefa = !tarefa;
  const hoje = hojeChave();

  const titulosUnicos = titulosExistentes
    ? Array.from(new Set(titulosExistentes)).sort((a, b) => a.localeCompare(b))
    : [];

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
    localizacao_tipo: (tarefa?.localizacao_tipo as LocalizacaoInicial["localizacao_tipo"]) ?? "nenhuma",
    planta_id: tarefa?.planta_id ?? undefined,
    pagina: tarefa?.pagina ?? undefined,
    ponto_x: tarefa?.ponto_x ?? undefined,
    ponto_y: tarefa?.ponto_y ?? undefined,
    regiao: (tarefa?.regiao as { vertices: { x: number; y: number }[] } | null) ?? undefined,
    levantamento_id: tarefa?.levantamento_id ?? undefined,
    localizacao_detalhe: (tarefa?.localizacao_detalhe as Record<string, unknown> | null) ?? undefined,
  };

  const handlePrazoChange = (valor: string) => {
    setPrazo(valor);
    if (!ganttManual.current) setDataFim(valor);
    if (dataPlanejada && valor && dataPlanejada > valor) {
      setDataPlanejada(valor);
    }
  };

  const handleDataPlanejadaChange = (valor: string) => {
    setDataPlanejada(valor);
    if (!ganttManual.current) setDataInicio(valor);
    if (prazo && valor && valor > prazo) {
      setPrazo(valor);
    }
  };

  const handleDataInicioChange = (valor: string) => {
    ganttManual.current = true;
    setDataInicio(valor);
    if (dataFim && valor && valor > dataFim) setDataFim(valor);
  };

  const handleDataFimChange = (valor: string) => {
    ganttManual.current = true;
    setDataFim(valor);
  };

  const handleCriarTag = async () => {
    const nome = window.prompt("Digite o nome da nova tag:");
    if (!nome?.trim()) return;

    setCriandoTag(true);
    const resultado = await criarTag(nome);
    setCriandoTag(false);

    if ("erro" in resultado) {
      alert(resultado.erro);
      return;
    }

    setListaTags((atual) => [...atual, { id: resultado.id, nome: resultado.nome }].sort((a, b) => a.nome.localeCompare(b.nome)));
    setTagSelecionada(resultado.id);
  };

  const catalogoDaObra = catalogoPrecos?.filter((item) => item.medicoes.obra_id === obraId) ?? [];

  const catalogoPorMedicao = catalogoDaObra.reduce<Record<string, CatalogoComMedicao[]>>((acc, item) => {
    const chave = item.medicoes.titulo ?? "Sem medicao";
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(item);
    return acc;
  }, {});

  function adicionarMedicao() {
    setMedicoesLista((atual) => [...atual, { catalogo_id: "", quantidade: 0 }]);
  }

  function removerMedicao(indice: number) {
    setMedicoesLista((atual) => atual.filter((_, i) => i !== indice));
  }

  function atualizarMedicao(indice: number, campo: keyof MedicaoItem, valor: string | number) {
    setMedicoesLista((atual) =>
      atual.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item,
      ),
    );
  }

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
          <input
            type="hidden"
            name="levantamento_id"
            value={localizacao.levantamento_id ?? ""}
          />
          <input
            type="hidden"
            name="localizacao_detalhe"
            value={
              localizacao.localizacao_detalhe
                ? JSON.stringify(localizacao.localizacao_detalhe)
                : ""
            }
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
          <div className="space-y-1">
            <p className="font-medium">
              {localizacoesLote.length}{" "}
              {localizacoesLote.length === 1
                ? "localização selecionada"
                : "localizações selecionadas"}
            </p>
            <p className="text-xs text-azul-700">
              Todas as tarefas geradas terão o mesmo título definido abaixo e serão distintas apenas pela sua descrição com os dados individuais de cada segmento (comprimento, circuito, condutores, área).
            </p>
            {localizacoesLote.some(
              (l) => l.comprimento || l.localizacao_detalhe?.comprimento,
            ) && (
              <p className="text-xs font-semibold text-azul-800">
                Comprimento total dos trechos:{" "}
                {localizacoesLote
                  .reduce(
                    (acc, l) =>
                      acc +
                      Number(
                        l.comprimento ??
                          l.localizacao_detalhe?.comprimento ??
                          0,
                      ),
                    0,
                  )
                  .toFixed(2)}
                m
              </p>
            )}
            {localizacoesLote.some(
              (l) => l.area || l.localizacao_detalhe?.area,
            ) && (
              <p className="text-xs font-semibold text-azul-800">
                Área total medida:{" "}
                {localizacoesLote
                  .reduce(
                    (acc, l) =>
                      acc +
                      Number(
                        l.area ??
                          l.localizacao_detalhe?.area ??
                          0,
                      ),
                    0,
                  )
                  .toFixed(2)}
                m²
              </p>
            )}
          </div>
        </div>
      ) : (
        localizacao.localizacao_tipo !== "nenhuma" && (
          <ResumoLocalizacao
            localizacao={localizacao}
            tarefaId={tarefa?.id}
            obraId={tarefa?.obra_id ?? obraId}
          />
        )
      )}

      <Campo
        rotulo="Titulo"
        obrigatorio
        name="titulo"
        defaultValue={tarefa?.titulo ?? tituloInicial ?? ""}
        placeholder="Ex.: Instalar rede hidraulica"
        list="titulos-existentes"
        autoComplete="off"
        dica={
          titulosUnicos.length > 0
            ? "Sugestoes de titulos ja cadastrados aparecem ao digitar."
            : undefined
        }
      />
      {titulosUnicos.length > 0 && (
        <datalist id="titulos-existentes">
          {titulosUnicos.map((titulo) => (
            <option key={titulo} value={titulo} />
          ))}
        </datalist>
      )}

      <AreaTexto
        rotulo="Descricao"
        name="descricao"
        defaultValue={tarefa?.descricao ?? descricaoInicial ?? ""}
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
        <Selecao
          rotulo="Tag"
          name="tag_id"
          value={tagSelecionada}
          onChange={(e) => setTagSelecionada(e.target.value)}
          dica="Agrupe tarefas usando tags."
        >
          <option value="">Sem tag</option>
          {listaTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.nome}
            </option>
          ))}
        </Selecao>
        <div className="flex items-end pb-7">
          <Botao type="button" variante="secundario" onClick={handleCriarTag} carregando={criandoTag}>
            Nova tag
          </Botao>
        </div>
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

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          rotulo="Data de inicio"
          name="data_inicio"
          type="date"
          value={dataInicio}
          onChange={(e) => handleDataInicioChange(e.target.value)}
          dica="Inicio do intervalo no gantt."
        />
        <Campo
          rotulo="Data de fim"
          name="data_fim"
          type="date"
          value={dataFim}
          onChange={(e) => handleDataFimChange(e.target.value)}
          min={dataInicio || undefined}
          dica="Fim do intervalo no gantt."
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

      {catalogoDaObra.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-superficie-700">
            Medicoes
          </legend>
          <p className="mt-0.5 text-xs text-superficie-500">
            Registre os itens do catalogo e suas quantidades para esta tarefa.
          </p>
          <div className="mt-3 space-y-3">
            {medicoesLista.map((medicao, indice) => (
              <div
                key={indice}
                className="flex items-end gap-2 rounded-lg border border-borda px-3 py-2"
              >
                <Selecao
                  rotulo="Item"
                  obrigatorio
                  value={medicao.catalogo_id}
                  onChange={(e) => atualizarMedicao(indice, "catalogo_id", e.target.value)}
                  className="flex-1"
                >
                  <option value="">Selecione o item</option>
                  {Object.entries(catalogoPorMedicao).map(([medicaoTitulo, itens]) => (
                    <optgroup key={medicaoTitulo} label={medicaoTitulo}>
                      {itens.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}{item.unidade ? ` (${item.unidade})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Selecao>
                <Campo
                  rotulo="Quantidade"
                  obrigatorio
                  type="number"
                  min={0}
                  step="any"
                  value={medicao.quantidade || ""}
                  onChange={(e) => atualizarMedicao(indice, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-28"
                />
                <Botao
                  type="button"
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => removerMedicao(indice)}
                  className="mb-0.5 text-perigo hover:text-perigo"
                >
                  <Trash2 className="h-4 w-4" />
                </Botao>
              </div>
            ))}
            <Botao
              type="button"
              variante="contorno"
              tamanho="sm"
              onClick={adicionarMedicao}
            >
              <Plus className="h-4 w-4" />
              Adicionar medicao
            </Botao>
          </div>
          <input
            type="hidden"
            name="medicoes"
            value={JSON.stringify(medicoesLista.filter((m) => m.catalogo_id))}
          />
        </fieldset>
      )}

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
