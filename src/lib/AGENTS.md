# SRC/LIB — LÓGICA NÃO-UI

## OVERVIEW
Lógica fora da camada de UI: clientes Supabase (browser/server/admin), datas fuso-safe, armazenamento, e-mail e matemática de coordenadas PDF.

## STRUCTURE
```
src/lib/
├── supabase/          # client.ts (browser), server.ts (SC), admin.ts (secret, server-only),
│                      #   session.ts (refresh proxy), database.types.ts (gerado)
├── pdf/               # coordenadas.ts (math), worker.ts (pdfjs client-only)
├── domain/rotulos.ts  # mapas de rótulo/classe p/ enums
├── datas.ts           # paraData/chaveDia/gradeDoMes (fuso-safe)
├── armazenamento.ts   # URLs assinadas p/ buckets plantas/anexos
├── email.ts           # notificação por e-mail (Resend) + log em notificacoes
└── utils.ts           # cn(), formatarTamanho, iniciais, sanitizarNomeArquivo
```

## WHERE TO LOOK
| Função | Local |
|--------|-------|
| Datas fuso-safe | `datas.ts` (`paraData`, `chaveDia`, `hojeChave`, `gradeDoMes`) |
| Upload/Storage | `armazenamento.ts` (`assinarUpload`, `urlAssinada`, buckets) |
| Coordenadas/calibragem | `pdf/coordenadas.ts` |
| Envios de e-mail | `email.ts` |
| Rótulos/enums pt-BR | `domain/rotulos.ts` |

## API ESSENCIAL
- `datas.ts`: `FUSO_HORARIO` (`America/Fortaleza`), `paraData`, `chaveDia`, `hojeChave`, `formatarData{,Extensa,Hora}`, `formatarMesAno`, `situacaoPrazo` → `{situacao,dias,texto}`, `gradeDoMes`, `NOMES_DIAS_SEMANA`; reexporta `addDays`/`isSameDay`/`startOfMonth`.
- `armazenamento.ts`: `BUCKET_PLANTAS`/`BUCKET_ANEXOS`, `montarCaminho` (UUID + nome sanitizado), `assinarUpload` (**throws**), `urlAssinada`, `urlsAssinadas` (→ `Map`), `removerArquivo` (**throws**).
- `pdf/coordenadas.ts`: `telaParaPdf`, `pdfParaPercentual`, `distanciaEmPontos`, `calcularCalibracao` (**throws** se os 2 pontos coincidem), `medirDistancia`, `medirArea` (shoelace — escala com o **quadrado** do fator), `medirPerimetro`, `limitesDaRegiao`, `centroDaRegiao`, `retanguloParaRegiao`, `formatarMedida`.
- `email.ts`: só `notificarResponsavel` → `{enviado:true}` | `{enviado:false, motivo:"sem_chave"|"erro"}`. Nunca lança.
- `utils.ts`: `cn`, `formatarTamanho`, `iniciais`, `sanitizarNomeArquivo`.

## CONVENTIONS
- **Clients Supabase — 4 camadas**:
  - `client.ts` (`createBrowserClient`) — só componente client. **Atualmente sem nenhum import no repo (código morto).**
  - `server.ts` (`createServerClient`) — Server Components; NÃO escreve cookies (try/catch silencioso; renovação no `proxy.ts`).
  - `admin.ts` (`createAdminClient`) — secret key, `import "server-only"`, bypassa RLS; NEVER importar de client.
  - `session.ts` (`updateSession`) — usado pelo `proxy.ts`; NUNCA inserir await entre `createServerClient` e `getUser`.
- **Nomes**: constantes `UPPER_SNAKE_CASE` (`BUCKET_PLANTAS`); funções camelCase pt-BR (`montarCaminho`).
- **Comentários/erros internos** sem acentos ("nao", "Sessao expirada").

## ANTI-PATTERNS
- **Datas**: NUNCA `new Date("YYYY-MM-DD")` — use `paraData`/`chaveDia` (off-by-one por fuso UTC−3).
- **Upload**: NUNCA passar bytes pela função serverless (limite 4,5 MB) — sempre `assinarUpload` + envio direto.
- **Coordenadas**: SEMPRE persistir em espaço do PDF (origem inf-esq, Y p/ cima); renderizar em % do quadro.
- **server-only**: módulos `admin.ts`/`armazenamento.ts`/`email.ts` começam com `import "server-only"`.
- **E-mail**: falha de envio/log NUNCA pode derrubar criação de tarefa — try/catch; `RESEND_API_KEY` ausente só loga + status `ignorado`.
- **database.types.ts**: gerado por `supabase gen types`; os aliases de domínio (linhas 620+) são reaplicados à mão após cada regeneração — reproduzir `Tabelas`/`Insercao`/`Atualizacao`/`PontoPdf`/`RegiaoPdf`/`TarefaRow`/`PlantaCalibracaoRow`.
