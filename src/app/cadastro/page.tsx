"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, Info } from "lucide-react";
import { z } from "zod";
import { cadastrar } from "../login/acoes";
import { Botao, Campo } from "@/components/ui";

const esquemaCadastro = z
  .object({
    nome: z.string().min(1, "Nome e obrigatorio."),
    email: z.string().min(1, "E-mail e obrigatorio.").email("E-mail invalido."),
    telefone: z.string().optional(),
    cargo: z.string().optional(),
    senha: z
      .string()
      .min(1, "Senha e obrigatoria.")
      .min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmar_senha: z.string().min(1, "Confirme sua senha."),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: "As senhas nao coincidem.",
    path: ["confirmar_senha"],
  });

type ErrosZod = Record<string, string>;

function validarFormulario(fd: FormData): ErrosZod {
  const resultado = esquemaCadastro.safeParse({
    nome: String(fd.get("nome") ?? ""),
    email: String(fd.get("email") ?? ""),
    telefone: String(fd.get("telefone") ?? "") || undefined,
    cargo: String(fd.get("cargo") ?? "") || undefined,
    senha: String(fd.get("senha") ?? ""),
    confirmar_senha: String(fd.get("confirmar_senha") ?? ""),
  });
  if (resultado.success) return {};
  const erros: ErrosZod = {};
  for (const issue of resultado.error.issues) {
    const campo = String(issue.path[0] ?? "");
    if (campo && !erros[campo]) erros[campo] = issue.message;
  }
  return erros;
}

export default function CadastroPage() {
  const [estado, enviar, submetendo] = useActionState(
    async (prev: { erro?: string; sucesso?: boolean; erros?: ErrosZod }, fd: FormData) => {
      const erros = validarFormulario(fd);
      if (Object.keys(erros).length > 0) {
        return { ...prev, erros };
      }
      return cadastrar(prev, fd);
    },
    {},
  );

  const erros = (estado as { erros?: ErrosZod })?.erros ?? {};

  if ("sucesso" in estado && estado.sucesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sucesso-fundo text-sucesso mb-6">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-superficie-900">
            Confirme seu e-mail
          </h1>
          <p className="mt-3 text-superficie-600 leading-relaxed">
            Enviamos um link de confirmacao para o seu endereco de e-mail.
            Clique no link para ativar sua conta e acessar o painel.
          </p>
          <p className="mt-2 text-sm text-superficie-500">
            Nao esqueca de verificar a pasta de spam.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-azul-600 hover:text-azul-700"
          >
            Voltar para o login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-azul-800">
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
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">Vasconcelos</p>
              <p className="text-sm text-azul-200 -mt-0.5">Engenharia</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold leading-tight max-w-md">
            Junte-se a equipe
          </h1>
          <p className="mt-4 text-azul-200 max-w-md leading-relaxed">
            Crie sua conta para acessar o sistema de gestao de obras. O primeiro
            usuario a se cadastrar sera automaticamente o administrador.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2 lg:hidden mb-8">
            <Building2 className="h-6 w-6 text-azul-600" />
            <span className="font-bold text-superficie-900">
              Vasconcelos Engenharia
            </span>
          </div>

          <h2 className="text-2xl font-bold text-superficie-900">
            Solicitar acesso
          </h2>
          <p className="mt-2 text-sm text-superficie-500">
            Preencha seus dados para criar sua conta.
          </p>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-info-fundo border border-info/20 px-4 py-3">
            <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
            <p className="text-xs text-superficie-600 leading-relaxed">
              O primeiro usuario a se cadastrar recebera automaticamente o papel
              de <strong>Administrador</strong> do sistema.
            </p>
          </div>

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
              rotulo="Nome completo"
              name="nome"
              obrigatorio
              autoComplete="name"
              placeholder="Seu nome"
              erro={erros.nome}
            />

            <Campo
              rotulo="E-mail"
              name="email"
              type="email"
              obrigatorio
              autoComplete="email"
              placeholder="voce@empresa.com"
              erro={erros.email}
            />

            <Campo
              rotulo="Telefone"
              name="telefone"
              type="tel"
              dica="Opcional"
              autoComplete="tel"
              placeholder="(85) 99999-0000"
              erro={erros.telefone}
            />

            <Campo
              rotulo="Cargo"
              name="cargo"
              dica="Opcional"
              placeholder="Engenheiro, Tecnico..."
              erro={erros.cargo}
            />

            <Campo
              rotulo="Senha"
              name="senha"
              type="password"
              obrigatorio
              autoComplete="new-password"
              placeholder="Minimo 6 caracteres"
              erro={erros.senha}
            />

            <Campo
              rotulo="Confirmar senha"
              name="confirmar_senha"
              type="password"
              obrigatorio
              autoComplete="new-password"
              placeholder="Repita a senha"
              erro={erros.confirmar_senha}
            />

            <Botao
              type="submit"
              variante="primario"
              tamanho="lg"
              carregando={submetendo}
              className="w-full"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Botao>
          </form>

          <p className="mt-8 text-center text-sm text-superficie-500">
            Ja tem uma conta?{" "}
            <Link
              href="/login"
              className="font-medium text-azul-600 hover:text-azul-700 transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
