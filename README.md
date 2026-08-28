# Painel de Gestão de Obras — Vasconcelos Engenharia

Aplicação web para gestão de obras, plantas em PDF com calibragem de escala, tarefas georreferenciadas na planta, relatório diário de obra (RDO) e planejamento em calendário.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS v4 (configuração CSS-first, sem `tailwind.config.js`) |
| Banco / Auth / Storage | Supabase (Postgres + RLS) |
| PDF | `react-pdf` + `pdfjs-dist` |
| E-mail | Resend |
| Hospedagem | Vercel |

## Funcionalidades

- **Autenticação** por e-mail e senha, com cadastro de novos usuários. O primeiro usuário cadastrado torna-se administrador automaticamente.
- **Obras**: cadastro completo, responsável, status, prazos e indicadores de progresso.
- **Plantas em PDF**: upload direto para o Storage, navegação por páginas, zoom e pan.
- **Calibragem de escala** por página: marque dois pontos, informe a distância real e o sistema passa a medir distâncias e áreas sobre a planta.
- **Tarefas vinculadas à planta**: um ponto ou uma região do PDF vira uma tarefa.
- **Tarefas**: status, responsável, prazo, prioridade, comentários, imagens, vídeos e arquivos.
- **Comprovação obrigatória**: no cadastro da tarefa define-se se a conclusão exige foto, vídeo e/ou arquivo. A regra é validada no servidor.
- **Notificação por e-mail** ao responsável na criação da tarefa e em cada troca de responsável.
- **Busca e filtros** por obra, usuário, status, prazo, prioridade e localização no PDF, com estado na URL (compartilhável).
- **Calendário** de planejamento com reagendamento por arrastar e alternativa acessível.
- **RDO** — relatório diário com atividades executadas e registros fotográficos, exportável em PDF pela impressão do navegador.

## Configuração local

```bash
npm install
cp .env.example .env.local   # preencha as credenciais
npm run dev
```

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável (`sb_publishable_...`), usada no navegador |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta (`sb_secret_...`), **apenas no servidor** |
| `RESEND_API_KEY` | não | Sem ela o envio é apenas registrado em log e a aplicação segue funcionando |
| `RESEND_FROM` | não | Remetente. Exige domínio verificado na Resend |
| `NEXT_PUBLIC_APP_URL` | sim | URL pública, usada nos links dos e-mails |

## Banco de dados

O schema completo está em `supabase/migrations/0001_schema_inicial.sql`: tabelas, enums, funções auxiliares, triggers, políticas de RLS e os buckets de Storage.

Para aplicar em um projeto novo, cole o conteúdo do arquivo no **SQL Editor** do Supabase, ou use a CLI:

```bash
supabase link --project-ref <seu-ref>
supabase db push
```

Regenerar os tipos após alterar o schema:

```bash
supabase gen types typescript --project-id <seu-ref> --schema public > src/lib/supabase/database.types.ts
```

> Os aliases de domínio ficam no final do arquivo gerado e precisam ser reaplicados após a regeneração.

### Modelo de dados

`perfis` · `obras` · `plantas` · `planta_calibracoes` · `tarefas` · `tarefa_comentarios` · `tarefa_anexos` · `notificacoes`

Buckets privados: `plantas` (somente PDF) e `anexos` (imagens, vídeos e arquivos).

### Permissões

| Papel | Permissões |
| --- | --- |
| `admin` | Tudo, incluindo gestão de usuários e papéis |
| `gestor` | Cria e edita obras, plantas e tarefas |
| `colaborador` | Consulta tudo e atualiza as tarefas sob sua responsabilidade |

## Decisões de arquitetura

**Upload direto para o Storage.** Os arquivos nunca passam pela função serverless: a Vercel limita o corpo da requisição a 4,5 MB. O servidor apenas assina uma URL e o navegador envia os bytes direto ao Supabase.

**Coordenadas em espaço do PDF.** Pontos e regiões são gravados em pontos de PDF (origem inferior esquerda, eixo Y para cima) e renderizados em porcentagem do quadro da página. Assim as marcações permanecem corretas em qualquer zoom, resolução ou tamanho de tela.

**Datas sem deslocamento de fuso.** Colunas `date` do Postgres chegam como `YYYY-MM-DD`; `new Date("2026-08-27")` é interpretado como meia-noite UTC e, em UTC−3, retrocede um dia. Todo o código usa `paraData`/`chaveDia` de `src/lib/datas.ts`.

**RDO impresso pelo navegador.** A exportação usa a engine de impressão do navegador em vez de gerar PDF no servidor, porque a Vercel limita a resposta da função a 4,5 MB — um relatório com muitas fotos ultrapassaria o teto — e porque o navegador já resolve imagens remotas, quebras de página e acentuação.

**Sem biblioteca de calendário.** O calendário é construído com `date-fns`, evitando dependência pesada e risco de incompatibilidade com o React 19.

## Estrutura

```
src/
  app/
    (protegido)/        painel, obras, plantas, tarefas, calendario, relatorios, usuarios
    login/ cadastro/ auth/ erro/
  components/
    ui/                 primitivos de interface
    layout/             barra lateral e cabeçalho
    obras/ plantas/ tarefas/
  lib/
    supabase/           clients (browser, server, admin) e tipos
    pdf/                matemática de coordenadas e calibragem
    datas.ts  email.ts  armazenamento.ts  utils.ts
supabase/migrations/
proxy.ts                renovação de sessão (Next.js 16 substituiu middleware.ts)
```

## Deploy

O projeto está conectado à Vercel. Todo push na branch `main` dispara um novo deploy.

Ao criar o ambiente, cadastre as variáveis da tabela acima em **Project Settings → Environment Variables** e, em seguida, ajuste no Supabase (**Authentication → URL Configuration**) a *Site URL* e as *Redirect URLs* para o domínio de produção, incluindo `https://SEU-DOMINIO/auth/confirmar`.

## Limitações conhecidas

- **Confirmação de e-mail ativa.** Novos usuários precisam confirmar o endereço antes do primeiro acesso. Para desativar em ambiente de testes: Authentication → Providers → Email → *Confirm email*.
- **Plano gratuito do Supabase limita arquivos a 50 MB.** Os buckets estão configurados para valores maiores, mas o teto do plano prevalece. Vídeos longos exigem o plano Pro.
- **Resend em modo sandbox.** Sem um domínio verificado, o remetente `onboarding@resend.dev` só entrega para o e-mail dono da conta. O plano gratuito permite 100 envios por dia.
