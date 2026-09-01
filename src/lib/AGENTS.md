# SRC/LIB — LÓGICA NÃO-UI

## OVERVIEW
Lógica de suporte: clientes Supabase, datas fuso-safe, armazenamento, e-mail, matemática PDF e levantamento quantitativo.

## STRUCTURE
```
src/lib/
├── supabase/          # client.ts, server.ts, admin.ts, session.ts, database.types.ts
├── pdf/               # coordenadas.ts (math), exportador-planta-pdf.ts, worker.ts
├── levantamento/      # calculos.ts, exportacao.ts, tipos.ts
├── domain/rotulos.ts  # mapas de rótulo/classe p/ enums
├── datas.ts           # paraData/chaveDia/gradeDoMes (fuso-safe)
├── armazenamento.ts   # URLs assinadas p/ buckets plantas/anexos
├── compressao-imagem.ts # compressão client-side (JPEG/WebP)
├── email.ts           # notificação por e-mail (Resend) + log em notificacoes
├── url-app.ts         # derivação da URL base da app (NEXT_PUBLIC_APP_URL ou Host)
└── utils.ts           # cn(), formatarTamanho, iniciais, sanitizarNomeArquivo
```

## WHERE TO LOOK
| Função | Local |
|--------|-------|
| Datas fuso-safe | `datas.ts` (`paraData`, `chaveDia`, `hojeChave`, `gradeDoMes`) |
| Upload/Storage | `armazenamento.ts` (`assinarUpload`, `urlAssinada`, buckets) |
| Coordenadas/calibragem | `pdf/coordenadas.ts` |
| Exportação PDF Prancha | `pdf/exportador-planta-pdf.ts` |
| Cálculos Levantamento | `levantamento/calculos.ts` |
| Exportação CSV/Impressão | `levantamento/exportacao.ts` |
| Compressão de Imagens | `compressao-imagem.ts` |
| Envios de e-mail | `email.ts` |
| Rótulos/enums pt-BR | `domain/rotulos.ts` |

## API ESSENCIAL
- `datas.ts`: `FUSO_HORARIO` (`America/Fortaleza`), `paraData`, `chaveDia`, `hojeChave`, `formatarData{,Extensa,Hora}`, `formatarMesAno`, `situacaoPrazo` → `{situacao,dias,texto}`, `gradeDoMes`.
- `armazenamento.ts`: `BUCKET_PLANTAS`/`BUCKET_ANEXOS`, `montarCaminho`, `assinarUpload`, `urlAssinada`, `urlsAssinadas`, `removerArquivo`.
- `pdf/coordenadas.ts`: `telaParaPdf`, `pdfParaPercentual`, `distanciaEmPontos`, `calcularCalibracao`, `medirDistancia`, `medirArea` (shoelace), `retanguloParaRegiao`, `formatarMedida`.
- `levantamento/calculos.ts`: `calcularResumoLevantamento` (elementos, distâncias, cabos, áreas, descidas).
- `compressao-imagem.ts`: `comprimirImagem` (canvas 2D offscreen, limite 1920px).

## CONVENTIONS
- **Clients Supabase — 4 camadas**:
  - `client.ts` (`createBrowserClient`) — só componente client. **Atualmente sem nenhum import no repo (código morto).**
  - `server.ts` (`createServerClient`) — Server Components; NÃO escreve cookies (renovação no `proxy.ts`).
  - `admin.ts` (`createAdminClient`) — secret key, `import "server-only"`, bypassa RLS.
  - `session.ts` (`updateSession`) — usado pelo `proxy.ts`; NUNCA inserir await entre `createServerClient` e `getUser`.
- **server-only**: módulos `admin.ts`/`armazenamento.ts`/`email.ts` usam `import "server-only"`.

## ANTI-PATTERNS
- **Datas**: NUNCA `new Date("YYYY-MM-DD")` — use `paraData`/`chaveDia` (off-by-one por fuso UTC−3).
- **Upload**: NUNCA passar bytes pela função serverless (limite 4,5 MB) — sempre `assinarUpload` + envio direto.
- **Coordenadas**: SEMPRE persistir em espaço do PDF (origem inf-esq, Y p/ cima); renderizar em % do quadro.
- **E-mail**: falha de envio NUNCA pode derrubar mutação principal — try/catch isolado.
- **database.types.ts**: gerado por `supabase gen types`; os aliases de domínio (linhas 1170+) são reaplicados à mão após cada regeneração — reproduzir `Tabelas`/`Insercao`/`Atualizacao`/`PontoPdf`/`RegiaoPdf`/`TarefaRow`/`PlantaCalibracaoRow`.
