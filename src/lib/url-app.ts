import "server-only";

import { headers } from "next/headers";

// Evita convite com redirectTo "undefined/..." (env ausente) e o fallback de
// localhost do Supabase: usa NEXT_PUBLIC_APP_URL ou deriva o Host da requisicao.
export async function urlPublicaApp(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL
    ?.trim()
    .replace(/\/+$/, "");
  if (configurada) return configurada;

  const cabecalhos = await headers();
  const host = (
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host")
  )?.split(",")[0]?.trim();

  if (host) {
    const protocolo = cabecalhos.get("x-forwarded-proto") ?? "https";
    return `${protocolo}://${host}`;
  }

  throw new Error("NEXT_PUBLIC_APP_URL nao configurado e host indisponivel.");
}