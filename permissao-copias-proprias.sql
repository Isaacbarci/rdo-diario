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
