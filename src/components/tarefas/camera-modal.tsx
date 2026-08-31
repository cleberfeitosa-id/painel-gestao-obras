"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, AlertCircle } from "lucide-react";
import { Botao, Modal } from "@/components/ui";

interface CameraModalProps {
  aberto: boolean;
  aoFechar: () => void;
  aoCapturar: (arquivo: File) => void;
  aoUsarArquivoAlternativo?: () => void;
}

export function CameraModal({
  aberto,
  aoFechar,
  aoCapturar,
  aoUsarArquivoAlternativo,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modoCamera, setModoCamera] = useState<"environment" | "user">("environment");
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [capturando, setCapturando] = useState(false);

  function pararStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function iniciarCamera(facingMode: "environment" | "user") {
    pararStream();
    setErroCamera(null);
    setIniciando(true);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErroCamera(
        "A captura direta de câmera não é suportada neste navegador ou requer conexão HTTPS.",
      );
      setIniciando(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (erro) {
      if (erro instanceof Error) {
        if (erro.name === "NotAllowedError" || erro.name === "PermissionDeniedError") {
          setErroCamera(
            "Permissão de acesso à câmera negada. Conceda permissão no navegador ou escolha uma foto da galeria.",
          );
        } else if (erro.name === "NotFoundError" || erro.name === "DevicesNotFoundError") {
          setErroCamera("Nenhuma câmera foi encontrada neste dispositivo.");
        } else {
          setErroCamera("Não foi possível iniciar a câmera. Tente selecionar da galeria.");
        }
      } else {
        setErroCamera("Erro ao acessar a câmera.");
      }
    } finally {
      setIniciando(false);
    }
  }

  useEffect(() => {
    if (aberto) {
      void iniciarCamera(modoCamera);
    } else {
      pararStream();
      setErroCamera(null);
    }
    return () => {
      pararStream();
    };
  }, [aberto, modoCamera]);

  function alternarCamera() {
    setModoCamera((atual) => (atual === "environment" ? "user" : "environment"));
  }

  async function capturarFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    setCapturando(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setErroCamera("Não foi possível capturar a foto.");
        setCapturando(false);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88);
      });

      canvas.width = 0;
      canvas.height = 0;

      if (!blob) {
        setErroCamera("Falha ao processar a foto capturada.");
        setCapturando(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const arquivo = new File([blob], `foto-${timestamp}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      pararStream();
      aoCapturar(arquivo);
      aoFechar();
    } catch {
      setErroCamera("Erro ao salvar foto capturada.");
    } finally {
      setCapturando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => {
        pararStream();
        aoFechar();
      }}
      titulo="Tirar foto"
      tamanho="lg"
    >
      <div className="space-y-4">
        {erroCamera ? (
          <div className="space-y-4 rounded-xl border border-perigo/30 bg-perigo/5 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-perigo" />
            <div>
              <p className="text-sm font-medium text-perigo">{erroCamera}</p>
              <p className="mt-1 text-xs text-superficie-600">
                Você pode tirar a foto pelo app de Câmera do celular e selecioná-la da galeria.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {aoUsarArquivoAlternativo && (
                <Botao
                  type="button"
                  variante="primario"
                  onClick={() => {
                    pararStream();
                    aoFechar();
                    aoUsarArquivoAlternativo();
                  }}
                >
                  Selecionar da galeria / arquivos
                </Botao>
              )}
              <Botao
                type="button"
                variante="contorno"
                onClick={() => {
                  pararStream();
                  aoFechar();
                }}
              >
                Fechar
              </Botao>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="h-[55vh] max-h-[480px] w-full object-cover"
            />

            {iniciando && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">
                Iniciando câmera...
              </div>
            )}

            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 px-4">
              <button
                type="button"
                onClick={alternarCamera}
                disabled={iniciando || capturando}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-colors hover:bg-white/30 active:scale-95 disabled:opacity-50"
                aria-label="Alternar câmera frontal e traseira"
              >
                <RefreshCw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={capturarFoto}
                disabled={iniciando || capturando}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-azul-600 text-white shadow-xl transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="Capturar foto"
              >
                <Camera className="h-7 w-7" />
              </button>

              <button
                type="button"
                onClick={() => {
                  pararStream();
                  aoFechar();
                }}
                disabled={capturando}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-colors hover:bg-white/30 active:scale-95 disabled:opacity-50"
                aria-label="Fechar câmera"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
