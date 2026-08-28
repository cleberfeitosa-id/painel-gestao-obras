"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Botao, Campo, Selecao, Modal } from "@/components/ui";
import { PAPEL_USUARIO } from "@/lib/domain/rotulos";
import { convidarUsuario } from "@/app/(protegido)/usuarios/acoes";

export function ConvidarUsuario() {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function enviar(formData: FormData) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await convidarUsuario({
        nome: String(formData.get("nome") ?? ""),
        email: String(formData.get("email") ?? ""),
        papel: String(formData.get("papel") ?? "colaborador"),
        cargo: String(formData.get("cargo") ?? "") || undefined,
        telefone: String(formData.get("telefone") ?? "") || undefined,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      formRef.current?.reset();
      setAberto(false);
    });
  }

  return (
    <>
      <Botao type="button" onClick={() => setAberto(true)}>
        <UserPlus className="h-4 w-4" />
        Convidar usuário
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Convidar usuário"
        descricao="O convidado recebera um e-mail para definir a senha e acessar o painel."
      >
        <form ref={formRef} action={enviar} className="space-y-4">
          {erro && (
            <div
              className="rounded-lg bg-perigo-fundo border border-perigo/20 px-4 py-3 text-sm text-perigo"
              role="alert"
            >
              {erro}
            </div>
          )}

          <Campo
            rotulo="Nome completo"
            name="nome"
            obrigatorio
            autoComplete="name"
            placeholder="Nome do convidado"
          />

          <Campo
            rotulo="E-mail"
            name="email"
            type="email"
            obrigatorio
            autoComplete="email"
            placeholder="convidado@empresa.com"
          />

          <Selecao
            rotulo="Papel"
            name="papel"
            obrigatorio
            defaultValue="colaborador"
          >
            {Object.entries(PAPEL_USUARIO).map(([valor, opcao]) => (
              <option key={valor} value={valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>

          <Campo
            rotulo="Cargo"
            name="cargo"
            dica="Opcional"
            placeholder="Engenheiro, Tecnico..."
          />

          <Campo
            rotulo="Telefone"
            name="telefone"
            type="tel"
            dica="Opcional"
            autoComplete="tel"
            placeholder="(85) 99999-0000"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" carregando={pendente}>
              Enviar convite
            </Botao>
          </div>
        </form>
      </Modal>
    </>
  );
}