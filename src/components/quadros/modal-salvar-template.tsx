"use client";

import { useState } from "react";
import { Modal, Botao } from "@/components/ui";

interface ModalSalvarTemplateProps {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: (nome: string, descricao: string) => Promise<void>;
  sugestaoNome: string;
}

export function ModalSalvarTemplate({
  aberto,
  aoFechar,
  aoConfirmar,
  sugestaoNome,
}: ModalSalvarTemplateProps) {
  const [nome, setNome] = useState(sugestaoNome);
  const [descricao, setDescricao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe um nome para o template.");
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      await aoConfirmar(nome.trim(), descricao.trim());
      aoFechar();
    } catch {
      setErro("Falha ao salvar template.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Salvar como Template de Quadro"
      descricao="Este quadro e todos os seus componentes, trilhos e barramentos serão salvos na biblioteca para reutilização em qualquer obra."
    >
      <form onSubmit={submeter} className="space-y-4">
        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {erro}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-superficie-700 mb-1">
            Nome do Template *
          </label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: QDC Residencial 36M com Barramento"
            className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-superficie-700 mb-1">
            Descrição Técnica (Opcional)
          </label>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Quadro com 3 trilhos DIN, proteção IDR geral e barramento trifásico espinha de peixe."
            className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-superficie-900 focus:outline-none focus:ring-2 focus:ring-azul-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Botao type="button" variante="contorno" onClick={aoFechar} disabled={carregando}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" carregando={carregando}>
            Salvar Template
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
