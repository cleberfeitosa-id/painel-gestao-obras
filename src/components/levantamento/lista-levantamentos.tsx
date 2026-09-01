"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Calendar,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Plus,
  Ruler,
  Scale,
  Search,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Botao, Campo, Cartao, CartaoConteudo, EstadoVazio, Etiqueta, Modal, Selecao } from "@/components/ui";
import { formatarMetros, formatarMetrosQuadrados } from "@/lib/levantamento/calculos";
import { excluirLevantamento } from "@/app/(protegido)/levantamento/acoes";
import { ModalNovoLevantamento } from "./modal-novo-levantamento";
import { ModalUploadNovaPlanta } from "./modal-upload-nova-planta";
import type {
  LevantamentoRow,
  ObraRow,
  PlantaCalibracaoRow,
  PlantaRow,
} from "@/lib/supabase/database.types";
import type { ItemLevantamento, ResumoLevantamento } from "@/lib/levantamento/tipos";

export interface LevantamentoComRelacoes extends LevantamentoRow {
  obras: { id: string; nome: string } | null;
  plantas: { id: string; nome: string; total_paginas: number } | null;
}

interface ListaLevantamentosProps {
  levantamentos: LevantamentoComRelacoes[];
  obras: ObraRow[];
  plantas: PlantaRow[];
  calibracoes: PlantaCalibracaoRow[];
  obraFiltroId?: string;
  podeEditar: boolean;
}

