-- ============================================================================
-- Painel de Gestao de Obras - Vasconcelos Engenharia
-- Schema inicial: perfis, obras, plantas, tarefas, anexos, comentarios.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.papel_usuario as enum ('admin', 'gestor', 'colaborador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_obra as enum ('planejamento', 'em_andamento', 'pausada', 'concluida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_tarefa as enum ('pendente', 'em_execucao', 'concluido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.prioridade_tarefa as enum ('baixa', 'media', 'alta', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_localizacao as enum ('nenhuma', 'ponto', 'regiao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_anexo as enum ('imagem', 'video', 'arquivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.momento_anexo as enum ('criacao', 'andamento', 'conclusao');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- perfis (espelha auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.perfis (
  id           uuid primary key references auth.users (id) on delete cascade,
  nome         text not null,
  email        text not null unique,
  telefone     text,
  cargo        text,
  papel        public.papel_usuario not null default 'colaborador',
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- obras
-- ---------------------------------------------------------------------------
create table if not exists public.obras (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  codigo            text unique,
  cliente           text,
  endereco          text,
  cidade            text,
  estado            text,
  descricao         text,
  status            public.status_obra not null default 'planejamento',
  data_inicio       date,
  data_prevista_fim date,
  responsavel_id    uuid references public.perfis (id) on delete set null,
  criado_por        uuid references public.perfis (id) on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists idx_obras_responsavel on public.obras (responsavel_id);
create index if not exists idx_obras_status on public.obras (status);

-- ---------------------------------------------------------------------------
-- plantas (PDF) + calibragem de escala por pagina
-- ---------------------------------------------------------------------------
create table if not exists public.plantas (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id) on delete cascade,
  nome          text not null,
  descricao     text,
  arquivo_path  text not null,
  arquivo_nome  text not null,
  tamanho_bytes bigint,
  total_paginas integer not null default 1,
  criado_por    uuid references public.perfis (id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_plantas_obra on public.plantas (obra_id);

-- unidades_por_ponto: fator real/ponto-PDF obtido na calibragem.
-- distancia_real = hypot(p2 - p1) * unidades_por_ponto
create table if not exists public.planta_calibracoes (
  planta_id          uuid not null references public.plantas (id) on delete cascade,
  pagina             integer not null,
  unidades_por_ponto double precision not null check (unidades_por_ponto > 0),
  unidade            text not null default 'm',
  ref_p1             jsonb not null,
  ref_p2             jsonb not null,
  distancia_real     double precision not null check (distancia_real > 0),
  calibrado_por      uuid references public.perfis (id) on delete set null,
  criado_em          timestamptz not null default now(),
  primary key (planta_id, pagina)
);

-- ---------------------------------------------------------------------------
-- tarefas
-- ---------------------------------------------------------------------------
create table if not exists public.tarefas (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.obras (id) on delete cascade,
  planta_id         uuid references public.plantas (id) on delete set null,
  pagina            integer,
  titulo            text not null,
  descricao         text,
  status            public.status_tarefa not null default 'pendente',
  prioridade        public.prioridade_tarefa not null default 'media',
  responsavel_id    uuid references public.perfis (id) on delete set null,
  criado_por        uuid references public.perfis (id) on delete set null,
  prazo             date,
  data_planejada    date,
  concluida_em      timestamptz,
  localizacao_tipo  public.tipo_localizacao not null default 'nenhuma',
  ponto_x           double precision,
  ponto_y           double precision,
  regiao            jsonb,
  exige_foto        boolean not null default false,
  exige_video       boolean not null default false,
  exige_arquivo     boolean not null default false,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint tarefa_ponto_completo check (
    localizacao_tipo <> 'ponto' or (ponto_x is not null and ponto_y is not null)
  ),
  constraint tarefa_regiao_completa check (
    localizacao_tipo <> 'regiao' or regiao is not null
  ),
  constraint tarefa_localizacao_exige_planta check (
    localizacao_tipo = 'nenhuma' or (planta_id is not null and pagina is not null)
  )
);

create index if not exists idx_tarefas_obra on public.tarefas (obra_id);
create index if not exists idx_tarefas_responsavel on public.tarefas (responsavel_id);
create index if not exists idx_tarefas_status on public.tarefas (status);
create index if not exists idx_tarefas_prioridade on public.tarefas (prioridade);
create index if not exists idx_tarefas_prazo on public.tarefas (prazo);
create index if not exists idx_tarefas_data_planejada on public.tarefas (data_planejada);
create index if not exists idx_tarefas_planta_pagina on public.tarefas (planta_id, pagina);
create index if not exists idx_tarefas_concluida_em on public.tarefas (concluida_em);

-- ---------------------------------------------------------------------------
-- comentarios e anexos
-- ---------------------------------------------------------------------------
create table if not exists public.tarefa_comentarios (
  id        uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  autor_id  uuid references public.perfis (id) on delete set null,
  texto     text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);

create index if not exists idx_comentarios_tarefa on public.tarefa_comentarios (tarefa_id);

create table if not exists public.tarefa_anexos (
  id            uuid primary key default gen_random_uuid(),
  tarefa_id     uuid not null references public.tarefas (id) on delete cascade,
  tipo          public.tipo_anexo not null,
  momento       public.momento_anexo not null default 'andamento',
  caminho       text not null,
  nome_arquivo  text not null,
  mime          text,
  tamanho_bytes bigint,
  enviado_por   uuid references public.perfis (id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_anexos_tarefa on public.tarefa_anexos (tarefa_id);
create index if not exists idx_anexos_tipo on public.tarefa_anexos (tipo);
create index if not exists idx_anexos_criado_em on public.tarefa_anexos (criado_em);

-- ---------------------------------------------------------------------------
-- registro de notificacoes enviadas
-- ---------------------------------------------------------------------------
create table if not exists public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  tarefa_id      uuid references public.tarefas (id) on delete cascade,
  destinatario   text not null,
  assunto        text not null,
  status         text not null default 'enviado',
  erro           text,
  criado_em      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funcoes auxiliares
-- ---------------------------------------------------------------------------

-- security definer + search_path vazio: evita recursao infinita nas policies
-- de `perfis` (uma policy em perfis nao pode consultar perfis diretamente).
create or replace function private_papel_atual()
returns public.papel_usuario
language sql
security definer
set search_path = ''
stable
as $$
  select papel from public.perfis where id = (select auth.uid())
$$;

create or replace function public.e_gestor()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select papel in ('admin', 'gestor') from public.perfis where id = (select auth.uid())),
    false
  )
$$;

create or replace function public.e_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select papel = 'admin' from public.perfis where id = (select auth.uid())),
    false
  )
$$;

-- Cria o perfil automaticamente quando um usuario se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, telefone, cargo, papel)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'cargo'), ''),
    case
      when (select count(*) from public.perfis) = 0 then 'admin'::public.papel_usuario
      else coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'papel'), '')::public.papel_usuario,
        'colaborador'::public.papel_usuario
      )
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantem atualizado_em coerente e carimba a conclusao da tarefa.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.marcar_conclusao_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if new.status = 'concluido' and coalesce(old.status, 'pendente') <> 'concluido' then
    new.concluida_em := now();
  elsif new.status <> 'concluido' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfis_atualizado on public.perfis;
