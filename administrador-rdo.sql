-- Aplicar no Supabase do RDO: aifukuicddxpxzvfnmur.
begin;
create or replace function public.rdo_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid())
 and lower(u.email)='isaacbarci@gmail.com' and u.email_confirmed_at is not null);
$$;
revoke all on function public.rdo_admin() from public,anon;
grant execute on function public.rdo_admin() to authenticated;
create or replace function public.rdo_operacao_admin() returns boolean
language sql stable security invoker set search_path='' as $$
 select current_user in ('postgres','supabase_admin') or
 (public.rdo_admin() and (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-rdo-admin')='true');
$$;
revoke all on function public.rdo_operacao_admin() from public,anon;
grant execute on function public.rdo_operacao_admin() to authenticated;

do $$ declare nome text;begin
 foreach nome in array array['rdo_registros','rdo_semanas','rdo_apontamentos'] loop
  execute format('drop policy if exists rdo_administrador on public.%I',nome);
  execute format('create policy rdo_administrador on public.%I for all to authenticated using((select public.rdo_operacao_admin())) with check((select public.rdo_operacao_admin()))',nome);
 end loop;
end $$;
grant update,delete on public.rdo_arquivos to authenticated;
drop policy if exists rdo_admin_historico_ler on public.rdo_arquivos;
create policy rdo_admin_historico_ler on public.rdo_arquivos for select to authenticated using((select public.rdo_admin()));
drop policy if exists rdo_admin_historico_alterar on public.rdo_arquivos;
create policy rdo_admin_historico_alterar on public.rdo_arquivos for update to authenticated
 using((select public.rdo_operacao_admin())) with check((select public.rdo_operacao_admin()));
drop policy if exists rdo_admin_historico_excluir on public.rdo_arquivos;
create policy rdo_admin_historico_excluir on public.rdo_arquivos for delete to authenticated using((select public.rdo_operacao_admin()));
drop policy if exists rdo_admin_copias_ler on storage.objects;
create policy rdo_admin_copias_ler on storage.objects for select to authenticated
 using(bucket_id='rdo-arquivos' and (select public.rdo_admin()));
drop policy if exists rdo_admin_copias_gerenciar on storage.objects;
create policy rdo_admin_copias_gerenciar on storage.objects for all to authenticated
 using(bucket_id='rdo-arquivos' and (select public.rdo_operacao_admin()))
 with check(bucket_id='rdo-arquivos' and (select public.rdo_operacao_admin()));

-- Mantem a auditoria e permite a administracao pelo painel de Owner.
create or replace function public.rdo_auditar_registro() returns trigger
language plpgsql security invoker set search_path='' as $$
declare administrador boolean:=public.rdo_operacao_admin();email_conta text:=auth.jwt()->>'email';
begin
 if not administrador and (auth.uid() is null or new.user_id is distinct from auth.uid()) then raise exception 'Conta incorreta';end if;
 if tg_op='UPDATE' then new.criado_em=old.criado_em;end if;
 new.atualizado_em=now();
 if email_conta is not null then
  if tg_op='UPDATE' and new.user_id is distinct from auth.uid() then
   new.conteudo=jsonb_set(new.conteudo,'{administrador_email}',to_jsonb(email_conta));
  else new.conteudo=jsonb_set(new.conteudo,'{autor_email}',to_jsonb(email_conta));end if;
 elsif administrador then new.conteudo=jsonb_set(new.conteudo,'{alterado_via}',to_jsonb('painel_supabase'::text));end if;
 return new;
end $$;
revoke all on function public.rdo_auditar_registro() from public,anon,authenticated;
commit;
select schemaname,tablename,policyname,cmd from pg_policies
 where policyname in ('rdo_administrador','rdo_admin_historico_ler','rdo_admin_historico_alterar','rdo_admin_historico_excluir','rdo_admin_copias_ler','rdo_admin_copias_gerenciar') order by tablename,policyname;
