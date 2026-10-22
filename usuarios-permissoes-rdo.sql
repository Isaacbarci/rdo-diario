-- Executar APOS administrador-rdo.sql, no Supabase correspondente ao pacote.
begin;
create table if not exists public.rdo_acessos(
 user_id uuid primary key references auth.users(id) on delete cascade,
 ver_historico boolean not null default false,
 excluir_copias boolean not null default false,
 check(not excluir_copias or ver_historico)
);
alter table public.rdo_acessos enable row level security;
revoke all on public.rdo_acessos from public,anon,authenticated;
grant select,insert,update,delete on public.rdo_acessos to service_role;
create or replace function public.rdo_admin()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from auth.users u where u.id=(select auth.uid()) and lower(u.email)='isaacbarci@gmail.com' and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()));$$;
create or replace function public.rdo_historico_admin()
returns boolean language sql stable security definer set search_path=''
as $$select public.rdo_admin() or exists(select 1 from public.rdo_acessos a join auth.users u on u.id=a.user_id where a.user_id=(select auth.uid()) and a.ver_historico and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()));$$;
create or replace function public.rdo_excluir_copias()
returns boolean language sql stable security definer set search_path=''
as $$select public.rdo_admin() or exists(select 1 from public.rdo_acessos a join auth.users u on u.id=a.user_id where a.user_id=(select auth.uid()) and a.excluir_copias and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()));$$;
create or replace function public.rdo_operacao_historico()
returns boolean language sql stable security invoker set search_path=''
as $$select public.rdo_excluir_copias() and (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-rdo-admin')='true';$$;
revoke all on function public.rdo_admin(),public.rdo_historico_admin(),public.rdo_excluir_copias(),public.rdo_operacao_historico() from public,anon;
grant execute on function public.rdo_admin(),public.rdo_historico_admin(),public.rdo_excluir_copias(),public.rdo_operacao_historico() to authenticated;
drop policy if exists rdo_admin_historico_excluir on public.rdo_arquivos;
create policy rdo_admin_historico_excluir on public.rdo_arquivos for delete to authenticated using((select public.rdo_operacao_historico()));
drop policy if exists rdo_arquivo_permissao_excluir on storage.objects;
create policy rdo_arquivo_permissao_excluir on storage.objects for delete to authenticated using(bucket_id='rdo-arquivos' and (select public.rdo_operacao_historico()));
drop policy if exists rdo_admin_historico_ler on public.rdo_arquivos;
create policy rdo_admin_historico_ler on public.rdo_arquivos for select to authenticated using((select public.rdo_historico_admin()));
drop policy if exists rdo_admin_copias_ler on storage.objects;
create policy rdo_admin_copias_ler on storage.objects for select to authenticated using(bucket_id='rdo-arquivos' and (select public.rdo_historico_admin()));
commit;

-- Permissão independente para excluir apenas cópias próprias. Não concede novas permissões a contas existentes.
begin;
alter table public.rdo_acessos add column if not exists excluir_proprias boolean not null default false;
create or replace function public.rdo_excluir_proprias()
returns boolean language sql stable security definer set search_path=''
as $$ select public.rdo_excluir_copias() or exists(
 select 1 from public.rdo_acessos a join auth.users u on u.id=a.user_id
 where a.user_id=(select auth.uid()) and a.excluir_proprias and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<now())); $$;
create or replace function public.rdo_operacao_copia(p_dono text)
returns boolean language sql stable security invoker set search_path=''
as $$ select (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-rdo-admin')='true'
 and (public.rdo_excluir_copias() or (p_dono=(select auth.uid())::text and public.rdo_excluir_proprias())); $$;
revoke all on function public.rdo_excluir_proprias(),public.rdo_operacao_copia(text) from public,anon;
grant execute on function public.rdo_excluir_proprias(),public.rdo_operacao_copia(text) to authenticated;
grant delete on public.rdo_arquivos to authenticated;
drop policy if exists rdo_admin_historico_excluir on public.rdo_arquivos;
create policy rdo_admin_historico_excluir on public.rdo_arquivos for delete to authenticated using(public.rdo_operacao_copia(user_id::text));
drop policy if exists rdo_arquivo_permissao_excluir on storage.objects;
create policy rdo_arquivo_permissao_excluir on storage.objects for delete to authenticated
 using(bucket_id='rdo-arquivos' and public.rdo_operacao_copia((storage.foldername(name))[1]));
commit;
