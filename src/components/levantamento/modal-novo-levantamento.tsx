"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Plus, Upload } from "lucide-react";
import { Botao, Campo, Modal, Selecao } from "@/components/ui";
import { criarNovoLevantamento } from "@/app/(protegido)/levantamento/acoes";
import type { ObraRow, PlantaRow } from "@/lib/supabase/database.types";

interface ModalNovoLevantamentoProps {
  aberto: boolean;
  obras: ObraRow[];
  plantas: PlantaRow[];
  obraIdInicial?: string;
  aoAbrirUploadPlanta?: () => void;
  aoFechar: () => void;
}

export function ModalNovoLevantamento({
  aberto,
  obras,
  plantas,
  obraIdInicial,
  aoAbrirUploadPlanta,
  aoFechar,
}: ModalNovoLevantamentoProps) {
  const router = useRouter();

  const [obraId, setObraId] = useState(obraIdInicial ?? (obras[0]?.id ?? ""));
  const plantasDaObra = useMemo(
    () => plantas.filter((p) => p.obra_id === obraId),
    [plantas, obraId],
  );

  const [plantaId, setPlantaId] = useState(plantasDaObra[0]?.id ?? "");
  const plantaAtual = useMemo(
    () => plantas.find((p) => p.id === plantaId) ?? plantasDaObra[0],
    [plantas, plantaId, plantasDaObra],
  );

  const [pagina, setPagina] = useState(1);
  const [nome, setNome] = useState("Levantamento de Quantidades");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarObra(novaObraId: string) {
    setObraId(novaObraId);
    const primPlanta = plantas.find((p) => p.obra_id === novaObraId);
    if (primPlanta) {
      setPlantaId(primPlanta.id);
      setPagina(1);
    } else {
      setPlantaId("");
    }
  }

  async function criar() {
    if (!obraId) {
      setErro("Selecione uma obra.");
      return;
    }
    const finalPlantaId = plantaId || plantaAtual?.id;
    if (!finalPlantaId) {
      setErro("Selecione uma planta. Envie uma planta em PDF caso a obra não tenha nenhuma.");
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome do levantamento.");
      return;
    }

    setSalvando(true);
    setErro(null);

    const resultado = await criarNovoLevantamento({
      obraId,
      plantaId: finalPlantaId,
      pagina,
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
    });

    setSalvando(false);

    if ("erro" in resultado) {
      setErro(resultado.erro);
    } else {
      aoFechar();
      router.push(`/levantamento/${resultado.id}`);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo Levantamento de Quantidades"
      descricao="Inicie um levantamento quantitativo (contagem, distâncias, cabos, áreas e perspectiva 3D) em uma planta."
      tamanho="md"
    >
      <div className="space-y-4">
        {erro && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
            {erro}
          </div>
        )}

        <Selecao
          rotulo="Obra"
          obrigatorio
          value={obraId}
          onChange={(e) => selecionarObra(e.target.value)}
        >
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Selecao>

        {plantasDaObra.length === 0 ? (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <p className="text-xs text-amber-800">
              Esta obra ainda não possui nenhuma planta em PDF cadastrada.
            </p>
            {aoAbrirUploadPlanta && (
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  aoFechar();
                  aoAbrirUploadPlanta();
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Enviar Planta em PDF
              </Botao>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px] gap-3">
            <Selecao
              rotulo="Planta"
              obrigatorio
              value={plantaId || plantaAtual?.id || ""}
              onChange={(e) => {
                setPlantaId(e.target.value);
                setPagina(1);
              }}
            >
              {plantasDaObra.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.total_paginas} pág.)
                </option>
              ))}
            </Selecao>

            <Campo
              rotulo="Página"
              type="number"
              min={1}
              max={plantaAtual?.total_paginas ?? 1}
              value={pagina}
              onChange={(e) => setPagina(Math.max(1, Number(e.target.value)))}
            />
          </div>
        )}

        <Campo
          rotulo="Nome do Levantamento"
          obrigatorio
          placeholder="Ex.: Levantamento Elétrico - Pavimento Tipo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <Campo
          rotulo="Descrição / Observações (opcional)"
          placeholder="Ex.: Fiação de circuitos, iluminação e tomadas"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <div className="flex items-center justify-between pt-2 border-t border-superficie-100">
          {aoAbrirUploadPlanta ? (
            <button
              type="button"
              onClick={() => {
                aoFechar();
                aoAbrirUploadPlanta();
              }}
              className="text-xs text-azul-600 hover:underline flex items-center gap-1 font-medium"
            >
              <Upload className="h-3.5 w-3.5" />
              Enviar outra planta
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Botao variante="fantasma" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              onClick={criar}
              carregando={salvando}
              disabled={plantasDaObra.length === 0 || !nome.trim()}
            >
              <Boxes className="h-4 w-4" />
              Criar e Abrir
            </Botao>
          </div>
        </div>
      </div>
    </Modal>
  );
}
