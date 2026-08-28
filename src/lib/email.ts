import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatarData } from "@/lib/datas";
import { PRIORIDADE_TAREFA } from "@/lib/domain/rotulos";
import type { PrioridadeTarefa } from "@/lib/supabase/database.types";

type NotificacaoTarefa = {
  para: string;
  nomeResponsavel: string;
  tarefaId: string;
  titulo: string;
  descricao?: string | null;
  obra: string;
  prazo?: string | null;
  prioridade: PrioridadeTarefa;
};

function urlBase() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function montarHtml(dados: NotificacaoTarefa) {
  const link = `${urlBase()}/tarefas/${dados.tarefaId}`;
  const prioridade = PRIORIDADE_TAREFA[dados.prioridade].rotulo;
  const prazo = dados.prazo ? formatarData(dados.prazo) : "Sem prazo definido";

  const linhas = [
    ["Obra", escapar(dados.obra)],
    ["Prazo", escapar(prazo)],
    ["Prioridade", escapar(prioridade)],
  ]
    .map(
      ([rotulo, valor]) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:110px">${rotulo}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${valor}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <p style="margin:0 0 4px;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Vasconcelos Engenharia</p>
      <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px">Nova tarefa atribuida a voce</h1>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6">Ola, ${escapar(dados.nomeResponsavel)}. Voce foi definido como responsavel pela tarefa abaixo.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700">${escapar(dados.titulo)}</p>
        ${dados.descricao ? `<p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6">${escapar(dados.descricao)}</p>` : ""}
        <table style="width:100%;border-collapse:collapse">${linhas}</table>
      </div>
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600">Abrir tarefa</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">Voce recebeu este e-mail porque e o responsavel por esta tarefa no Painel de Gestao de Obras.</p>
    </div>
  </div>
</body></html>`;
}

async function registrar(
  tarefaId: string,
  destinatario: string,
  assunto: string,
  status: string,
  erro?: string,
) {
  try {
    await createAdminClient()
      .from("notificacoes")
      .insert({ tarefa_id: tarefaId, destinatario, assunto, status, erro: erro ?? null });
  } catch {
    // O registro da notificacao e auxiliar: falhar aqui nao pode derrubar a
    // criacao da tarefa que ja foi persistida.
  }
}

export async function notificarResponsavel(dados: NotificacaoTarefa) {
  const assunto = `Nova tarefa: ${dados.titulo}`;
  const chave = process.env.RESEND_API_KEY;

  if (!chave) {
    console.warn(`[email] RESEND_API_KEY ausente; envio ignorado para ${dados.para}`);
    await registrar(dados.tarefaId, dados.para, assunto, "ignorado", "RESEND_API_KEY ausente");
    return { enviado: false as const, motivo: "sem_chave" as const };
  }

  const { error } = await new Resend(chave).emails.send({
    from: process.env.RESEND_FROM ?? "Vasconcelos Engenharia <onboarding@resend.dev>",
    to: [dados.para],
    subject: assunto,
    html: montarHtml(dados),
  });

  if (error) {
    console.error("[email] falha ao enviar:", error.message);
    await registrar(dados.tarefaId, dados.para, assunto, "erro", error.message);
    return { enviado: false as const, motivo: "erro" as const };
  }

  await registrar(dados.tarefaId, dados.para, assunto, "enviado");
  return { enviado: true as const };
}
