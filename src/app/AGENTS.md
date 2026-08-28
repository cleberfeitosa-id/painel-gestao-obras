# SRC/APP — ROTAS (NEXT.JS FILE-SYSTEM)

## OVERVIEW
Rotas do App Router. `(protegido)/` é o grupo autenticado (painel, obras, plantas, tarefas, calendario, relatorios, usuarios); `login`, `cadastro`, `auth`, `erro` são públicas. Toda Mutation mora num `acoes.ts` co-locado com a rota.

## STRUCTURE
```
src/app/
├── (protegido)/          # área autenticada (layout exige sessão)
│   ├── painel/           # dashboard
│   ├── obras/            # [id]/ + [id]/plantas/[plantaId]/ + nova/
│   ├── plantas/          # lista global de plantas
│   ├── tarefas/          # [id]/ + [id]/editar/ + nova/
│   ├── calendario/       # [data]/ + page
│   ├── relatorios/       # [data]/ (botao-imprimir client)
│   └── usuarios/
├── login/ cadastro/      # públicas
├── auth/confirmar/       # route.ts (confirmação e-mail / OTP)
├── erro/                 # página de erro
├── layout.tsx            # shell raiz (fontes, metadata, lang pt-BR)
└── page.tsx              # `/` → redirect /painel
```

## WHERE TO LOOK
| Tarefa | Local |
|--------|-------|
| Página (UI) | `<rota>/page.tsx` |
| Mutations/Server Actions | `<rota>/acoes.ts` |
| Shell autenticado | `(protegido)/layout.tsx` |
| Validação de rota dinâmica | `[id]/page.tsx` ou `[data]/page.tsx` (zod + `notFound`) |

## SERVER ACTIONS (6 arquivos, 23 actions)
| Arquivo | Actions | Guard |
|---------|---------|-------|
| `login/acoes.ts` | `entrar`, `cadastrar`, `sair` | — (público) |
| `(protegido)/obras/acoes.ts` | `criarObra`, `atualizarObra`, `excluirObra` | `verificarGestor` |
| `(protegido)/obras/[id]/plantas/acoes.ts` | `assinarUploadPlanta`, `registrarPlanta`, `salvarCalibracao`, `excluirPlanta`, `renovarUrlPlanta` | `verificarGestor` |
| `(protegido)/tarefas/acoes.ts` (550 ln) | `criarTarefa`, `atualizarTarefa`, `alterarStatus`, `excluirTarefa`, `adicionarComentario`, `excluirComentario`, `assinarUploadAnexo`, `registrarAnexo`, `excluirAnexo` | `eGestor` OU responsável |
| `(protegido)/calendario/acoes.ts` | `reagendarTarefa` | `papelDoUsuario` OU responsável |
| `(protegido)/usuarios/acoes.ts` | `atualizarPapel`, `alternarAtivo` | `verificarAdmin` |

Guards são **reimplementados em cada arquivo** — não há helper compartilhado. Ao criar um novo `acoes.ts`, copie o padrão do vizinho mais próximo.

## CONVENTIONS
- **Rotas file-system**: segmentos kebab-case pt-BR. Rota dinâmica `[id]`/`[data]`; grupo de rota `(protegido)`.
- **Server Actions**: `acoes.ts` com `"use server"` no topo. Padrão: validar com zod (schema no mesmo arquivo ou em `schema.ts`) → revalidar permissão no servidor → executar → `revalidatePath`/`redirect`. `"use client"` mas `page.tsx` continua Server Component.
- **Server Components default**: páginas são SC por padrão; marcar `"use client"` só em folhas (botões/forms/componentes interativos).
- **Parâmetros de rota**: `params`/`searchParams` em Next 16 são `Promise` → `await` dentro do componente/page.
- **Erro/404**: NÃO existem `loading.tsx`/`error.tsx`/`not-found.tsx` em lugar nenhum. 404 = `notFound()` inline após consulta ao banco; `/erro` cobre falhas de auth.
- **Route handlers**: só existe UM (`auth/confirmar/route.ts`, GET, `exchangeCodeForSession`/`verifyOtp`). Todo o resto é Server Action.
- **Validação `[data]`**: regex zod + round-trip `chaveDia(paraData(v)) === v` (rejeita `2026-02-30`, que o `parseISO` normalizaria).
- **Client components**: apenas `login/page.tsx`, `cadastro/page.tsx` (`useActionState`) e `relatorios/[data]/botao-imprimir.tsx`. Todas as outras páginas são Server Components.
- **Login/sessão**: `(protegido)/layout.tsx` busca `perfis` via `createClient()` do servidor; usuário sem perfil vai para `/login`.

## ANTI-PATTERNS
- NÃO colocar mutação fora de `acoes.ts` (Server Action) — nada de `fetch` num POST ad-hoc.
- NÃO confiar no client p/ permissão: revalidar no servidor (ex.: apenas admin/gestor escrevem obras).
- NÃO escrever cookies em Server Component — renovação de sessão só no `proxy.ts`.
- NÃO gerar PDF no servidor (limite 4,5 MB) — RDO usa impressão do navegador.
