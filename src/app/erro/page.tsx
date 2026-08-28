import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Botao } from "@/components/ui";

export default function ErroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aviso-fundo text-aviso mb-6">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-superficie-900">
          Algo deu errado
        </h1>
        <p className="mt-3 text-superficie-600 leading-relaxed">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o
          administrador do sistema.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login">
            <Botao variante="contorno">Voltar ao login</Botao>
          </Link>
          <Link href="/painel">
            <Botao variante="primario">Ir para o painel</Botao>
          </Link>
        </div>
      </div>
    </div>
  );
}
