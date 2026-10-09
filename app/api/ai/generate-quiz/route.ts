import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateQuizFromNote } from "@/lib/ai/generate-quiz";

type GenerateQuizRequest = {
  noteId?: unknown;
  numberOfQuestions?: unknown;
  questionType?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();

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

  let body: GenerateQuizRequest;

  try {
    body = (await request.json()) as GenerateQuizRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    noteId,
    numberOfQuestions,
    questionType,
  } = body;

  if (typeof noteId !== "string" || !noteId) {
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

  if (note.student_id !== user.id) {
    return NextResponse.json(
      { error: "You do not own this note." },
      { status: 403 }
    );
  }

   try {
    const generatedQuiz = await generateQuizFromNote({
      noteTitle: note.title,
      noteContent: note.content,
      numberOfQuestions,
      questionType: "multiple_choice",
    });

    const { data: quiz, error: quizError } = await supabase
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
      console.error("Quiz creation failed:", quizError?.message);

      return NextResponse.json(
        { error: "Unable to save the generated quiz." },
        { status: 500 }
      );
    }

    const questions = generatedQuiz.questions.map((question) => ({
      quiz_id: quiz.id,
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      topic: question.topic,
      ai_generated: true,
      reviewed_by_tutor: false,
    }));

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questions);

    if (questionsError) {
      console.error("Questions creation failed:", questionsError.message);

      // Remove the incomplete quiz if saving questions fails.
      const { error: cleanupError } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quiz.id);

      if (cleanupError) {
        console.error("Quiz cleanup failed:", cleanupError.message);
      }

      return NextResponse.json(
        { error: "Unable to save the generated questions." },
        { status: 500 }
      );
    }

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
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "AI quiz generation failed." },
      { status: 500 }
    );
  }
}