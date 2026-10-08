alter table public.quiz_attempts
drop constraint quiz_attempts_student_id_fkey,
add constraint quiz_attempts_student_id_fkey
foreign key (student_id)
references public.profiles(id)
on delete restrict;

alter table public.understanding_checks
drop constraint understanding_checks_project_id_fkey,
add constraint understanding_checks_project_id_fkey
foreign key (project_id)
references public.projects(id)
on delete restrict;

alter table public.understanding_checks
drop constraint understanding_checks_student_id_fkey,
add constraint understanding_checks_student_id_fkey
foreign key (student_id)
references public.profiles(id)
on delete restrict;

