import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const raiz = path.resolve(import.meta.dirname, "..");
const pasta = path.join(raiz, "sprints/ref/Orçamentos e Medições Crato/importacao-modelada");
const chaveImportacao = "huv-crato-po-2026-09-v1";

async function carregarEnvLocal() {
  const caminho = path.join(raiz, ".env.local");
  try {
    const conteudo = await fs.readFile(caminho, "utf8");
    for (const linha of conteudo.split(/\r?\n/u)) {
      const correspondencia = linha.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/u);
      if (!correspondencia) continue;
      const [, nome, valorBruto] = correspondencia;
      if (process.env[nome] !== undefined) continue;
      const valor = valorBruto.trim().replace(/^(["'])(.*)\1$/u, "$2");
      process.env[nome] = valor;
    }
  } catch {
    if (erro?.code !== "ENOENT") throw erro;
  }
}

await carregarEnvLocal();

async function lerJson(nome) {
  return JSON.parse(await fs.readFile(path.join(pasta, nome), "utf8"));
}

const manifesto = await lerJson("manifesto-validacao.json");
const composicoes = await lerJson("composicoes.normalizadas.json");
const referencias = await lerJson("composicoes.referencias.json");
const orcamento = await lerJson("orcamento.normalizado.json");
const hashPacote = crypto.createHash("sha256")
  .update(await fs.readFile(path.join(pasta, "composicoes.normalizadas.json")))
  .update(await fs.readFile(path.join(pasta, "composicoes.referencias.json")))
  .update(await fs.readFile(path.join(pasta, "orcamento.normalizado.json")))
  .digest("hex");

if (manifesto.obra !== "HUV Crato" || manifesto.composicoes.selecionadas_com_transitivas !== 694 || manifesto.po.linhas_modeladas !== 975) {
  throw new Error("Manifesto nao corresponde a carga HUV Crato esperada.");
}
if (composicoes.composicoes.length !== 694 || orcamento.linhas.length !== 975) {
  throw new Error(`Pacote invalido: ${composicoes.composicoes.length} composicoes e ${orcamento.linhas.length} linhas.`);
}
if (manifesto.sha256_pacote !== hashPacote) {
  throw new Error("Hash do pacote nao corresponde ao manifesto; regenere os arquivos antes da carga.");
}

const modoExecucao = process.argv.includes("--execute");
const codigosComposicoes = new Set(composicoes.composicoes.map((item) => item.codigo));
const idsLinhas = new Set(orcamento.linhas.map((linha) => linha.__item_id));
const referenciasInternas = referencias.referencias.filter((referencia) => codigosComposicoes.has(referencia.filha));
const totalComponentes = composicoes.composicoes.reduce((total, item) => total + item.componentes.length, 0);
const maiorComposicao = Math.max(...composicoes.composicoes.map((item) => item.componentes.length));
if (codigosComposicoes.size !== 694 || idsLinhas.size !== 975 || totalComponentes !== 3403 || maiorComposicao > 500 || referenciasInternas.length !== 94) {
  throw new Error(`Integridade do pacote invalida: codigos=${codigosComposicoes.size}, ids=${idsLinhas.size}, componentes=${totalComponentes}, maior=${maiorComposicao}, referencias internas=${referenciasInternas.length}.`);
}
console.log(`[HUV Crato] pacote validado: 694 composicoes, ${manifesto.composicoes.componentes} componentes, 975 linhas.`);
console.log(`[HUV Crato] referencias internas que serao vinculadas: ${referenciasInternas.length}; externas permanecem componentes precificados.`);
console.log(`[HUV Crato] chave idempotente: ${chaveImportacao}`);
if (!modoExecucao) {
  console.log("[HUV Crato] dry-run: nenhuma alteracao foi enviada. Use --execute apos aplicar a migration 0040.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorias.");
const obraId = process.env.HUV_CRATO_OBRA_ID;
if (!obraId) throw new Error("Defina HUV_CRATO_OBRA_ID explicitamente; o script nunca procura uma obra por aproximacao.");

const resposta = await fetch(`${url.replace(/\/$/u, "")}/rest/v1/rpc/importar_huv_crato`, {
  method: "POST",
  headers: {
    apikey: chave,
    Authorization: `Bearer ${chave}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    p_obra_id: obraId,
    p_chave_importacao: chaveImportacao,
    p_hash_pacote: hashPacote,
    p_composicoes: composicoes.composicoes,
    p_referencias: referencias.referencias,
    p_orcamento: { nome: orcamento.nome, colunas: orcamento.colunas, linhas: orcamento.linhas },
  }),
});
const corpo = await resposta.text();
if (!resposta.ok) {
  let mensagem = corpo;
  try {
    const erroJson = JSON.parse(corpo);
    mensagem = erroJson.message ?? corpo;
  } catch {
    mensagem = corpo;
  }
  throw new Error(`[HUV Crato] carga revertida: ${mensagem}`);
}
const data = JSON.parse(corpo);
console.log("[HUV Crato] carga concluida atomicamente:");
console.log(JSON.stringify(data, null, 2));
