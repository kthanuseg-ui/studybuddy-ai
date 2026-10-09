-- Protect quiz answers from direct client access.
-- RLS controls rows, while SQL grants control columns.

-- Remove unrestricted SELECT access.
revoke select
on table public.questions
from public, anon, authenticated;

-- Allow authenticated users to read only safe question columns.
grant select (
  id,
  quiz_id,
  question_text,
  question_type,
  options,
  topic,
  ai_generated,
  reviewed_by_tutor,
  created_at,
  updated_at
)
on table public.questions
to authenticated;

-- Prevent direct UPDATE operations on questions.
-- Authorized corrections will go through server APIs.
revoke update
on table public.questions
from public, anon, authenticated;