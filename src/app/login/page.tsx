"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { entrar } from "./acoes";
import { Botao, Campo, LogoVasconcelos } from "@/components/ui";

function FormularioLogin() {
  const searchParams = useSearchParams();
  const redirecionar = searchParams.get("redirecionar") ?? "/painel";

  const [estado, enviar, submetendo] = useActionState(entrar, {});

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-grafite-900">
        <div className="absolute inset-0 bg-radial-[at_top_left] from-marca-500/20 via-transparent to-transparent opacity-80" />
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.05) 35px, rgba(255,255,255,0.05) 36px)",
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-10">
            <LogoVasconcelos
              variante="completa"
              tema="negativo"
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold leading-tight max-w-md">
            Painel de Gestao de Obras
          </h1>
          <p className="mt-4 text-white/80 max-w-md leading-relaxed">
            Gerencie suas obras, tarefas e equipes em tempo real. Acompanhe o
            progresso de cada projeto diretamente do canteiro de obras.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { valor: "100%", rotulo: "Visibilidade" },
              { valor: "Tempo real", rotulo: "Atualizacoes" },
              { valor: "A4", rotulo: "Relatorios" },
            ].map((item) => (
              <div key={item.rotulo} className="text-center">
                <p className="text-2xl font-bold text-white">{item.valor}</p>
                <p className="text-xs text-marca-200 mt-1">{item.rotulo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex justify-center lg:hidden mb-8">
            <LogoVasconcelos variante="completa" className="h-16 w-auto" />
          </div>

          <h2 className="text-2xl font-bold text-superficie-900">
            Entrar no painel
          </h2>
          <p className="mt-2 text-sm text-superficie-500">
            Acesse sua conta para gerenciar suas obras.
          </p>

          <form action={enviar} className="mt-8 space-y-5">
            <input type="hidden" name="redirecionar" value={redirecionar} />

            {estado?.erro && (
              <div
                className="rounded-lg bg-perigo-fundo border border-perigo/20 px-4 py-3 text-sm text-perigo"
                role="alert"
              >
                {estado.erro}
              </div>
            )}

            <Campo
              rotulo="E-mail"
              name="email"
              type="email"
              obrigatorio
              autoComplete="email"
              placeholder="voce@empresa.com"
            />

            <Campo
              rotulo="Senha"
              name="senha"
              type="password"
              obrigatorio
              autoComplete="current-password"
              placeholder="Sua senha"
            />

            <Botao
              type="submit"
              variante="primario"
              tamanho="lg"
              carregando={submetendo}
              className="w-full"
            >
              Entrar
              <ArrowRight className="h-4 w-4" />
            </Botao>
          </form>

          <p className="mt-8 text-center text-sm text-superficie-500">
            Ainda nao tem conta?{" "}
            <Link
              href="/cadastro"
              className="font-medium text-azul-600 hover:text-azul-700 transition-colors"
            >
              Solicitar acesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams exige um componente suspenso durante o prerender estatico;
  // sem a fronteira Suspense o build falha com "missing suspense with csr bailout".
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
