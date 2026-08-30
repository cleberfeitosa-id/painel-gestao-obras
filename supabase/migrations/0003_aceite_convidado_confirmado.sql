-- ---------------------------------------------------------------------------
-- Garante o aceite de convite para usuarios ja confirmados.
-- Reaplica o trigger handle_user_confirmed (idempotente) e faz backfill de
-- aceito_em a partir de auth.users.email_confirmed_at. Pode rodar no SQL
-- Editor quantas vezes precisar.
-- ---------------------------------------------------------------------------

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

update public.perfis p
set aceito_em = u.email_confirmed_at
from auth.users u
where u.id = p.id
  and p.aceito_em is null
  and u.email_confirmed_at is not null;