alter table public.profiles enable row level security;
alter table public.tutor_student_links enable row level security;
alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.understanding_checks enable row level security;

create policy "Profiles are readable by permitted users"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or public.is_assigned_student(id)
  or exists (
    select 1
    from public.tutor_student_links tsl
    where tsl.student_id = auth.uid()
      and tsl.tutor_id = public.profiles.id
  )
);

create policy "Profiles can be updated by owner or admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

revoke update on table public.profiles from authenticated;

grant update (full_name)
on table public.profiles
to authenticated;

create policy "Profiles can be deleted by admins"
on public.profiles
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Tutor student links are readable by related users"
on public.tutor_student_links
for select
to authenticated
using (
  student_id = auth.uid()
  or tutor_id = auth.uid()
  or public.is_admin()
);

create policy "Tutor student links can be inserted by admins"
on public.tutor_student_links
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Tutor student links can be updated by admins"
on public.tutor_student_links
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Tutor student links can be deleted by admins"
on public.tutor_student_links
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Subjects are readable by permitted users"
on public.subjects
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_assigned_student(student_id)
  or public.is_admin()
);

create policy "Subjects can be inserted by students or admins"
on public.subjects
for insert
to authenticated
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Subjects can be updated by owners or admins"
on public.subjects
for update
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
)
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Subjects can be deleted by owners or admins"
on public.subjects
for delete
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Notes are readable by owners or admins"
on public.notes
for select
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Notes can be inserted by owners or admins"
on public.notes
for insert
to authenticated
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.subjects
      where public.subjects.id = public.notes.subject_id
        and public.subjects.student_id = auth.uid()
    )
  )
  or public.is_admin()
);

create policy "Notes can be updated by owners or admins"
on public.notes
for update
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
)
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.subjects
      where public.subjects.id = public.notes.subject_id
        and public.subjects.student_id = auth.uid()
    )
  )
  or public.is_admin()
);

create policy "Notes can be deleted by owners or admins"
on public.notes
for delete
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Quizzes are readable by permitted users"
on public.quizzes
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_assigned_student(student_id)
  or public.is_admin()
);

create policy "Quizzes can be inserted by owners or admins"
on public.quizzes
for insert
to authenticated
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.subjects
      where public.subjects.id = public.quizzes.subject_id
        and public.subjects.student_id = auth.uid()
    )
    and (
      source_note_id is null
      or exists (
        select 1
        from public.notes
        where public.notes.id = public.quizzes.source_note_id
          and public.notes.student_id = auth.uid()
          and public.notes.subject_id = public.quizzes.subject_id
      )
    )
  )
  or public.is_admin()
);

create policy "Quizzes can be updated by owners or admins"
on public.quizzes
for update
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
)
with check (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.subjects
      where public.subjects.id = public.quizzes.subject_id
        and public.subjects.student_id = auth.uid()
    )
    and (
      source_note_id is null
      or exists (
        select 1
        from public.notes
        where public.notes.id = public.quizzes.source_note_id
          and public.notes.student_id = auth.uid()
          and public.notes.subject_id = public.quizzes.subject_id
      )
    )
  )
  or public.is_admin()
);

create policy "Quizzes can be deleted by owners or admins"
on public.quizzes
for delete
to authenticated
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'::public.user_role
  )
  or public.is_admin()
);

create policy "Questions are readable by permitted users"
on public.questions
for select
to authenticated
using (
  exists (
    select 1
    from public.quizzes
    where public.quizzes.id = public.questions.quiz_id
      and (
        public.quizzes.student_id = auth.uid()
        or public.is_assigned_student(public.quizzes.student_id)
        or public.is_admin()
      )
  )
);

create policy "Questions can be inserted by quiz owners or admins"
on public.questions
for insert
to authenticated
with check (
  (
    public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.quizzes
      where public.quizzes.id = public.questions.quiz_id
        and public.quizzes.student_id = auth.uid()
    )
  )
  or public.is_admin()
);

create policy "Questions can be updated by quiz owners or admins"
on public.questions
for update
to authenticated
using (
  (
    public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.quizzes
      where public.quizzes.id = public.questions.quiz_id
        and public.quizzes.student_id = auth.uid()
    )
  )
  or public.is_admin()
)
with check (
  (
    public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.quizzes
      where public.quizzes.id = public.questions.quiz_id
        and public.quizzes.student_id = auth.uid()
    )
  )
  or public.is_admin()
);

