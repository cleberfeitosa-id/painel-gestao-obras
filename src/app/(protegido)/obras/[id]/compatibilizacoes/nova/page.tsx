"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Botao, Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo, Campo } from "@/components/ui";
import { criarCompatibilizacao } from "../acoes";
import { useActionState } from "react";
import { useParams } from "next/navigation";

export default function NovaCompatibilizacao() {
  const { id } = useParams() as { id: string };
  const [state, formAction, isPending] = useActionState(async (prevState: unknown, formData: FormData) => {
    return await criarCompatibilizacao(formData);
  }, null);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/obras/${id}/compatibilizacoes`}>
          <Botao variante="fantasma" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Botao>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nova Compatibilização</h1>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Detalhes</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="obra_id" value={id} />
            
            {state?.erro && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded">
                {state.erro}
              </div>
            )}

            <Campo
              rotulo="Nome da Compatibilização"
              name="nome"
              placeholder="Ex: Arquitetura x Estrutura"
              required
              autoFocus
            />
            
            <div className="flex justify-end gap-2 pt-2">
              <Link href={`/obras/${id}/compatibilizacoes`}>
                <Botao variante="contorno" type="button">
                  Cancelar
                </Botao>
              </Link>
              <Botao type="submit" carregando={isPending}>Criar</Botao>
            </div>
          </form>
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
