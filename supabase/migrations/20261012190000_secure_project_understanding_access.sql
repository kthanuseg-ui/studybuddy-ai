
begin;

-- Check whether the authenticated student is assigned to a project.
-- SECURITY DEFINER avoids recursive RLS evaluation.
create or replace function public.is_student_assigned_to_project(
  project_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_uuid
      and pa.student_id = auth.uid()
  );
$$;

-- Check whether the authenticated tutor owns a project.
create or replace function public.is_project_tutor(
  project_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project_uuid
      and p.tutor_id = auth.uid()
      and public.current_user_role() = 'tutor'::public.user_role
  );
$$;

-- Only authenticated users may execute these helpers.
revoke all on function public.is_student_assigned_to_project(uuid)
  from public;
revoke all on function public.is_project_tutor(uuid)
  from public;

grant execute on function public.is_student_assigned_to_project(uuid)
  to authenticated;
grant execute on function public.is_project_tutor(uuid)
  to authenticated;

-- Prevent circular RLS dependencies between projects
-- and project_assignments.
drop policy if exists
  "Projects are readable by permitted users"
on public.projects;

create policy "Projects are readable by permitted users"
on public.projects
for select
to authenticated
using (
  tutor_id = auth.uid()
  or public.is_student_assigned_to_project(id)
  or public.is_admin()
);

drop policy if exists
  "Project assignments are readable by permitted users"
on public.project_assignments;

create policy "Project assignments are readable by permitted users"
on public.project_assignments
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_project_tutor(project_id)
  or public.is_admin()
);

-- A tutor may only read understanding checks belonging
-- to their own project and currently assigned students.
drop policy if exists
  "Understanding checks are readable by permitted users"
on public.understanding_checks;

create policy "Understanding checks are readable by permitted users"
on public.understanding_checks
for select
to authenticated
using (
  student_id = auth.uid()
  or (
    public.is_project_tutor(project_id)
    and public.is_assigned_student(student_id)
  )
  or public.is_admin()
);

commit;