create policy "Questions can be deleted by quiz owners or admins"
on public.questions
for delete
to authenticated
using (
  (
    public.current_user_role() = 'student'::public.user_role
    and exists (
      select 1
      from public.quizzes
      where public.quizzes.id = public.questions.quiz_id
        and public.quizzes.student_id = auth.uid()
    )
  )
  or public.is_admin()
);

create policy "Quiz attempts are readable by permitted users"
on public.quiz_attempts
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_assigned_student(student_id)
  or public.is_admin()
);

create policy "Quiz attempts can be inserted by admins"
on public.quiz_attempts
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Quiz attempts can be updated by admins"
on public.quiz_attempts
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Quiz attempts can be deleted by admins"
on public.quiz_attempts
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Quiz attempt answers are readable by permitted users"
on public.quiz_attempt_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts
    where public.quiz_attempts.id = public.quiz_attempt_answers.attempt_id
      and (
        public.quiz_attempts.student_id = auth.uid()
        or public.is_assigned_student(public.quiz_attempts.student_id)
        or public.is_admin()
      )
  )
);

create policy "Quiz attempt answers can be inserted by admins"
on public.quiz_attempt_answers
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Quiz attempt answers can be updated by admins"
on public.quiz_attempt_answers
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Quiz attempt answers can be deleted by admins"
on public.quiz_attempt_answers
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Projects are readable by permitted users"
on public.projects
for select
to authenticated
using (
  tutor_id = auth.uid()
  or exists (
    select 1
    from public.project_assignments
    where public.project_assignments.project_id = public.projects.id
      and public.project_assignments.student_id = auth.uid()
  )
  or public.is_admin()
);

create policy "Projects can be inserted by tutors or admins"
on public.projects
for insert
to authenticated
with check (
  (
    tutor_id = auth.uid()
    and public.current_user_role() = 'tutor'::public.user_role
  )
  or public.is_admin()
);

create policy "Projects can be updated by owners or admins"
on public.projects
for update
to authenticated
using (
  (
    tutor_id = auth.uid()
    and public.current_user_role() = 'tutor'::public.user_role
  )
  or public.is_admin()
)
with check (
  (
    tutor_id = auth.uid()
    and public.current_user_role() = 'tutor'::public.user_role
  )
  or public.is_admin()
);

create policy "Projects can be deleted by owners or admins"
on public.projects
for delete
to authenticated
using (
  (
    tutor_id = auth.uid()
    and public.current_user_role() = 'tutor'::public.user_role
  )
  or public.is_admin()
);

create policy "Project assignments are readable by permitted users"
on public.project_assignments
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.projects
    where public.projects.id = public.project_assignments.project_id
      and public.projects.tutor_id = auth.uid()
  )
  or public.is_admin()
);

create policy "Project assignments can be inserted by permitted tutors or admins"
on public.project_assignments
for insert
to authenticated
with check (
  (
    public.current_user_role() = 'tutor'::public.user_role
    and exists (
      select 1
      from public.projects
      where public.projects.id = public.project_assignments.project_id
        and public.projects.tutor_id = auth.uid()
    )
    and exists (
      select 1
      from public.tutor_student_links
      where public.tutor_student_links.tutor_id = auth.uid()
        and public.tutor_student_links.student_id = public.project_assignments.student_id
    )
  )
  or public.is_admin()
);

create policy "Project assignments can be deleted by permitted tutors or admins"
on public.project_assignments
for delete
to authenticated
using (
  (
    public.current_user_role() = 'tutor'::public.user_role
    and exists (
      select 1
      from public.projects
      where public.projects.id = public.project_assignments.project_id
        and public.projects.tutor_id = auth.uid()
    )
    and exists (
      select 1
      from public.tutor_student_links
      where public.tutor_student_links.tutor_id = auth.uid()
        and public.tutor_student_links.student_id = public.project_assignments.student_id
    )
  )
  or public.is_admin()
);

create policy "Project assignments can be updated by admins"
on public.project_assignments
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Understanding checks are readable by permitted users"
on public.understanding_checks
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_assigned_student(student_id)
  or public.is_admin()
);

create policy "Understanding checks can be inserted by admins"
on public.understanding_checks
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Understanding checks can be updated by admins"
on public.understanding_checks
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Understanding checks can be deleted by admins"
on public.understanding_checks
for delete
to authenticated
using (
  public.is_admin()
);

