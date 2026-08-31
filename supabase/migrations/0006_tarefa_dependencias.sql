-- ---------------------------------------------------------------------------
-- Dependencias entre tarefas e datas de inicio/fim para o grafico gantt.
--
-- 1) `tarefas.data_inicio` / `tarefas.data_fim`: intervalo de tempo executado
--    no grafico gantt. Sao opcionais; para tarefas sem intervalo explicito a
--    UI faz fallback para `data_planejada` -> `prazo`.
--
-- 2) `tarefa_dependencias`: relacao N:N entre tarefas. Uma linha
--    (tarefa_id -> depende_de) significa "essa tarefa so acontece depois da
--    tarefa `depende_de`", ou seja `tarefa_id` e DEPENDENTE de `depende_de`
--    (que, por sua vez, e REQUISITO da `tarefa_id`). As duas direcoes sao
--    derivadas por consulta, sem duplicar o dado.
-- ---------------------------------------------------------------------------

alter table public.tarefas
  add column if not exists data_inicio date,
  add column if not exists data_fim    date;

-- A validacao de ordem (data_fim >= data_inicio) acontece na camada de dominio
-- (zod) para nao quebrar o UPDATE de linhas existentes sem datas.

-- ---------------------------------------------------------------------------
-- tabela de dependencias
-- ---------------------------------------------------------------------------
create table if not exists public.tarefa_dependencias (
  tarefa_id   uuid not null references public.tarefas (id) on delete cascade,
  depende_de  uuid not null references public.tarefas (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  constraint tarefa_dependencias_pk primary key (tarefa_id, depende_de),
  constraint tarefa_dependencias_sem_auto check (tarefa_id <> depende_de)
);

create index if not exists idx_tarefa_dependencias_tarefa
  on public.tarefa_dependencias (tarefa_id);
create index if not exists idx_tarefa_dependencias_depende_de
  on public.tarefa_dependencias (depende_de);

-- ---------------------------------------------------------------------------
-- Row Level Security (segue o padrao de tarefa_aprovacoes: empresa unica).
-- ---------------------------------------------------------------------------
alter table public.tarefa_dependencias enable row level security;

-- Empresa unica: autenticado le todas as dependencias.
drop policy if exists tarefa_dependencias_select on public.tarefa_dependencias;
create policy tarefa_dependencias_select on public.tarefa_dependencias
  for select to authenticated using (true);

-- Gestor/admin gerencia as dependencias (a escrita pratica passa pela Server
-- Action, que tambem confere o papel via admin client).
drop policy if exists tarefa_dependencias_gestor_escreve on public.tarefa_dependencias;
create policy tarefa_dependencias_gestor_escreve on public.tarefa_dependencias
  for all to authenticated
  using (public.e_gestor())
  with check (public.e_gestor());
