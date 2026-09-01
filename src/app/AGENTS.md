# SRC/APP — ROTAS (NEXT.JS FILE-SYSTEM)

## OVERVIEW
Rotas do App Router. `(protegido)/` é o grupo autenticado (painel, obras, plantas, tarefas, calendario, relatorios, usuarios, levantamento); `login`, `cadastro`, `definir-senha`, `auth`, `erro` são públicas. Toda Mutation mora num `acoes.ts` co-locado com a rota.

## STRUCTURE
```
src/app/
├── (protegido)/          # área autenticada (layout exige sessão)
│   ├── painel/           # dashboard geral
│   ├── obras/            # [id]/ (+ medicoes/, executores/, plantas/) + nova/
│   ├── plantas/          # lista global de plantas
│   ├── tarefas/          # [id]/ (+ editar/) + nova/ + nova-em-lote/ + tags/
│   ├── calendario/       # [data]/ + page (planejamento)
│   ├── relatorios/       # [data]/ + periodo/ (RDO impresso)
│   ├── levantamento/     # [id]/ + lista (quantitativo 3D/circuitos)
│   └── usuarios/         # gestão de equipe e convites
├── login/ cadastro/ definir-senha/ # públicas
├── auth/confirmar/       # route.ts (confirmação e-mail / OTP / convite)
├── erro/                 # fallback de erro
├── layout.tsx            # shell raiz (fontes, metadata, lang pt-BR)
└── page.tsx              # `/` → redirect /painel
```

## WHERE TO LOOK
| Tarefa | Local |
|--------|-------|
| Página (UI) | `<rota>/page.tsx` |
| Mutations/Server Actions | `<rota>/acoes.ts` |
| Shell autenticado | `(protegido)/layout.tsx` |
| Callback auth/convite | `auth/confirmar/route.ts` |
| Snapshots RDO | `(protegido)/relatorios/snapshots.ts` |

## SERVER ACTIONS (10 arquivos)
| Arquivo | Actions Principais | Guard |
|---------|-------------------|-------|
| `login/acoes.ts` | `entrar`, `cadastrar`, `sair` | — (público) |
| `definir-senha/acoes.ts` | `definirSenha` | — (público) |
| `(protegido)/obras/acoes.ts` | `criarObra`, `atualizarObra`, `excluirObra` | `verificarGestor` |
| `(protegido)/obras/[id]/plantas/acoes.ts` | `assinarUploadPlanta`, `registrarPlanta`, `salvarCalibracao`, `excluirPlanta`, `renovarUrlPlanta` | `verificarGestor` |
| `(protegido)/obras/[id]/medicoes/acoes.ts` | `criarMedicao`, `atualizarMedicao`, `atualizarPrecoCatalogo`, `salvarMedicaoTarefa`, `registrarPagamento` | `verificarGestor` |
| `(protegido)/obras/[id]/executores/acoes.ts` | `criarExecutor`, `atualizarExecutor`, `alternarAtivoExecutor` | `verificarGestor` |
| `(protegido)/tarefas/acoes.ts` | `criarTarefa`, `criarTarefasEmLote`, `atualizarTarefa`, `alterarStatus`, `avaliarTarefa`, `reverterAprovacao`, `salvarRascunhoLote`, `assinarUploadAnexo` | `eGestor` OU responsável/supervisor |
| `(protegido)/levantamento/acoes.ts` | `criarNovoLevantamento`, `salvarLevantamento`, `salvarCalibracaoDireta`, `criarTarefasEmLoteLevantamento`, `excluirLevantamento` | `verificarGestor` |
| `(protegido)/calendario/acoes.ts` | `reagendarTarefa` | `papelDoUsuario` OU responsável |
| `(protegido)/usuarios/acoes.ts` | `atualizarPapel`, `convidarUsuario`, `alternarAtivo` | `verificarAdmin` |

Guards são **reimplementados em cada arquivo** — não há helper compartilhado. Ao criar um novo `acoes.ts`, copie o padrão do vizinho mais próximo.

## CONVENTIONS
- **Rotas file-system**: segmentos kebab-case pt-BR. Rota dinâmica `[id]`/`[data]`/`[plantaId]`/`[medicaoId]`; grupo `(protegido)`.
- **Server Actions**: `acoes.ts` com `"use server"`. Zod schema (`esquema*`) → checar permissão → `createClient` (ou `createAdminClient` p/ bypass RLS) → `revalidatePath` → `redirect` (ou return `{ erro }`).
- **Server Components default**: páginas são SC por padrão; `"use client"` só em componentes interativos com hooks.
- **Parâmetros de rota**: `params`/`searchParams` em Next 16 são `Promise` → `await` dentro do componente/page.
- **Erro/404**: sem `loading.tsx`/`error.tsx`/`not-found.tsx` na pasta de rota. 404 = `notFound()` inline; `/erro` cobre falhas de auth.
- **Route handlers**: só existe UM (`auth/confirmar/route.ts`, GET). Todo o resto é Server Action.
- **Validação `[data]`**: regex zod + round-trip `chaveDia(paraData(v)) === v`.

## ANTI-PATTERNS
- NÃO colocar mutação fora de `acoes.ts` (Server Action) — nada de `fetch` num POST ad-hoc.
- NÃO confiar no client p/ permissão: revalidar no servidor (ex.: apenas admin/gestor escrevem obras).
- NÃO escrever cookies em Server Component — renovação de sessão só no `proxy.ts`.
- NÃO gerar PDF no servidor (limite 4,5 MB) — RDO e levantamento usam impressão do navegador.
