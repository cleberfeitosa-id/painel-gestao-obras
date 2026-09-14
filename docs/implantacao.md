# Guia de Implantacao — Painel de Gestao de Obras

## Arquitetura por Empresa

Cada empresa/organizacao deve operar com seu **proprio projeto Supabase** isolado.
Nao existe multi-tenancy real: o isolamento e feito por infraestrutura separada.

### Componentes por Instalacao

| Recurso | Escopo | Observacao |
|---------|--------|------------|
| Projeto Supabase | 1 por empresa | Database, Auth, Storage, Edge Functions |
| Bucket `plantas` | Privado | PDFs de plantas tecnicas |
| Bucket `anexos` | Privado | Fotos, videos, documentos de tarefa |
| Projeto Vercel | 1 por empresa | Deploy da aplicacao Next.js |
| Dominio | Proprio | Ex: painel.empresa.com.br |
| Resend | 1 API key por empresa | Envio de e-mails transacionais |
| Variaveis de ambiente | Arquivo `.env.local` | Configuracao de branding e integracao |

---

## Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicavel (ex-anon) | `sb_publishable_xxx` |
| `SUPABASE_SECRET_KEY` | Chave secreta (servidor) | `sb_secret_xxx` |
| `NEXT_PUBLIC_APP_URL` | URL publica da aplicacao | `https://painel.empresa.com.br` |

### Branding

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `NEXT_PUBLIC_NOME_EMPRESA` | Vasconcelos Engenharia | Nome da empresa em UI, e-mails, PDFs |
| `NEXT_PUBLIC_NOME_APLICACAO` | Painel de Gestao de Obras | Nome da aplicacao em titulos |
| `NEXT_PUBLIC_LOGO_URL` | (vazio) | URL do logo (HTTPS ou `/logo.png` local) |
| `NEXT_PUBLIC_COR_PRIMARIA` | `#F48040` | Cor primaria em hex |
| `NEXT_PUBLIC_COR_DESTAQUE` | `#1d4ed8` | Cor de destaque em hex |
| `NEXT_PUBLIC_FRASE_TAGLINE` | (vazio) | Tagline institucional opcional |
| `NEXT_PUBLIC_FAVICON_URL` | (vazio) | URL do favicon personalizado |

### Opcional

| Variavel | Descricao |
|----------|-----------|
| `RESEND_API_KEY` | Chave API do Resend para envio de e-mails |
| `RESEND_FROM` | Remetente dos e-mails (ex: `Empresa <notif@dominio.com>`) |

---

## Checklist de Implantacao

### 1. Projeto Supabase

- [ ] Criar novo projeto no Supabase Dashboard
- [ ] Anotar `SUPABASE_URL`, `PUBLISHABLE_KEY` e `SECRET_KEY`
- [ ] Aplicar migracoes em ordem sequencial (`supabase/migrations/0001_*.sql` ate a mais recente)
- [ ] Verificar as tabelas, buckets e funções criados pelas migrações, incluindo o módulo de orçamento e o bucket privado `orcamentos`
- [ ] Configurar Storage: criar buckets `plantas` e `anexos` (privados)
- [ ] Verificar funcoes SQL `e_gestor()`, `e_admin()` com `SECURITY DEFINER`

### 2. Variaveis de Ambiente

- [ ] Copiar `.env.example` para `.env.local`
- [ ] Preencher todas as obrigatorias
- [ ] Configurar branding: nome, logo, cores, favicon
- [ ] Validar cores hex (6 ou 8 caracteres, com `#`)
- [ ] Testar localmente com `npm run dev`

### 3. Deploy (Vercel)

- [ ] Conectar repositorio ao Vercel
- [ ] Configurar variaveis de ambiente no painel Vercel
- [ ] Verificar `NEXT_PUBLIC_APP_URL` com dominio final
- [ ] Confirmar deploy bem-sucedido

### 4. Supabase Auth

- [ ] Em Authentication > URL Configuration, definir **Site URL**
- [ ] Adicionar URL de redirect: `https://seu-dominio.vercel.app/auth/confirmar`
- [ ] Testar fluxo de login completo

### 5. Pos-Deploy

- [ ] Acessar a aplicacao e criar primeiro usuario (sera admin)
- [ ] Verificar que branding aparece corretamente (logo, nome, cores)
- [ ] Testar envio de e-mail de notificacao
- [ ] Verificar RDO e exports de PDF com cores da marca

---

## Notas Importantes

### Isolamento

- Cada empresa tem projeto Supabase, Vercel e dominio **separados**
- Nao existe compartilhamento de banco ou RLS entre empresas
- O branding e puramente visual — nao afeta isolamento de dados

### Logo

- Se `NEXT_PUBLIC_LOGO_URL` nao estiver definido e a empresa for a Vasconcelos (padrao), o SVG nativo e exibido
- Para outras empresas: definir `NEXT_PUBLIC_LOGO_URL` (HTTPS ou caminho em `/public`)
- Se nao houver logo definido e nao for a Vasconcelos, um fallback textual com a primeira letra e exibido
- **NUNCA** o logo da Vasconcelos e exibido para outras empresas

### Cores

- `corPrimaria` e `corDestaque` sao validadas como hex no startup
- Valores invalidos retornam ao padrao Vasconcelos automaticamente
- As cores afetam: cabecalhos PDF, botoes e-mail, selos, tokens CSS (`--branding-cor-primaria`, `--branding-cor-destaque`)
- **NAO** afetam: cores de circuitos eletricos, geometria CAD, status de tarefas

### Migracoes

- Executar sempre em ordem numérica, da `0001` até a migração mais recente
- Cada migracao e idempotente (usa `IF NOT EXISTS` / `ON CONFLICT`)
- Apos qualquer alteracao de schema, regenerar tipos: `supabase gen types typescript`

### E-mails

- Sem `RESEND_API_KEY`, envios sao registrados em log mas nao disparados
- O remetente (`RESEND_FROM`) deve ser validado no dominio do Resend
- E-mails de falha NUNCA interrompem a criacao de tarefas

### PDF / RDO

- Exportacao via engine de print do navegador (sem geracao server-side)
- Limite do Vercel: corpo da requisicao < 4,5 MB (uploads usam URLs pré-assinadas)
- Cores de marca sao aplicadas em cabecalhos e selos — nao alteram geometria CAD
