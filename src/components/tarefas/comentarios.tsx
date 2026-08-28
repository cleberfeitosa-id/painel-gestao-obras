"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, MessageSquare } from "lucide-react";
import { Botao, AreaTexto, Avatar, Modal, EstadoVazio } from "@/components/ui";
import { formatarDataHora } from "@/lib/datas";
import { adicionarComentario, excluirComentario } from "@/app/(protegido)/tarefas/acoes";
import type { TarefaComentarioRow, PerfilRow } from "@/lib/supabase/database.types";

type ResultadoFormulario = { erro?: string };

interface ComentarioComAutor extends TarefaComentarioRow {
  autor: Pick<PerfilRow, "id" | "nome"> | null;
}

interface ComentariosProps {
  tarefaId: string;
  comentarios: ComentarioComAutor[];
  usuarioId: string;
  eAdmin: boolean;
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      Comentar
    </Botao>
  );
}

export function Comentarios({
  tarefaId,
  comentarios,
  usuarioId,
  eAdmin,
}: ComentariosProps) {
  const [estado, acaoFormulario] = useActionState(adicionarComentario, {});
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function confirmarExclusao() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    iniciarTransicao(async () => {
      await excluirComentario(id, tarefaId);
    });
  }

  return (
    <div className="space-y-4">
      <form action={acaoFormulario} className="space-y-3">
        <input type="hidden" name="tarefa_id" value={tarefaId} />
        <AreaTexto
          rotulo="Adicionar comentario"
          name="texto"
          placeholder="Escreva um comentario sobre a tarefa..."
        />
        {estado.erro && (
          <p className="text-xs text-perigo" role="alert">
            {estado.erro}
          </p>
        )}
        <div className="flex justify-end">
          <BotaoEnviar />
        </div>
      </form>

      {comentarios.length === 0 ? (
        <EstadoVazio
          icone={<MessageSquare className="h-8 w-8" />}
          titulo="Nenhum comentario"
          descricao="Seja o primeiro a comentar nesta tarefa."
        />
      ) : (
        <ul className="space-y-4">
          {comentarios.map((comentario) => {
            const podeExcluir =
              eAdmin || comentario.autor_id === usuarioId;
            return (
              <li
                key={comentario.id}
                className="flex gap-3 rounded-lg border border-borda p-4"
              >
                {comentario.autor ? (
                  <Avatar nome={comentario.autor.nome} tamanho="sm" />
                ) : (
                  <Avatar nome="?" tamanho="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-superficie-900">
                        {comentario.autor?.nome ?? "Usuario removido"}
                      </span>
                      <span className="text-xs text-superficie-400">
                        {formatarDataHora(comentario.criado_em)}
                      </span>
                    </div>
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => setExcluirId(comentario.id)}
                        className="rounded-lg p-1.5 text-superficie-400 hover:text-perigo hover:bg-superficie-100 transition-colors"
                        aria-label="Excluir comentario"
                        disabled={pendente}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-superficie-700">
                    {comentario.texto}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        aberto={excluirId !== null}
        aoFechar={() => setExcluirId(null)}
        titulo="Excluir comentario"
        descricao="Esta acao nao pode ser desfeita."
      >
        <div className="flex justify-end gap-3">
          <Botao
            type="button"
            variante="contorno"
            onClick={() => setExcluirId(null)}
          >
            Cancelar
          </Botao>
          <Botao type="button" variante="perigo" onClick={confirmarExclusao}>
            Excluir
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
