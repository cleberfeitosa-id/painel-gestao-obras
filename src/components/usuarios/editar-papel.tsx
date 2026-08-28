"use client";

import { useState, useTransition } from "react";
import { Botao, Selecao, Modal } from "@/components/ui";
import { PAPEL_USUARIO } from "@/lib/domain/rotulos";
import type { PapelUsuario } from "@/lib/supabase/database.types";
import { atualizarPapel, alternarAtivo } from "@/app/(protegido)/usuarios/acoes";

interface EditarPapelProps {
  userId: string;
  papel: PapelUsuario;
  ativo: boolean;
}

export function EditarPapel({ userId, papel, ativo }: EditarPapelProps) {
  const [papelAtual, setPapelAtual] = useState<PapelUsuario>(papel);
  const [ativoAtual, setAtivoAtual] = useState(ativo);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  function mudarPapel(novoPapel: PapelUsuario) {
    if (novoPapel === papelAtual) return;
    const anterior = papelAtual;
    setPapelAtual(novoPapel);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await atualizarPapel(userId, novoPapel);
      if (resultado.erro) {
        setPapelAtual(anterior);
        setErro(resultado.erro);
      }
    });
  }

  function desativar() {
    setConfirmarDesativar(false);
    const anterior = ativoAtual;
    setAtivoAtual(false);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await alternarAtivo(userId, false);
      if (resultado.erro) {
        setAtivoAtual(anterior);
        setErro(resultado.erro);
      }
    });
  }

  function reativar() {
    const anterior = ativoAtual;
    setAtivoAtual(true);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await alternarAtivo(userId, true);
      if (resultado.erro) {
        setAtivoAtual(anterior);
        setErro(resultado.erro);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <Selecao
          rotulo="Papel"
          value={papelAtual}
          onChange={(e) => mudarPapel(e.target.value as PapelUsuario)}
          disabled={pendente}
          className="w-44"
        >
          {Object.entries(PAPEL_USUARIO).map(([valor, opcao]) => (
            <option key={valor} value={valor}>
              {opcao.rotulo}
            </option>
          ))}
        </Selecao>
        {ativoAtual ? (
          <Botao
            type="button"
            variante="perigo"
            tamanho="sm"
            onClick={() => setConfirmarDesativar(true)}
            disabled={pendente}
          >
            Desativar
          </Botao>
        ) : (
          <Botao
            type="button"
            variante="secundario"
            tamanho="sm"
            onClick={reativar}
            disabled={pendente}
          >
            Reativar
          </Botao>
        )}
      </div>
      {erro && (
        <p className="text-xs text-perigo" role="alert">
          {erro}
        </p>
      )}

      <Modal
        aberto={confirmarDesativar}
        aoFechar={() => setConfirmarDesativar(false)}
        titulo="Desativar usuario"
        descricao="O usuario nao podera mais acessar o sistema ate ser reativado."
      >
        <div className="flex justify-end gap-3">
          <Botao
            type="button"
            variante="contorno"
            onClick={() => setConfirmarDesativar(false)}
          >
            Cancelar
          </Botao>
          <Botao type="button" variante="perigo" onClick={desativar}>
            Desativar
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
