import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const tipo = searchParams.get("type");

  if (!tokenHash && !code) {
    redirect("/erro");
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect("/erro");
    }
    redirect("/painel");
  }

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as "signup" | "magiclink" | "recovery",
    });
    if (error) {
      redirect("/erro");
    }
    redirect("/painel");
  }

  redirect("/erro");
}
