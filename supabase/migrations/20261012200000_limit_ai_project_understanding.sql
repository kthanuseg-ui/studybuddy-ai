
-- StudyBuddy AI
-- Limit Project Understanding Check AI analyses
-- to 3 requests per student per UTC day.

BEGIN;

-- 1. Store daily AI analysis usage.
CREATE TABLE public.ai_project_understanding_daily_usage (
  student_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  usage_date date NOT NULL,

  request_count integer NOT NULL DEFAULT 1
    CHECK (request_count BETWEEN 1 AND 3),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (student_id, usage_date)
);

-- 2. Enable Row Level Security.
ALTER TABLE public.ai_project_understanding_daily_usage
  ENABLE ROW LEVEL SECURITY;

-- 3. Block direct access by regular users.
REVOKE ALL
  ON TABLE public.ai_project_understanding_daily_usage
  FROM PUBLIC, anon, authenticated;

-- 4. Allow the privileged backend to manage counters.
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.ai_project_understanding_daily_usage
  TO service_role;

-- 5. Atomically reserve one AI analysis request.
CREATE OR REPLACE FUNCTION public.consume_ai_project_understanding_quota(
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
  INSERT INTO public.ai_project_understanding_daily_usage (
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
      public.ai_project_understanding_daily_usage.request_count + 1,
    updated_at = now()
  WHERE
    public.ai_project_understanding_daily_usage.request_count < 3
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- 6. Prevent public execution of the quota function.
REVOKE ALL
  ON FUNCTION public.consume_ai_project_understanding_quota(uuid)
  FROM PUBLIC, anon, authenticated;

-- 7. Only the privileged backend may call it.
GRANT EXECUTE
  ON FUNCTION public.consume_ai_project_understanding_quota(uuid)
  TO service_role;

COMMIT;
