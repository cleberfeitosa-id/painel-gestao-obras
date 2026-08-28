import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/**",
          },
          {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/render/image/**",
          },
        ]
      : [],
  },
  // pdfjs-dist referencia o pacote `canvas` (somente Node). No bundle do
  // browser ele precisa ser resolvido para um modulo vazio.
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.ts",
    },
  },
};

export default nextConfig;
