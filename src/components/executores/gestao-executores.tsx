"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import {
  Botao,
  Campo,
  Modal,
  Etiqueta,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
  EstadoVazio,
} from "@/components/ui";
import {
  criarExecutor,
  atualizarExecutor,
  alternarAtivoExecutor,
} from "@/app/(protegido)/obras/[id]/executores/acoes";
import type { ExecutorRow } from "@/lib/supabase/database.types";

interface GestaoExecutoresProps {
  obraId: string;
  executores: ExecutorRow[];
}

export function GestaoExecutores({ obraId, executores }: GestaoExecutoresProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ExecutorRow | null>(null);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setContato("");
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(executor: ExecutorRow) {
    setEditando(executor);
    setNome(executor.nome);
    setContato(executor.contato ?? "");
    setErro(null);
    setModalAberto(true);
  }

  function salvar() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = editando
        ? await atualizarExecutor({ id: editando.id, nome, contato })
        : await criarExecutor({ obraId, nome, contato });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setModalAberto(false);
      }
    });
  }

  function alternar(executor: ExecutorRow) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await alternarAtivoExecutor(executor.id);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-superficie-500">
          {executores.length}{" "}
          {executores.length === 1 ? "executor cadastrado" : "executores cadastrados"}
        </p>
        <Botao type="button" onClick={abrirNovo} tamanho="sm">
          <Plus className="h-4 w-4" />
          Novo executor
        </Botao>
      </div>

      {erro && (
        <p className="text-sm text-perigo" role="alert">
          {erro}
        </p>
      )}

      {executores.length === 0 ? (
        <EstadoVazio
          icone={<Users className="h-8 w-8" />}
          titulo="Nenhum executor cadastrado"
          descricao="Cadastre pessoas que executam tarefas desta obra sem precisar de conta."
        />
      ) : (
        <Tabela>
          <Cabecalho>
            <LinhaCabecalho>
              <CelulaCabecalho>Nome</CelulaCabecalho>
              <CelulaCabecalho>Contato</CelulaCabecalho>
              <CelulaCabecalho>Situação</CelulaCabecalho>
              <CelulaCabecalho className="text-right">Ações</CelulaCabecalho>
            </LinhaCabecalho>
          </Cabecalho>
          <Corpo>
            {executores.map((executor) => (
              <Linha key={executor.id}>
                <Celula className="font-medium text-superficie-900">
                  {executor.nome}
                </Celula>
                <Celula>{executor.contato || "—"}</Celula>
                <Celula>
                  {executor.ativo ? (
                    <Etiqueta className="bg-emerald-100 text-emerald-800 ring-emerald-600/25">
                      Ativo
                    </Etiqueta>
                  ) : (
                    <Etiqueta className="bg-slate-100 text-slate-700 ring-slate-600/20">
                      Inativo
                    </Etiqueta>
                  )}
                </Celula>
                <Celula className="text-right">
                  <div className="flex justify-end gap-2">
                    <Botao
                      type="button"
                      variante="contorno"
                      tamanho="sm"
                      onClick={() => abrirEdicao(executor)}
                      disabled={pendente}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Botao>
                    <Botao
                      type="button"
                      variante={executor.ativo ? "fantasma" : "secundario"}
                      tamanho="sm"
                      onClick={() => alternar(executor)}
                      disabled={pendente}
                    >
                      {executor.ativo ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      {executor.ativo ? "Desativar" : "Reativar"}
                    </Botao>
                  </div>
                </Celula>
              </Linha>
            ))}
          </Corpo>
        </Tabela>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={editando ? "Editar executor" : "Novo executor"}
        descricao="Pessoa que executa tarefas desta obra sem precisar de cadastro."
      >
        <div className="space-y-4">
          <Campo
            rotulo="Nome"
            obrigatorio
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: José Carlos da Silva"
          />
          <Campo
            rotulo="Contato"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder="Telefone ou e-mail (opcional)"
          />
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setModalAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              onClick={salvar}
              carregando={pendente}
              disabled={!nome.trim()}
            >
              {editando ? "Salvar alterações" : "Cadastrar"}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}