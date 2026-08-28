-- ---------------------------------------------------------------------------
-- Sprint 1: executor sem cadastro, supervisor aprovador e convite de usuarios.
--
-- Decisoes de modelagem:
--  * `aprovacao` e uma dimensao ORTOGONAL a `status`. Nao estendemos o enum
--    `status_tarefa` porque o trigger `marcar_conclusao_tarefa` e o RDO
--    dependem de `status = 'concluido'` para carimbar/consultar `concluida_em`.
--  * O executor e uma pessoa SEM login. Vira tabela propria (e nao texto livre)
--    porque o filtro da planta por executor exige identidade estavel.
--  * O supervisor e sempre um usuario cadastrado (FK para perfis).
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.aprovacao_tarefa as enum ('pendente', 'aprovado', 'reprovado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- executores: pessoas identificadas que executam tarefas sem ter conta.
-- ---------------------------------------------------------------------------
create table if not exists public.executores (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id) on delete cascade,
  nome          text not null,
  contato       text,
  ativo         boolean not null default true,
  criado_por    uuid references public.perfis (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint executor_nome_nao_vazio check (length(trim(nome)) > 0)
);

create index if not exists idx_executores_obra on public.executores (obra_id);
create unique index if not exists idx_executores_obra_nome
  on public.executores (obra_id, lower(trim(nome)));

drop trigger if exists trg_executores_atualizado on public.executores;
create trigger trg_executores_atualizado before update on public.executores
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- tarefas: executor (sem cadastro), supervisor (cadastrado) e aprovacao.
-- ---------------------------------------------------------------------------
alter table public.tarefas
  add column if not exists executor_id        uuid references public.executores (id) on delete set null,
  add column if not exists supervisor_id      uuid references public.perfis (id) on delete set null,
  add column if not exists aprovacao          public.aprovacao_tarefa not null default 'pendente',
  add column if not exists avaliado_por       uuid references public.perfis (id) on delete set null,
  add column if not exists avaliado_em        timestamptz,
  add column if not exists motivo_reprovacao  text;

create index if not exists idx_tarefas_executor on public.tarefas (executor_id);
create index if not exists idx_tarefas_supervisor on public.tarefas (supervisor_id);
create index if not exists idx_tarefas_aprovacao on public.tarefas (aprovacao);

-- Uma avaliacao (aprovada ou reprovada) sempre registra quem avaliou e quando.
alter table public.tarefas drop constraint if exists tarefa_avaliacao_completa;
alter table public.tarefas add constraint tarefa_avaliacao_completa check (
  aprovacao = 'pendente'
  or (avaliado_por is not null and avaliado_em is not null)
);

-- Reprovar exige justificativa; aprovar/pendente nao pode carregar motivo.
alter table public.tarefas drop constraint if exists tarefa_motivo_reprovacao;
alter table public.tarefas add constraint tarefa_motivo_reprovacao check (
  case
    when aprovacao = 'reprovado' then length(trim(coalesce(motivo_reprovacao, ''))) > 0
    else motivo_reprovacao is null
  end
);

-- ---------------------------------------------------------------------------
-- tarefa_aprovacoes: historico append-only das avaliacoes do supervisor.
-- ---------------------------------------------------------------------------
create table if not exists public.tarefa_aprovacoes (
  id            uuid primary key default gen_random_uuid(),
  tarefa_id     uuid not null references public.tarefas (id) on delete cascade,
  supervisor_id uuid not null references public.perfis (id) on delete restrict,
  decisao       public.aprovacao_tarefa not null,
  motivo        text,
  criado_em     timestamptz not null default now(),
  constraint aprovacao_decisao_valida check (decisao <> 'pendente'),
  constraint aprovacao_motivo_reprovacao check (
    decisao <> 'reprovado' or length(trim(coalesce(motivo, ''))) > 0
  )
);

create index if not exists idx_tarefa_aprovacoes_tarefa
  on public.tarefa_aprovacoes (tarefa_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- perfis: rastreio de convite x aceite.
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists convidado_por uuid references public.perfis (id) on delete set null,
  add column if not exists aceito_em     timestamptz;

-- Quem ja confirmou o e-mail antes desta migracao ja aceitou o convite.
update public.perfis p
set aceito_em = u.email_confirmed_at
from auth.users u
where u.id = p.id
  and p.aceito_em is null
  and u.email_confirmed_at is not null;

-- `confirmed_at` em auth.users e coluna GERADA: um trigger `update of
-- confirmed_at` nunca dispararia. Observamos `email_confirmed_at`, que e a
-- coluna real atualizada quando o convidado define a senha.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.perfis
    set aceito_em = new.email_confirmed_at
    where id = new.id and aceito_em is null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.executores enable row level security;
alter table public.tarefa_aprovacoes enable row level security;

drop policy if exists executores_select on public.executores;
create policy executores_select on public.executores
  for select to authenticated using (true);

drop policy if exists executores_gestor_escreve on public.executores;
create policy executores_gestor_escreve on public.executores
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());

drop policy if exists tarefa_aprovacoes_select on public.tarefa_aprovacoes;
create policy tarefa_aprovacoes_select on public.tarefa_aprovacoes
  for select to authenticated using (true);

-- O supervisor so registra decisao em nome proprio e apenas nas tarefas em que
-- ele e o supervisor designado. A escrita em `tarefas` correspondente passa
-- pela Server Action (client admin), que confere a mesma condicao.
drop policy if exists tarefa_aprovacoes_supervisor_insere on public.tarefa_aprovacoes;
create policy tarefa_aprovacoes_supervisor_insere on public.tarefa_aprovacoes
  for insert to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.supervisor_id = (select auth.uid())
    )
  );

drop policy if exists tarefa_aprovacoes_gestor_escreve on public.tarefa_aprovacoes;
create policy tarefa_aprovacoes_gestor_escreve on public.tarefa_aprovacoes
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());
