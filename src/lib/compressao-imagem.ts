export interface OpcoesCompressao {
  maxDimensao?: number;
  qualidade?: number;
  tipoMime?: string;
  limiteIgnorarBytes?: number;
}

const CONFIG_PADRAO: Required<OpcoesCompressao> = {
  maxDimensao: 1920,
  qualidade: 0.82,
  tipoMime: "image/jpeg",
  limiteIgnorarBytes: 500 * 1024,
};

export function eImagemComprimivel(arquivo: File): boolean {
  const tipo = arquivo.type.toLowerCase();
  const nome = arquivo.name.toLowerCase();

  if (
    tipo === "image/svg+xml" ||
    tipo === "image/gif" ||
    nome.endsWith(".svg") ||
    nome.endsWith(".gif")
  ) {
    return false;
  }

  if (tipo.startsWith("image/")) {
    return true;
  }

  return /\.(jpe?g|png|webp|heic|heif|bmp|tiff)$/i.test(nome);
}

async function carregarFonteImagem(
  arquivo: File,
): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  limpar: () => void;
}> {
  if (typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(arquivo, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        limpar: () => bitmap.close(),
      };
    } catch {
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();

    img.decoding = "async";
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        limpar: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = url;
  });
}

export async function comprimirImagem(
  arquivo: File,
  opcoes?: OpcoesCompressao,
): Promise<File> {
  if (typeof window === "undefined" || !eImagemComprimivel(arquivo)) {
    return arquivo;
  }

  const { maxDimensao, qualidade, tipoMime, limiteIgnorarBytes } = {
    ...CONFIG_PADRAO,
    ...opcoes,
  };

  try {
    const { source, width, height, limpar } = await carregarFonteImagem(arquivo);

    try {
      let targetWidth = width;
      let targetHeight = height;

      if (width > maxDimensao || height > maxDimensao) {
        if (width >= height) {
          targetWidth = maxDimensao;
          targetHeight = Math.max(1, Math.round((height * maxDimensao) / width));
        } else {
          targetHeight = maxDimensao;
          targetWidth = Math.max(1, Math.round((width * maxDimensao) / height));
        }
      }

      const dimensoesNaoMudaram = targetWidth === width && targetHeight === height;
      if (
        dimensoesNaoMudaram &&
        arquivo.size <= limiteIgnorarBytes &&
        arquivo.type === tipoMime
      ) {
        return arquivo;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        return arquivo;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), tipoMime, qualidade);
      });

      canvas.width = 0;
      canvas.height = 0;

      if (!blob) {
        return arquivo;
      }

      if (blob.size >= arquivo.size && dimensoesNaoMudaram) {
        return arquivo;
      }

      let novoNome = arquivo.name;
      if (tipoMime === "image/jpeg") {
        novoNome = novoNome.replace(
          /\.(jpe?g|png|webp|heic|heif|bmp|tiff)$/i,
          ".jpg",
        );
        if (!/\.jpe?g$/i.test(novoNome)) {
          novoNome = `${novoNome}.jpg`;
        }
      }

      return new File([blob], novoNome, {
        type: tipoMime,
        lastModified: Date.now(),
      });
    } finally {
      limpar();
    }
  } catch (erro) {
    console.warn("[compressao-imagem] fallback para arquivo original:", erro);
    return arquivo;
  }
}
