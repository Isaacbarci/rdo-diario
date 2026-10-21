-- RDO usa tabelas próprias no Supabase de teste aifukuicddxpxzvfnmur.
-- Não altera tabelas, usuários ou arquivos dos romaneios.
begin;
create table if not exists public.rdo_registros(
 user_id uuid not null default auth.uid() references auth.users(id),
 id text not null,conteudo jsonb not null,
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),
 primary key(user_id,id)
);
create table if not exists public.rdo_semanas(
 user_id uuid not null default auth.uid() references auth.users(id),
 id text not null,conteudo jsonb not null,
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),
 primary key(user_id,id)
);
create table if not exists public.rdo_apontamentos(
 user_id uuid not null default auth.uid() references auth.users(id),
 id text not null,spool_id text not null,data_apontamento date not null,conteudo jsonb not null,
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),
 primary key(user_id,id),unique(user_id,spool_id),check(id=spool_id)
);
create or replace function public.rdo_auditar_registro() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Conta incorreta';end if;
 if tg_op='UPDATE' then new.criado_em=old.criado_em;end if;
 new.atualizado_em=now();
 new.conteudo=jsonb_set(new.conteudo,'{autor_email}',to_jsonb(auth.jwt()->>'email'));
 return new;
end $$;
revoke all on function public.rdo_auditar_registro() from public,anon,authenticated;
do $$ declare nome text;begin
 foreach nome in array array['rdo_registros','rdo_semanas','rdo_apontamentos'] loop
  execute format('alter table public.%I enable row level security',nome);
  execute format('revoke all on public.%I from anon,authenticated',nome);
  execute format('grant select,insert,update,delete on public.%I to authenticated',nome);
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=nome and policyname='rdo_somente_proprio') then
   execute format('create policy rdo_somente_proprio on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',nome);
  end if;
  if not exists(select 1 from pg_trigger where tgname='rdo_auditoria' and tgrelid=('public.'||nome)::regclass) then
   execute format('create trigger rdo_auditoria before insert or update on public.%I for each row execute function public.rdo_auditar_registro()',nome);
  end if;
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rdo-arquivos','rdo-arquivos',false,20971520,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/html']) on conflict(id) do nothing;
create table if not exists public.rdo_arquivos(
 id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id),
 tipo text not null check(tipo in ('rdo_excel','rdo_dashboard','apontamento_excel')),
 nome text not null check(length(nome) between 1 and 240),caminho text not null unique,
 tamanho bigint not null check(tamanho between 1 and 20971520),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 itens integer not null default 0 check(itens>=0),autor_email text not null default '',criado_em timestamptz not null default now(),
 check(caminho=user_id::text||'/'||id::text||case when tipo='rdo_dashboard' then '.html' else '.xlsx' end)
);
alter table public.rdo_arquivos enable row level security;
revoke all on public.rdo_arquivos from anon,authenticated;
grant select on public.rdo_arquivos to authenticated;
grant insert(id,user_id,tipo,nome,caminho,tamanho,sha256,itens) on public.rdo_arquivos to authenticated;
create or replace function public.rdo_auditar_arquivo() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Conta incorreta';end if;
 new.autor_email=auth.jwt()->>'email';new.criado_em=now();return new;
end $$;
revoke all on function public.rdo_auditar_arquivo() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='rdo_arquivo_email') then create trigger rdo_arquivo_email before insert on public.rdo_arquivos for each row execute function public.rdo_auditar_arquivo();end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='rdo_arquivos' and policyname='rdo_arquivo_ler') then create policy rdo_arquivo_ler on public.rdo_arquivos for select to authenticated using(user_id=(select auth.uid()));end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='rdo_arquivos' and policyname='rdo_arquivo_inserir') then create policy rdo_arquivo_inserir on public.rdo_arquivos for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='rdo-arquivos' and o.name=caminho));end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rdo_storage_ler') then create policy rdo_storage_ler on storage.objects for select to authenticated using(bucket_id='rdo-arquivos' and (storage.foldername(name))[1]=(select auth.uid())::text);end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rdo_storage_inserir') then create policy rdo_storage_inserir on storage.objects for insert to authenticated with check(bucket_id='rdo-arquivos' and (storage.foldername(name))[1]=(select auth.uid())::text and storage.extension(name) in ('xlsx','html'));end if;
end $$;
create index if not exists rdo_arquivos_data on public.rdo_arquivos(user_id,criado_em desc);
commit;
select 'OK: RDO e apontamentos preparados, privados por conta.' as resultado;

-- Metadados dos novos downloads; preserva os arquivos existentes.
begin;
alter table public.rdo_arquivos add column if not exists equipe text not null default '';
alter table public.rdo_arquivos add column if not exists turno text not null default '';
alter table public.rdo_arquivos add column if not exists data_rdo date;
grant insert(equipe,turno,data_rdo) on public.rdo_arquivos to authenticated;
commit;
