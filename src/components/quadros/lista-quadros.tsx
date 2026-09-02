"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Cartao, CartaoConteudo, Botao, Modal, Etiqueta, EstadoVazio } from "@/components/ui";
import { excluirQuadroEletrico } from "@/app/(protegido)/obras/[id]/quadros/acoes";
import type { QuadroEletricoRow } from "@/lib/supabase/database.types";
import type { QuadroEletricoLayout } from "@/lib/quadros/tipos";

interface ListaQuadrosProps {
  obraId: string;
  obraNome: string;
  quadros: QuadroEletricoRow[];
  podeEditar: boolean;
}

export function ListaQuadros({
  obraId,
  obraNome,
  quadros,
  podeEditar,
}: ListaQuadrosProps) {
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const quadroParaExcluir = quadros.find((q) => q.id === excluirId);

  const quadrosFiltrados = quadros.filter((q) => {
    if (filtroTipo !== "todos" && q.tipo_quadro !== filtroTipo) return false;
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      const matchTag = q.tag.toLowerCase().includes(termo);
      const matchNome = (q.nome ?? "").toLowerCase().includes(termo);
      if (!matchTag && !matchNome) return false;
    }
    return true;
  });

  function confirmarExclusao() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    iniciarTransicao(async () => {
      await excluirQuadroEletrico(id, obraId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Quadros Elétricos</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Modelagem técnica de quadros de distribuição, proteção e circuitos de {obraNome}.
          </p>
        </div>
        {podeEditar && (
          <Link href={`/obras/${obraId}/quadros/novo`}>
            <Botao variante="primario">
              <Plus className="h-4 w-4" />
              Novo Quadro
            </Botao>
          </Link>
        )}
      </div>

      {quadros.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-xl border border-borda">
          <input
            type="text"
            placeholder="Buscar por tag ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="rounded-lg border border-borda px-3 py-1.5 text-xs text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500 w-full sm:w-64"
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {["todos", "QDC", "QGBT", "QDR", "QMF"].map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFiltroTipo(tipo)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filtroTipo === tipo
                    ? "bg-azul-50 text-azul-700 border border-azul-200"
                    : "text-superficie-600 hover:bg-superficie-100"
                }`}
              >
                {tipo === "todos" ? "Todos os tipos" : tipo}
              </button>
            ))}
          </div>
        </div>
      )}

      {quadros.length === 0 ? (
        <EstadoVazio
          icone={<Layers className="h-10 w-10 text-superficie-400" />}
          titulo="Nenhum quadro elétrico modelado"
          descricao="Crie o primeiro quadro elétrico desta obra para posicionar componentes em trilhos DIN, barramentos espinha de peixe e vincular circuitos."
          acao={
            podeEditar ? (
              <Link href={`/obras/${obraId}/quadros/novo`}>
                <Botao variante="primario">
                  <Plus className="h-4 w-4" />
                  Modelar Primeiro Quadro
                </Botao>
              </Link>
            ) : undefined
          }
        />
      ) : quadrosFiltrados.length === 0 ? (
        <p className="text-center py-10 text-sm text-superficie-500">
          Nenhum quadro elétrico encontrado com os filtros atuais.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quadrosFiltrados.map((q) => {
            const layout = ((q.layout || {}) as unknown) as QuadroEletricoLayout;
            const totalComponentes = layout.elementos?.length || 0;
            const totalTrilhos = layout.trilhos?.length || 0;
            const totalBarramentos = layout.barramentos?.length || 0;

            return (
              <Cartao
                key={q.id}
                className="group relative flex flex-col justify-between hover:border-azul-300 hover:shadow-md transition-all"
              >
                <CartaoConteudo className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-superficie-900 group-hover:text-azul-600 transition-colors">
                          {q.tag}
                        </span>
                        <Etiqueta className="bg-azul-50 text-azul-700 border-azul-200 text-[10px]">
                          {q.tipo_quadro}
                        </Etiqueta>
                      </div>
                      {q.nome && (
                        <p className="text-xs text-superficie-600 mt-1 truncate">
                          {q.nome}
                        </p>
                      )}
                    </div>
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => setExcluirId(q.id)}
                        className="p-1.5 rounded-lg text-superficie-400 hover:text-perigo hover:bg-superficie-100 transition-colors"
                        title="Excluir quadro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-superficie-50 p-2.5 rounded-lg border border-borda">
                    <div>
                      <span className="text-[10px] text-superficie-500 block">Dimensões LxAxP</span>
                      <span className="font-medium text-superficie-900">
                        {q.largura_mm}×{q.altura_mm}×{q.profundidade_mm}mm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-superficie-500 block">Área Útil Chapa</span>
                      <span className="font-medium text-superficie-900">
                        {q.largura_util_mm}×{q.altura_util_mm}mm
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-superficie-600 border-t border-superficie-100 pt-2.5">
                    <span>{totalComponentes} componentes</span>
                    <span>{totalTrilhos} trilhos DIN</span>
                    {totalBarramentos > 0 && <span>{totalBarramentos} barramento</span>}
                  </div>

                  <div className="pt-2">
                    <Link href={`/obras/${obraId}/quadros/${q.id}`} className="block">
                      <Botao variante="contorno" className="w-full justify-between text-xs">
                        <span>Abrir Modelagem / Editor</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Botao>
                    </Link>
                  </div>
                </CartaoConteudo>
              </Cartao>
            );
          })}
        </div>
      )}

      <Modal
        aberto={excluirId !== null}
        aoFechar={() => setExcluirId(null)}
        titulo="Excluir Quadro Elétrico"
        descricao={`Tem certeza que deseja excluir o quadro ${quadroParaExcluir?.tag || ""}? Esta ação não pode ser desfeita.`}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Botao type="button" variante="contorno" onClick={() => setExcluirId(null)}>
            Cancelar
          </Botao>
          <Botao type="button" variante="perigo" onClick={confirmarExclusao} carregando={pendente}>
            Excluir Quadro
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
