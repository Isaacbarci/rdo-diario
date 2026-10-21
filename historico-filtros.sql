-- Metadados dos novos downloads; preserva os arquivos existentes.
begin;
alter table public.rdo_arquivos add column if not exists equipe text not null default '';
alter table public.rdo_arquivos add column if not exists turno text not null default '';
alter table public.rdo_arquivos add column if not exists data_rdo date;
grant insert(equipe,turno,data_rdo) on public.rdo_arquivos to authenticated;
commit;
