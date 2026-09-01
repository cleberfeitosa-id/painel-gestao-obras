# Painel de Gestão de Obras — Vasconcelos Engenharia

Sistema web integrado para planejamento, fiscalização de campo, levantamento quantitativo em pranchas PDF, medições contratuais e relatórios diários de obras.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Arquitetura do Banco de Dados](#arquitetura-do-banco-de-dados)
   - [Enums](#enums)
   - [Tabelas e Relacionamentos](#tabelas-e-relacionamentos)
   - [Segurança e Row Level Security (RLS)](#segurança-e-row-level-security-rls)
   - [Buckets de Armazenamento](#buckets-de-armazenamento)
4. [Módulos e Funcionalidades](#módulos-e-funcionalidades)
   - [1. Autenticação e Gestão de Usuários](#1-autenticação-e-gestão-de-usuários)
   - [2. Gestão de Obras e Executores](#2-gestão-de-obras-e-executores)
   - [3. Visualizador de Plantas e Calibragem de Escala](#3-visualizador-de-plantas-e-calibragem-de-escala)
   - [4. Levantamento Quantitativo (Takeoff 2D/3D)](#4-levantamento-quantitativo-takeoff-2d3d)
   - [5. Gestão de Tarefas Georreferenciadas](#5-gestão-de-tarefas-georreferenciadas)
   - [6. Medições e Pagamentos](#6-medições-e-pagamentos)
   - [7. Planejamento e Calendário](#7-planejamento-e-calendário)
   - [8. Relatório Diário de Obra (RDO)](#8-relatório-diário-de-obra-rdo)
5. [Decisões Técnicas e Padrões de Projeto](#decisões-técnicas-e-padrões-de-projeto)
6. [Estrutura de Diretórios](#estrutura-de-diretórios)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Instalação e Execução Local](#instalação-e-execução-local)
9. [Deploy e Operações](#deploy-e-operações)

---

## Visão Geral

O **Painel de Gestão de Obras** foi projetado para digitalizar o fluxo operacional de canteiros de obras e escritórios de engenharia. Ele unifica em uma única plataforma:

- **Plantas em PDF interativas** com calibragem real de escala métrica.
- **Levantamento quantitativo elétrico e estrutural** com suporte a circuitos, caixas, eletrodutos, áreas poligonais e descidas/subidas verticais 3D.
- **Apontamento de tarefas em campo** vinculado a pontos ou regiões da prancha técnica, com controle de evidências fotográficas obrigatórias e aprovações.
- **Medição física e financeira** integrada a catálogo de preços e pagamentos parcelados.
- **RDO automatizado** com consolidação diária/periódica de atividades, clima, fotos e snapshots da planta com marcadores.

---

## Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 (App Router)                       │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │   Server Components  │  │   Server Actions   │  │    proxy.ts    │ │
│  │ (Busca e Render SSR) │  │  (Mutação + Zod)   │  │ (Sessão / Auth)│ │
│  └──────────┬───────────┘  └─────────┬──────────┘  └───────┬────────┘ │
└─────────────┼────────────────────────┼─────────────────────┼──────────┘
              │                        │                     │
              ▼                        ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase (BaaS) / Postgres 15+                  │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │   Postgres + RLS     │  │   Supabase Auth    │  │Storage Buckets │ │
│  │(18 tabelas / 8 enums)│  │(E-mail/Senha/Token)│  │(plantas/anexos)│ │
│  └──────────────────────┘  └────────────────────┘  └────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
        │                                 │
        ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│  Resend API      │            │ Navegador Client │
│  (E-mails Trans.)│            │ (PDFjs/Three.js) │
└──────────────────┘            └──────────────────┘
```

### Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|---|---|---|
| **Framework** | Next.js 16.3 (App Router) | React 19, Server Components por padrão, Server Actions para mutações |
| **Linguagem** | TypeScript 5 (Strict mode) | Tipagem estática fim a fim derivada do schema do banco |
| **Estilização** | Tailwind CSS v4 | CSS-first (`globals.css` `@theme inline`), `clsx` + `tailwind-merge` (`cn()`) |
| **Banco de Dados** | Supabase / PostgreSQL | 18 tabelas relacionais, 8 enums, Triggers, Views e RLS rigoroso |
| **Autenticação** | Supabase Auth + SSR | Sessão baseada em cookies seguros gerenciada via `proxy.ts` |
| **Storage** | Supabase Storage | Buckets privados (`plantas`, `anexos`) com URLs pré-assinadas |
| **Manipulação PDF** | `pdfjs-dist` + `react-pdf` + `pdf-lib` | Renderização vetorial no canvas, visualização e geração de pranchas anotadas |
| **3D / Geometria** | Three.js + `@types/three` | Visualização tridimensional de pavimentos, descidas e circuitos |
| **Datas & Fusos** | `date-fns` + wrapper local | Manipulação em fuso horário `America/Fortaleza` (UTC-3) |
| **E-mails** | Resend | Envio de notificações e convites com templates transacionais |
| **Impressão / RDO** | `react-to-print` | Renderização e impressão via engine do navegador |

---

## Arquitetura do Banco de Dados

O banco de dados é estruturado no PostgreSQL (Supabase) sob o schema `public`, com forte integridade relacional, constraints de validação e controle de concorrência.

### Enums

| Enum | Valores | Aplicação |
|---|---|---|
| `papel_usuario` | `admin`, `gestor`, `colaborador` | Controle de acesso baseado em função (RBAC) |
| `status_obra` | `planejamento`, `em_andamento`, `pausada`, `concluida` | Ciclo de vida da obra |
| `status_tarefa` | `pendente`, `em_execucao`, `concluido` | Fluxo de execução de serviços |
| `prioridade_tarefa` | `baixa`, `media`, `alta`, `urgente` | Classificação de impacto |
| `tipo_localizacao` | `nenhuma`, `ponto`, `regiao`, `distancia`, `circuito`, `area`, `descida` | Geometria da tarefa no espaço da prancha |
| `tipo_anexo` | `imagem`, `video`, `arquivo` | Formato do anexo de tarefa |
| `momento_anexo` | `criacao`, `andamento`, `conclusao` | Estágio da tarefa em que a mídia foi anexada |
| `aprovacao_tarefa`| `pendente`, `aprovado`, `reprovado` | Workflow de fiscalização e controle de qualidade |

---

### Tabelas e Relacionamentos

```
                      ┌───────────────┐
                      │    perfis     │◀────────────────┐
                      └───────┬───────┘                 │
                              │ 1                       │
                              │                         │
                              ▼ *                       │
                      ┌───────────────┐                 │
                      │     obras     │                 │
                      └───────┬───────┘                 │
                              │ 1                       │
          ┌───────────────────┼───────────────────┐     │
          │ *                 │ *                 │ *   │
          ▼                   ▼                   ▼     │
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
  │    plantas    │   │  executores   │   │   medicoes    │
  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
          │ 1                 │ 1                 │ 1
          ├──────────────┐    │                   │
          ▼ *            │    │                   ├──────────────────┐
  ┌───────────────┐      │    │                   │ *                │ *
  │planta_calib.  │      │    │                   ▼                  ▼
  └───────────────┘      │    │           ┌───────────────┐  ┌───────────────┐
                         │    │           │tarefa_medicoes│  │medicao_pagam. │
                         ▼ *  ▼ *         └───────┬───────┘  └───────────────┘
                      ┌───────────────┐           │ *
                      │    tarefas    │◀──────────┘
                      └───────┬───────┘
                              │ 1
     ┌──────────────┬─────────┼──────────────┬──────────────┐
     │ *            │ *       │ *            │ *            │ *
     ▼              ▼         ▼              ▼              ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│anexos    │  │comentarios│ │aprovacoes│ │tags      │ │dependencias  │
└──────────┘  └──────────┘ └──────────┘ └──────────┘ └──────────────┘

Outras Entidades:
- catalogo_precos (preços unitários por obra/item)
- levantamentos (dados CAD/quantitativos em JSONB vinculados a obra e planta)
- lote_rascunhos (armazenamento efêmero para criação de tarefas em lote)
- notificacoes (registro de disparos de e-mail e alertas)
```

#### Descrição das Tabelas

1. **`perfis`**: Extensão de `auth.users` contendo nome completo, papel (`admin`, `gestor`, `colaborador`) e data de cadastro.
2. **`obras`**: Entidade principal de gestão (nome, endereço, status, datas de início/previsão, responsável técnico).
3. **`plantas`**: Pranchas técnicas em PDF vinculadas a uma obra (arquivo no Storage, total de páginas).
4. **`planta_calibracoes`**: Calibragem de escala por prancha e página. Armazena `ref_p1`, `ref_p2` (pontos no PDF), distância real em metros e o fator calculado (`fator_escala_ppm`).
5. **`executores`**: Empreiteiros, terceirizados ou equipes de execução vinculados à obra (nome, especialidade, contato, supervisor responsável).
6. **`catalogo_precos`**: Itens de serviço com unidade de medida e preço unitário para composição das medições.
7. **`tarefas`**: Apontamento operacional. Suporta georreferenciamento no PDF (`ponto_x`, `ponto_y`, `regiao`, `tipo_localizacao`), exigência de evidências (`exige_foto`, `exige_video`, `exige_arquivo`), executor, responsável e prazos.
8. **`tarefa_comentarios`**: Histórico de interações e anotações em cada tarefa.
9. **`tarefa_anexos`**: Arquivos, fotos e vídeos associados à tarefa, indexados pelo estágio (`momento_anexo`) e geolocalização da captura.
10. **`tarefa_aprovacoes`**: Histórico do fluxo de aprovação/reprovação (solicitante, avaliador, parecer, data).
11. **`tarefa_dependencias`**: Relacionamento DAG (Grafo Acíclico Dirigido) para travar o início de tarefas dependentes.
12. **`tags_tarefa`**: Marcações e categorias transversais aplicadas às tarefas.
13. **`lote_rascunhos`**: Tabela temporária para transacionar a criação de múltiplos pinos da planta para o formulário de lote sem poluir a URL com parâmetros longos.
14. **`medicoes`**: Boletins periódicos de medição física e financeira de uma obra.
15. **`tarefa_medicoes`**: Vínculo entre a medição e as tarefas executadas, registrando quantidade medida e valor acumulado.
16. **`medicao_pagamentos`**: Registro financeiro de parcelas pagas, datas e comprovantes atrelados à medição.
17. **`levantamentos`**: Armazena a estrutura completa do levantamento quantitativo (árvore de circuitos, eletrodutos, pontos, áreas poligonais, níveis de piso e descidas 3D) em JSONB estruturado.
18. **`notificacoes`**: Log operacional de e-mails disparados aos responsáveis por tarefas.

---

### Segurança e Row Level Security (RLS)

O modelo de segurança adota o conceito de **organização única (single-tenant corporativo)** com RBAC:

- **Políticas de Leitura (`SELECT`)**: Todos os usuários autenticados têm permissão de leitura ampla (`USING (true)`).
- **Políticas de Escrita (`INSERT`, `UPDATE`, `DELETE`)**:
  - `admin`: Permissão irrestrita em todas as tabelas e gestão de usuários/papéis.
  - `gestor`: Cria e edita obras, plantas, calibrações, levantamentos, tarefas, medições e executores.
  - `colaborador`: Acesso de edição restrito às tarefas atribuídas sob sua responsabilidade direta (atualização de status, envio de anexos e comentários).
- **Funções SQL `SECURITY DEFINER`**: As validações de perfil (`e_gestor()`, `e_admin()`) utilizam `SET search_path = ''` para prevenir ataques de injeção de schema e recursão infinita em subqueries de RLS.

---

### Buckets de Armazenamento

| Bucket | Acesso | Tipos de Arquivo | Finalidade |
|---|---|---|---|
| `plantas` | Privado | `application/pdf` | Pranchas técnicas originais de engenharia e arquitetura |
| `anexos` | Privado | Imagens (`jpg`, `png`, `webp`), Vídeos (`mp4`, `mov`), Documentos (`pdf`, `xlsx`, `docx`) | Evidências de campo, vistorias e comprovantes |

---

## Módulos e Funcionalidades

### 1. Autenticação e Gestão de Usuários
- **Fluxo de Acesso Seguro**: Login com e-mail/senha, recuperação de acesso e primeiro acesso via convite com token seguro.
- **Primeiro Usuário Administrador**: O primeiro usuário cadastrado na base assume automaticamente o papel de `admin`.
- **Painel de Usuários**: Administradores podem convidar membros, alterar papéis (`admin`, `gestor`, `colaborador`) e gerenciar status.

---

### 2. Gestão de Obras e Executores
- **Cadastro e Visão Geral**: Gestão de escopo, datas de início e entrega, endereço físico e status (`planejamento`, `em_andamento`, `pausada`, `concluida`).
- **Dashboard da Obra**: Indicadores de avanço físico, tarefas em atraso, total de pranchas, balanço de medições e equipe alocada.
- **Gestão de Executores**: Cadastro de empreiteiros e terceirizados, vinculação de supervisores internos e associação direta nas ordens de serviço/tarefas.

---

### 3. Visualizador de Plantas e Calibragem de Escala
- **Renderização Vetorial de Alta Performance**: Visualização de arquivos PDF de grande formato com controle de zoom, pan (arraste), rotação e paginação.
- **Calibragem de Escala**:
  - Marcação de dois pontos de referência conhecidos sobre o desenho técnico (ex: cota de 5,00 m).
  - Cálculo automático de pixels por metro (PPM) e persistência no banco.
  - Habilita réguas de medição de distâncias lineares e cálculo de áreas em tempo real.
- **Exportação de Prancha Anotada**: Geração de novo arquivo PDF vetorizado contendo todos os pinos de tarefas desenhados sobre a prancha original através da `pdf-lib`.

---

### 4. Levantamento Quantitativo (Takeoff 2D/3D)
Módulo CAD-like especializado para orçamentação e extração quantitativa direto da prancha:
- **Ferramentas de Desenho Técnico**:
  - **Pontos**: Tomadas, interruptores, luminárias, caixas de passagem e quadros (QGBT/QDC).
  - **Distâncias Lineares**: Traçado contínuo de tubulações, canaletas e esteiras com cálculo métrico.
  - **Circuitos e Fiação**: Configuração de condutores por trecho (Fase, Neutro, Terra, Retorno), bitolas (mm²) e comprimento extra de pontas de ligação.
  - **Áreas Poligonais**: Cálculo de superfícies (m²) para pisos, alvenarias, forros ou pintura usando o algoritmo de Shoelace.
  - **Descidas e Subidas Verticais**: Lançamento de prumadas e alimentação entre pisos com cotas de altura e pé-direito.
- **Gerenciador de Níveis / Pavimentos**: Configuração de alturas de piso e laje.
- **Visualizador 3D Integrado (Three.js)**: Inspeção espacial em 3 dimensões das descidas, caixas e prumadas elétricas.
- **Exportação e Conversão**:
  - Resumo de materiais em CSV e impressão técnica.
  - **Conversão Direta em Tarefas**: Geração em lote de ordens de serviço a partir dos elementos do levantamento.

---

### 5. Gestão de Tarefas Georreferenciadas
- **Georreferenciamento no PDF**: Pinos pontuais ou demarcação de regiões poligonais amarrados ao espaço métrico do PDF.
- **Fluxo de Trabalho e Status**: Transição entre `pendente`, `em_execucao` e `concluido`.
- **Controle de Evidências (Comprovação Obrigatória)**:
  - Configuração granular exigindo foto, vídeo ou arquivo para conclusão do serviço.
  - Bloqueio de finalização no servidor caso os anexos obrigatórios não tenham sido enviados.
  - Compressão automática de imagens no navegador antes do upload para economia de banda.
- **Fluxo de Aprovação e Qualidade**: Envio para fiscalização do gestor, permitindo aprovação ou devolução com apontamento de correções.
- **Dependências e Tags**: Vínculos de precedência entre tarefas (bloqueios) e categorização por tags customizadas.
- **Criação e Edição em Lote**: Modo de seleção múltipla na planta com rascunho de lote (`lote_rascunhos`) e atualização coletiva de prazos/responsáveis.

---

### 6. Medições e Pagamentos
- **Boletins de Medição**: Emissão de medições quinzenais/mensais com controle de período e status.
- **Catálogo de Preços**: Tabela de preços unitários integrada (serviços e materiais).
- **Vínculo com Tarefas**: Importação de itens concluídos no canteiro para o boletim de medição.
- **Gestão Financeira de Pagamentos**: Registro de parcelas, retenções contratuais, saldo a pagar, data de quitação e comprovantes fiscais/bancários.

---

### 7. Planejamento e Calendário
- **Visão Mensal e Diária**: Calendário interativo para acompanhamento de cronograma e prazos de entrega.
- **Filtros e Alertas**: Identificação visual de tarefas atrasadas, críticas ou com prazo próximo.
- **Ajuste de Cronograma**: Reagendamento ágil de prazos respeitando fusos horários locais.

---

### 8. Relatório Diário de Obra (RDO)
- **Consolidação Diária Automatizada**: Agrupamento em tempo real das atividades concluídas no dia, tarefas em andamento, efetivo de mão de obra e ocorrências.
- **Snapshots Visuais da Planta**: Recortes automáticos da prancha com os pinos das tarefas executadas no dia para contextualização no relatório.
- **Relatórios por Período**: Emissão consolidada semanal ou mensal para envio a clientes e investidores.
- **Impressão Profissional**: Layout otimizado para exportação PDF de alta resolução diretamente pela engine de impressão do navegador (`react-to-print`).

---

## Decisões Técnicas e Padrões de Projeto

1. **Upload Direto via URLs Pré-Assinadas (Bypass de Serverless Payload)**:
   - Funções serverless da Vercel limitam o corpo da requisição a 4,5 MB. O sistema nunca trafega arquivos binários pelo backend Node.js. A Server Action gera uma URL pré-assinada (`assinarUpload`) e o navegador realiza o envio direto ao Supabase Storage via PUT/Tus.
2. **Coordenadas Matemáticas no Espaço do PDF**:
   - Pinos e geometrias são armazenados em coordenadas absolutas de PDF (origem no canto inferior esquerdo, eixo Y crescente para cima, medido em pontos tipográficos `pt`).
   - A renderização converte essas coordenadas em porcentagens relativas (`left %`, `top %`) sobre a viewport, garantindo precisão milimétrica independente de DPI, nível de zoom ou tamanho da tela.
3. **Tratamento Seguro de Datas e Fusos Horários (`datas.ts`)**:
   - Campos `date` do PostgreSQL (ex: `2026-08-31`) são interpretados sem conversão ingênua para UTC (que causaria o erro *off-by-one* no Brasil - UTC-3). O módulo `src/lib/datas.ts` padroniza o fuso `America/Fortaleza`.
4. **Renovação de Sessão via `proxy.ts`**:
   - Seguindo o padrão do Next.js 16, a proteção de rotas e a renovação dos tokens de autenticação ocorrem na camada de proxy, evitando mutações de cookies proibidas durante a renderização de Server Components.
5. **Resiliência em Serviços Auxiliares**:
   - Falhas no envio de e-mails transacionais (Resend) ou limpeza de arquivos secundários são capturadas em blocos `try/catch` isolados, impedindo que erros externos abortem transações de negócio principais.

---

## Estrutura de Diretórios

```
.
├── src/
│   ├── app/                                 # Rotas e páginas (App Router)
│   │   ├── (protegido)/                     # Rotas autenticadas
│   │   │   ├── painel/                      # Dashboard principal
│   │   │   ├── obras/                       # Gestão de obras, plantas e medições
│   │   │   │   └── [id]/
│   │   │   │       ├── executores/          # Empreiteiros e equipes da obra
│   │   │   │       ├── levantamento/        # Quantitativos da obra
│   │   │   │       ├── medicoes/            # Boletins de medição e pagamentos
│   │   │   │       └── plantas/             # Pranchas técnicas e calibragem
│   │   │   ├── tarefas/                     # Gestão de tarefas, lote e tags
│   │   │   ├── levantamento/                # Editor de levantamento 2D/3D
│   │   │   ├── calendario/                  # Cronograma mensal e diário
│   │   │   ├── relatorios/                  # RDO (diário e por período)
│   │   │   └── usuarios/                    # Controle de acessos e papéis
│   │   ├── auth/                            # Callbacks de autenticação
│   │   ├── cadastro/                        # Criação de conta
│   │   ├── login/                           # Autenticação
│   │   └── definir-senha/                   # Aceite de convite e senha
│   ├── components/                          # Componentes React
│   │   ├── ui/                              # Primitivos de UI (botões, modais, inputs)
│   │   ├── layout/                          # Sidebar, header e navegação
│   │   ├── obras/                           # Componentes de obras e formulários
│   │   ├── plantas/                         # Visualizador PDF, pinos, calibragem
│   │   ├── levantamento/                    # Editor CAD, Three.js 3D, níveis
│   │   ├── tarefas/                         # Listas, filtros, anexos, aprovações
│   │   ├── medicao/                         # Painel de medições e pagamentos
│   │   └── relatorios/                      # Layout de impressão do RDO
│   └── lib/                                 # Lógica de domínio e infraestrutura
│       ├── supabase/                        # Clients Supabase (server, admin, session)
│       ├── pdf/                             # Matemática de coordenadas e exportação
│       ├── levantamento/                    # Algoritmos de cálculo e exportação CSV
│       ├── domain/                          # Mapeamento de rótulos e enums
│       ├── datas.ts                         # Tratamento fuso-safe de datas
│       ├── armazenamento.ts                 # URLs assinadas e gestão de buckets
│       ├── compressao-imagem.ts             # Otimização de imagens client-side
│       ├── email.ts                         # Integração Resend
│       └── utils.ts                         # Utilitários gerais
├── supabase/
│   └── migrations/                          # 16 migrações SQL versionadas
├── proxy.ts                                 # Interceptor de autenticação e sessão
└── package.json
```

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com base nas definições abaixo:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://sua-instancia.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publicavel
SUPABASE_SECRET_KEY=sb_secret_sua_chave_secreta_servidor

# Aplicação
NEXT_PUBLIC_APP_URL=http://localhost:3000

# E-mail (Resend) - Opcional em desenvolvimento
RESEND_API_KEY=re_sua_chave_api
RESEND_FROM="Vasconcelos Engenharia <notificacoes@seudominio.com.br>"
```

---

## Instalação e Execução Local

### Pré-requisitos
- Node.js 20+ ou 22+
- Gerenciador de pacotes `npm`
- Instância ativa do Supabase (Cloud ou Docker local)

### Passo a Passo

1. **Clonar o repositório e instalar dependências**:
   ```bash
   git clone <url-do-repositorio>
   cd "Painel de Gestão"
   npm install
   ```

2. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example .env.local
   # Preencha as credenciais no .env.local
   ```

3. **Aplicar migrações no banco de dados**:
   Caso utilize a CLI do Supabase:
   ```bash
   supabase link --project-ref <seu-projeto-id>
   supabase db push
   ```
   *Ou execute os scripts SQL de `supabase/migrations/` em ordem sequencial no SQL Editor do Supabase.*

4. **Executar em modo de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse a aplicação em `http://localhost:3000`.

5. **Verificação de tipos e linting**:
   ```bash
   npm run lint        # Executa ESLint
   npx tsc --noEmit    # Type-checking completo
   npm run build       # Validação do build de produção
   ```

---

## Deploy e Operações

O projeto está configurado para deploy contínuo (CI/CD) na **Vercel** acoplado à branch `main`.

### Checklist de Produção
1. **Configuração de URL no Supabase**:
   - Em **Authentication → URL Configuration**:
     - Configurar **Site URL** para `https://seu-dominio.vercel.app`.
     - Adicionar em **Redirect URLs**: `https://seu-dominio.vercel.app/auth/confirmar`.
2. **Variáveis de Ambiente na Vercel**:
   - Garantir que `NEXT_PUBLIC_APP_URL` esteja definida com o domínio final de produção (`https://seu-dominio.vercel.app`).
3. **Regeneração de Tipos TypeScript**:
   Após qualquer alteração no banco de dados, execute:
   ```bash
   supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/database.types.ts
   ```
   *(Lembre-se de reaplicar os aliases de tipo de domínio definidos no final de `database.types.ts`)*.

