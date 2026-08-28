import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BarraLateral } from "@/components/layout/barra-lateral";
import { Cabecalho } from "@/components/layout/cabecalho";
import type { PerfilRow } from "@/lib/supabase/database.types";

async function buscarPerfil() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  return perfil as PerfilRow | null;
}

export default async function ProtegidoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await buscarPerfil();

  if (!perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aviso-fundo text-aviso mb-6">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-superficie-900">
            Perfil nao encontrado
          </h1>
          <p className="mt-3 text-superficie-600 leading-relaxed">
            Sua conta foi criada, mas seu perfil ainda nao foi configurado. Aguarde
            a ativacao ou entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-fundo">
      <BarraLateral papel={perfil.papel} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <Cabecalho perfil={perfil} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
