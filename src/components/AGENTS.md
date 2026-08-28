# SRC/COMPONENTS — UI E COMPONENTES DE DOMÍNIO

## OVERVIEW
Componentes React. `ui/` = primitivos reutilizáveis (barrel export); `layout/` = shell da app; o resto espelha domínios de feature (obras, plantas, tarefas, calendario, relatorios, usuarios).

## STRUCTURE
```
src/components/
├── ui/          # Botao, Campo, Cartao, Modal, Tabela, Etiqueta, EstadoVazio, Avatar, Carregando (barrel index.ts)
├── layout/      # barra-lateral (nav), cabecalho
├── obras/       # formulario-obra, filtros-obras
├── plantas/     # visualizador-planta (+894 linhas), calibragem, area-planta, upload, lista-tarefas, pdfjs.ts, tipos.ts
├── tarefas/     # formulario-tarefa, alterar-status, anexos, comentarios, filtros-tarefas
├── calendario/  # calendario-interativo, filtros-calendario
├── relatorios/  # formulario-relatorio
└── usuarios/    # editar-papel
```

## WHERE TO LOOK
| Necessidade | Local |
|-------------|-------|
| Primitivo reutilizável | `ui/` (importar via `@/components/ui` barrel) |
| Shell/navegação | `layout/` |
| Formulários de feature | `<domínio>/formulario-*.tsx` |

## PADRÕES COMPARTILHADOS
- **Formulários**: Server Action + `useActionState` + `useFormStatus` (React 19). **Sem react-hook-form.** Contrato: `(estadoAnterior, formData) => Promise<{erro?: string}>`; IDs vão em `<input type="hidden">`; erro vira `<div role="alert" className="border-perigo bg-perigo/5">`.
- **Mutações fora de formulário**: `useTransition` + chamada direta da action, com estado otimista e rollback quando `resultado.erro`.
- **Toast/notificação**: NÃO existe (sem sonner/react-hot-toast). Feedback = alerta inline ou `Modal` de confirmação.
- **Modal**: `<dialog>` nativo (`ui/modal.tsx`), controlado por `aberto`/`aoFechar`, tamanhos sm/md/lg/xl. Único primitivo `ui/` que é client.
- **Filtros**: estado na URL via `useRouter` + `useSearchParams` + `URLSearchParams` (obras, tarefas, calendário).
- **Etiquetas**: a string Tailwind vem de `classe` nos mapas de `@/lib/domain/rotulos.ts` — não hardcodar cor de status/prioridade.

## CONVENTIONS
- **Nomes**: arquivos kebab-case pt-BR (`formulario-obra.tsx`); componentes PascalCase pt-BR (`BarraLateral`, `VisualizadorPlanta`).
- **Client vs Server**: 21 arquivos são `"use client"`; os 10 restantes (todos `ui/`, menos `modal.tsx`, mais `plantas/tipos.ts`) são server-compatible. Marcar `"use client"` só quando houver hook/evento.
- **Colisão de nome**: `ui/tabela.tsx` exporta `Cabecalho` (thead) e `layout/cabecalho.tsx` exporta `Cabecalho` (header da app) — importe explicitamente.
- **UI tokens Tailwind**: usar classes semânticas de `@theme` — `azul-*` (primário), `ambar-*` (destaque), `superficie-*` (neutro), `sucesso/aviso/perigo/info`; `cn()` de `@/lib/utils` p/ merge condicional.
- **Primitivos**: componentes `ui/` recebem props tipadas (`BotaoProps`), estendem `className` via `cn()`, e adicionam-se a um único barrel `ui/index.ts`.
- **pdfjs**: worker (`pdfjs.ts`) é client-only — NUNCA importar de Server Component. `visualizador-planta.tsx` é o ponto mais complexo do projeto (+894 linhas).

## ANTI-PATTERNS
- NÃO usar `new Date()` em string `YYYY-MM-DD` — passar por `paraData`/`chaveDia` (`@/lib/datas`).
- NÃO enviar upload pela função serverless — usar URL assinada (`assinarUpload`) + envio direto do navegador.
- NÃO renderizar coordenadas de planta em pixels de tela — sempre % do quadro (`pdfParaPercentual`).
- NÃO rodar worker do pdfjs no servidor.
- NÃO duplicar primitivo que já existe em `ui/` — estender via barrel.
