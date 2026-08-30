-- ---------------------------------------------------------------------------
-- Rascunho de lote de tarefas.
--
-- Motivo: criar ate centenas de tarefas em lote na planta via querystring
-- estoura o limite da linha de requisicao HTTP (~16 KB no Node/Vercel). O
-- rascunho guarda as localizacoes no banco e a URL passa a carregar apenas o
-- id do rascunho.
-- ---------------------------------------------------------------------------

create table if not exists public.lote_rascunhos (
  id            uuid primary key default gen_random_uuid(),
  criado_por    uuid not null references public.perfis (id) on delete cascade,
  obra_id       uuid not null references public.obras (id) on delete cascade,
  planta_id     uuid not null references public.plantas (id) on delete cascade,
  pagina        integer not null check (pagina > 0),
  localizacoes  jsonb not null check (jsonb_typeof(localizacoes) = 'array'),
  criado_em     timestamptz not null default now()
);

create index if not exists idx_lote_rascunhos_criado_por
  on public.lote_rascunhos (criado_por, criado_em desc);
create index if not exists idx_lote_rascunhos_criado_em
  on public.lote_rascunhos (criado_em);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.lote_rascunhos enable row level security;

-- Empresa unica: autenticado le (o acesso pratico e por id proprio, mas a
-- leitura ampla segue o padrao das demais tabelas).
drop policy if exists lote_rascunhos_select on public.lote_rascunhos;
create policy lote_rascunhos_select on public.lote_rascunhos
  for select to authenticated using (true);

-- So quem cria tarefas (gestor/admin) cria rascunho, sempre em nome proprio.
drop policy if exists lote_rascunhos_gestor_insere on public.lote_rascunhos;
create policy lote_rascunhos_gestor_insere on public.lote_rascunhos
  for insert to authenticated
  with check (public.e_gestor() and criado_por = (select auth.uid()));

-- Consumo: o proprio autor apaga ao concluir; gestor/admin pode limpar.
drop policy if exists lote_rascunhos_autor_apaga on public.lote_rascunhos;
create policy lote_rascunhos_autor_apaga on public.lote_rascunhos
  for delete to authenticated
  using (criado_por = (select auth.uid()) or public.e_gestor());