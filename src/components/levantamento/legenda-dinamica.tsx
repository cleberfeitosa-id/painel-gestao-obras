"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatarMetros,
  formatarMetrosQuadrados,
  rotuloCondutor,
} from "@/lib/levantamento/calculos";
import type {
  ConfigLegenda,
  PosicaoLegenda,
  ResumoLevantamento,
} from "@/lib/levantamento/tipos";

interface LegendaDinamicaProps {
  resumo: ResumoLevantamento;
  config: ConfigLegenda;
  aoMudarConfig?: (novaConfig: ConfigLegenda) => void;
  className?: string;
}

export function LegendaDinamica({
  resumo,
  config,
  aoMudarConfig,
  className,
}: LegendaDinamicaProps) {
  const [expandido, setExpandido] = useState(true);
  const [mostrandoConfig, setMostrandoConfig] = useState(false);

  if (!config.visivel) return null;

  const posicoesClasses: Record<PosicaoLegenda, string> = {
    nw: "top-4 left-4",
    ne: "top-4 right-4",
    sw: "bottom-4 left-4",
    se: "bottom-4 right-4",
  };

  const temItens =
    resumo.elementos.length > 0 ||
    resumo.distancias.length > 0 ||
    resumo.cabos.length > 0 ||
    resumo.areas.length > 0 ||
    resumo.descidasSubidas.length > 0;

  const estiloFundo = {
    backgroundColor: config.corFundo,
    color: config.corTexto,
    opacity: config.opacidade / 255,
    fontSize: `${config.tamanhoFonte}px`,
  };

  return (
    <div
      className={cn(
        "absolute z-30 flex flex-col rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-200 pointer-events-auto border border-white/20 max-w-[340px] w-full max-h-[85%]",
        posicoesClasses[config.posicao],
        className,
      )}
      style={estiloFundo}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/15 gap-2 select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="h-3.5 w-3.5 shrink-0 text-azul-400" />
          <span className="text-xs font-semibold truncate">Resumo do Levantamento</span>
        </div>
        <div className="flex items-center gap-1">
          {aoMudarConfig && (
            <button
              type="button"
              onClick={() => setMostrandoConfig(!mostrandoConfig)}
              className="p-1 rounded hover:bg-white/20 text-white/80 transition-colors"
              title="Configurar Legenda"
            >
              <Sliders className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="p-1 rounded hover:bg-white/20 text-white/80 transition-colors"
            title={expandido ? "Recolher Legenda" : "Expandir Legenda"}
          >
            {expandido ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {mostrandoConfig && aoMudarConfig && (
        <div className="p-3 border-b border-white/15 bg-black/40 text-xs space-y-2 select-none">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/70 block mb-1">
                Posição:
              </label>
              <select
                value={config.posicao}
                onChange={(e) =>
                  aoMudarConfig({
                    ...config,
                    posicao: e.target.value as PosicaoLegenda,
                  })
                }
                className="w-full bg-black/60 border border-white/20 rounded px-2 py-1 text-white text-xs"
              >
                <option value="nw">Topo-Esquerda</option>
                <option value="ne">Topo-Direita</option>
                <option value="sw">Baixo-Esquerda</option>
                <option value="se">Baixo-Direita</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/70 block mb-1">
                Fonte: {config.tamanhoFonte}px
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={config.tamanhoFonte}
                onChange={(e) =>
                  aoMudarConfig({
                    ...config,
                    tamanhoFonte: Number(e.target.value),
                  })
                }
                className="w-full cursor-pointer accent-azul-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <div>
              <label className="text-[10px] text-white/70 block mb-1">
                Opacidade: {Math.round((config.opacidade / 255) * 100)}%
              </label>
              <input
                type="range"
                min="100"
                max="255"
                value={config.opacidade}
                onChange={(e) =>
                  aoMudarConfig({
                    ...config,
                    opacidade: Number(e.target.value),
                  })
                }
                className="w-full cursor-pointer accent-azul-400"
              />
            </div>
            <div className="flex gap-2 justify-end pt-3">
              <input
                type="color"
                value={config.corFundo}
                onChange={(e) =>
                  aoMudarConfig({ ...config, corFundo: e.target.value })
                }
                title="Cor de Fundo"
                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
              <input
                type="color"
                value={config.corTexto}
                onChange={(e) =>
                  aoMudarConfig({ ...config, corTexto: e.target.value })
                }
                title="Cor do Texto"
                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {expandido && (
        <div className="p-3 overflow-y-auto max-h-[400px] space-y-3 divide-y divide-white/10 select-none">
          {!temItens ? (
            <p className="text-center py-2 text-white/60 italic text-xs">
              Nenhuma marcação no levantamento.
            </p>
          ) : (
            <>
              {resumo.elementos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                    <span>Elementos Contados</span>
                    <span>{resumo.totalGeralElementos} un</span>
                  </div>
                  <div className="space-y-1">
                    {resumo.elementos.map((el) => (
                      <div
                        key={`${el.subtipo}_${el.nivelNome ?? ""}`}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                            style={{ backgroundColor: el.cor }}
                          />
                          <span className="truncate">
                            {el.nome}
                            {el.nivelNome && (
                              <span className="text-[10px] text-white/60 ml-1">
                                ({el.nivelNome})
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="font-bold text-amber-300 shrink-0">
                          {el.quantidade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(resumo.distancias.length > 0 ||
                resumo.descidasSubidas.length > 0) && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                    <span>Tubulações / Distâncias</span>
                    <span>{formatarMetros(resumo.totalGeralDistancias)}</span>
                  </div>
                  <div className="space-y-1">
                    {resumo.distancias.map((d) => (
                      <div
                        key={d.subtipo}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                            style={{ backgroundColor: d.cor }}
                          />
                          <span className="truncate">{d.nome}</span>
                        </div>
                        <span className="font-bold text-cyan-300 shrink-0">
                          {formatarMetros(d.totalMetros)}
                        </span>
                      </div>
                    ))}
                    {resumo.descidasSubidas.map((desc) => (
                      <div
                        key={desc.subtipo}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                            style={{ backgroundColor: desc.cor }}
                          />
                          <span className="truncate">
                            Descida/Subida ({desc.nome})
                          </span>
                        </div>
                        <span className="font-bold text-purple-300 shrink-0">
                          {formatarMetros(desc.alturaTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resumo.cabos.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                    <span>Cabos e Condutores</span>
                    <span>{formatarMetros(resumo.totalGeralCabos)}</span>
                  </div>
                  <div className="space-y-1">
                    {resumo.cabos.map((c, idx) => (
                      <div
                        key={`${c.circuito}_${c.tipoCabo}_${c.funcao}_${idx}`}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium text-emerald-300">
                            {c.circuito} · {rotuloCondutor(c.funcao)}
                          </div>
                          <div className="text-[10px] text-white/60 truncate">
                            {c.tipoCabo} ({c.quantidadeCondutores}x)
                          </div>
                        </div>
                        <span className="font-bold text-emerald-300 shrink-0">
                          {formatarMetros(c.comprimentoTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resumo.areas.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                    <span>Áreas e Acabamentos</span>
                    <span>{formatarMetrosQuadrados(resumo.totalGeralAreas)}</span>
                  </div>
                  <div className="space-y-1">
                    {resumo.areas.map((a) => (
                      <div
                        key={a.subtipo}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                            style={{ backgroundColor: a.cor }}
                          />
                          <span className="truncate">{a.nome}</span>
                        </div>
                        <span className="font-bold text-pink-300 shrink-0">
                          {formatarMetrosQuadrados(a.totalArea)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
