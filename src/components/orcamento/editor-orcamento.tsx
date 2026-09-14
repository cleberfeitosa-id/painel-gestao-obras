"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao, Cartao, CartaoCabecalho, CartaoConteudo } from "@/components/ui";
import { atualizarOrcamento } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";
import { calcularIndicadores } from "@/lib/orcamento/indicadores";
import { CartoesIndicadores } from "@/components/orcamento/cartoes-indicadores";
import { ConfiguracaoIndicadores } from "@/components/orcamento/configuracao-indicadores";
import { FUNCAO_COLUNA_ORCAMENTO, OPCOES_FUNCAO_COLUNA_ORCAMENTO } from "@/lib/domain/rotulos";
import type { ColunaOrcamento, FuncaoColunaOrcamento, LinhaOrcamento } from "@/lib/orcamento/tipos";

const MENSAGEM_CONFLITO = "Este orçamento foi alterado por outro usuário. Recarregue a página para ver a versão mais recente.";

export function EditorOrcamento({
  obraId,
  orcamentoId,
  nomeInicial,
  colunasIniciais,
  linhasIniciais,
  versaoInicial,
}: {
  obraId: string;
  orcamentoId: string;
  nomeInicial: string;
  colunasIniciais: ColunaOrcamento[];
  linhasIniciais: LinhaOrcamento[];
  versaoInicial: number;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [versao, setVersao] = useState(versaoInicial);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [conflitoVersao, setConflitoVersao] = useState(false);
  const [salvando, iniciarTransicao] = useTransition();
  const indicadores = calcularIndicadores(linhas, colunas);

  function editarCelula(indice: number, coluna: string, valor: string) { setLinhas((atuais) => atuais.map((linha, idx) => idx === indice ? { ...linha, [coluna]: valor } : linha)); }
  function adicionarColuna() { const id = `coluna_${Date.now()}`; setColunas((atuais) => [...atuais, { id, nome: "Nova coluna", tipo: "texto", selecionada: true }]); setLinhas((atuais) => atuais.map((linha) => ({ ...linha, [id]: null }))); }
  function adicionarLinha() { setLinhas((atuais) => [...atuais, Object.fromEntries(colunas.map((coluna) => [coluna.id, null]))]); }
  function removerLinha(indice: number) { setLinhas((atuais) => atuais.filter((_, idx) => idx !== indice)); }
  function removerColuna(id: string) { setColunas((atuais) => atuais.filter((coluna) => coluna.id !== id)); setLinhas((atuais) => atuais.map((linha) => { const novaLinha = { ...linha }; delete novaLinha[id]; return novaLinha; })); }
  function alterarTipoColuna(id: string, tipo: ColunaOrcamento["tipo"]) { setColunas((atuais) => atuais.map((coluna) => coluna.id === id ? { ...coluna, tipo } : coluna)); }
  function alterarFuncaoColuna(id: string, funcao: FuncaoColunaOrcamento | undefined) { setColunas((atuais) => atuais.map((coluna) => coluna.id === id ? { ...coluna, funcao } : coluna)); }
  function salvar() {
    setConflitoVersao(false);
    iniciarTransicao(async () => {
      const resultado = await atualizarOrcamento({ id: orcamentoId, obraId, nome, colunas, linhas, versao });
      if (resultado.erro) {
        setMensagem(resultado.erro);
        setConflitoVersao(resultado.erro === MENSAGEM_CONFLITO);
      } else {
        setMensagem("Alterações salvas.");
        if (resultado.versao != null) setVersao(resultado.versao);
      }
    });
  }

  return <div className="space-y-4">
    <CartoesIndicadores indicadores={indicadores} colunas={colunas} />
    {conflitoVersao && (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">{MENSAGEM_CONFLITO}</p>
        <Botao type="button" variante="contorno" tamanho="sm" onClick={() => router.refresh()}>Recarregar</Botao>
      </div>
    )}
    <Cartao>
      <CartaoCabecalho>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input className="rounded border border-borda px-3 py-2 text-lg font-semibold" value={nome} onChange={(evento) => setNome(evento.target.value)} />
          <div className="flex flex-wrap gap-2">
            <ConfiguracaoIndicadores colunas={colunas} aoAplicar={setColunas} />
            <Botao type="button" variante="secundario" onClick={adicionarColuna}>Nova coluna</Botao>
            <Botao type="button" variante="secundario" onClick={adicionarLinha}>Nova linha</Botao>
            <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Botao>
          </div>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {colunas.filter((coluna) => coluna.selecionada).map((coluna) => (
                <th key={coluna.id} className="border-b border-borda p-2 text-left">
                  <div>{coluna.nome}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <select className="rounded border border-borda text-xs" value={coluna.tipo} onChange={(evento) => alterarTipoColuna(coluna.id, evento.target.value as ColunaOrcamento["tipo"])}>
                      <option value="texto">Texto</option>
                      <option value="numero">Número</option>
                      <option value="moeda">Moeda</option>
                    </select>
                    <select className="rounded border border-borda text-xs" value={coluna.funcao ?? ""} onChange={(evento) => alterarFuncaoColuna(coluna.id, evento.target.value === "" ? undefined : evento.target.value as FuncaoColunaOrcamento)}>
                      <option value="">Função</option>
                      {OPCOES_FUNCAO_COLUNA_ORCAMENTO.map((funcao) => (
                        <option key={funcao} value={funcao}>{FUNCAO_COLUNA_ORCAMENTO[funcao].rotulo}</option>
                      ))}
                    </select>
                    <button type="button" className="text-xs text-red-600" onClick={() => removerColuna(coluna.id)}>Excluir coluna</button>
                  </div>
                </th>
              ))}
              <th className="border-b border-borda p-2" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={indice}>
                {colunas.filter((coluna) => coluna.selecionada).map((coluna) => (
                  <td key={coluna.id} className="border-b border-borda p-1">
                    <input className="w-full min-w-28 rounded border border-transparent px-2 py-1 hover:border-borda focus:border-azul-500" value={linha[coluna.id] == null ? "" : String(linha[coluna.id])} onChange={(evento) => editarCelula(indice, coluna.id, evento.target.value)} />
                  </td>
                ))}
                <td className="border-b border-borda p-1">
                  <button type="button" className="text-xs text-red-600" onClick={() => removerLinha(indice)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CartaoConteudo>
    </Cartao>
    {!conflitoVersao && mensagem && <p className="text-sm text-superficie-600">{mensagem}</p>}
  </div>;
}