export function ListaLevantamentos({
  levantamentos: levantamentosIniciais,
  obras,
  plantas,
  calibracoes,
  obraFiltroId,
  podeEditar,
}: ListaLevantamentosProps) {
  const [lista, setLista] = useState(levantamentosIniciais);
  const [obraFiltro, setObraFiltro] = useState(obraFiltroId ?? "todas");
  const [busca, setBusca] = useState("");

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalUploadAberto, setModalUploadAberto] = useState(false);

  const filtrados = useMemo(() => {
    return lista.filter((item) => {
      if (obraFiltro !== "todas" && item.obra_id !== obraFiltro) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeMatch = item.nome.toLowerCase().includes(termo);
        const descMatch = item.descricao?.toLowerCase().includes(termo);
        const obraMatch = item.obras?.nome.toLowerCase().includes(termo);
        const plantaMatch = item.plantas?.nome.toLowerCase().includes(termo);
        return nomeMatch || descMatch || obraMatch || plantaMatch;
      }
      return true;
    });
  }, [lista, obraFiltro, busca]);

  async function confirmarExcluir(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o levantamento "${nome}"?`))
      return;
    const res = await excluirLevantamento(id);
    if ("erro" in res) {
      alert(`Erro ao excluir: ${res.erro}`);
    } else {
      setLista((prev) => prev.filter((l) => l.id !== id));
    }
  }

  function calcularTotaisRapidos(itensRaw: unknown) {
    const itens = (Array.isArray(itensRaw) ? itensRaw : []) as ItemLevantamento[];
    let totalPontos = 0;
    let totalDistancia = 0;
    let totalCabos = 0;
    let totalArea = 0;

    for (const it of itens) {
      if (it.tipo === "ponto") {
        totalPontos += 1;
      } else if (it.tipo === "distancia" || it.tipo === "tubulacao_cabo") {
        const comp = it.comprimentoReal ?? 0;
        totalDistancia += comp;
        if (it.metadadosCabo) {
          for (const c of it.metadadosCabo.condutores) {
            totalCabos += comp * (c.quantidade ?? 1);
          }
        }
      } else if (it.tipo === "descida_subida") {
        const comp = it.comprimentoReal ?? 0;
        totalDistancia += comp;
      } else if (it.tipo === "area") {
        totalArea += it.areaReal ?? 0;
      }
    }

    return { totalPontos, totalDistancia, totalCabos, totalArea, totalItens: itens.length };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">
            Levantamento de Quantidades
          </h1>
          <p className="mt-1 text-sm text-superficie-500">
            Gerencie e crie levantamentos de quantidades sobre as plantas da obra com persistência e perspectiva 3D.
          </p>
        </div>

        {podeEditar && (
          <div className="flex items-center gap-2">
            <Botao
              variante="contorno"
              onClick={() => setModalUploadAberto(true)}
            >
              <Upload className="h-4 w-4" />
              Enviar Planta
            </Botao>
            <Botao
              variante="primario"
              onClick={() => setModalNovoAberto(true)}
            >
              <Plus className="h-4 w-4" />
              Novo Levantamento
            </Botao>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between rounded-2xl bg-white p-4 border border-superficie-200 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="w-full sm:w-64">
            <Selecao
              rotulo="Filtrar por Obra"
              value={obraFiltro}
              onChange={(e) => setObraFiltro(e.target.value)}
            >
              <option value="todas">Todas as Obras ({obras.length})</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Selecao>
          </div>

          <div className="flex-1">
            <Campo
              rotulo="Buscar levantamento"
              placeholder="Digite o nome, planta ou obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <Cartao>
          <CartaoConteudo>
            <EstadoVazio
              icone={<Boxes className="h-10 w-10 text-azul-600" />}
              titulo="Nenhum levantamento encontrado"
              descricao={
                busca || obraFiltro !== "todas"
                  ? "Tente ajustar os filtros de busca para encontrar o que procura."
                  : "Crie seu primeiro levantamento de quantidades sobre qualquer planta cadastrada."
              }
              acao={
                podeEditar ? (
                  <Botao
                    variante="primario"
                    onClick={() => setModalNovoAberto(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Criar Primeiro Levantamento
                  </Botao>
                ) : undefined
              }
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrados.map((item) => {
            const totais = calcularTotaisRapidos(item.itens);
            const cal = calibracoes.find(
              (c) => c.planta_id === item.planta_id && c.pagina === item.pagina,
            );

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-superficie-200 bg-white p-5 shadow-sm transition-all hover:border-azul-400 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/levantamento/${item.id}`}
                        className="font-bold text-superficie-900 text-base group-hover:text-azul-600 truncate block transition-colors"
                      >
                        {item.nome}
                      </Link>
                      <div className="text-xs text-superficie-500 mt-0.5 truncate">
                        {item.obras?.nome ?? "Obra"} ·{" "}
                        <span className="text-superficie-700 font-medium">
                          {item.plantas?.nome ?? "Planta"} (Pág. {item.pagina})
                        </span>
                      </div>
                    </div>

                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => confirmarExcluir(item.id, item.nome)}
                        className="text-superficie-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Excluir Levantamento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {item.descricao && (
                    <p className="text-xs text-superficie-600 line-clamp-2">
                      {item.descricao}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-superficie-100">
                    <div className="p-2 rounded-xl bg-superficie-50 border border-superficie-100">
                      <span className="text-[10px] text-superficie-500 font-bold uppercase tracking-wider block">
                        Elementos
                      </span>
                      <span className="text-sm font-bold text-amber-600">
                        {totais.totalPontos} un
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-superficie-50 border border-superficie-100">
                      <span className="text-[10px] text-superficie-500 font-bold uppercase tracking-wider block">
                        Tubulações
                      </span>
                      <span className="text-sm font-bold text-cyan-600">
                        {formatarMetros(totais.totalDistancia)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-superficie-50 border border-superficie-100">
                      <span className="text-[10px] text-superficie-500 font-bold uppercase tracking-wider block">
                        Cabos / Fiação
                      </span>
                      <span className="text-sm font-bold text-emerald-600">
                        {formatarMetros(totais.totalCabos)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-superficie-50 border border-superficie-100">
                      <span className="text-[10px] text-superficie-500 font-bold uppercase tracking-wider block">
                        Áreas Medidas
                      </span>
                      <span className="text-sm font-bold text-pink-600">
                        {formatarMetrosQuadrados(totais.totalArea)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-superficie-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {cal ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                        <Scale className="h-3 w-3" />
                        Calibrada ({cal.unidades_por_ponto.toFixed(3)} {cal.unidade}/pt)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
                        <Scale className="h-3 w-3" />
                        Não calibrada
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/levantamento/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-azul-600 hover:text-azul-700 group-hover:translate-x-0.5 transition-all"
                  >
                    Abrir <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalNovoLevantamento
        aberto={modalNovoAberto}
        obras={obras}
        plantas={plantas}
        obraIdInicial={obraFiltro !== "todas" ? obraFiltro : undefined}
        aoAbrirUploadPlanta={() => setModalUploadAberto(true)}
        aoFechar={() => setModalNovoAberto(false)}
      />

      <ModalUploadNovaPlanta
        aberto={modalUploadAberto}
        obras={obras}
        obraIdPadrao={obraFiltro !== "todas" ? obraFiltro : undefined}
        aoConcluir={() => {
          setModalUploadAberto(false);
          window.location.reload();
        }}
        aoFechar={() => setModalUploadAberto(false)}
      />
    </div>
  );
}
