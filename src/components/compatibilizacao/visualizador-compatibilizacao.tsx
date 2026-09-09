"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Eye, EyeOff, ZoomIn, ZoomOut, AlertTriangle, Trash2, FileDown } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import dynamic from "next/dynamic";

import { Botao, Cartao } from "@/components/ui";

const ModalExportarCompatibilizacao = dynamic(
  () => import("./modal-exportar-compatibilizacao").then((m) => m.ModalExportarCompatibilizacao),
  { ssr: false }
);
import { calcularMatrizTransformacao } from "./math";
import {
  adicionarPlantaCompatibilizacao,
  atualizarPlantaCompatibilizacao,
  removerPlantaCompatibilizacao,
  criarChoqueCompatibilizacao
} from "@/app/(protegido)/obras/[id]/compatibilizacoes/acoes";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface TarefaItem {
  id: string;
  titulo: string;
  status: string;
  executor_id: string | null;
  planta_id: string;
  ponto_x: number | null;
  ponto_y: number | null;
  executores?: {
    id: string;
    nome: string;
  } | null;
  [key: string]: unknown;
}

interface ChoqueItem {
  id: string;
  ponto_x: number;
  ponto_y: number;
  descricao: string;
  status?: string;
}

interface PlantaItem {
  id: string;
  planta_id: string;
  pagina: number;
  e_base: boolean;
  ref1_x: number;
  ref1_y: number;
  ref2_x: number;
  ref2_y: number;
  cor_identificacao: string;
  opacidade: number;
  visivel: boolean;
  urlPdf: string | null;
  dimensoes: { largura: number; altura: number } | null;
  plantas: {
    id: string;
    nome: string;
  };
  [key: string]: unknown;
}

interface Props {
  compatibilizacao: {
    id: string;
    nome: string;
    [key: string]: unknown;
  };
  plantasPreCarregadas: PlantaItem[];
  plantasDisponiveis: { id: string; nome: string }[];
  tarefas: TarefaItem[];
  choques: ChoqueItem[];
}

