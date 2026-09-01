# PAINEL DE GESTÃO DE OBRAS — PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-31
**Commit:** a01cb39
**Branch:** main
**Escala:** 199 arquivos · 104 `.ts`/`.tsx` · ~35k linhas · profundidade máx. 8

## OVERVIEW
Painel web p/ gestão de obras da Vasconcelos Engenharia: obras, plantas em PDF com calibragem de escala, tarefas georreferenciadas, levantamento quantitativo (3D/circuitos/descidas), medições com catálogo de preços, calendário e relatório diário (RDO). Next.js 16 (App Router, Server Components/Server Actions) + TypeScript + Tailwind v4 + Supabase (Postgres/RLS/Auth/Storage) + Resend, hospedado na Vercel.

## STRUCTURE
```
./
├── src/app/          # rotas (file-system); (protegido)/ = área autenticada; acoes.ts co-locados
├── src/components/   # ui/ (primitivos barrel) + layout/ + feature subfolders (plantas, tarefas, levantamento, medicao, etc.)
├── src/lib/          # lógica não-UI (supabase/, pdf/, levantamento/, datas.ts, email.ts, armazenamento.ts)
├── supabase/migrations/  # 16 migrations (schema, enums, RLS, triggers, buckets)
├── proxy.ts          # renovação de sessão e roteamento auth (Next 16 substituiu middleware.ts)
└── scripts/          # scripts operacionais pontuais (ex.: reinvitar-convite.mjs)
```

## WHERE TO LOOK
| Tarefa | Local |
|--------|-------|
| Rotas/Páginas (UI) | `src/app/**/page.tsx` |
| Mutations/Server Actions | `src/app/**/acoes.ts` (co-locado com a rota) |
| Primitivos de UI | `src/components/ui/` (barrel export `@/components/ui`) |
| Visualizador PDF / Plantas | `src/components/plantas/` (`visualizador-planta.tsx`, `pdfjs.ts`) |
| Levantamento Quantitativo | `src/components/levantamento/` + `src/lib/levantamento/` |
| Medições / Pagamentos | `src/components/medicao/` + `src/app/(protegido)/obras/[id]/medicoes/` |
| Auth & Sessão | `proxy.ts` → `src/lib/supabase/session.ts` → `src/app/(protegido)/layout.tsx` |
| Clients Supabase | `src/lib/supabase/{client,server,admin,session}.ts` |
| Datas (fuso-safe) | `src/lib/datas.ts` (`paraData`, `chaveDia`, `hojeChave`) |
| Uploads p/ Storage | `src/lib/armazenamento.ts` (`assinarUpload`, `urlAssinada`) |
| Coordenadas PDF / Matemática | `src/lib/pdf/coordenadas.ts` |
| E-mail (Resend) | `src/lib/email.ts` |
| Rótulos de domínio/enums | `src/lib/domain/rotulos.ts` |
| Schema DB / Migrações | `supabase/migrations/*.sql` |
| Tipos DB gerados | `src/lib/supabase/database.types.ts` |

## CODE MAP (domínio)
18 tabelas: `perfis` · `obras` · `plantas` · `planta_calibracoes` · `tarefas` · `tarefa_comentarios` · `tarefa_anexos` · `notificacoes` · `catalogo_precos` · `executores` · `tarefa_aprovacoes` · `lote_rascunhos` · `tags_tarefa` · `tarefa_dependencias` · `tarefa_medicoes` · `medicoes` · `medicao_pagamentos` · `levantamentos`.
8 enums: `papel_usuario`, `status_obra`, `status_tarefa`, `prioridade_tarefa`, `tipo_localizacao` (nenhuma, ponto, regiao, distancia, circuito, area, descida), `tipo_anexo`, `momento_anexo`, `aprovacao_tarefa`.

| Fluxo | Cadeia |
|-------|--------|
| **Calibragem** | 2 cliques → `telaParaPdf` → modal `calibragem.tsx` → `calcularCalibracao` → action `salvarCalibracao`/`salvarCalibracaoDireta` → upsert `planta_calibracoes` (PK `planta_id,pagina`) |
| **Pino/região** | clique/arraste → `telaParaPdf`/`retanguloParaRegiao` → querystring → `criarTarefa` grava `ponto_x/ponto_y` ou `regiao` em espaço PDF |
| **Render do pino** | `pdfParaPercentual` → `left/top` em % do quadro (imune a zoom/DPI); `situacaoDaTarefa` define cor (aprovação > status) |
| **Lote (planta)** | pinos/regiões em modo Lote → action `salvarRascunhoLote` grava `lote_rascunhos` (localizacoes jsonb) → URL `nova-em-lote?lote=<id>` (curta; NUNCA querystring com localizacoes) → `criarTarefasEmLote` cria as tarefas e consome o rascunho |
| **Levantamento** | planta calibrada → `AreaLevantamento` desenha pontos/distâncias/circuitos/áreas/descidas 3D → `calculos.ts` agrega quantitativos → action `salvarLevantamento` grava jsonb → exporta CSV/impressão PDF ou `criarTarefasEmLoteLevantamento` converte itens em tarefas com `localizacao_detalhe` |
| **Medição** | obra → lista `medicoes` (RPC `valor_executado/pendente/pago`) → detalhe `[medicaoId]` com catálogo de preços e itens por tarefa → `salvarMedicaoTarefa` grava `tarefa_medicoes` → registro de pagamentos em `medicao_pagamentos` |
| **RDO** | `relatorios/[data]` = 4 queries paralelas (concluídas no dia + anexos + comentários → "em andamento" + abertas) + `snapshots.ts` (figuras com pinos) → `botao-imprimir.tsx` (`useReactToPrint`, espera imagens) |
| **Upload** | action assina URL (`assinarUpload`) → navegador envia bytes direto ao Storage → `registrarAnexo`/`registrarPlanta` grava a linha |

