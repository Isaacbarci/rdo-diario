-- Lixeira de cópias: restauração pela conta principal durante 30 dias.
begin;
alter table public.rdo_arquivos add column if not exists excluido_em timestamptz;
alter table public.rdo_arquivos add column if not exists excluido_por uuid;
alter table public.rdo_arquivos add column if not exists eliminacao_em timestamptz;
create index if not exists rdo_arquivos_lixeira_idx on public.rdo_arquivos(excluido_em) where excluido_em is not null;
drop policy if exists lixeira_visibilidade on public.rdo_arquivos;
create policy lixeira_visibilidade on public.rdo_arquivos as restrictive for select to authenticated using(excluido_em is null);
drop policy if exists lixeira_sem_delete on public.rdo_arquivos;
create policy lixeira_sem_delete on public.rdo_arquivos as restrictive for delete to authenticated using(false);
drop policy if exists lixeira_sem_update on public.rdo_arquivos;
create policy lixeira_sem_update on public.rdo_arquivos as restrictive for update to authenticated using(false);
drop policy if exists lixeira_insert_limpo on public.rdo_arquivos;
create policy lixeira_insert_limpo on public.rdo_arquivos as restrictive for insert to authenticated with check(excluido_em is null and excluido_por is null);
drop policy if exists rdo_lixeira_storage_delete on storage.objects;
create policy rdo_lixeira_storage_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'rdo-arquivos');
drop policy if exists rdo_lixeira_storage_update on storage.objects;
create policy rdo_lixeira_storage_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'rdo-arquivos');
-- Preserve retry downloads after an upload succeeded but its metadata insert failed.
create or replace function public.rdo_arquivo_fora_lixeira(p_caminho text)
returns boolean language sql stable security definer set search_path=''
as $$ select not exists(select 1 from public.rdo_arquivos h where h.caminho=p_caminho and h.excluido_em is not null); $$;
revoke all on function public.rdo_arquivo_fora_lixeira(text) from public,anon;
grant execute on function public.rdo_arquivo_fora_lixeira(text) to authenticated;
drop policy if exists rdo_lixeira_storage_select on storage.objects;
create policy rdo_lixeira_storage_select on storage.objects as restrictive for select to authenticated using(bucket_id<>'rdo-arquivos' or public.rdo_arquivo_fora_lixeira(name));
create or replace function public.rdo_copia_lixeira(p_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare dono text; apagado timestamptz;
begin
 select user_id::text,excluido_em into dono,apagado from public.rdo_arquivos where id::text=p_id for update;
 if not found then raise exception 'Cópia não encontrada'; end if;
 if not coalesce(public.rdo_operacao_copia(dono),false) then raise exception 'Sem permissão para excluir esta cópia'; end if;
 if apagado is null then update public.rdo_arquivos set excluido_em=now(),excluido_por=auth.uid() where id::text=p_id; end if;
 return true;
end; $$;
create or replace function public.rdo_copia_restaurar(p_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.rdo_admin(),false) then raise exception 'Somente a conta principal pode restaurar'; end if;
 update public.rdo_arquivos set excluido_em=null,excluido_por=null where id::text=p_id and excluido_em>now()-interval '30 days' and eliminacao_em is null;
 if not found then raise exception 'Cópia indisponível ou prazo de restauração encerrado'; end if;
 return true;
end; $$;
revoke all on function public.rdo_copia_lixeira(text),public.rdo_copia_restaurar(text) from public,anon;
grant execute on function public.rdo_copia_lixeira(text),public.rdo_copia_restaurar(text) to authenticated;
commit;