export default function VisualizadorCompatibilizacao({ compatibilizacao, plantasPreCarregadas, plantasDisponiveis, tarefas, choques: choquesIniciais }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [plantasComp, setPlantasComp] = useState<PlantaItem[]>(
    plantasPreCarregadas.sort((a, b) => (a.e_base === b.e_base ? 0 : a.e_base ? -1 : 1))
  );
  const [choques, setChoques] = useState<ChoqueItem[]>(choquesIniciais);
  const [marcandoRef, setMarcandoRef] = useState<{plantaId: string, refIndex: 1 | 2} | null>(null);
  
  const [escala, setEscala] = useState(1);
  const [renderEscala, setRenderEscala] = useState(1);
  
  const [filtroExecutor, setFiltroExecutor] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modoChoque, setModoChoque] = useState(false);
  const [novoChoquePonto, setNovoChoquePonto] = useState<{x: number, y: number} | null>(null);
  const [descChoque, setDescChoque] = useState("");
  const [modalExportar, setModalExportar] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRenderEscala(escala), 150);
    return () => clearTimeout(timer);
  }, [escala]);

  const plantaBase = plantasComp.find(p => p.e_base);

  const telaParaBasePdf = (clientX: number, clientY: number) => {
    if (!plantaBase?.dimensoes || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const xContainer = clientX - rect.left + containerRef.current.scrollLeft;
    const yContainer = clientY - rect.top + containerRef.current.scrollTop;
    
    const cssX = xContainer / escala;
    const cssY = yContainer / escala;
    
    const pdfX = cssX;
    const pdfY = plantaBase.dimensoes.altura - cssY;
    
    return { x: pdfX, y: pdfY };
  };

  const aoClicarPlanta = async (e: React.MouseEvent) => {
    const pt = telaParaBasePdf(e.clientX, e.clientY);
    if (!pt) return;

    if (modoChoque && !novoChoquePonto) {
      setNovoChoquePonto(pt);
    }
  };

  const salvarReferencia = async (plantaId: string, refIndex: 1 | 2, x: number, y: number) => {
    const p = plantasComp.find(p => p.id === plantaId);
    if (!p) return;
    
    const dados = refIndex === 1 
      ? { ref1_x: x, ref1_y: y } 
      : { ref2_x: x, ref2_y: y };
      
    setPlantasComp(prev => prev.map(x_1 => x_1.id === plantaId ? { ...x_1, ...dados } : x_1));
    await atualizarPlantaCompatibilizacao(plantaId, dados);
    setMarcandoRef(null);
  };

  const salvarChoque = async () => {
    if (!novoChoquePonto || !descChoque) return;
    const { error } = await criarChoqueCompatibilizacao(compatibilizacao.id, novoChoquePonto.x, novoChoquePonto.y, descChoque);
    if (!error) {
      setChoques([...choques, { 
        id: Math.random().toString(), 
        ponto_x: novoChoquePonto.x, 
        ponto_y: novoChoquePonto.y, 
        descricao: descChoque 
      }]);
      setNovoChoquePonto(null);
      setDescChoque("");
      setModoChoque(false);
    }
  };

  const addPlanta = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;
    await adicionarPlantaCompatibilizacao(compatibilizacao.id, e.target.value);
    window.location.reload();
  };

  const removerPlanta = async (id: string) => {
    if (!confirm("Remover planta?")) return;
    await removerPlantaCompatibilizacao(id);
    window.location.reload();
  };

  const toggleVisivel = async (p: PlantaItem) => {
    const newVal = !p.visivel;
    setPlantasComp(prev => prev.map(x => x.id === p.id ? { ...x, visivel: newVal } : x));
    await atualizarPlantaCompatibilizacao(p.id, { visivel: newVal });
  };

  const updateOpacidade = async (p: PlantaItem, val: number) => {
    setPlantasComp(prev => prev.map(x => x.id === p.id ? { ...x, opacidade: val } : x));
    await atualizarPlantaCompatibilizacao(p.id, { opacidade: val });
  };

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
    if (filtroExecutor !== "todos" && t.executor_id !== filtroExecutor) return false;
    const plantaVisivel = plantasComp.find(p => p.planta_id === t.planta_id)?.visivel;
    if (!plantaVisivel) return false;
    return t.ponto_x !== null && t.ponto_y !== null;
  });

  const executores: string[] = Array.from(new Set(tarefas.map((t) => t.executores?.nome).filter(Boolean))) as string[];

  const safeRenderEscala = Math.min(renderEscala, 2.5);

  return (
    <div className="flex h-full w-full bg-slate-50">
      <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b space-y-4">
          <h2 className="font-semibold text-lg">Plantas ({plantasComp.length})</h2>
          <select className="w-full border rounded p-2 text-sm" onChange={addPlanta} value="">
            <option value="">+ Adicionar Planta</option>
            {plantasDisponiveis.filter((pd) => !plantasComp.find(pc => pc.planta_id === pd.id)).map((pd) => (
              <option key={pd.id} value={pd.id}>{pd.nome}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {plantasComp.map(p => (
            <Cartao key={p.id} className={`p-3 text-sm ${p.e_base ? 'border-primary' : ''}`}>
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">{p.plantas.nome} {p.e_base && "(Base)"}</span>
                <div className="flex gap-1">
                  <Botao variante="fantasma" className="h-6 w-6 p-0" onClick={() => toggleVisivel(p)}>
                    {p.visivel ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Botao>
                  {!p.e_base && (
                    <Botao variante="fantasma" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removerPlanta(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Botao>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input type="color" value={p.cor_identificacao} onChange={(e) => {
                    setPlantasComp(prev => prev.map(x => x.id === p.id ? { ...x, cor_identificacao: e.target.value } : x));
                    atualizarPlantaCompatibilizacao(p.id, { cor_identificacao: e.target.value });
                  }} className="w-6 h-6 rounded" />
                  <input type="range" min="0" max="1" step="0.1" value={p.opacidade} 
                    onChange={(e) => updateOpacidade(p, parseFloat(e.target.value))} 
                    className="flex-1" />
                </div>
                {!p.e_base && (
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground mb-1">Alinhamento</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Botao 
                        variante={marcandoRef?.plantaId === p.id && marcandoRef.refIndex === 1 ? "primario" : "contorno"} 
                        tamanho="sm"
                        onClick={() => setMarcandoRef({ plantaId: p.id, refIndex: 1 })}
                        className="text-[10px] h-6 px-1"
                      >
                        {p.ref1_x ? "Ponto 1 (Ok)" : "Marcar Ponto 1"}
                      </Botao>
                      <Botao 
                        variante={marcandoRef?.plantaId === p.id && marcandoRef.refIndex === 2 ? "primario" : "contorno"} 
                        tamanho="sm"
                        onClick={() => setMarcandoRef({ plantaId: p.id, refIndex: 2 })}
                        className="text-[10px] h-6 px-1"
                      >
                        {p.ref2_x ? "Ponto 2 (Ok)" : "Marcar Ponto 2"}
                      </Botao>
                    </div>
                  </div>
                )}
                {p.e_base && (
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground mb-1">Alinhamento Base</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Botao 
                        variante={marcandoRef?.plantaId === p.id && marcandoRef.refIndex === 1 ? "primario" : "contorno"} 
                        tamanho="sm"
                        onClick={() => setMarcandoRef({ plantaId: p.id, refIndex: 1 })}
                        className="text-[10px] h-6 px-1"
                      >
                        {p.ref1_x ? "Ponto 1 (Ok)" : "Marcar Ponto 1"}
                      </Botao>
                      <Botao 
                        variante={marcandoRef?.plantaId === p.id && marcandoRef.refIndex === 2 ? "primario" : "contorno"} 
                        tamanho="sm"
                        onClick={() => setMarcandoRef({ plantaId: p.id, refIndex: 2 })}
                        className="text-[10px] h-6 px-1"
                      >
                        {p.ref2_x ? "Ponto 2 (Ok)" : "Marcar Ponto 2"}
                      </Botao>
                    </div>
                  </div>
                )}
              </div>
            </Cartao>
          ))}

          <hr className="my-4"/>
          <h3 className="font-semibold mb-2">Filtros de Tarefas</h3>
          <select className="w-full border rounded p-2 text-sm mb-2" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="em_execucao">Em Execução</option>
            <option value="concluido">Concluído</option>
          </select>
          <select className="w-full border rounded p-2 text-sm" value={filtroExecutor} onChange={e => setFiltroExecutor(e.target.value)}>
            <option value="todos">Todos os executores</option>
            {executores.map((ex: string) => <option key={ex} value={ex}>{ex}</option>)}
          </select>

          <hr className="my-4"/>
          <Botao 
            variante={modoChoque ? "perigo" : "contorno"} 
            className="w-full"
            onClick={() => { setModoChoque(!modoChoque); setNovoChoquePonto(null); }}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {modoChoque ? "Cancelar Choque" : "Sinalizar Choque"}
          </Botao>
          
          <Botao 
            variante="contorno" 
            className="w-full mt-2"
            onClick={() => setModalExportar(true)}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exportar em PDF
          </Botao>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-4 right-4 z-50 flex gap-2 bg-white p-1 rounded shadow">
          <Botao variante="fantasma" className="h-8 w-8 p-0" onClick={() => setEscala(e => e * 1.2)}><ZoomIn className="h-4 w-4"/></Botao>
          <Botao variante="fantasma" className="h-8 w-8 p-0" onClick={() => setEscala(e => e / 1.2)}><ZoomOut className="h-4 w-4"/></Botao>
        </div>

        {novoChoquePonto && (
          <div className="absolute top-4 left-4 z-50 bg-white p-4 rounded shadow-lg border w-80 space-y-3">
            <h4 className="font-semibold">Novo Ponto de Choque</h4>
            <div className="space-y-1">
              <label className="text-sm font-medium">Descrição do choque (ex: Tubulação x Viga)</label>
              <input 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Descrição"
                value={descChoque} 
                onChange={e => setDescChoque(e.target.value)} 
                autoFocus 
              />
            </div>
            <Botao className="w-full" onClick={salvarChoque} disabled={!descChoque}>Salvar Choque</Botao>
          </div>
        )}

        {marcandoRef && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-3">
            <span className="font-medium text-sm">
              Clique na planta para marcar o Ponto {marcandoRef.refIndex === 1 ? '1' : '2'}
            </span>
            <Botao variante="secundario" tamanho="sm" className="h-6 text-xs px-2" onClick={() => setMarcandoRef(null)}>
              Cancelar
            </Botao>
          </div>
        )}

        <div 
          ref={containerRef}
          className={`flex-1 overflow-auto bg-slate-300 relative ${modoChoque || marcandoRef ? 'cursor-crosshair' : 'cursor-grab'}`}
          onClick={aoClicarPlanta}
        >
          {plantaBase && plantaBase.urlPdf ? (
            <div 
              className="relative m-auto"
              style={{
                width: plantaBase.dimensoes ? plantaBase.dimensoes.largura * escala : 'auto',
                height: plantaBase.dimensoes ? plantaBase.dimensoes.altura * escala : 'auto'
              }}
            >
              <div
                className="origin-top-left absolute top-0 left-0"
                style={{
                  transform: `scale(${escala / safeRenderEscala})`,
                  width: plantaBase.dimensoes ? plantaBase.dimensoes.largura * safeRenderEscala : 'auto',
                  height: plantaBase.dimensoes ? plantaBase.dimensoes.altura * safeRenderEscala : 'auto'
                }}
              >
                {plantasComp.map((p) => {
                  if (!p.visivel || !p.urlPdf) return null;
                  
                  let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
                  if (!p.e_base && p.ref1_x && p.ref2_x && plantaBase.ref1_x && plantaBase.ref2_x) {
                    const bH = plantaBase.dimensoes?.altura || 0;
                    const tH = p.dimensoes?.altura || 0;
                    if (bH && tH) {
                      matrix = calcularMatrizTransformacao(
                        { x: plantaBase.ref1_x, y: bH - plantaBase.ref1_y },
                        { x: plantaBase.ref2_x, y: bH - plantaBase.ref2_y },
                        { x: p.ref1_x, y: tH - p.ref1_y },
                        { x: p.ref2_x, y: tH - p.ref2_y }
                      );
                    }
                  }

                  return (
                    <div 
                      key={p.id}
                      className="absolute top-0 left-0 origin-top-left"
                      style={{
                        opacity: p.opacidade,
                        zIndex: marcandoRef?.plantaId === p.id ? 40 : (p.e_base ? 10 : 20),
                        mixBlendMode: (marcandoRef?.plantaId === p.id) ? "normal" : "multiply",
                        transform: (p.e_base || marcandoRef?.plantaId === p.id) ? 'none' : `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e * safeRenderEscala}, ${matrix.f * safeRenderEscala})`
                      }}
                      onClick={(e) => {
                        if (marcandoRef?.plantaId === p.id) {
                          e.stopPropagation();
                          if (!p.dimensoes) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const proporcaoX = (e.clientX - rect.left) / rect.width;
                          const proporcaoY = (e.clientY - rect.top) / rect.height;
                          
                          const pdfX = proporcaoX * p.dimensoes.largura;
                          const pdfY = (1 - proporcaoY) * p.dimensoes.altura;
                          
                          salvarReferencia(p.id, marcandoRef.refIndex, pdfX, pdfY);
                        }
                      }}
                    >
                      <Document file={p.urlPdf}>
                        <Page 
                          pageNumber={p.pagina} 
                          scale={safeRenderEscala}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        onLoadSuccess={(page: { getViewport: (options: { scale: number }) => { width: number; height: number } }) => {
                          const vp = page.getViewport({ scale: 1 });
                          setPlantasComp(prev => prev.map(x => 
                            x.id === p.id ? { ...x, dimensoes: { largura: vp.width, altura: vp.height } } : x
                          ));
                        }}
                      />
                    </Document>
                    {p.dimensoes && p.ref1_x && p.ref1_y && (
                      <div 
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-50"
                        style={{ 
                          left: `${(p.ref1_x / p.dimensoes.largura) * 100}%`, 
                          top: `${((p.dimensoes.altura - p.ref1_y) / p.dimensoes.altura) * 100}%` 
                        }}
                      >
                        <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: p.cor_identificacao }}></div>
                        <span className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded shadow-sm text-white" style={{ backgroundColor: p.cor_identificacao }}>
                          P1
                        </span>
                      </div>
                    )}
                    {p.dimensoes && p.ref2_x && p.ref2_y && (
                      <div 
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-50"
                        style={{ 
                          left: `${(p.ref2_x / p.dimensoes.largura) * 100}%`, 
                          top: `${((p.dimensoes.altura - p.ref2_y) / p.dimensoes.altura) * 100}%` 
                        }}
                      >
                        <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: p.cor_identificacao }}></div>
                        <span className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded shadow-sm text-white" style={{ backgroundColor: p.cor_identificacao }}>
                          P2
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="absolute inset-0 z-30 pointer-events-none">
                {tarefasFiltradas.map((t) => {
                  const plantaDaTarefa = plantasComp.find(p => p.planta_id === t.planta_id);
                  if (!plantaDaTarefa || !plantaDaTarefa.dimensoes || !plantaBase.dimensoes) return null;

                  let px = t.ponto_x!;
                  let py = plantaDaTarefa.dimensoes.altura - t.ponto_y!;

                  if (!plantaDaTarefa.e_base && plantaDaTarefa.ref1_x) {
                    const bH = plantaBase.dimensoes.altura;
                    const tH = plantaDaTarefa.dimensoes.altura;
                    const mat = calcularMatrizTransformacao(
                      { x: plantaBase.ref1_x, y: bH - plantaBase.ref1_y },
                      { x: plantaBase.ref2_x, y: bH - plantaBase.ref2_y },
                      { x: plantaDaTarefa.ref1_x, y: tH - plantaDaTarefa.ref1_y },
                      { x: plantaDaTarefa.ref2_x, y: tH - plantaDaTarefa.ref2_y }
                    );
                    const nx = mat.a * px + mat.c * py + mat.e;
                    const ny = mat.b * px + mat.d * py + mat.f;
                    px = nx;
                    py = ny;
                  }

                  const esq = (px / plantaBase.dimensoes.largura) * 100;
                  const topo = (py / plantaBase.dimensoes.altura) * 100;

                  return (
                    <div 
                      key={t.id} 
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-5 h-5 flex items-center justify-center text-[10px] text-white font-bold pointer-events-auto cursor-pointer shadow-md border-2 border-white"
                      style={{ left: `${esq}%`, top: `${topo}%`, backgroundColor: plantaDaTarefa.cor_identificacao }}
                      title={`${t.titulo}\nStatus: ${t.status}\nExecutor: ${t.executores?.nome || 'N/A'}`}
                    >
                      {t.status === 'concluido' ? '✓' : '!'}
                    </div>
                  );
                })}

                {choques.map((c) => {
                  if (!plantaBase.dimensoes) return null;
                  const esq = (c.ponto_x / plantaBase.dimensoes.largura) * 100;
                  const topo = ((plantaBase.dimensoes.altura - c.ponto_y) / plantaBase.dimensoes.altura) * 100;

                  return (
                    <div 
                      key={c.id} 
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-red-600 pointer-events-auto"
                      style={{ left: `${esq}%`, top: `${topo}%` }}
                      title={`Choque: ${c.descricao}`}
                    >
                      <AlertTriangle className="w-8 h-8 drop-shadow-md" fill="#fef08a" />
                    </div>
                  );
                })}

                {novoChoquePonto && plantaBase.dimensoes && (
                  <div 
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-red-600 animate-pulse"
                    style={{ 
                      left: `${(novoChoquePonto.x / plantaBase.dimensoes.largura) * 100}%`, 
                      top: `${((plantaBase.dimensoes.altura - novoChoquePonto.y) / plantaBase.dimensoes.altura) * 100}%` 
                    }}
                  >
                    <AlertTriangle className="w-8 h-8 drop-shadow-md" fill="#fef08a" />
                  </div>
                )}
              </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Selecione uma planta base no painel lateral
            </div>
          )}
        </div>
      </div>
      {modalExportar && (
        <ModalExportarCompatibilizacao
          aberto={modalExportar}
          aoFechar={() => setModalExportar(false)}
          plantasComp={plantasComp}
          tarefas={tarefasFiltradas}
          choques={choques}
          compatibilizacaoNome={compatibilizacao.nome}
          obraNome={"Obras Vasconcelos"}
        />
      )}
    </div>
  );
}
