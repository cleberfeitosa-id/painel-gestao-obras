"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Botao, Campo, AreaTexto, Selecao } from "@/components/ui";
import { OPCOES_STATUS_OBRA } from "@/lib/domain/rotulos";
import type { ObraRow, PerfilRow } from "@/lib/supabase/database.types";

type ResultadoFormulario = { erro?: string };

interface FormularioObraProps {
  acao: (
    estadoAnterior: ResultadoFormulario,
    formData: FormData,
  ) => Promise<ResultadoFormulario>;
  responsaveis: PerfilRow[];
  obra?: ObraRow;
}

function BotaoEnviar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      {rotulo}
    </Botao>
  );
}

export function FormularioObra({
  acao,
  responsaveis,
  obra,
}: FormularioObraProps) {
  const [estado, acaoFormulario] = useActionState(acao, {});

  return (
    <form action={acaoFormulario} className="space-y-6">
      {obra && <input type="hidden" name="id" value={obra.id} />}

      {estado.erro && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo"
        >
          {estado.erro}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          rotulo="Nome da obra"
          obrigatorio
          name="nome"
          defaultValue={obra?.nome ?? ""}
          placeholder="Ex.: Residencial Jardim das Flores"
        />
        <Campo
          rotulo="Codigo"
          name="codigo"
          defaultValue={obra?.codigo ?? ""}
          placeholder="Ex.: OB-2026-001"
          dica="Codigo interno opcional e unico."
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          rotulo="Cliente"
          name="cliente"
          defaultValue={obra?.cliente ?? ""}
          placeholder="Ex.: Construtora Alfa"
        />
        <Selecao
          rotulo="Status"
          obrigatorio
          name="status"
          defaultValue={obra?.status ?? "planejamento"}
        >
          {OPCOES_STATUS_OBRA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </Selecao>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Campo
          rotulo="Endereco"
          name="endereco"
          defaultValue={obra?.endereco ?? ""}
          placeholder="Rua, numero, bairro"
          className="sm:col-span-2"
        />
        <Campo
          rotulo="Cidade"
          name="cidade"
          defaultValue={obra?.cidade ?? ""}
          placeholder="Ex.: Fortaleza"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Campo
          rotulo="Estado"
          name="estado"
          defaultValue={obra?.estado ?? ""}
          placeholder="CE"
          maxLength={2}
        />
        <Campo
          rotulo="Data de inicio"
          name="data_inicio"
          type="date"
          defaultValue={obra?.data_inicio ?? ""}
        />
        <Campo
          rotulo="Previsao de termino"
          name="data_prevista_fim"
          type="date"
          defaultValue={obra?.data_prevista_fim ?? ""}
        />
      </div>

      <Selecao
        rotulo="Responsavel"
        name="responsavel_id"
        defaultValue={obra?.responsavel_id ?? ""}
        dica="Responsavel tecnico pela obra."
      >
        <option value="">Sem responsavel</option>
        {responsaveis.map((perfil) => (
          <option key={perfil.id} value={perfil.id}>
            {perfil.nome}
          </option>
        ))}
      </Selecao>

      <AreaTexto
        rotulo="Descricao"
        name="descricao"
        defaultValue={obra?.descricao ?? ""}
        placeholder="Detalhes, escopo e observacoes da obra."
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <BotaoEnviar rotulo={obra ? "Salvar alteracoes" : "Criar obra"} />
      </div>
    </form>
  );
}
