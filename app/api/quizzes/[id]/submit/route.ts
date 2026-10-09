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
  // 1. Authenticate the student.
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

  // 2. Verify the Student role.
  const { data: profile, error: profileError } = await supabase
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

  // 3. Get and validate the quiz ID.
  const { id: quizId } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(quizId)) {
    return NextResponse.json(
      { error: "Invalid quiz ID." },
      { status: 400 }
    );
  }

  // 4. Verify that the quiz belongs to this student.
  const { data: quiz, error: quizError } = await supabase
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

  // 5. Read the student's answers.
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

  // 6. Prepare the privileged server-only client.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

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
    // 7. Retrieve the correct answers securely.
    const { data: questions, error: questionsError } =
      await adminSupabase
        .from("questions")
        .select(
          "id, question_type, options, correct_answer"
        )
        .eq("quiz_id", quizId);

    if (questionsError || !questions) {
      return NextResponse.json(
        { error: "Unable to load quiz questions." },
        { status: 500 }
      );
    }

    // 8. Every question must have exactly one submitted answer.
    if (
      questions.length === 0 ||
      submittedAnswers.size !== questions.length
    ) {
      return NextResponse.json(
        { error: "You must answer every question." },
        { status: 400 }
      );
    }

    const validatedAnswers: StudentAnswer[] = [];

    let correctAnswers = 0;

    const answerRecords: {
      question_id: string;
      student_answer: string;
      is_correct: boolean;
    }[] = [];

    // 9. Validate and grade every answer on the server.
    for (const question of questions) {
      const studentAnswer = submittedAnswers.get(question.id);

      if (
        !studentAnswer ||
        question.question_type !== "multiple_choice" ||
        !Array.isArray(question.options) ||
        !question.options.every(
          (option: unknown) => typeof option === "string"
        ) ||
        !question.options.includes(studentAnswer) ||
        typeof question.correct_answer !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid quiz answer or question." },
          { status: 400 }
        );
      }

      const isCorrect =
        studentAnswer === question.correct_answer;

      if (isCorrect) {
        correctAnswers += 1;
      }

      validatedAnswers.push({
        questionId: question.id,
        answer: studentAnswer,
      });

      answerRecords.push({
        question_id: question.id,
        student_answer: studentAnswer,
        is_correct: isCorrect,
      });
    }

    // 10. Calculate the score as a percentage.
    const totalQuestions = questions.length;

    const score = Number(
      ((correctAnswers / totalQuestions) * 100).toFixed(2)
    );

    // 11. Save the attempt.
    const { data: attempt, error: attemptError } =
      await adminSupabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quizId,
          student_id: user.id,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
        })
        .select("id")
        .single();

    if (attemptError || !attempt) {
      console.error(
        "Quiz attempt creation failed:",
        attemptError?.message
      );

      return NextResponse.json(
        { error: "Unable to save quiz attempt." },
        { status: 500 }
      );
    }

    // 12. Save the individual answers.
    const { error: answersError } = await adminSupabase
      .from("quiz_attempt_answers")
      .insert(
        answerRecords.map((answer) => ({
          attempt_id: attempt.id,
          ...answer,
        }))
      );

    if (answersError) {
      console.error(
        "Quiz answers creation failed:",
        answersError.message
      );

      // Attempt to remove the incomplete attempt.
      const { error: cleanupError } = await adminSupabase
        .from("quiz_attempts")
        .delete()
        .eq("id", attempt.id);

      if (cleanupError) {
        console.error(
          "Quiz attempt cleanup failed:",
          cleanupError.message
        );
      }

      return NextResponse.json(
        { error: "Unable to save quiz answers." },
        { status: 500 }
      );
    }

    // 13. Return the calculated result.
    return NextResponse.json(
      {
        attemptId: attempt.id,
        quizId,
        score,
        totalQuestions,
        correctAnswers,
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
