-- Remove uma medicao e todos os vinculos que impedem a exclusao do catalogo.
-- A operacao inteira ocorre na mesma transacao da chamada RPC.
create or replace function public.excluir_medicao_atomico(
  p_medicao_id uuid,
  p_obra_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existe boolean;
begin
  if not public.e_gestor() then
    raise exception 'Permissao insuficiente';
  end if;

  select exists (
    select 1
    from public.medicoes
    where id = p_medicao_id and obra_id = p_obra_id
  ) into v_existe;

  if not v_existe then
    raise exception 'Medicao nao encontrada nesta obra';
  end if;

  delete from public.tarefa_medicoes
  where catalogo_id in (
    select id from public.catalogo_precos where medicao_id = p_medicao_id
  );

  delete from public.medicoes
  where id = p_medicao_id and obra_id = p_obra_id;
end;
$$;

grant execute on function public.excluir_medicao_atomico(uuid, uuid) to authenticated;
