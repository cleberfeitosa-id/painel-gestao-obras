"use client";

import { useState, useTransition } from "react";
import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Botao, Campo, Modal } from "@/components/ui";
import { criarMedicao } from "@/app/(protegido)/obras/[id]/medicoes/acoes";

interface NovaMedicaoModalProps {
  obraId: string;
}

export function NovaMedicaoModal({ obraId }: NovaMedicaoModalProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function abrir() {
    setTitulo("");
    setValor("");
    setErro(null);
    setAberto(true);
  }

  function salvar() {
    if (!titulo.trim()) {
      setErro("Informe o titulo da medicao.");
      return;
    }
    const bruto = valor.trim().replace(",", ".");
    const valorContrato = bruto === "" ? null : Number(bruto);
    if (valorContrato != null && !Number.isFinite(valorContrato)) {
      setErro("Informe um valor valido.");
      return;
    }
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await criarMedicao({
        obraId,
        titulo: titulo.trim(),
        valorContrato,
      });
      if (resultado.erro) {
        setErro(resultado.erro);
      } else if (resultado.medicaoId) {
        setAberto(false);
        router.push(`/obras/${obraId}/medicoes/${resultado.medicaoId}`);
      }
    });
  }

  return (
    <>
      <Botao type="button" onClick={abrir}>
        <Plus className="h-4 w-4" />
        Nova Medição
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova medição"
        descricao="Crie um novo contrato de medição para esta obra."
      >
        <div className="space-y-4">
          <Campo
            rotulo="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Medição 01 — Fundações"
            autoFocus
          />
          <Campo
            rotulo="Valor do contrato (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 1500000,00"
            dica="Deixe vazio para definir depois."
          />
          {erro && (
            <p className="text-sm text-perigo" role="alert">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
            <Botao type="button" onClick={salvar} carregando={pendente}>
              <Save className="h-3.5 w-3.5" />
              Criar
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  );
}
