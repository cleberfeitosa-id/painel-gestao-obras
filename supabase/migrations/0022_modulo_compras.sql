-- Compras realizadas separadas de medicao fisica e pagamentos contratuais.
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  fornecedor text,
  documento text,
  data_compra date not null default current_date,
  observacao text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  orcamento_item_id uuid references public.orcamento_itens(id) on delete set null,
  composicao_id uuid references public.composicoes(id) on delete set null,
  codigo_insumo text,
  descricao text not null,
  unidade text not null default 'un',
  quantidade numeric(20,4) not null check (quantidade > 0),
  valor_unitario numeric(20,4) not null check (valor_unitario >= 0),
  criado_em timestamptz not null default now()
);

alter table public.compras enable row level security;
alter table public.compra_itens enable row level security;

drop policy if exists compras_select on public.compras;
create policy compras_select on public.compras for select to authenticated using (true);
drop policy if exists compras_financeiro on public.compras;
create policy compras_financeiro on public.compras for all to authenticated
  using (public.e_financeiro()) with check (public.e_financeiro());
drop policy if exists compra_itens_select on public.compra_itens;
create policy compra_itens_select on public.compra_itens for select to authenticated using (true);
drop policy if exists compra_itens_financeiro on public.compra_itens;
create policy compra_itens_financeiro on public.compra_itens for all to authenticated
  using (public.e_financeiro()) with check (public.e_financeiro());

create index if not exists idx_compras_obra_data on public.compras(obra_id, data_compra desc);
create index if not exists idx_compra_itens_compra on public.compra_itens(compra_id);
create index if not exists idx_compra_itens_orcamento on public.compra_itens(orcamento_item_id);
create index if not exists idx_compra_itens_composicao on public.compra_itens(composicao_id);

create or replace function public.compras_por_item_orcamento(p_obra_id uuid)
returns table (
  orcamento_item_id uuid,
  comprado numeric(20,4)
) language sql stable set search_path = '' as $$
  select ci.orcamento_item_id, sum(ci.quantidade * ci.valor_unitario)::numeric(20,4)
  from public.compra_itens ci
  join public.compras c on c.id = ci.compra_id
  where c.obra_id = p_obra_id and ci.orcamento_item_id is not null
  group by ci.orcamento_item_id
$$;

grant execute on function public.compras_por_item_orcamento(uuid) to authenticated;