RLS = empresa única: todo autenticado **lê tudo** (`using (true)`); escrita por papel via `e_gestor()`/`e_admin()` (security definer, `search_path=''` p/ evitar recursão). `tarefas` tem exceção: responsável atualiza a própria.

## CONVENTIONS
- **Alias**: imports internos sempre `@/*` → `./src/*` (sem `baseUrl`).
- **Nomes pt-BR**: arquivos/pastas kebab-case; componentes PascalCase; funções camelCase; constantes UPPER_SNAKE_CASE; tipos PascalCase.
- **Server Actions**: arquivos `acoes.ts` com `"use server"`, padrão zod (`esquema*`) → checar permissão no servidor → executar → `revalidatePath`/`redirect`. Guards são **duplicados por arquivo** (`verificarGestor`/`verificarAdmin`/`papelDoUsuario`).
- **Clients Supabase**: `admin.ts` usa secret key + `import "server-only"` (bypassa RLS). Usar apenas quando estritamente necessário (convites, bulk updates, aprovações).
- **Língua**: strings de UI com acentos ("Em execução"); comentários e erros internos SEM acentos ("Sessao expirada").
- **Commit**: Conventional Commits em português (`feat:`, `chore:`); branch única `main`; push dispara deploy na Vercel.
- **Estilo**: `cn()` (`clsx` + `tailwind-merge`) — sem `cva`; variantes são `Record<Variante, string>`.
- **ESLint**: flat config (`eslint.config.mjs`) = `next/core-web-vitals` + `next/typescript`, zero regra custom.
- **Fontes**: Geist/Geist_Mono via `next/font/google` no layout raiz → vars `--font-geist-*` consumidas pelo `@theme`.

## ANTI-PATTERNS (OBRIGATÓRIO RESPEITAR)
- **Tempo**: NUNCA `new Date("YYYY-MM-DD")` ou `new Date().toISOString().split("T")[0]` no servidor → usar `paraData`/`chaveDia`/`hojeChave` de `src/lib/datas.ts` (evita off-by-one UTC−3).
- **Uploads**: NUNCA passar arquivos pela função serverless (Vercel limita corpo a 4,5 MB) → assinar URL (`assinarUpload`) e enviar direto do navegador.
- **Coordenadas**: SEMPRE persistir em espaço do PDF (origem inf-esq, Y p/ cima), renderizar em % do quadro — nunca pixels de tela.
- **Sessão**: NUNCA inserir await/código entre `createServerClient` e `getUser` no `session.ts` (expira a sessão intermitentemente).
- **Server Components**: NÃO escrevem cookies **durante o render**; a renovação de sessão acontece no `proxy.ts`. `server.ts` engole o erro de `setAll` num try/catch.
- **E-mail & Auxiliares**: falha de e-mail ou limpeza secundária NUNCA pode derrubar a criação/mutação principal (sempre try/catch isolado).
- **Permissão**: SEMPRE revalidar permissão no servidor, nunca confiar no client.
- **RDO / Exportação**: exportar via impressão do navegador (engine de print), não gerar PDF no servidor (limite 4,5 MB).
- **Calendário**: construído com `date-fns`; NÃO adicionar biblioteca de calendário (incompatibilidade React 19).
- **Lote de Tarefas**: NUNCA passar listas de coordenadas na querystring da URL — usar tabela `lote_rascunhos` com ID curto.
- **Tipos DB**: `supabase gen types typescript` sobrescreve `database.types.ts`; os aliases de domínio no final do arquivo (linhas 1170+) precisam ser reaplicados após toda regeneração.
- **pdfjs worker**: NÃO pode rodar no servidor — componentes que dependem de worker ou DOMMatrix usam `dynamic(..., { ssr: false })`.
- **Tailwind**: CSS-first via `globals.css` `@theme inline`; NÃO criar `tailwind.config.js`.

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
- **Referência pendente (benigna)**: `next.config.ts` aliases `canvas` → `./empty-module.ts` via `turbopack.resolveAlias`, MAS o arquivo NÃO existe no repo. `npm run build` passa mesmo assim — só criar se o pdfjs quebrar no bundle.
- **Código morto**: `src/lib/supabase/client.ts` (`createBrowserClient`) não é importado em lugar nenhum — todo acesso a dados é server-side.
- **Config extra**: `.vercelignore` (ignora build + `diretrizes.txt`); `postcss.config.mjs` só com `@tailwindcss/postcss`; `next-env.d.ts` está no `.gitignore`.
- **`images.remotePatterns`** é derivado de `NEXT_PUBLIC_SUPABASE_URL` em build-time; sem essa env no build, imagens do Storage quebram.
- **Chaves Supabase**: `publishable`/`secret` são a nomenclatura nova (ex-`anon`/`service_role`).
- **`proxy.ts`**: convenção do Next 16 que substitui `middleware.ts` (os dois NÃO podem coexistir; `config.matcher` continua igual; runtime edge NÃO é suportado).
- **Limitações conhecidas**: confirmação de e-mail ativa; plano grátis Supabase limita arquivos a 50 MB; Resend sandbox (100 emails/dia, só owner).
- Buckets privados: `plantas` (só PDF) e `anexos` (imagens/vídeos/arquivos).
- Papéis: `admin` (tudo), `gestor` (cria/edita obras, plantas, tarefas, medições, levantamentos), `colaborador` (consulta + atualiza tarefas próprias).
