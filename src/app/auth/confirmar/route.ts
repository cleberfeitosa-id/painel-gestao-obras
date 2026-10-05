import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const TIPOS_TOKEN = new Set<EmailOtpType>([
  "signup",
  "invite",
  "recovery",
  "magiclink",
]);

function tipoTokenValido(valor: string | null): valor is EmailOtpType {
  return valor !== null && TIPOS_TOKEN.has(valor as EmailOtpType);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const tipo = searchParams.get("type");

  if ((tokenHash && code) || (!tokenHash && !code)) {
    return NextResponse.redirect(new URL("/erro", request.url));
  }

  const destino = code
    ? "/painel"
    : tipo === "invite" || tipo === "recovery"
      ? "/definir-senha"
      : "/painel";
  const resposta = NextResponse.redirect(new URL(destino, request.url));
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/erro", request.url));
    }
    return resposta;
  }

  if (tokenHash && tipoTokenValido(tipo)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo,
    });
    if (error) {
      return NextResponse.redirect(new URL("/erro", request.url));
    }
    return resposta;
  }

  return NextResponse.redirect(new URL("/erro", request.url));
}
