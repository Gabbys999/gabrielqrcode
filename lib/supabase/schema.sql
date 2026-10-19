
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student'
    check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));


create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  venue text not null default '',
  description text not null default '',
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists venue text not null default '',
  add column if not exists description text not null default '',
  add column if not exists status text not null default 'open';

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check
  check (status in ('open', 'closed'));


create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  status text not null default 'present'
    check (status in ('present', 'late', 'excused', 'absent')),
  unique (student_id, event_id)
);

alter table public.attendance
  add column if not exists status text not null default 'present';

alter table public.attendance
  drop constraint if exists attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'excused', 'absent'));



alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.can_manage_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('teacher', 'admin')
  );
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
  );
$$;

drop policy if exists "Administrators can view all profiles"
on public.profiles;

create policy "Administrators can view all profiles"
on public.profiles
for select
using (public.is_admin());

drop policy if exists "Administrators can update all profiles"
on public.profiles;

create policy "Administrators can update all profiles"
on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());


drop policy if exists "Profiles are viewable by owner"
on public.profiles;

create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile"
on public.profiles;

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id and role = 'student');

drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Only an administrator can change account roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation
on public.profiles;

create trigger prevent_profile_role_escalation
before update on public.profiles
for each row
execute procedure public.prevent_self_role_change();


drop policy if exists "Events are readable by any authenticated user"
on public.events;

create policy "Events are readable by any authenticated user"
on public.events
for select
using (auth.role() = 'authenticated');

drop policy if exists "Users can insert events"
on public.events;

create policy "Users can insert events"
on public.events
for insert
with check (auth.uid() = created_by and public.can_manage_events());

drop policy if exists "Users can update their own events"
on public.events;

create policy "Users can update their own events"
on public.events
for update
using (auth.uid() = created_by and public.can_manage_events())
with check (auth.uid() = created_by and public.can_manage_events());

drop policy if exists "Administrators can update any event"
on public.events;

create policy "Administrators can update any event"
on public.events
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Administrators can delete events"
on public.events;

create policy "Administrators can delete events"
on public.events
for delete
using (public.is_admin());


drop policy if exists "Students can view their own attendance"
on public.attendance;

create policy "Students can view their own attendance"
on public.attendance
for select
using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance"
on public.attendance;

create policy "Students can insert their own attendance"
on public.attendance
for insert
with check (
  auth.uid() = student_id
  and public.is_student()
  and exists (
    select 1
    from public.events
    where events.id = attendance.event_id
      and events.status = 'open'
      and (events.start_time is null or events.start_time <= now())
      and (events.end_time is null or events.end_time >= now())
  )
);



drop policy if exists "Teachers can view attendance for their events"
on public.attendance;

create policy "Teachers can view attendance for their events"
on public.attendance
for select
using (
  exists (
    select 1
    from public.events
    where events.id = attendance.event_id
      and events.created_by = auth.uid()
  )
);

drop policy if exists "Administrators can manage attendance"
on public.attendance;

create policy "Administrators can manage attendance"
on public.attendance
for all
using (public.is_admin())
with check (public.is_admin());



create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    case
      when new.raw_user_meta_data->>'role' in ('student', 'teacher')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();