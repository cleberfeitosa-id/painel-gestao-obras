import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Botao, LogoAplicacao } from "@/components/ui";

const TIPOS_TOKEN = new Set(["signup", "invite", "recovery", "magiclink"]);

type ParametrosPagina = {
  token_hash?: string;
  type?: string;
  code?: string;
};

export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosPagina>;
}) {
  const parametros = await searchParams;
  const tokenHash = parametros.token_hash ?? "";
  const tipo = parametros.type ?? "";
  const code = parametros.code ?? "";
  const valido =
    (Boolean(tokenHash) && TIPOS_TOKEN.has(tipo) && !code) ||
    (Boolean(code) && !tokenHash && !tipo);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <LogoAplicacao variante="completa" className="h-16 w-auto" />
        </div>
        <div className="rounded-xl border border-borda bg-fundo-card p-8 text-center shadow-sm">
          {valido ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-azul-100 text-azul-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-superficie-900">
                Continuar acesso
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-superficie-500">
                Clique no botão abaixo para validar seu link e continuar para a
                definição da senha.
              </p>
              <form action="/auth/confirmar/validar" method="post" className="mt-6">
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value={tipo} />
                <input type="hidden" name="code" value={code} />
                <Botao type="submit" tamanho="lg" className="w-full">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Botao>
              </form>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-aviso-fundo text-aviso">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-superficie-900">
                Link inválido
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-superficie-600">
                Este link não contém os dados necessários para continuar. Solicite
                um novo link de acesso.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
