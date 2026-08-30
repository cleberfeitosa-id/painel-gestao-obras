# PAINEL DE GESTÃO DE OBRAS — PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-27
**Commit:** b427110
**Branch:** main
**Escala:** 105 arquivos · 77 `.ts`/`.tsx` · ~11,3k linhas · profundidade máx. 7

## OVERVIEW
Painel web p/ gestão de obras da Vasconcelos Engenharia: obras, plantas em PDF com calibragem de escala, tarefas georreferenciadas, calendário e relatório diário (RDO). Next.js 16 (App Router, Server Components/Server Actions) + TypeScript + Tailwind v4 + Supabase (Postgres/RLS/Auth/Storage) + Resend, hospedado na Vercel.

## STRUCTURE
```
./
├── src/app/          # rotas (file-system); (protegido)/ = área autenticada
├── src/components/   # ui/ (primitivos) + layout/ + feature domain
├── src/lib/          # lógica não-UI (clients, pdf, datas, email, storage)
├── supabase/migrations/0001_schema_inicial.sql  # schema completo (tabelas, RLS, buckets)
├── proxy.ts          # renovação de sessão (Next 16 substituiu middleware.ts)
└── diretrizes.txt    # requisitos originais do produto (spec)
```

## WHERE TO LOOK
| Tarefa | Local |
|--------|-------|
| Rotas/UI | `src/app/**/page.tsx` |
| Mutations/Server Actions | `src/app/**/acoes.ts` (co-locado com a rota) |
| Primitivos de UI | `src/components/ui/` (barrel export) |
| Auth | `proxy.ts` → `src/app/(protegido)/layout.tsx` → `src/lib/supabase/*` |
| Clients Supabase | `src/lib/supabase/{client,server,admin,session}.ts` |
| Datas (fuso-safe) | `src/lib/datas.ts` |
| Uploads p/ Storage | `src/lib/armazenamento.ts` |
| Coordenadas PDF | `src/lib/pdf/coordenadas.ts` |
| E-mail | `src/lib/email.ts` |
| Rótulos de domínio/enums | `src/lib/domain/rotulos.ts` |
| Schema DB | `supabase/migrations/0001_schema_inicial.sql` |
| Tipos DB gerados | `src/lib/supabase/database.types.ts` |

## CODE MAP (domínio)
Modelo: `perfis` · `obras` · `plantas` · `planta_calibracoes` · `tarefas` · `tarefa_comentarios` · `tarefa_anexos` · `notificacoes` · `executores` · `tarefa_aprovacoes` · `lote_rascunhos`.
7 enums: `papel_usuario`, `status_obra`, `status_tarefa`, `prioridade_tarefa`, `tipo_localizacao`, `tipo_anexo`, `momento_anexo`.

| Fluxo | Cadeia |
|-------|--------|
| **Calibragem** | 2 cliques → `telaParaPdf` → modal `calibragem.tsx` → `calcularCalibracao` → action `salvarCalibracao` → upsert `planta_calibracoes` (PK `planta_id,pagina`) |
| **Pino/região** | clique/arraste → `telaParaPdf`/`retanguloParaRegiao` → querystring → `criarTarefa` grava `ponto_x/ponto_y` ou `regiao` em espaço PDF |
| **Render do pino** | `pdfParaPercentual` → `left/top` em % do quadro (imune a zoom/DPI) |
| **Lote** | pinos/regiões em modo Lote → action `salvarRascunhoLote` grava `lote_rascunhos` (localizacoes jsonb) → URL `nova-em-lote?lote=<id>` (curta; NUNCA querystring com localizacoes — estoura limite de URL) → `criarTarefasEmLote` cria as tarefas e **consome** o rascunho (delete) |
| **RDO** | `relatorios/[data]` = 4 queries paralelas (concluídas no dia + anexos do dia + comentários do dia → união = "em andamento" + contagem em aberto) → `botao-imprimir.tsx` (`useReactToPrint`, espera imagens carregarem) |
| **Upload** | action assina URL (`assinarUpload`) → navegador envia bytes direto ao Storage → `registrarAnexo`/`registrarPlanta` grava a linha |

RLS = empresa única: todo autenticado **lê tudo**; escrita por papel via `e_gestor()`/`e_admin()` (security definer, `search_path` vazio p/ evitar recursão). `tarefas` tem exceção: responsável atualiza a própria.

## CONVENTIONS
- **Alias**: imports internos sempre `@/*` → `./src/*` (sem `baseUrl`).
- **Nomes pt-BR**: arquivos/pastas kebab-case; componentes PascalCase; funções camelCase; constantes UPPER_SNAKE_CASE; tipos PascalCase.
- **Server Actions**: arquivos `acoes.ts`, padrão zod → checar permissão → `revalidatePath`/`redirect`. Guards são **duplicados por arquivo** (`verificarGestor`/`verificarAdmin`/`papelDoUsuario`) — não existe helper compartilhado.
- **Clients Supabase**: `admin.ts` usa secret key + `import "server-only"` (bypassa RLS). Não importar de componente client.
- **Língua**: strings de UI com acentos ("Em execução"); comentários e erros internos SEM acentos ("Sessao expirada").
- **Commit**: Conventional Commits em português (`feat:`, `chore:`); branch única `main`; push dispara deploy na Vercel.
- **Estilo**: `cn()` (`clsx` + `tailwind-merge`) — sem `cva`; variantes são `Record<Variante, string>`.
- **ESLint**: flat config (`eslint.config.mjs`) = `next/core-web-vitals` + `next/typescript`, zero regra custom.
- **Fontes**: Geist/Geist_Mono via `next/font/google` no layout raiz → vars `--font-geist-*` consumidas pelo `@theme`.

