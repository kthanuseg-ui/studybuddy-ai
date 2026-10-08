create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'admin'::public.user_role;
$$;

create or replace function public.is_assigned_student(student_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tutor_student_links
    where tutor_id = auth.uid()
      and student_id = student_uuid
  );
$$;