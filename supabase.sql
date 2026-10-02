-- =====================================================================
--  هقَّوة — إعداد قاعدة Supabase  (انسخ الملف كاملاً في SQL Editor ثم Run)
-- =====================================================================

-- ---------- الجداول ----------
create table if not exists public.site_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name_ar text, name_en text, desc_ar text, desc_en text,
  price numeric, category_ar text, category_en text,
  image text, visible boolean not null default true, sort bigint not null default 0
);
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title_ar text, title_en text, desc_ar text, desc_en text,
  price_label_ar text, price_label_en text,
  image text, visible boolean not null default true, sort bigint not null default 0
);
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image text, caption_ar text, caption_en text,
  size text not null default 'md', visible boolean not null default true, sort bigint not null default 0
);

create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  photo text default '',
  role text not null default 'staff' check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text, email text, photo text,
  favs text[] not null default '{}'
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text, email text, photo text,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  branch text, note text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  action text not null,
  ts timestamptz not null default now()
);

-- ---------- دوال مساعدة ----------
create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.staff where id = auth.uid() and active) $$;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.staff where id = auth.uid() and active and role = 'admin') $$;

-- هل يحتاج الموقع إلى إنشاء المدير الأول؟
create or replace function public.needs_setup() returns boolean
language sql security definer stable set search_path = public as
$$ select not exists (select 1 from public.staff) $$;

-- إنشاء أول مدير (تعمل مرة واحدة فقط)
create or replace function public.claim_first_admin(p_name text, p_username text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.staff) then raise exception 'admin already exists'; end if;
  insert into public.staff (id, name, username, role) values (auth.uid(), p_name, lower(p_username), 'admin');
end $$;

-- حذف موظف نهائياً (يحرّر اسم المستخدم أيضاً)
create or replace function public.delete_staff(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_id = auth.uid() then raise exception 'cannot delete yourself'; end if;
  delete from auth.users where id = p_id;
end $$;

-- تغيير كلمة مرور موظف
create or replace function public.admin_set_password(p_id uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if length(p_pass) < 6 then raise exception 'password too short'; end if;
  update auth.users set encrypted_password = crypt(p_pass, gen_salt('bf')), updated_at = now() where id = p_id;
end $$;

revoke all on function public.claim_first_admin(text,text), public.delete_staff(uuid), public.admin_set_password(uuid,text) from public, anon;
grant execute on function public.claim_first_admin(text,text), public.delete_staff(uuid), public.admin_set_password(uuid,text) to authenticated;
grant execute on function public.needs_setup(), public.is_staff(), public.is_admin() to anon, authenticated;

-- ---------- الصلاحيات (RLS) ----------
alter table public.site_kv   enable row level security;
alter table public.products  enable row level security;
alter table public.offers    enable row level security;
alter table public.gallery   enable row level security;
alter table public.staff     enable row level security;
alter table public.profiles  enable row level security;
alter table public.orders    enable row level security;
alter table public.activity  enable row level security;

-- محتوى الموقع: قراءة للجميع، تعديل للموظفين
do $$ declare t text; begin
  foreach t in array array['site_kv','products','offers','gallery'] loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('drop policy if exists "staff write" on public.%I', t);
    execute format('create policy "read all" on public.%I for select using (true)', t);
    execute format('create policy "staff write" on public.%I for all using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- الموظفون
drop policy if exists "staff read" on public.staff;
drop policy if exists "admin write" on public.staff;
create policy "staff read"  on public.staff for select using (id = auth.uid() or public.is_admin());
create policy "admin write" on public.staff for all using (public.is_admin()) with check (public.is_admin());

-- ملفات الزوار (المفضلة)
drop policy if exists "own profile" on public.profiles;
drop policy if exists "staff see profiles" on public.profiles;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "staff see profiles" on public.profiles for select using (public.is_staff());

-- الطلبات
drop policy if exists "create own order" on public.orders;
drop policy if exists "read orders" on public.orders;
drop policy if exists "staff update orders" on public.orders;
drop policy if exists "staff delete orders" on public.orders;
create policy "create own order" on public.orders for insert with check (user_id = auth.uid() and status = 'new');
create policy "read orders" on public.orders for select using (user_id = auth.uid() or public.is_staff());
create policy "staff update orders" on public.orders for update using (public.is_staff());
create policy "staff delete orders" on public.orders for delete using (public.is_staff());

-- سجل النشاط: للفريق فقط، ولا يمكن تعديله أو حذفه
drop policy if exists "staff read activity" on public.activity;
drop policy if exists "staff add activity" on public.activity;
create policy "staff read activity" on public.activity for select using (public.is_staff());
create policy "staff add activity"  on public.activity for insert with check (public.is_staff() and user_id = auth.uid());

-- ---------- التخزين (الصور والخطوط) ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists "media read" on storage.objects;
drop policy if exists "media staff insert" on storage.objects;
drop policy if exists "media staff update" on storage.objects;
drop policy if exists "media staff delete" on storage.objects;
create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media staff insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_staff());
create policy "media staff update" on storage.objects for update using (bucket_id = 'media' and public.is_staff());
create policy "media staff delete" on storage.objects for delete using (bucket_id = 'media' and public.is_staff());

-- ---------- التحديث اللحظي ----------
do $$ declare t text; begin
  foreach t in array array['site_kv','products','offers','gallery','orders','activity','profiles','staff'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
