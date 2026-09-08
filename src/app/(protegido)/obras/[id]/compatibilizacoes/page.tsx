import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";
import {
  Cartao,
  CartaoCabecalho,
  CartaoTitulo,
  CartaoConteudo,
  Botao,
  EstadoVazio,
} from "@/components/ui";

interface CompatibilizacaoPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompatibilizacoesObra({ params }: CompatibilizacaoPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Buscar obra
  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .single();

  if (!obra) {
    notFound();
  }

  // Buscar compatibilizacoes
  const { data: compatibilizacoes } = await supabase
    .from("compatibilizacoes")
    .select("*, compatibilizacao_plantas(count)")
    .eq("obra_id", id)
    .order("criado_em", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/obras/${id}`}>
          <Botao variante="fantasma" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Botao>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compatibilização de Plantas</h1>
          <p className="text-muted-foreground">Obra: {obra.nome}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href={`/obras/${id}/compatibilizacoes/nova`}>
          <Botao>
            <Plus className="h-4 w-4 mr-2" />
            Nova Compatibilização
          </Botao>
        </Link>
      </div>

      {!compatibilizacoes || compatibilizacoes.length === 0 ? (
        <Cartao>
          <CartaoConteudo className="pt-6">
            <EstadoVazio
              icone={<Layers className="h-10 w-10 text-muted-foreground" />}
              titulo="Nenhuma compatibilização"
              descricao="Crie sua primeira compatibilização sobrepondo múltiplas plantas."
              acao={
                <Link href={`/obras/${id}/compatibilizacoes/nova`}>
                  <Botao>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Compatibilização
                  </Botao>
                </Link>
              }
            />
          </CartaoConteudo>
        </Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {compatibilizacoes.map((comp) => (
            <Link key={comp.id} href={`/obras/${id}/compatibilizacoes/${comp.id}`}>
              <Cartao className="transition-all hover:border-primary">
                <CartaoCabecalho>
                  <CartaoTitulo className="text-lg">{comp.nome}</CartaoTitulo>
                  <p className="text-sm text-muted-foreground mt-1">
                    {comp.compatibilizacao_plantas[0]?.count || 0} plantas
                  </p>
                </CartaoCabecalho>
                <CartaoConteudo className="text-sm text-muted-foreground flex justify-between items-center">
                  <span>Criado em {formatarData(comp.criado_em)}</span>
                </CartaoConteudo>
              </Cartao>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
