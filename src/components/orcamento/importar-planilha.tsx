"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao, Cartao, CartaoCabecalho, CartaoConteudo } from "@/components/ui";
import { criarOrcamento } from "@/app/(protegido)/obras/[id]/orcamentos/acoes";
import type { ColunaOrcamento, LinhaOrcamento } from "@/lib/orcamento/tipos";
import { converterMatriz } from "@/lib/orcamento/planilha";

export function ImportarPlanilha({ obraId }: { obraId: string }) {
  const [nome, setNome] = useState("Orçamento importado");
  const [colunas, setColunas] = useState<ColunaOrcamento[]>([]);
  const [linhas, setLinhas] = useState<LinhaOrcamento[]>([]);
  const [arquivoNome, setArquivoNome] = useState("");
  const [matriz, setMatriz] = useState<unknown[][]>([]);
  const [linhaCabecalho, setLinhaCabecalho] = useState(0);
  const [abas, setAbas] = useState<string[]>([]);
  const [abaSelecionada, setAbaSelecionada] = useState("");
  const [matrizes, setMatrizes] = useState<Record<string, unknown[][]>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, iniciarTransicao] = useTransition();
  const router = useRouter();

  async function importar(arquivo: File) {
    setMensagem(null);
    const XLSX = await import("@e965/xlsx");
    const cptable = await import("@e965/xlsx/dist/cpexcel.full.mjs");
    XLSX.set_cptable(cptable);
    const extensao = arquivo.name.toLowerCase().split(".").pop();
    const opcoes = { cellDates: true, dense: true, raw: true, cellText: true };
    const workbook = extensao === "csv"
      ? XLSX.read(decodificarCsv(await arquivo.arrayBuffer()), { ...opcoes, type: "string" })
      : XLSX.read(await arquivo.arrayBuffer(), { ...opcoes, type: "array", ...(extensao === "xls" ? { codepage: 1252 } : {}) });
    const novasMatrizes = Object.fromEntries(workbook.SheetNames.map((aba) => [aba, XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[aba], { header: 1, defval: null })]));
    const primeiraAba = workbook.SheetNames[0];
    if (!primeiraAba || !novasMatrizes[primeiraAba]) {
      setMensagem("A planilha nao possui uma aba legivel.");
      return;
    }
    setMatrizes(novasMatrizes); setAbas(workbook.SheetNames); setAbaSelecionada(primeiraAba);
    const novaMatriz = novasMatrizes[primeiraAba];
    setMatriz(novaMatriz);
    prepararMatriz(novaMatriz, 0, arquivo.name);
  }

  function decodificarCsv(dados: ArrayBuffer): string {
    const bytes = new Uint8Array(dados);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  function prepararMatriz(dados: unknown[][], indiceCabecalho: number, nomeArquivo: string) {
    const resultado = converterMatriz(dados[indiceCabecalho] ?? [], dados.slice(indiceCabecalho + 1), abaSelecionada);
    setColunas(resultado.colunas); setLinhas(resultado.linhas);
    setMensagem(resultado.erros.length || resultado.avisos.length ? [...resultado.erros.slice(0, 3).map((erro) => `Linha ${erro.linha}: ${erro.mensagem}`), ...resultado.avisos].join(" ") : null);
    setArquivoNome(nomeArquivo);
    setNome(nomeArquivo.replace(/\.[^.]+$/, ""));
  }

  function alternarColuna(id: string) {
    setColunas((atuais) => atuais.map((coluna) => coluna.id === id ? { ...coluna, selecionada: !coluna.selecionada } : coluna));
  }

  function salvar() {
    iniciarTransicao(async () => {
      const resultado = await criarOrcamento({ obraId, nome, colunas, linhas, arquivoNome });
      setMensagem(resultado.erro ?? "Orçamento importado com sucesso.");
      if (resultado.id) router.push(`/obras/${obraId}/orcamentos/${resultado.id}`);
    });
  }

  return (
    <Cartao>
      <CartaoCabecalho><h2 className="text-lg font-semibold">Importar planilha</h2></CartaoCabecalho>
      <CartaoConteudo className="space-y-4">
        <input className="block w-full rounded border-2 border-dashed border-azul-300 bg-azul-50 px-3 py-4 text-sm font-medium text-azul-900" type="file" accept=".xlsx,.xls,.csv" onChange={(evento) => { const arquivo = evento.target.files?.[0]; if (arquivo) void importar(arquivo); }} />
        {abas.length > 1 && <label className="block text-sm font-medium">Aba da planilha
          <select className="mt-1 w-full rounded border border-borda px-3 py-2" value={abaSelecionada} onChange={(evento) => { const aba = evento.target.value; setAbaSelecionada(aba); setMatriz(matrizes[aba] ?? []); setLinhaCabecalho(0); prepararMatriz(matrizes[aba] ?? [], 0, arquivoNome); }}>
            {abas.map((aba) => <option key={aba} value={aba}>{aba}</option>)}
          </select>
        </label>}
        {matriz.length > 0 && <label className="block text-sm font-medium">Linha de cabeçalho
          <select className="mt-1 w-full rounded border border-borda px-3 py-2" value={linhaCabecalho} onChange={(evento) => { const indice = Number(evento.target.value); setLinhaCabecalho(indice); prepararMatriz(matriz, indice, arquivoNome); }}>
            {matriz.slice(0, 80).map((linha, indice) => <option key={indice} value={indice}>Linha {indice + 1}: {linha.filter((valor) => valor !== null && valor !== "").slice(0, 4).map(String).join(" · ") || "vazia"}</option>)}
          </select>
        </label>}
        {colunas.length > 0 && <>
          <label className="block text-sm font-medium">Nome do orçamento<input className="mt-1 w-full rounded border border-borda px-3 py-2" value={nome} onChange={(evento) => setNome(evento.target.value)} /></label>
          <div><p className="mb-2 text-sm font-medium">Colunas importadas</p><div className="flex flex-wrap gap-2">{colunas.map((coluna) => <label key={coluna.id} className="flex items-center gap-2 rounded border border-borda px-2 py-1 text-sm"><input type="checkbox" checked={coluna.selecionada} onChange={() => alternarColuna(coluna.id)} />{coluna.nome}</label>)}</div></div>
          <p className="text-sm text-superficie-500">{linhas.length} linhas encontradas. O editor permitirá adicionar linhas e colunas após salvar.</p>
          <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar orçamento"}</Botao>
        </>}
        {mensagem && <p className="text-sm text-superficie-600">{mensagem}</p>}
      </CartaoConteudo>
    </Cartao>
  );
}
