"use client";

import { useActionState } from "react";
import { KeyRound, ArrowRight } from "lucide-react";
import { definirSenha } from "./acoes";
import { Botao, Campo } from "@/components/ui";

export default function DefinirSenhaPage() {
  const [estado, enviar, submetendo] = useActionState(definirSenha, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-6">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-borda bg-fundo-card shadow-sm p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-azul-100 text-azul-600 mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-bold text-superficie-900">
            Definir senha
          </h1>
          <p className="mt-2 text-center text-sm text-superficie-500">
            Defina uma senha para acessar o painel.
          </p>

          <form action={enviar} className="mt-6 space-y-4">
            {estado?.erro && (
              <div
                className="rounded-lg bg-perigo-fundo border border-perigo/20 px-4 py-3 text-sm text-perigo"
                role="alert"
              >
                {estado.erro}
              </div>
            )}

            <Campo
              rotulo="Senha"
              name="senha"
              type="password"
              obrigatorio
              autoComplete="new-password"
              placeholder="Minimo 6 caracteres"
            />

            <Campo
              rotulo="Confirmar senha"
              name="confirmar_senha"
              type="password"
              obrigatorio
              autoComplete="new-password"
              placeholder="Repita a senha"
            />

            <Botao
              type="submit"
              variante="primario"
              tamanho="lg"
              carregando={submetendo}
              className="w-full"
            >
              Ativar conta
              <ArrowRight className="h-4 w-4" />
            </Botao>
          </form>
        </div>
      </div>
    </div>
  );
}