-- =====================================================================
-- Barista de Bolsillo — Base de datos (Supabase / Postgres)
-- ---------------------------------------------------------------------
-- Cuentas con email + contraseña (Supabase Auth), sincronización de
-- recetas / bitácora / catas entre dispositivos, y recetas públicas
-- (Comunidad) con "me gusta".
--
-- Seguridad: TODAS las tablas tienen Row Level Security.
--   - user_items: cada usuario ve y modifica solo lo suyo.
--   - public_recipes: cualquiera puede leer; solo el dueño publica/edita/borra.
--   - recipe_likes: cada usuario maneja solo sus "me gusta".
--   - profiles: nombre de usuario visible (para firmar recetas públicas).
-- Para aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_.]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Perfiles visibles para todos" on public.profiles;
create policy "Perfiles visibles para todos" on public.profiles
  for select using (true);

drop policy if exists "Cada uno edita su perfil" on public.profiles;
create policy "Cada uno edita su perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Solo se puede cambiar el nombre (no el id ni la fecha)
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name) on public.profiles to authenticated;

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, username, display_name)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(left(new.raw_user_meta_data ->> 'display_name', 60), '')
    );
  exception when others then
    -- nombre de usuario repetido o inválido: se crea sin nombre y se elige después
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Datos sincronizados (recetas, bitácora, catas) ----------
create table if not exists public.user_items (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('recipe', 'log', 'cata')),
  client_id bigint not null,
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) < 20000),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, client_id)
);
alter table public.user_items enable row level security;

drop policy if exists "Ver mis datos" on public.user_items;
create policy "Ver mis datos" on public.user_items
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Crear mis datos" on public.user_items;
create policy "Crear mis datos" on public.user_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Editar mis datos" on public.user_items;
create policy "Editar mis datos" on public.user_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Borrar mis datos" on public.user_items;
create policy "Borrar mis datos" on public.user_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Recetas públicas (Comunidad) ----------
create table if not exists public.public_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  client_id bigint not null,
  title text not null check (char_length(title) between 1 and 120),
  brewer text not null check (char_length(brewer) <= 30),
  data jsonb not null check (octet_length(data::text) < 20000),
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists public_recipes_recent_idx on public.public_recipes (created_at desc);
create index if not exists public_recipes_popular_idx on public.public_recipes (likes_count desc, created_at desc);
create index if not exists public_recipes_brewer_idx on public.public_recipes (brewer);
alter table public.public_recipes enable row level security;

drop policy if exists "Recetas públicas visibles para todos" on public.public_recipes;
create policy "Recetas públicas visibles para todos" on public.public_recipes
  for select using (true);
drop policy if exists "Publicar mis recetas" on public.public_recipes;
create policy "Publicar mis recetas" on public.public_recipes
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Editar mis recetas públicas" on public.public_recipes;
create policy "Editar mis recetas públicas" on public.public_recipes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Despublicar mis recetas" on public.public_recipes;
create policy "Despublicar mis recetas" on public.public_recipes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- El contador de "me gusta" no se puede tocar desde la app (solo el trigger)
revoke insert, update on public.public_recipes from anon, authenticated;
grant insert (user_id, client_id, title, brewer, data) on public.public_recipes to authenticated;
grant update (title, brewer, data, updated_at) on public.public_recipes to authenticated;

-- ---------- Me gusta ----------
create table if not exists public.recipe_likes (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipe_id uuid not null references public.public_recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index if not exists recipe_likes_recipe_idx on public.recipe_likes (recipe_id);
alter table public.recipe_likes enable row level security;

drop policy if exists "Ver mis me gusta" on public.recipe_likes;
create policy "Ver mis me gusta" on public.recipe_likes
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Dar me gusta" on public.recipe_likes;
create policy "Dar me gusta" on public.recipe_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Sacar me gusta" on public.recipe_likes;
create policy "Sacar me gusta" on public.recipe_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.update_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.public_recipes set likes_count = likes_count + 1 where id = new.recipe_id;
  elsif tg_op = 'DELETE' then
    update public.public_recipes set likes_count = greatest(likes_count - 1, 0) where id = old.recipe_id;
  end if;
  return null;
end;
$$;

drop trigger if exists recipe_likes_count on public.recipe_likes;
create trigger recipe_likes_count
  after insert or delete on public.recipe_likes
  for each row execute function public.update_likes_count();

-- ---------- Eliminar mi cuenta (borra todo en cascada) ----------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_likes_count() from public, anon, authenticated;
