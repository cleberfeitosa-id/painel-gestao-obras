"use client";

import { sair } from "@/app/login/acoes";
import { Avatar } from "@/components/ui/avatar";
import { LogoVasconcelos } from "@/components/ui";
import { PAPEL_USUARIO } from "@/lib/domain/rotulos";
import type { PerfilRow } from "@/lib/supabase/database.types";

interface CabecalhoProps {
  perfil: PerfilRow;
}

export function Cabecalho({ perfil }: CabecalhoProps) {
  const papelRotulo = PAPEL_USUARIO[perfil.papel]?.rotulo ?? perfil.papel;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-borda bg-white/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
      <div className="lg:hidden flex items-center pl-12">
        <LogoVasconcelos variante="horizontal" className="h-6 w-auto" />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-superficie-900">
            {perfil.nome}
          </p>
          <p className="text-xs text-superficie-500">{papelRotulo}</p>
        </div>
        <Avatar nome={perfil.nome} tamanho="md" />

        <form action={sair}>
          <button
            type="submit"
            className="ml-2 rounded-lg px-3 py-1.5 text-sm font-medium text-superficie-500 hover:text-superficie-700 hover:bg-superficie-100 transition-colors"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
