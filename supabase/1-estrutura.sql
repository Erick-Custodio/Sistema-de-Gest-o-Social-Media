-- =====================================================================
-- Central de Conteúdo · estrutura do banco (rode 1 vez no SQL Editor)
-- Pode rodar de novo sem problema: tudo é "se não existir".
-- =====================================================================

-- Perfis de acesso: quem é administradora e quem é cliente de qual empresa
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text,
  role text not null default 'client' check (role in ('admin','client')),
  client_id text,
  blocked boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Todos os dados do painel (clientes, conteúdos, tarefas, leads...)
-- col = tipo do registro, id = código, client_id = empresa dona, data = conteúdo
create table if not exists public.docs (
  col text not null,
  id text not null,
  client_id text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists docs_client_idx on public.docs (client_id);

-- ---------- funções de apoio ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not blocked)
$$;

-- empresa do cliente logado (vazio se bloqueado ou se ainda não trocou a senha provisória)
create or replace function public.my_client_id() returns text
language sql stable security definer set search_path = public as $$
  select client_id from profiles
  where id = auth.uid() and role = 'client' and not blocked and not must_change_password
$$;

-- o cliente pode agir sobre este conteúdo/tarefa? (é da empresa dele e a permissão está ligada)
create or replace function public.client_can(perm text, target_col text, target_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from docs t
    join docs c on c.col = 'clients' and c.id = t.client_id
    where t.col = target_col and t.id = target_id
      and t.client_id = my_client_id()
      and coalesce(c.data->'perms'->>perm, 'true') <> 'false'
  )
$$;

-- chamada pelo cliente depois de criar a própria senha
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as $$
  update profiles set must_change_password = false where id = auth.uid()
$$;

revoke all on function public.password_changed() from public, anon;
grant execute on function public.password_changed() to authenticated;

-- ---------- regras de acesso: docs ----------
alter table public.docs enable row level security;

drop policy if exists docs_admin on public.docs;
create policy docs_admin on public.docs for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists docs_client_read on public.docs;
create policy docs_client_read on public.docs for select to authenticated
  using (client_id is not null and client_id = my_client_id()
         and (col in ('clients','posts','tasks','approvals','taskdone','actions')
              or (col = 'fin' and data->>'kind' = 'receita' and client_can('faturas','fin',id))));

drop policy if exists docs_client_insert on public.docs;
create policy docs_client_insert on public.docs for insert to authenticated
  with check (client_id = my_client_id() and (
       (col = 'approvals' and client_can('aprovar','posts',id))
    or (col = 'actions'   and client_can('concluir','posts',id))
    or (col = 'taskdone'  and client_can('tarefas','tasks',id))));

drop policy if exists docs_client_update on public.docs;
create policy docs_client_update on public.docs for update to authenticated
  using (client_id = my_client_id() and col in ('approvals','actions','taskdone'))
  with check (client_id = my_client_id() and (
       (col = 'approvals' and client_can('aprovar','posts',id))
    or (col = 'actions'   and client_can('concluir','posts',id))
    or (col = 'taskdone'  and client_can('tarefas','tasks',id))));

drop policy if exists docs_client_delete on public.docs;
create policy docs_client_delete on public.docs for delete to authenticated
  using (client_id = my_client_id() and col in ('approvals','actions','taskdone'));

-- ---------- regras de acesso: profiles ----------
-- cada um lê o próprio perfil; a administradora lê todos.
-- ninguém altera direto: mudanças passam pela função "admin-users" (servidor).
alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin());

-- ---------- tempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.docs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

-- ---------- fotos e vídeos (bucket privado, até 20 MB por arquivo) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 20971520,
        array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;

-- arquivos ficam em pastas por empresa: media/<código da empresa>/arquivo
drop policy if exists media_admin on storage.objects;
create policy media_admin on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists media_client_read on storage.objects;
create policy media_client_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_client_id());
