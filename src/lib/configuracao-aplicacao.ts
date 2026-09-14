function validarHex(valor: string | undefined, padrao: string): string {
  const v = valor?.trim();
  if (!v) return padrao;
  const hex = v.startsWith("#") ? v : `#${v}`;
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex) ? hex : padrao;
}

export const CONFIGURACAO_APLICACAO = {
  nomeEmpresa:
    process.env.NEXT_PUBLIC_NOME_EMPRESA?.trim() || "Vasconcelos Engenharia",
  nomeAplicacao:
    process.env.NEXT_PUBLIC_NOME_APLICACAO?.trim() || "Painel de Gestão de Obras",

  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL?.trim() || null,

  corPrimaria: validarHex(process.env.NEXT_PUBLIC_COR_PRIMARIA, "#F48040"),

  corDestaque: validarHex(process.env.NEXT_PUBLIC_COR_DESTAQUE, "#1d4ed8"),

  fraseTagline: process.env.NEXT_PUBLIC_FRASE_TAGLINE?.trim() || null,

  faviconUrl: process.env.NEXT_PUBLIC_FAVICON_URL?.trim() || null,

  isDefaultCompany:
    !process.env.NEXT_PUBLIC_LOGO_URL?.trim() &&
    (!process.env.NEXT_PUBLIC_NOME_EMPRESA?.trim() ||
      process.env.NEXT_PUBLIC_NOME_EMPRESA.trim() === "Vasconcelos Engenharia"),
};
