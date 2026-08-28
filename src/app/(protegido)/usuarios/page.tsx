import { ShieldAlert, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PAPEL_USUARIO } from "@/lib/domain/rotulos";
import {
  Cartao,
  CartaoConteudo,
  Etiqueta,
  EstadoVazio,
  Avatar,
  Tabela,
  Cabecalho,
  LinhaCabecalho,
  CelulaCabecalho,
  Corpo,
  Linha,
  Celula,
} from "@/components/ui";
import { EditarPapel } from "@/components/usuarios/editar-papel";
import { ConvidarUsuario } from "@/components/usuarios/convidar-usuario";
import type { PerfilRow } from "@/lib/supabase/database.types";

async function buscarPerfilAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as PerfilRow | null;
}

async function buscarUsuarios() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("*")
    .order("nome");
  return (data ?? []) as PerfilRow[];
}

export default async function UsuariosPage() {
  const perfilAtual = await buscarPerfilAtual();

  if (!perfilAtual || perfilAtual.papel !== "admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Usuarios</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Gerenciamento de acesso ao sistema.
          </p>
        </div>
        <Cartao>
          <EstadoVazio
            icone={<ShieldAlert className="h-8 w-8" />}
            titulo="Acesso restrito"
            descricao="Somente administradores podem visualizar e gerenciar os usuarios do sistema."
          />
        </Cartao>
      </div>
    );
  }

  const usuarios = await buscarUsuarios();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-superficie-900">Usuarios</h1>
          <p className="mt-1 text-sm text-superficie-500">
            Gerencie os acessos e papeis da equipe.
          </p>
        </div>
        <ConvidarUsuario />
      </div>

      {usuarios.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={<Users className="h-8 w-8" />}
            titulo="Nenhum usuario cadastrado"
            descricao="Os perfis dos usuarios aparecerao aqui a medida que forem criados."
          />
        </Cartao>
      ) : (
        <Cartao>
          <CartaoConteudo className="p-0">
            <Tabela>
              <table className="min-w-full">
                <Cabecalho>
                  <LinhaCabecalho>
                    <CelulaCabecalho>Usuario</CelulaCabecalho>
                    <CelulaCabecalho>Cargo</CelulaCabecalho>
                    <CelulaCabecalho>Telefone</CelulaCabecalho>
                    <CelulaCabecalho>Papel</CelulaCabecalho>
                    <CelulaCabecalho>Status</CelulaCabecalho>
                    <CelulaCabecalho className="text-right">
                      Acoes
                    </CelulaCabecalho>
                  </LinhaCabecalho>
                </Cabecalho>
                <Corpo>
                  {usuarios.map((usuario) => (
                    <Linha key={usuario.id}>
                      <Celula>
                        <div className="flex items-center gap-3">
                          <Avatar nome={usuario.nome} tamanho="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-superficie-900">
                              {usuario.nome}
                            </p>
                            <p className="truncate text-xs text-superficie-500">
                              {usuario.email}
                            </p>
                          </div>
                        </div>
                      </Celula>
                      <Celula>{usuario.cargo || "—"}</Celula>
                      <Celula>{usuario.telefone || "—"}</Celula>
                      <Celula>
                        <Etiqueta className="bg-superficie-100 text-superficie-700 ring-superficie-600/20">
                          {PAPEL_USUARIO[usuario.papel].rotulo}
                        </Etiqueta>
                      </Celula>
                      <Celula>
                        {usuario.aceito_em === null ? (
                          <Etiqueta className="bg-amber-100 text-amber-800 ring-amber-600/25">
                            Convite pendente
                          </Etiqueta>
                        ) : usuario.ativo ? (
                          <Etiqueta className="bg-emerald-100 text-emerald-800 ring-emerald-600/25">
                            Ativo
                          </Etiqueta>
                        ) : (
                          <Etiqueta className="bg-red-100 text-red-800 ring-red-600/25">
                            Inativo
                          </Etiqueta>
                        )}
                      </Celula>
                      <Celula className="text-right">
                        <EditarPapel
                          userId={usuario.id}
                          papel={usuario.papel}
                          ativo={usuario.ativo}
                        />
                      </Celula>
                    </Linha>
                  ))}
                </Corpo>
              </table>
            </Tabela>
          </CartaoConteudo>
        </Cartao>
      )}
    </div>
  );
}
