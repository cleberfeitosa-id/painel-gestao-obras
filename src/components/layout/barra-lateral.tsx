"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HardHat,
  CheckSquare,
  Calendar,
  FileText,
  Users,
  Building2,
  Ruler,
  Boxes,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PapelUsuario } from "@/lib/supabase/database.types";

interface BarraLateralProps {
  papel: PapelUsuario;
}

export function BarraLateral({ papel }: BarraLateralProps) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const obraMatch = pathname.match(/^\/obras\/([^/]+)/);
  const obraId = obraMatch?.[1] ?? null;

  const itensNavegacao = [
    { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
    { href: "/obras", rotulo: "Obras", icone: HardHat },
    {
      href: obraId ? `/obras/${obraId}/medicoes` : "/obras",
      chave: "medicoes",
      rotulo: "Medições",
      icone: Ruler,
    },
    {
      href: obraId ? `/levantamento?obra=${obraId}` : "/levantamento",
      chave: "levantamento",
      rotulo: "Levantamento",
      icone: Boxes,
    },
    {
      href: obraId ? `/obras/${obraId}/quadros` : "/obras",
      chave: "quadros",
      rotulo: "Quadros",
      icone: Layers,
    },
    { href: "/plantas", rotulo: "Plantas", icone: FileText },
    { href: "/tarefas", rotulo: "Tarefas", icone: CheckSquare },
    { href: "/calendario", rotulo: "Calendário", icone: Calendar },
    { href: "/relatorios", rotulo: "Relatórios", icone: FileText },
  ];

  function estaAtivo(href: string) {
    if (
      href === "/obras" &&
      (pathname.includes("/medicoes") || pathname.includes("/levantamento") || pathname.includes("/quadros"))
    )
      return false;
    if (href.startsWith("/levantamento") && pathname.startsWith("/levantamento"))
      return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const itens = [
    ...itensNavegacao,
    ...(papel === "admin"
      ? [{ href: "/usuarios", rotulo: "Usuários", icone: Users }]
      : []),
  ];

  const conteudoNavegacao = (
    <nav className="flex flex-1 flex-col px-2 py-3">
      <div className="flex items-center gap-2 px-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-azul-600">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-superficie-900 truncate">
            Vasconcelos
          </p>
          <p className="text-xs text-superficie-500 -mt-0.5">Engenharia</p>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {itens.map((item) => {
          const Icone = item.icone;
          const ativo = estaAtivo(item.href);
          const key = "chave" in item ? item.chave : item.href;

          return (
            <li key={key}>
              <Link
                href={item.href}
                onClick={() => setAberto(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-azul-50 text-azul-700"
                    : "text-superficie-600 hover:bg-superficie-100 hover:text-superficie-900",
                )}
              >
                <Icone className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-superficie-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-36 flex-col bg-white border-r border-borda transition-transform duration-200 ease-in-out",
          "lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-end p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="rounded-lg p-1.5 text-superficie-400 hover:text-superficie-600 hover:bg-superficie-100"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {conteudoNavegacao}
      </aside>

      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed top-4 left-4 z-30 rounded-lg bg-white border border-borda p-2 text-superficie-600 shadow-sm hover:bg-superficie-50 lg:hidden"
        aria-label="Abrir menu"
        data-menu-trigger
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>
    </>
  );
}
