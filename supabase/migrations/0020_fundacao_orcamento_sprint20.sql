-- Fundacao normalizada do orcamento, versionamento e vinculo com medicoes.
-- A camada JSONB existente permanece como formato de compatibilidade do editor.

alter table public.orcamentos add column if not exists versao integer not null default 1 check (versao > 0);
alter table public.perfis add column if not exists pode_editar_financeiro boolean not null default true;
update public.perfis set pode_editar_financeiro = true where papel = 'gestor' and pode_editar_financeiro is null;
alter table public.composicao_componentes add column if not exists codigo text;
alter table public.composicao_componentes add column if not exists composicao_referencia_id uuid references public.composicoes(id) on delete restrict;
alter table public.catalogo_precos add column if not exists orcamento_item_id uuid;

create table if not exists public.orcamento_versoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  versao integer not null check (versao > 0),
  colunas jsonb not null,
  linhas jsonb not null,
  arquivo_caminho text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (orcamento_id, versao)
);

create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  chave_estavel text not null,
  ordem integer not null default 0,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(20,4) not null default 0 check (quantidade >= 0),
  valor_unitario numeric(20,4) not null default 0 check (valor_unitario >= 0),
  valor_total numeric(20,4) not null default 0 check (valor_total >= 0),
  valor_bdi numeric(20,4) check (valor_bdi >= 0),
  custo_real numeric(20,4) check (custo_real >= 0),
  grupo text,
  dados jsonb not null default '{}'::jsonb,
  tipo text not null default 'item' check (tipo in ('item','grupo','subtotal','informativa')),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (orcamento_id, chave_estavel)
);

alter table public.catalogo_precos drop constraint if exists catalogo_precos_orcamento_item_id_fkey;
alter table public.catalogo_precos add constraint catalogo_precos_orcamento_item_id_fkey
  foreign key (orcamento_item_id) references public.orcamento_itens(id) on delete set null;

create table if not exists public.orcamento_auditoria (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  entidade text not null,
  entidade_id uuid,
  operacao text not null check (operacao in ('insert','update','delete','restore','import')),
  antes jsonb,
  depois jsonb,
  autor_id uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('orcamentos', 'orcamentos', false)
on conflict (id) do nothing;

create or replace function public.e_financeiro()
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select papel = 'admin' or (papel = 'gestor' and pode_editar_financeiro)
    from public.perfis where id = (select auth.uid())), false)
$$;

alter table public.orcamento_versoes enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.orcamento_auditoria enable row level security;

drop policy if exists orcamento_versoes_select on public.orcamento_versoes;
create policy orcamento_versoes_select on public.orcamento_versoes for select to authenticated using (true);
drop policy if exists orcamento_versoes_financeiro on public.orcamento_versoes;
create policy orcamento_versoes_financeiro on public.orcamento_versoes for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());
drop policy if exists orcamento_itens_select on public.orcamento_itens;
create policy orcamento_itens_select on public.orcamento_itens for select to authenticated using (true);
drop policy if exists orcamento_itens_financeiro on public.orcamento_itens;
create policy orcamento_itens_financeiro on public.orcamento_itens for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());
drop policy if exists orcamento_auditoria_select on public.orcamento_auditoria;
create policy orcamento_auditoria_select on public.orcamento_auditoria for select to authenticated using (public.e_financeiro());
drop policy if exists orcamento_auditoria_financeiro on public.orcamento_auditoria;
create policy orcamento_auditoria_financeiro on public.orcamento_auditoria for insert to authenticated with check (public.e_financeiro());
drop policy if exists orcamentos_gestor_escreve on public.orcamentos;
create policy orcamentos_financeiro_escreve on public.orcamentos for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());

create index if not exists idx_orcamento_itens_orcamento on public.orcamento_itens(orcamento_id, ordem);
create index if not exists idx_orcamento_itens_codigo on public.orcamento_itens(orcamento_id, codigo);
create index if not exists idx_catalogo_precos_orcamento_item on public.catalogo_precos(orcamento_item_id);
create index if not exists idx_orcamento_auditoria_orcamento on public.orcamento_auditoria(orcamento_id, criado_em desc);

