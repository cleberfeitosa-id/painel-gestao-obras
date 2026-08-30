import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Botao, Cartao, CartaoConteudo, EstadoVazio } from "@/components/ui";
import { BotaoExcluirTag } from "@/components/tarefas/botao-excluir-tag";

export default async function GerenciarTagsPage() {
  const supabase = await createClient();

  const [
    { data: tags },
    { data: { user } }
  ] = await Promise.all([
    supabase.from("tags_tarefa").select("id, nome, criado_em, criado_por(nome)").order("nome"),
    supabase.auth.getUser()
  ]);

  let podeExcluir = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", user.id)
      .single();
    podeExcluir = perfil?.papel === "admin" || perfil?.papel === "gestor";
  }

  const listTags = tags ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/tarefas"
          className="inline-flex items-center gap-1 text-sm font-medium text-azul-600 hover:text-azul-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para tarefas
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-superficie-900">Gerenciar Tags</h1>
        </div>
        <p className="mt-1 text-sm text-superficie-500">
          Vocabulario de tags globais agrupando tarefas do sistema.
        </p>
      </div>

      <Cartao>
        <CartaoConteudo>
          {listTags.length === 0 ? (
            <EstadoVazio
              icone={<Tag className="h-8 w-8" />}
              titulo="Nenhuma tag cadastrada"
              descricao="As tags podem ser criadas diretamente no formulario de criacao de tarefas."
            />
          ) : (
            <ul className="divide-y divide-superficie-100">
              {listTags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-superficie-900">{tag.nome}</p>
                    <p className="text-xs text-superficie-500 mt-1">
                      Criada por {(tag.criado_por as any)?.nome ?? "Sistema"} em {new Date(tag.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {podeExcluir && (
                    <BotaoExcluirTag tagId={tag.id} nome={tag.nome} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
