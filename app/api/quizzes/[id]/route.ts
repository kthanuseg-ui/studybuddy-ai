import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const supabase = await createClient();

    // 1. Verify that the user is authenticated.
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

    const { id: quizId } = await params;

    // 2. Verify that the quiz belongs to this student.
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, source_note_id, created_at")
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

    // 3. Retrieve questions without their correct answers.
    const { data: questions, error: questionsError } =
      await supabase
        .from("questions")
        .select(
          "id, question_text, question_type, options, topic"
        )
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

    if (questionsError) {
      return NextResponse.json(
        { error: "Unable to load quiz questions." },
        { status: 500 }
      );
    }

    // 4. Return the quiz and its questions.
    return NextResponse.json(
      {
        quiz,
        questions: questions ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Quiz retrieval failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}