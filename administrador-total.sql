-- Aplicar após as permissões existentes. Não concede acesso a nenhuma conta automaticamente.
begin;
alter table public.rdo_acessos add column if not exists administrador_total boolean not null default false;
create or replace function public.rdo_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<now()) and (lower(u.email)='isaacbarci@gmail.com'
 or exists(select 1 from public.rdo_acessos a where a.user_id=u.id and a.administrador_total)));
$$;
revoke all on function public.rdo_admin() from public,anon;
grant execute on function public.rdo_admin() to authenticated;
notify pgrst,'reload schema';
commit;
