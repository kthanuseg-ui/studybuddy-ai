-- =====================================================
-- StudyBuddy AI - Secure Quiz Writes
-- =====================================================

-- Quiz and question modifications must go through
-- authorized server-side API routes.

-- 1. Remove policies allowing direct quiz modifications.

drop policy if exists
  "Quizzes can be inserted by owners or admins"
on public.quizzes;

drop policy if exists
  "Quizzes can be updated by owners or admins"
on public.quizzes;

drop policy if exists
  "Quizzes can be deleted by owners or admins"
on public.quizzes;


-- 2. Remove policies allowing direct question modifications.

drop policy if exists
  "Questions can be inserted by quiz owners or admins"
on public.questions;

drop policy if exists
  "Questions can be updated by quiz owners or admins"
on public.questions;

drop policy if exists
  "Questions can be deleted by quiz owners or admins"
on public.questions;


-- 3. Revoke direct write privileges on quizzes.

revoke insert, update, delete
on table public.quizzes
from public, anon, authenticated;


-- 4. Revoke direct write privileges on questions.

revoke insert, update, delete
on table public.questions
from public, anon, authenticated;


-- 5. Read permissions remain unchanged.
-- Students can still read authorized quizzes and
-- the permitted question columns.
--
-- The server-only Supabase secret key is used for
-- authorized database writes after checking the user.