import { cn, iniciais } from "@/lib/utils";

type TamanhoAvatar = "sm" | "md" | "lg";

interface AvatarProps {
  nome: string;
  tamanho?: TamanhoAvatar;
  className?: string;
}

const estilosTamanho: Record<TamanhoAvatar, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

const CORES = [
  "bg-azul-100 text-azul-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function corDeterministica(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES[Math.abs(hash) % CORES.length];
}

export function Avatar({ nome, tamanho = "md", className }: AvatarProps) {
  const iniciaisNome = iniciais(nome);
  const cor = corDeterministica(nome);

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none",
        estilosTamanho[tamanho],
        cor,
        className,
      )}
      aria-hidden="true"
    >
      {iniciaisNome}
    </div>
  );
}
