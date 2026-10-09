
-- StudyBuddy AI
-- Save quiz attempts and answers atomically.
-- The database validates answers and calculates scores.

CREATE OR REPLACE FUNCTION public.save_quiz_attempt_atomically(
  p_student_id uuid,
  p_quiz_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  attempt_id uuid,
  score numeric,
  total_questions integer,
  correct_answers integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quiz_owner uuid;
  v_total integer;
  v_answer_count integer;
  v_correct integer := 0;
  v_score numeric;
  v_attempt_id uuid;

  v_item jsonb;
  v_question_id_text text;
  v_question_id uuid;
  v_student_answer text;
  v_question record;
  v_is_correct boolean;

  v_seen_ids uuid[] := ARRAY[]::uuid[];
  v_answer_records jsonb := '[]'::jsonb;

  v_uuid_pattern text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- 1. Validate required parameters.
  IF p_student_id IS NULL OR p_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Invalid student or quiz ID';
  END IF;

  -- 2. Require a valid array of submitted answers.
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Answers must be an array';
  END IF;

  v_answer_count := jsonb_array_length(p_answers);

  IF v_answer_count < 1 OR v_answer_count > 10 THEN
    RAISE EXCEPTION 'Invalid number of answers';
  END IF;

  -- 3. Verify that the student exists
  -- and has the Student role.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = p_student_id
      AND p.role = 'student'
  ) THEN
    RAISE EXCEPTION 'Invalid student';
  END IF;

  -- 4. Verify quiz ownership.
  SELECT q.student_id
  INTO v_quiz_owner
  FROM public.quizzes AS q
  WHERE q.id = p_quiz_id
  FOR SHARE;

  IF NOT FOUND OR v_quiz_owner <> p_student_id THEN
    RAISE EXCEPTION 'Quiz not found or access denied';
  END IF;

  -- 5. Count the quiz questions.
  SELECT COUNT(*)::integer
  INTO v_total
  FROM public.questions AS q
  WHERE q.quiz_id = p_quiz_id;

  IF v_total <> v_answer_count THEN
    RAISE EXCEPTION 'Every question must be answered';
  END IF;

  -- 6. Validate and grade each submitted answer.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_answers) AS answers(value)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'questionId')
          IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'answer')
          IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION 'Invalid answer format';
    END IF;

    v_question_id_text := v_item->>'questionId';
    v_student_answer := btrim(v_item->>'answer');

    IF v_question_id_text !~* v_uuid_pattern THEN
      RAISE EXCEPTION 'Invalid question ID';
    END IF;

    IF length(v_student_answer) < 1
       OR length(v_student_answer) > 2000
    THEN
      RAISE EXCEPTION 'Invalid answer value';
    END IF;

    v_question_id := v_question_id_text::uuid;

    -- 7. Reject duplicate question IDs.
    IF v_question_id = ANY(v_seen_ids) THEN
      RAISE EXCEPTION 'Duplicate question answer';
    END IF;

    v_seen_ids := array_append(
      v_seen_ids,
      v_question_id
    );

    -- 8. Retrieve the question and correct answer
    -- directly from the database.
    SELECT
      q.question_type,
      q.options,
      q.correct_answer
    INTO v_question
    FROM public.questions AS q
    WHERE q.id = v_question_id
      AND q.quiz_id = p_quiz_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Question does not belong to quiz';
    END IF;

    -- 9. Validate multiple-choice answers.
    IF v_question.question_type IS DISTINCT FROM
         'multiple_choice'
       OR jsonb_typeof(v_question.options)
          IS DISTINCT FROM 'array'
       OR NOT (
         v_question.options ? v_student_answer
       )
    THEN
      RAISE EXCEPTION 'Invalid multiple-choice answer';
    END IF;

    -- 10. Calculate correctness inside PostgreSQL.
    v_is_correct := (
      v_student_answer = v_question.correct_answer
    );

    IF v_is_correct THEN
      v_correct := v_correct + 1;
    END IF;

    -- 11. Prepare the individual answer record.
    v_answer_records :=
      v_answer_records || jsonb_build_array(
        jsonb_build_object(
          'question_id', v_question_id,
          'student_answer', v_student_answer,
          'is_correct', v_is_correct
        )
      );
  END LOOP;

  -- 12. Calculate the final score.
  v_score := ROUND(
    (v_correct::numeric / v_total) * 100,
    2
  );

  -- 13. Insert the quiz attempt.
  INSERT INTO public.quiz_attempts (
    quiz_id,
    student_id,
    score,
    total_questions,
    correct_answers
  )
  VALUES (
    p_quiz_id,
    p_student_id,
    v_score,
    v_total,
    v_correct
  )
  RETURNING id INTO v_attempt_id;

  -- 14. Insert all individual answers.
  INSERT INTO public.quiz_attempt_answers (
    attempt_id,
    question_id,
    student_answer,
    is_correct
  )
  SELECT
    v_attempt_id,
    a.question_id,
    a.student_answer,
    a.is_correct
  FROM jsonb_to_recordset(v_answer_records) AS a(
    question_id uuid,
    student_answer text,
    is_correct boolean
  );

  -- 15. Return the calculated result.
  RETURN QUERY
  SELECT
    v_attempt_id,
    v_score,
    v_total,
    v_correct;
END;
$$;

-- 16. Remove access for regular users.
REVOKE ALL ON FUNCTION
  public.save_quiz_attempt_atomically(
    uuid, uuid, jsonb
  )
FROM PUBLIC, anon, authenticated;

-- 17. Only our privileged backend may invoke
-- the function after authenticating the student.
GRANT EXECUTE ON FUNCTION
  public.save_quiz_attempt_atomically(
    uuid, uuid, jsonb
  )
TO service_role;