create trigger trg_perfis_atualizado before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_obras_atualizado on public.obras;
create trigger trg_obras_atualizado before update on public.obras
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_tarefas_conclusao on public.tarefas;
create trigger trg_tarefas_conclusao before update on public.tarefas
  for each row execute function public.marcar_conclusao_tarefa();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Empresa unica: todo usuario autenticado le tudo; escrita conforme papel.
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.obras enable row level security;
alter table public.plantas enable row level security;
alter table public.planta_calibracoes enable row level security;
alter table public.tarefas enable row level security;
alter table public.tarefa_comentarios enable row level security;
alter table public.tarefa_anexos enable row level security;
alter table public.notificacoes enable row level security;

-- perfis
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated using (true);

drop policy if exists perfis_update_proprio on public.perfis;
create policy perfis_update_proprio on public.perfis
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists perfis_admin_tudo on public.perfis;
create policy perfis_admin_tudo on public.perfis
  for all to authenticated
  using (public.e_admin())
  with check (public.e_admin());

-- obras
drop policy if exists obras_select on public.obras;
create policy obras_select on public.obras
  for select to authenticated using (true);

drop policy if exists obras_gestor_escreve on public.obras;
create policy obras_gestor_escreve on public.obras
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

-- plantas
drop policy if exists plantas_select on public.plantas;
create policy plantas_select on public.plantas
  for select to authenticated using (true);