create or replace function public.reconstruir_itens_orcamento(p_orcamento_id uuid, p_colunas jsonb, p_linhas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare linha jsonb; chave text; v_chave_estavel text; item_id uuid; i integer := 0;
begin
  for linha in select value from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    chave := linha->>'__item_id';
    v_chave_estavel := coalesce(nullif(chave, ''), 'linha-' || i::text);
    select oi.id into item_id from public.orcamento_itens oi where oi.orcamento_id = p_orcamento_id and oi.chave_estavel = v_chave_estavel limit 1;
    if item_id is null then
      begin item_id := nullif(chave, '')::uuid; exception when invalid_text_representation then item_id := null; end;
      if item_id is null then item_id := gen_random_uuid(); end if;
    end if;
    insert into public.orcamento_itens(id, orcamento_id, chave_estavel, ordem, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, valor_bdi, custo_real, grupo, dados, tipo, ativo)
    values (
      item_id, p_orcamento_id, v_chave_estavel, i,
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'codigo' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'descricao' limit 1),
      (select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'unidade' limit 1),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'quantidade' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_unitario' limit 1), '')::numeric, 0),
      coalesce(nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_total' limit 1), '')::numeric, 0),
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'valor_bdi' limit 1), '')::numeric,
      nullif((select linha->>(value->>'id') from jsonb_array_elements(p_colunas) where value->>'funcao' = 'custo_real' limit 1), '')::numeric,
      linha->>'__grupo', linha, coalesce(linha->>'__tipo', 'item'), true
    ) on conflict (orcamento_id, chave_estavel) do update set ordem = excluded.ordem, codigo = excluded.codigo, descricao = excluded.descricao, unidade = excluded.unidade, quantidade = excluded.quantidade, valor_unitario = excluded.valor_unitario, valor_total = excluded.valor_total, valor_bdi = excluded.valor_bdi, custo_real = excluded.custo_real, grupo = excluded.grupo, dados = excluded.dados, tipo = excluded.tipo, ativo = true, atualizado_em = now();
  end loop;
  update public.orcamento_itens oi set ativo = false, atualizado_em = now()
    where oi.orcamento_id = p_orcamento_id and oi.ativo and not exists (
      select 1 from jsonb_array_elements(p_linhas) with ordinality as l(value, posicao)
      where coalesce(nullif(l.value->>'__item_id', ''), 'linha-' || l.posicao::text) = oi.chave_estavel
    );
end $$;

create or replace function public.projetar_orcamento_novo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.reconstruir_itens_orcamento(new.id, new.colunas, new.linhas);
  insert into public.orcamento_versoes(orcamento_id, versao, colunas, linhas, criado_por)
    values (new.id, new.versao, new.colunas, new.linhas, new.criado_por)
    on conflict (orcamento_id, versao) do nothing;
  return new;
end $$;

drop trigger if exists trg_projetar_orcamento_novo on public.orcamentos;
create trigger trg_projetar_orcamento_novo after insert on public.orcamentos
  for each row execute function public.projetar_orcamento_novo();

create or replace function public.verificar_ciclo_composicao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  encontrou boolean;
begin
  if new.composicao_referencia_id is null then return new; end if;
  if new.composicao_referencia_id = new.composicao_id then raise exception 'Ciclo de composicao'; end if;
  with recursive arvore(id) as (
    select new.composicao_referencia_id
    union all
    select c.composicao_referencia_id from public.composicao_componentes c
      join arvore a on a.id = c.composicao_id where c.composicao_referencia_id is not null
  ) select exists(select 1 from arvore where id = new.composicao_id) into encontrou;
  if encontrou then raise exception 'Ciclo de composicao'; end if;
  return new;
end $$;

drop trigger if exists trg_verificar_ciclo_composicao on public.composicao_componentes;
create trigger trg_verificar_ciclo_composicao before insert or update of composicao_referencia_id, composicao_id
  on public.composicao_componentes for each row execute function public.verificar_ciclo_composicao();

create or replace function public.salvar_orcamento_atomico(
  p_orcamento_id uuid, p_obra_id uuid, p_nome text, p_colunas jsonb, p_linhas jsonb,
  p_versao_esperada integer default null, p_autor uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare atual integer; nova integer;
begin
  select versao into atual from public.orcamentos where id = p_orcamento_id and obra_id = p_obra_id for update;
  if atual is null then raise exception 'Orcamento nao encontrado'; end if;
  if p_versao_esperada is not null and atual <> p_versao_esperada then raise exception 'Orcamento foi alterado por outro usuario'; end if;
  nova := atual + 1;
  insert into public.orcamento_versoes(orcamento_id, versao, colunas, linhas, criado_por)
    values (p_orcamento_id, nova, p_colunas, p_linhas, coalesce(p_autor, (select auth.uid())));
  update public.orcamentos set nome = p_nome, colunas = p_colunas, linhas = p_linhas, versao = nova where id = p_orcamento_id;
  perform public.reconstruir_itens_orcamento(p_orcamento_id, p_colunas, p_linhas);
  insert into public.orcamento_auditoria(orcamento_id, entidade, entidade_id, operacao, antes, depois, autor_id)
    values (p_orcamento_id, 'orcamento', p_orcamento_id, 'update', jsonb_build_object('versao', atual), jsonb_build_object('versao', nova), coalesce(p_autor, (select auth.uid())));
  return nova;
end $$;

grant execute on function public.e_financeiro() to authenticated;
grant execute on function public.salvar_orcamento_atomico(uuid, uuid, text, jsonb, jsonb, integer, uuid) to authenticated;

create or replace function public.impedir_autoalteracao_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() and (select auth.uid()) = old.id and (new.papel is distinct from old.papel or new.pode_editar_financeiro is distinct from old.pode_editar_financeiro) then
    raise exception 'Somente um administrador pode alterar papel ou permissao financeira';
  end if;
  return new;
end $$;

drop trigger if exists trg_impedir_autoalteracao_perfil on public.perfis;
create trigger trg_impedir_autoalteracao_perfil before update on public.perfis
  for each row execute function public.impedir_autoalteracao_perfil();
