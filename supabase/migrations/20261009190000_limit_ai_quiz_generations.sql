
-- StudyBuddy AI
-- Limit AI quiz generation to 5 requests
-- per student per UTC day.

-- 1. Store daily AI quiz generation usage.
CREATE TABLE public.ai_quiz_generation_daily_usage (
  student_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  usage_date date NOT NULL,

  request_count integer NOT NULL DEFAULT 1
    CHECK (request_count BETWEEN 1 AND 5),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (student_id, usage_date)
);

-- 2. Enable Row Level Security.
ALTER TABLE public.ai_quiz_generation_daily_usage
  ENABLE ROW LEVEL SECURITY;

-- 3. Prevent direct access by students
-- and other regular users.
REVOKE ALL
  ON TABLE public.ai_quiz_generation_daily_usage
  FROM PUBLIC, anon, authenticated;

-- 4. Allow only the privileged backend
-- to manage usage counters.
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.ai_quiz_generation_daily_usage
  TO service_role;

-- 5. Reserve one AI quiz generation request
-- atomically to prevent concurrent bypasses.
CREATE OR REPLACE FUNCTION public.consume_ai_quiz_generation_quota(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  INSERT INTO public.ai_quiz_generation_daily_usage (
    student_id,
    usage_date,
    request_count
  )
  VALUES (
    p_student_id,
    (now() AT TIME ZONE 'UTC')::date,
    1
  )
  ON CONFLICT (student_id, usage_date)
  DO UPDATE SET
    request_count =
      public.ai_quiz_generation_daily_usage.request_count + 1,
    updated_at = now()
  WHERE
    public.ai_quiz_generation_daily_usage.request_count < 5
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- 6. Remove public function permissions.
REVOKE ALL
  ON FUNCTION public.consume_ai_quiz_generation_quota(uuid)
  FROM PUBLIC, anon, authenticated;

-- 7. Only our privileged backend
-- may call this function.
GRANT EXECUTE
  ON FUNCTION public.consume_ai_quiz_generation_quota(uuid)
  TO service_role;
