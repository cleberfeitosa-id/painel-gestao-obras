#!/usr/bin/env node
/**
 * Recria o perfil ausente e gera um link de convite valido para um usuario.
 * Uso: node scripts/reinvitar-convite.mjs EMAIL [--url https://dominio]
 * --url sobrescreve NEXT_PUBLIC_APP_URL (para gerar link do ambiente de producao).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAPEIS = new Set(["admin", "gestor", "colaborador"]);

function carregarEnvLocal() {
  const env = {};
  let conteudo;
  try {
    conteudo = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return env;
  }
  for (const linha of conteudo.split("\n")) {
    const match = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let valor = match[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    env[match[1]] = valor;
  }
  return env;
}

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
const indiceUrl = args.findIndex((arg) => arg === "--url");
const urlFlag =
  (args.find((arg) => arg.startsWith("--url="))?.slice(6) ?? "") ||
  (indiceUrl !== -1 ? args[indiceUrl + 1] ?? "" : "");

const envLocal = carregarEnvLocal();
const supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecreta = envLocal.SUPABASE_SECRET_KEY;
const appUrl = (urlFlag || envLocal.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

if (!email || !supabaseUrl || !chaveSecreta || !appUrl) {
  console.error(
    "Uso: node scripts/reinvitar-convite.mjs EMAIL [--url https://dominio]\n" +
      "Exige .env.local com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e NEXT_PUBLIC_APP_URL (ou --url).",
  );
  process.exit(1);
}

async function chamar(rota, opcoes = {}) {
  const resposta = await fetch(`${supabaseUrl}${rota}`, {
    ...opcoes,
    headers: {
      apikey: chaveSecreta,
      Authorization: `Bearer ${chaveSecreta}`,
      "Content-Type": "application/json",
      ...opcoes.headers,
    },
  });
  const corpo =
    resposta.status === 204
      ? null
      : await resposta
          .json()
          .catch((e) => {
            console.error("Falha ao ler resposta de", rota, ":", e?.message);
            return null;
          });
  if (!resposta.ok) {
    const mensagem =
      corpo?.message ?? corpo?.msg ?? `${resposta.status} ${resposta.statusText}`;
    throw new Error(`${rota}: ${mensagem}`);
  }
  return corpo;
}

const { users } = await chamar(`/auth/v1/admin/users?per_page=1000&page=1`);

const usuario = users.find((user) => user.email?.toLowerCase() === email);

if (!usuario) {
  console.error(
    `"${email}" nao existe em auth.users. Convide pelo painel (Usuarios > Convidar): o trigger handle_new_user cria o perfil automaticamente.`,
  );
  process.exit(1);
}

console.log(
  `Usuario encontrado: ${usuario.email} (confirmado: ${!!usuario.email_confirmed_at})`,
);

const meta = {
  ...(usuario.user_metadata ?? {}),
  ...(usuario.raw_user_meta_data ?? {}),
};

const perfilExistente = await chamar(
  `/rest/v1/perfis?select=id,papel&id=eq.${usuario.id}`,
).then((corpo) => corpo?.[0] ?? null);

if (!perfilExistente) {
  const nome =
    typeof meta.nome === "string" && meta.nome.trim()
      ? meta.nome.trim()
      : usuario.email.split("@")[0];
  const papel = PAPEIS.has(meta.papel) ? meta.papel : "colaborador";

  await chamar(`/rest/v1/perfis`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: usuario.id,
      nome,
      email: usuario.email,
      telefone: typeof meta.telefone === "string" ? meta.telefone : null,
      cargo: typeof meta.cargo === "string" ? meta.cargo : null,
      papel,
      ativo: true,
      aceito_em: usuario.email_confirmed_at ?? null,
    }),
  });
  console.log(`Perfil recriado com papel "${papel}".`);
} else {
  console.log(
    `Perfil ja existe (papel "${perfilExistente.papel}"); nenhuma insercao feita.`,
  );
}

const aceite = await chamar(
  `/rest/v1/perfis?select=aceito_em&id=eq.${usuario.id}`,
).then((corpo) => corpo?.[0] ?? null);

if (usuario.email_confirmed_at && aceite?.aceito_em == null) {
  await chamar(`/rest/v1/perfis?id=eq.${usuario.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ aceito_em: usuario.email_confirmed_at }),
  });
  console.log("aceito_em sincronizado com email_confirmed_at (status vira Ativo).");
}

const tipoLink = usuario.email_confirmed_at ? "recovery" : "invite";
const respostaLink = await chamar(`/auth/v1/admin/generate_link`, {
  method: "POST",
  body: JSON.stringify({
    type: tipoLink,
    email: usuario.email,
    options: { redirectTo: `${appUrl}/auth/confirmar` },
  }),
});

const token =
  respostaLink?.hashed_token ?? respostaLink?.properties?.hashed_token;

if (!token) {
  console.error("Falha ao gerar link: token ausente na resposta");
  process.exit(1);
}

const link = `${appUrl}/auth/confirmar?token_hash=${token}&type=${tipoLink}`;
console.log(`\nLINK (${tipoLink === "invite" ? "convite: define a senha e confirma o e-mail" : "redefinicao: define uma nova senha"}):\n`);
console.log(link);
console.log(
  "\nAo abrir, o usuario e direcionado a /definir-senha.",
);