## ANTI-PATTERNS (OBRIGATÓRIO RESPEITAR)
- **Tempo**: NUNCA `new Date("YYYY-MM-DD")` → usar `paraData`/`chaveDia` de `src/lib/datas.ts` (off-by-one por fuso).
- **Uploads**: NUNCA passar arquivos pela função serverless (Vercel limita corpo a 4,5 MB) → assinar URL (`assinarUpload`) e enviar direto do navegador.
- **Coordenadas**: SEMPRE persistir em espaço do PDF (origem inf-esq, Y p/ cima), renderizar em % do quadro — nunca pixels de tela.
- **Sessão**: NUNCA inserir await/código entre `createServerClient` e `getUser` no `session.ts` (expira a sessão intermitentemente).
- **Server Components**: NÃO escrevem cookies **durante o render** (Server Actions e Route Handlers escrevem normalmente); a renovação de sessão acontece no `proxy.ts`. `server.ts` engole o erro de `setAll` num try/catch por isso.
- **E-mail**: falha de e-mail/notificação NUNCA pode derrubar a criação da tarefa (try/catch) — `RESEND_API_KEY` ausente só loga e marca `ignorado`.
- **Permissão**: SEMPRE revalidar permissão no servidor, nunca confiar no client.
- **RDO**: exportar via impressão do navegador (engine de print), não gerar PDF no servidor (limite 4,5 MB).
- **Calendário**: construído com `date-fns`; NÃO adicionar biblioteca de calendário (incompatibilidade React 19).
- **Tipos DB**: `supabase gen types typescript` sobrescreve `database.types.ts`; os aliases de domínio no final do arquivo (linhas 620+) precisam ser reaplicados após toda regeneração.
- **pdfjs worker**: NÃO pode rodar no servidor.
- **Tailwind**: CSS-first via `globals.css` `@theme inline`; NÃO criar `tailwind.config.js`.
- **"Hoje" no servidor**: NÃO usar `new Date().toISOString().split("T")[0]` — é UTC e adianta um dia entre 21h e 24h (UTC−3). Usar `hojeChave()` de `@/lib/datas`. **Dívida existente** em `painel/page.tsx:65` e `obras/[id]/page.tsx:93`.

## COMMANDS
```bash
npm install
cp .env.example .env.local   # 6 vars (4 obrigatórias)
npm run dev                  # servidor local
npm run build                # produção (roda type-check; NÃO roda lint)
npm run start                # serve build de produção
npm run lint                 # eslint (flat config) — passo separado do build
npx tsc --noEmit             # type-check isolado
# Regenerar tipos do banco (reaplicar aliases no fim do arquivo depois!):
supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/database.types.ts
# Sem testes; sem CI in-repo (Vercel auto-deploy em push para main)
```

## NOTES
- **Env obrigatórias**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable), `SUPABASE_SECRET_KEY` (só servidor), `NEXT_PUBLIC_APP_URL`; opcionais `RESEND_API_KEY`, `RESEND_FROM`.
- **Referência pendente (benigna)**: `next.config.ts` aliases `canvas` → `./empty-module.ts` via `turbopack.resolveAlias`, MAS o arquivo NÃO existe no repo. **Verificado: `npm run build` passa mesmo assim** — não "consertar" às cegas; só criar se o pdfjs quebrar no bundle.
- **Código morto**: `src/lib/supabase/client.ts` (`createBrowserClient`) não é importado em lugar nenhum — todo acesso a dados é server-side. Remover ou usar conscientemente.
- **Datas hardcoded**: `calendario-interativo.tsx:34-35` fixa `ANO_CALENDARIO = 2026` e `JANEIRO_2026_DOMINGO = 4` — quebra em 2027.
- **Config extra**: `.vercelignore` (ignora build + `diretrizes.txt`); `postcss.config.mjs` só com `@tailwindcss/postcss`; `next-env.d.ts` está no `.gitignore` (incomum); sem `packageManager`/`engines` — Node não está pinado e o `@supabase/supabase-js` avisa que Node ≤20 será descontinuado.
- **`images.remotePatterns`** é derivado de `NEXT_PUBLIC_SUPABASE_URL` em build-time; sem essa env no build, imagens do Storage quebram.
- **Chaves Supabase**: `publishable`/`secret` são a nomenclatura nova (ex-`anon`/`service_role`); migração obrigatória até o fim de 2026.
- **`proxy.ts`**: convenção do Next 16 que substitui `middleware.ts` (os dois NÃO podem coexistir; `config.matcher` continua igual; runtime edge NÃO é suportado). Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- **Limitações conhecidas**: confirmação de e-mail ativa; plano grátis Supabase limita arquivos a 50 MB; Resend sandbox (100 emails/dia, só owner).
- Buckets privados: `plantas` (só PDF) e `anexos` (imagens/vídeos/arquivos).
- Papéis: `admin` (tudo), `gestor` (cria/edita obras, plantas, tarefas), `colaborador` (consulta + atualiza tarefas próprias).
