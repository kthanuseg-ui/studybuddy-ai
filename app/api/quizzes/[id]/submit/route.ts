
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StudentAnswer = {
  questionId: string;
  answer: string;
};

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  // 1. Authenticate the current user.
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  // 2. Only Students may submit quizzes.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "student") {
    return NextResponse.json(
      { error: "Only Students can submit quizzes." },
      { status: 403 }
    );
  }

  // 3. Validate the quiz ID.
  const { id: quizId } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(quizId)) {
    return NextResponse.json(
      { error: "Invalid quiz ID." },
      { status: 400 }
    );
  }

  // 4. Verify ownership using the student's session.
  const { data: quiz, error: quizError } =
    await supabase
      .from("quizzes")
      .select("id, student_id")
      .eq("id", quizId)
      .eq("student_id", user.id)
      .maybeSingle();

  if (quizError) {
    return NextResponse.json(
      { error: "Unable to load quiz." },
      { status: 500 }
    );
  }

  if (!quiz) {
    return NextResponse.json(
      { error: "Quiz not found." },
      { status: 404 }
    );
  }

  // 5. Parse the submitted answers.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("answers" in body) ||
    !Array.isArray(body.answers) ||
    body.answers.length === 0 ||
    body.answers.length > 10
  ) {
    return NextResponse.json(
      { error: "Invalid answers." },
      { status: 400 }
    );
  }

  // 6. Validate answer formats and reject duplicates.
  const submittedAnswers = new Map<string, string>();

  for (const item of body.answers) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.questionId !== "string" ||
      typeof item.answer !== "string" ||
      !uuidPattern.test(item.questionId) ||
      item.answer.trim().length === 0 ||
      item.answer.length > 2000 ||
      submittedAnswers.has(item.questionId)
    ) {
      return NextResponse.json(
        { error: "Invalid or duplicate answer." },
        { status: 400 }
      );
    }

    submittedAnswers.set(
      item.questionId,
      item.answer.trim()
    );
  }

  const validatedAnswers: StudentAnswer[] =
    Array.from(
      submittedAnswers,
      ([questionId, answer]) => ({
        questionId,
        answer,
      })
    );

  // 7. Prepare the privileged server-only client.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return NextResponse.json(
      { error: "Server configuration is missing." },
      { status: 503 }
    );
  }

  const adminSupabase = createAdminClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  try {
    // 8. Call the PostgreSQL function.
    //
    // PostgreSQL will:
    // - Verify quiz ownership again
    // - Validate every answer
    // - Retrieve the correct answers
    // - Calculate the score
    // - Insert the attempt and all answers
    //   atomically
    //
    // The browser cannot provide its own score.

    const { data: results, error: saveError } =
      await adminSupabase.rpc(
        "save_quiz_attempt_atomically",
        {
          p_student_id: user.id,
          p_quiz_id: quizId,
          p_answers: validatedAnswers,
        }
      );

    if (saveError) {
      console.error(
        "Atomic quiz submission failed:",
        saveError.message
      );

      const invalidSubmission =
        saveError.code === "P0001";

      return NextResponse.json(
        {
          error: invalidSubmission
            ? "Invalid quiz submission. Please verify your answers."
            : "Unable to save quiz results.",
        },
        {
          status: invalidSubmission ? 400 : 500,
        }
      );
    }

    // 9. Read the result returned by PostgreSQL.
    const result = results?.[0];

    if (!result) {
      return NextResponse.json(
        { error: "No quiz result was returned." },
        { status: 500 }
      );
    }

    // 10. Return the score calculated by PostgreSQL.
    return NextResponse.json(
      {
        attemptId: result.attempt_id,
        quizId,
        score: Number(result.score),
        totalQuestions: result.total_questions,
        correctAnswers: result.correct_answers,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(
      "Quiz submission failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return NextResponse.json(
      { error: "Quiz submission failed." },
      { status: 500 }
    );
  }
}