drop policy if exists plantas_gestor_escreve on public.plantas;
create policy plantas_gestor_escreve on public.plantas
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

-- calibracoes
drop policy if exists calibracoes_select on public.planta_calibracoes;
create policy calibracoes_select on public.planta_calibracoes
  for select to authenticated using (true);

drop policy if exists calibracoes_gestor_escreve on public.planta_calibracoes;
create policy calibracoes_gestor_escreve on public.planta_calibracoes
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

-- tarefas: gestores gerenciam tudo; responsavel atualiza a propria tarefa.
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas
  for select to authenticated using (true);

drop policy if exists tarefas_gestor_escreve on public.tarefas;
create policy tarefas_gestor_escreve on public.tarefas
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

drop policy if exists tarefas_responsavel_atualiza on public.tarefas;
create policy tarefas_responsavel_atualiza on public.tarefas
  for update to authenticated
  using (responsavel_id = (select auth.uid()))
  with check (responsavel_id = (select auth.uid()));

-- comentarios: qualquer autenticado comenta; autor/admin apaga.
drop policy if exists comentarios_select on public.tarefa_comentarios;
create policy comentarios_select on public.tarefa_comentarios
  for select to authenticated using (true);

drop policy if exists comentarios_insert on public.tarefa_comentarios;
create policy comentarios_insert on public.tarefa_comentarios
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

drop policy if exists comentarios_delete on public.tarefa_comentarios;
create policy comentarios_delete on public.tarefa_comentarios
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.e_admin());

-- anexos
drop policy if exists anexos_select on public.tarefa_anexos;
create policy anexos_select on public.tarefa_anexos
  for select to authenticated using (true);

drop policy if exists anexos_insert on public.tarefa_anexos;
create policy anexos_insert on public.tarefa_anexos
  for insert to authenticated
  with check (enviado_por = (select auth.uid()));

drop policy if exists anexos_delete on public.tarefa_anexos;
create policy anexos_delete on public.tarefa_anexos
  for delete to authenticated
  using (enviado_por = (select auth.uid()) or public.e_gestor());

-- notificacoes: leitura para gestores; escrita apenas via secret key.
drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes
  for select to authenticated using (public.e_gestor());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plantas', 'plantas', false, 104857600, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 524288000)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

drop policy if exists plantas_storage_leitura on storage.objects;
create policy plantas_storage_leitura on storage.objects
  for select to authenticated using (bucket_id = 'plantas');

-- Upload via URL assinada NAO carrega auth.uid(); e_gestor() retornaria false
-- e o PUT falharia com 403 (RLS). O papel ja e validado em assinarUploadPlanta.
drop policy if exists plantas_storage_escrita on storage.objects;
create policy plantas_storage_escrita on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plantas');

drop policy if exists plantas_storage_remocao on storage.objects;
create policy plantas_storage_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'plantas' and public.e_gestor());

drop policy if exists anexos_storage_leitura on storage.objects;
create policy anexos_storage_leitura on storage.objects
  for select to authenticated using (bucket_id = 'anexos');

drop policy if exists anexos_storage_escrita on storage.objects;
create policy anexos_storage_escrita on storage.objects
  for insert to authenticated with check (bucket_id = 'anexos');

drop policy if exists anexos_storage_remocao on storage.objects;
create policy anexos_storage_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'anexos' and (owner = (select auth.uid()) or public.e_gestor()));
