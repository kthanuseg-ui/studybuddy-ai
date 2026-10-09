import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateQuizFromNote } from "@/lib/ai/generate-quiz";

export const runtime = "nodejs";

type GenerateQuizRequest = {
  noteId?: unknown;
  numberOfQuestions?: unknown;
  questionType?: unknown;
};

export async function POST(request: Request) {
  // 1. Create the Supabase client using the user's session.
  const supabase = await createClient();

  // 2. Verify authentication.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  // 3. Verify that the user has the Student role.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Unable to load user profile." },
      { status: 403 }
    );
  }

  if (profile.role !== "student") {
    return NextResponse.json(
      { error: "Only Students can generate quizzes." },
      { status: 403 }
    );
  }

  // 4. Parse and validate the request.
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
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    noteId,
    numberOfQuestions,
    questionType,
  } = body as GenerateQuizRequest;

  if (
    typeof noteId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId)
  ) {
    return NextResponse.json(
      { error: "A valid noteId is required." },
      { status: 400 }
    );
  }

  if (
    typeof numberOfQuestions !== "number" ||
    !Number.isInteger(numberOfQuestions) ||
    ![3, 5, 10].includes(numberOfQuestions)
  ) {
    return NextResponse.json(
      { error: "numberOfQuestions must be 3, 5, or 10." },
      { status: 400 }
    );
  }

  if (questionType !== "multiple_choice") {
    return NextResponse.json(
      { error: "Unsupported question type." },
      { status: 400 }
    );
  }

  // 5. Retrieve the note using the student's permissions.
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id, student_id, subject_id, title, content")
    .eq("id", noteId)
    .maybeSingle();

  if (noteError) {
    return NextResponse.json(
      { error: "Unable to load the source note." },
      { status: 500 }
    );
  }

  if (!note) {
    return NextResponse.json(
      { error: "Note not found." },
      { status: 404 }
    );
  }

  // 6. Verify note ownership before using elevated privileges.
  if (note.student_id !== user.id) {
    return NextResponse.json(
      { error: "You do not own this note." },
      { status: 403 }
    );
  }

  // 7. Verify the server-only Supabase configuration.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { error: "Server database configuration is missing." },
      { status: 503 }
    );
  }

  // 8. Create a privileged client used ONLY on the server.
  const adminSupabase = createAdminClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  try {
    // 9. Generate and validate the quiz using OpenAI.
    const generatedQuiz = await generateQuizFromNote({
      noteTitle: note.title,
      noteContent: note.content,
      numberOfQuestions,
      questionType: "multiple_choice",
    });

    // 10. Save the quiz using the server-only client.
    const { data: quiz, error: quizError } = await adminSupabase
      .from("quizzes")
      .insert({
        student_id: user.id,
        subject_id: note.subject_id,
        source_note_id: note.id,
        title: generatedQuiz.title,
        created_by_ai: true,
      })
      .select("id")
      .single();

    if (quizError || !quiz) {
      console.error(
        "Quiz creation failed:",
        quizError?.message
      );

      return NextResponse.json(
        { error: "Unable to save the generated quiz." },
        { status: 500 }
      );
    }

    // 11. Prepare the generated questions.
    const questions = generatedQuiz.questions.map(
      (question) => ({
        quiz_id: quiz.id,
        question_text: question.question_text,
        question_type: question.question_type,
        options: question.options,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        topic: question.topic,
        ai_generated: true,
        reviewed_by_tutor: false,
      })
    );

    // 12. Save questions using the server-only client.
    const { error: questionsError } = await adminSupabase
      .from("questions")
      .insert(questions);

    if (questionsError) {
      console.error(
        "Questions creation failed:",
        questionsError.message
      );

      // Attempt to remove the incomplete quiz.
      const { error: cleanupError } = await adminSupabase
        .from("quizzes")
        .delete()
        .eq("id", quiz.id);

      if (cleanupError) {
        console.error(
          "Quiz cleanup failed:",
          cleanupError.message
        );
      }

      return NextResponse.json(
        { error: "Unable to save the generated questions." },
        { status: 500 }
      );
    }

    // 13. Return the successful result.
    return NextResponse.json(
      {
        quizId: quiz.id,
        questionCount: generatedQuiz.questions.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Quiz generation failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return NextResponse.json(
      { error: "AI quiz generation failed." },
      { status: 500 }
    );
  }
}