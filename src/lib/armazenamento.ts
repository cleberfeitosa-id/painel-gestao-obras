import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizarNomeArquivo } from "@/lib/utils";

export const BUCKET_PLANTAS = "plantas";
export const BUCKET_ANEXOS = "anexos";

export function montarCaminho(prefixo: string, nomeArquivo: string) {
  return `${prefixo}/${crypto.randomUUID()}-${sanitizarNomeArquivo(nomeArquivo)}`;
}

// O upload nunca passa pela funcao serverless: a Vercel corta o corpo da
// requisicao em 4,5 MB. O servidor apenas assina a URL e o navegador envia os
// bytes direto ao Supabase Storage.
export async function assinarUpload(bucket: string, caminho: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel assinar o upload.");
  }

  return { caminho: data.path, token: data.token, url: data.signedUrl };
}

export async function urlAssinada(
  bucket: string,
  caminho: string,
  segundos = 3600,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, segundos);

  if (error || !data) return null;
  return data.signedUrl;
}

export async function urlsAssinadas(
  bucket: string,
  caminhos: string[],
  segundos = 3600,
) {
  if (caminhos.length === 0) return new Map<string, string>();

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(caminhos, segundos);

  const mapa = new Map<string, string>();
  if (error || !data) return mapa;

  for (const item of data) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

export async function removerArquivo(bucket: string, caminho: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([caminho]);
  if (error) throw new Error(error.message);
}
