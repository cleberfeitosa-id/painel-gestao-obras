"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Cartao, CartaoCabecalho, CartaoTitulo, CartaoConteudo, Botao } from "@/components/ui";
import { salvarQuadroEletrico } from "@/app/(protegido)/obras/[id]/quadros/acoes";
import type { QuadroTemplateItem, QuadroEletricoLayout } from "@/lib/quadros/tipos";

interface FormNovoQuadroProps {
  obraId: string;
  plantas: Array<{ id: string; nome: string }>;
  templates: QuadroTemplateItem[];
}

export function FormNovoQuadro({
  obraId,
  plantas,
  templates,
}: FormNovoQuadroProps) {
  const router = useRouter();

  const [templateSelecionadoId, setTemplateSelecionadoId] = useState<string>("vazio");
  const [tag, setTag] = useState("QDC-01");
  const [nome, setNome] = useState("");
  const [tipoQuadro, setTipoQuadro] = useState("QDC");
  const [plantaId, setPlantaId] = useState<string>("");

  const [larguraMm, setLarguraMm] = useState(600);
  const [alturaMm, setAlturaMm] = useState(800);
  const [profundidadeMm, setProfundidadeMm] = useState(200);
  const [margemLateralMm, setMargemLateralMm] = useState(30);
  const [margemTopoMm, setMargemTopoMm] = useState(30);

  const [tensaoNominal, setTensaoNominal] = useState("220/380V");
  const [correnteNominal, setCorrenteNominal] = useState(63);
  const [grauProtecao, setGrauProtecao] = useState("IP54");

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarTemplate(tId: string) {
    setTemplateSelecionadoId(tId);
    if (tId === "vazio") {
      setLarguraMm(600);
      setAlturaMm(800);
      setProfundidadeMm(200);
      setMargemLateralMm(30);
      setMargemTopoMm(30);
      setCorrenteNominal(63);
      setTensaoNominal("220/380V");
      setTipoQuadro("QDC");
      return;
    }

    const t = templates.find((item) => item.id === tId);
    if (t) {
      setLarguraMm(Number(t.largura_mm) || 600);
      setAlturaMm(Number(t.altura_mm) || 800);
      setProfundidadeMm(Number(t.profundidade_mm) || 200);
      setMargemLateralMm(Number(t.margem_lateral_mm) || 30);
      setMargemTopoMm(Number(t.margem_topo_mm) || 30);
      setTipoQuadro(t.tipo_quadro || "QDC");
      setCorrenteNominal(t.corrente_nominal ? Number(t.corrente_nominal) : 63);
      setTensaoNominal(t.tensao_nominal || "220/380V");
      setGrauProtecao(t.grau_protecao || "IP54");
      if (!nome) setNome(t.nome);
    }
  }

  const larguraUtilCalculada = Math.max(100, larguraMm - margemLateralMm * 2);
  const alturaUtilCalculada = Math.max(100, alturaMm - margemTopoMm * 2);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCarregando(true);
      setErro(null);

      let layoutInicial: QuadroEletricoLayout = {
        elementos: [],
        trilhos: [],
        canaletas: [],
        barramentos: [],
      };

      if (templateSelecionadoId !== "vazio") {
        const t = templates.find((item) => item.id === templateSelecionadoId);
        if (t && t.layout) {
          layoutInicial = t.layout;
        }
      }

      const res = await salvarQuadroEletrico({
        obraId,
        plantaId: plantaId || null,
        tag: tag.trim(),
        nome: nome.trim() || null,
        tipoQuadro,
        tensaoNominal,
        correnteNominal,
        correnteCurtoKa: 10,
        grauProtecao,
        materialCaixa: "Aço tratado com pintura eletrostática",
        larguraMm,
        alturaMm,
        profundidadeMm,
        larguraUtilMm: larguraUtilCalculada,
        alturaUtilMm: alturaUtilCalculada,
        margemLateralMm,
        margemTopoMm,
        layout: layoutInicial,
        templateId: templateSelecionadoId !== "vazio" && !templateSelecionadoId.startsWith("padrao-") ? templateSelecionadoId : null,
      });

      if (res.erro || !res.id) {
        setErro(res.erro ?? "Falha ao criar o quadro elétrico.");
        setCarregando(false);
        return;
      }

      router.push(`/obras/${obraId}/quadros/${res.id}`);
    } catch {
      setErro("Ocorreu um erro inesperado ao criar o quadro.");
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={submeter} className="space-y-6">
      {erro && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {erro}
        </div>
      )}

      <Cartao>
        <CartaoCabecalho>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-azul-600" />
            <CartaoTitulo>Modelo Base / Template</CartaoTitulo>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div
              onClick={() => selecionarTemplate("vazio")}
              className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                templateSelecionadoId === "vazio"
                  ? "border-azul-600 bg-azul-50/50 shadow-sm"
                  : "border-borda hover:border-superficie-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-superficie-900">Quadro Vazio</span>
                {templateSelecionadoId === "vazio" && (
                  <CheckCircle2 className="h-4 w-4 text-azul-600" />
                )}
              </div>
              <p className="text-xs text-superficie-500">
                Inicie com um quadro em branco para desenhar trilhos, canaletas e componentes livremente.
              </p>
            </div>

            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => selecionarTemplate(t.id)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  templateSelecionadoId === t.id
                    ? "border-azul-600 bg-azul-50/50 shadow-sm"
                    : "border-borda hover:border-superficie-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-superficie-900 truncate">
                    {t.nome}
                  </span>
                  {templateSelecionadoId === t.id && (
                    <CheckCircle2 className="h-4 w-4 text-azul-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-superficie-500 line-clamp-2">
                  {t.descricao || `${t.tipo_quadro} ${t.largura_mm}×${t.altura_mm}mm`}
                </p>
                <div className="mt-2 text-[10px] text-azul-700 font-medium">
                  {t.largura_mm}×{t.altura_mm}×{t.profundidade_mm}mm · In {t.corrente_nominal ?? 63}A
                </div>
              </div>
            ))}
          </div>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Identificação do Quadro</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Tag / Código *
              </label>
              <input
                type="text"
                required
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex: QDC-01, QGBT"
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500 font-mono font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Nome / Descrição Amigável
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Quadro de Distribuição de Circuitos - Pavimento Térreo"
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Tipo de Quadro
              </label>
              <select
                value={tipoQuadro}
                onChange={(e) => setTipoQuadro(e.target.value)}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              >
                <option value="QDC">QDC - Distribuição de Circuitos</option>
                <option value="QGBT">QGBT - Geral de Baixa Tensão</option>
                <option value="QDR">QDR - Distribuição de Ramo</option>
                <option value="QMF">QMF - Motores e Força</option>
                <option value="QPI">QPI - Proteção e Inversão</option>
                <option value="QTM">QTM - Transferência Manual</option>
                <option value="OUTRO">Outro tipo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Tensão Nominal
              </label>
              <input
                type="text"
                value={tensaoNominal}
                onChange={(e) => setTensaoNominal(e.target.value)}
                placeholder="Ex: 220/380V, 127/220V"
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Corrente Nominal Geral (A)
              </label>
              <input
                type="number"
                min={10}
                max={2500}
                value={correnteNominal}
                onChange={(e) => setCorrenteNominal(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>
          </div>

          {plantas.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Vincular a Planta da Obra (Opcional)
              </label>
              <select
                value={plantaId}
                onChange={(e) => setPlantaId(e.target.value)}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              >
                <option value="">Sem planta vinculada</option>
                {plantas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dimensões Construtivas e Área Útil</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Largura Total (mm)
              </label>
              <input
                type="number"
                min={200}
                max={3000}
                step={10}
                required
                value={larguraMm}
                onChange={(e) => setLarguraMm(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Altura Total (mm)
              </label>
              <input
                type="number"
                min={200}
                max={3000}
                step={10}
                required
                value={alturaMm}
                onChange={(e) => setAlturaMm(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-superficie-700 mb-1">
                Profundidade Total (mm)
              </label>
              <input
                type="number"
                min={100}
                max={1000}
                step={10}
                required
                value={profundidadeMm}
                onChange={(e) => setProfundidadeMm(Number(e.target.value))}
                className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:ring-2 focus:ring-azul-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-superficie-50 p-4 border border-borda space-y-3">
            <p className="text-xs font-bold text-superficie-800 uppercase tracking-wider">
              Chapa Metálica Interna de Montagem (Delimitador de Área Útil)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Margem Lateral (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={5}
                  value={margemLateralMm}
                  onChange={(e) => setMargemLateralMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-superficie-700 mb-1">
                  Margem Topo/Base (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={5}
                  value={margemTopoMm}
                  onChange={(e) => setMargemTopoMm(Number(e.target.value))}
                  className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-borda text-xs text-superficie-700 font-medium">
              <span>Área Útil Resultante:</span>
              <span className="font-bold text-superficie-900 text-sm">
                {larguraUtilCalculada} mm (L) × {alturaUtilCalculada} mm (A)
              </span>
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Botao
          type="button"
          variante="contorno"
          onClick={() => router.back()}
          disabled={carregando}
        >
          Cancelar
        </Botao>
        <Botao type="submit" variante="primario" carregando={carregando}>
          Criar e Abrir Modelagem Interativa
        </Botao>
      </div>
    </form>
  );
}
