"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit2 } from "lucide-react";
import { Modal, Botao, Cartao, CartaoConteudo, Tabela, Cabecalho, LinhaCabecalho, CelulaCabecalho, Corpo, Linha, Celula } from "@/components/ui";
import { EditorComposicao } from "@/components/orcamento/editor-composicao";
import { buscarComposicao } from "@/app/(protegido)/obras/[id]/orcamentos/composicoes/acoes";
import { CATEGORIA_COMPOSICAO } from "@/lib/domain/rotulos";
import { formatarMoeda } from "@/lib/utils";

interface ModalComposicaoProps {
  obraId: string;
}

type Modo = "ver" | "editar";

interface ComposicaoDetalhe {
  id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  custo_unitario: number;
  componentes: Array<{
    id: string;
    nome: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    custo_unitario: number;
    codigo: string | null;
    composicao_referencia_id: string | null;
  }>;
}

export function ModalComposicao({ obraId }: ModalComposicaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("ver");
  const [composicaoId, setComposicaoId] = useState<string | null>(null);
  const [composicao, setComposicao] = useState<ComposicaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarComposicao = useCallback(
    async (id: string) => {
      setCarregando(true);
      setErro(null);
      try {
        const resultado = await buscarComposicao(id, obraId);
        if (resultado.erro) {
          setErro(resultado.erro);
          setComposicao(null);
        } else {
          setComposicao(resultado.composicao ?? null);
        }
      } catch {
        setErro("Erro ao carregar a composição.");
        setComposicao(null);
      } finally {
        setCarregando(false);
      }
    },
    [obraId],
  );

  useEffect(() => {
    function handleAbrir(event: CustomEvent<{ composicaoId: string; obraId: string; modo: Modo }>) {
      if (event.detail.obraId !== obraId) return;
      setComposicaoId(event.detail.composicaoId);
      setModo(event.detail.modo);
      setAberto(true);
      setErro(null);
      carregarComposicao(event.detail.composicaoId);
    }

    window.addEventListener("abrir-modal-composicao", handleAbrir as EventListener);
    return () => window.removeEventListener("abrir-modal-composicao", handleAbrir as EventListener);
  }, [obraId, carregarComposicao]);

  function fechar() {
    setAberto(false);
    setComposicaoId(null);
    setComposicao(null);
    setErro(null);
  }

  function aoSalvar() {
    if (composicaoId) {
      carregarComposicao(composicaoId);
    }
    setModo("ver");
    router.refresh();
  }

  function aoFecharEditor() {
    setModo("ver");
  }

  if (!aberto) return null;

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={composicao?.nome ?? "Composição"}
      descricao={composicao?.codigo ? `Código: ${composicao.codigo}` : "Sem código"}
      tamanho="xl"
    >
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-perigo bg-perigo/5 px-4 py-3 text-sm text-perigo mb-4"
        >
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul-600 border-t-transparent" />
        </div>
      ) : composicao ? (
        <>
          {modo === "ver" && <VisaoDetalhada composicao={composicao} />}
          {modo === "editar" && (
            <EditorComposicao
              obraId={obraId}
              composicao={{
                id: composicao.id,
                codigo: composicao.codigo,
                nome: composicao.nome,
                unidade: composicao.unidade,
                componentes: composicao.componentes.map((c) => ({
                  nome: c.nome,
                  categoria: c.categoria,
                  unidade: c.unidade,
                  quantidade: c.quantidade,
                  custoUnitario: c.custo_unitario,
                })),
              }}
              rotuloBotao="Salvar alterações"
              aoSalvar={aoSalvar}
              aoFechar={aoFecharEditor}
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-borda">
            {modo === "ver" && (
              <Botao variante="secundario" onClick={() => setModo("editar")}>
                <Edit2 className="h-4 w-4" />
                Editar
              </Botao>
            )}
            <Botao variante="fantasma" onClick={fechar}>
              Fechar
            </Botao>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-superficie-500">Composição não encontrada.</div>
      )}
    </Modal>
  );
}

function VisaoDetalhada({ composicao }: { composicao: ComposicaoDetalhe }) {
  return (
    <div className="space-y-6">
      <Cartao>
        <CartaoConteudo className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-superficie-500 uppercase tracking-wider">Código</p>
              <p className="font-mono text-sm">{composicao.codigo ?? <span className="text-superficie-400">—</span>}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-superficie-500 uppercase tracking-wider">Unidade</p>
              <p className="text-sm">{composicao.unidade}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-superficie-500 uppercase tracking-wider">Custo unitário</p>
              <p className="font-mono tabular-nums font-semibold">{formatarMoeda(composicao.custo_unitario)}</p>
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
          <CartaoConteudo className="p-0">
            <Tabela>
               <Cabecalho>
                <LinhaCabecalho>
                  <CelulaCabecalho>Componente</CelulaCabecalho>
                  <CelulaCabecalho>Categoria</CelulaCabecalho>
                  <CelulaCabecalho>Unidade</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Qtd.</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Custo unit.</CelulaCabecalho>
                  <CelulaCabecalho className="text-right">Subtotal</CelulaCabecalho>
                </LinhaCabecalho>
              </Cabecalho>
              <Corpo>
                {composicao.componentes.map((comp) => (
                  <Linha key={comp.id}>
                    <Celula className="font-medium">{comp.nome}</Celula>
                    <Celula>
                      <span className="inline-flex items-center rounded-full bg-superficie-100 px-2.5 py-0.5 text-xs font-medium text-superficie-700">
                        {CATEGORIA_COMPOSICAO[comp.categoria]?.rotulo ?? comp.categoria}
                      </span>
                    </Celula>
                    <Celula>{comp.unidade}</Celula>
                    <Celula className="text-right font-mono tabular-nums">{comp.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</Celula>
                    <Celula className="text-right font-mono tabular-nums">{formatarMoeda(comp.custo_unitario)}</Celula>
                    <Celula className="text-right font-mono tabular-nums font-medium">{formatarMoeda(comp.quantidade * comp.custo_unitario)}</Celula>
                  </Linha>
                ))}
               </Corpo>
           </Tabela>
        </CartaoConteudo>
      </Cartao>

      <div className="flex justify-end">
        <div className="w-full max-w-xs rounded-lg border border-borda bg-superficie-50 p-4 text-right">
          <p className="text-xs font-medium text-superficie-500 uppercase tracking-wider">Total da composição</p>
          <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-superficie-900">{formatarMoeda(composicao.custo_unitario)}</p>
        </div>
      </div>
    </div>
  );
}
