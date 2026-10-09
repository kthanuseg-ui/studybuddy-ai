
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type QuizAttempt = {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
};

type MessagePageProps = {
  title: string;
  message: string;
};

function MessagePage({ title, message }: MessagePageProps) {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">
          {title}
        </h1>

        <p role="alert" className="mt-3 text-zinc-600">
          {message}
        </p>

        <Link
          href="/tutor/students"
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to My Students
        </Link>
      </div>
    </main>
  );
}

function formatDate(date: string) {
  return (
    new Date(date).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function getScoreColor(score: number) {
  if (score >= 80) {
    return "bg-green-50 text-green-700";
  }

  if (score >= 50) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-700";
}

export default async function TutorStudentResultsPage({
  params,
}: PageProps) {
  // 1. Retrieve and validate the student ID.
  const { id: studentId } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(studentId)) {
    notFound();
  }

  // 2. Authenticate the connected Tutor.
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <MessagePage
        title="Authentication required"
        message="Please sign in with your Tutor account."
      />
    );
  }

  // 3. Verify the Tutor role.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "tutor") {
    return (
      <MessagePage
        title="Access denied"
        message="Only Tutors can access student results."
      />
    );
  }

  // 4. Verify that this student is assigned to the Tutor.
  const { data: assignment, error: assignmentError } =
    await supabase
      .from("tutor_student_links")
      .select("id")
      .eq("tutor_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle();

  if (assignmentError) {
    console.error(
      "Unable to verify Tutor assignment:",
      assignmentError.message
    );

    return (
      <MessagePage
        title="Unable to verify assignment"
        message="Please try again later."
      />
    );
  }

  // An unassigned student must not be accessible.
  if (!assignment) {
    notFound();
  }

  // 5. Retrieve the assigned student's profile.
  const { data: student, error: studentError } =
    await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", studentId)
      .eq("role", "student")
      .maybeSingle();

  if (studentError) {
    console.error(
      "Unable to load student profile:",
      studentError.message
    );

    return (
      <MessagePage
        title="Unable to load student"
        message="Please try again later."
      />
    );
  }

  if (!student) {
    notFound();
  }

  // 6. Load up to 100 recent quiz attempts.
  const { data: attemptsData, error: attemptsError } =
    await supabase
      .from("quiz_attempts")
      .select(
        "id, quiz_id, score, total_questions, correct_answers, completed_at"
      )
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(100);

  if (attemptsError) {
    console.error(
      "Unable to load student quiz attempts:",
      attemptsError.message
    );

    return (
      <MessagePage
        title="Unable to load results"
        message="Student quiz results could not be retrieved."
      />
    );
  }

  const attempts: QuizAttempt[] = (attemptsData ?? []).map(
    (attempt) => ({
      id: attempt.id,
      quiz_id: attempt.quiz_id,
      score: Number(attempt.score),
      total_questions: attempt.total_questions,
      correct_answers: attempt.correct_answers,
      completed_at: attempt.completed_at,
    })
  );

  // 7. Retrieve the quiz titles.
  const quizIds = [
    ...new Set(
      attempts.map((attempt) => attempt.quiz_id)
    ),
  ];

  const quizTitles: Record<string, string> = {};

  if (quizIds.length > 0) {
    const { data: quizzes, error: quizzesError } =
      await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);

    if (quizzesError) {
      console.error(
        "Unable to load quiz titles:",
        quizzesError.message
      );

      return (
        <MessagePage
          title="Unable to load results"
          message="Quiz information could not be retrieved."
        />
      );
    }

    for (const quiz of quizzes ?? []) {
      quizTitles[quiz.id] = quiz.title;
    }
  }

  // 8. Calculate statistics using saved results.
  const totalAttempts = attempts.length;

  const averageScore =
    totalAttempts > 0
      ? attempts.reduce(
          (sum, attempt) => sum + attempt.score,
          0
        ) / totalAttempts
      : 0;

  const bestScore =
    totalAttempts > 0
      ? Math.max(...attempts.map((attempt) => attempt.score))
      : 0;

  const latestScore =
    totalAttempts > 0 ? attempts[0].score : 0;

  // 9. Display the results.
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/tutor/students"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to My Students
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-zinc-900">
              {student.full_name?.trim() || "Student"} - Results
            </h1>

            <p className="mt-2 text-zinc-600">
            Review your student&apos;s quiz performance
  and learning progress.
            </p>
          </div>

          <Link
            href="/tutor/dashboard"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Tutor Dashboard
          </Link>
        </div>

        {/* Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Quiz Attempts
            </p>

            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {totalAttempts}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Average Score
            </p>

            <p className="mt-3 text-3xl font-bold text-blue-600">
              {averageScore.toFixed(2)}%
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Best Score
            </p>

            <p className="mt-3 text-3xl font-bold text-green-700">
              {bestScore.toFixed(2)}%
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Latest Score
            </p>

            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {latestScore.toFixed(2)}%
            </p>
          </div>
        </section>

        {/* Student quiz history */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Quiz History
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Up to 100 recent quiz attempts for this student.
          </p>

          {attempts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
              <h3 className="font-semibold text-zinc-900">
                No quiz results yet
              </h3>

              <p className="mt-2 text-sm text-zinc-600">
                This student has not completed any quizzes.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {attempts.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">
                        {quizTitles[attempt.quiz_id] ??
                          "Unavailable quiz"}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-500">
                        Completed:{" "}
                        {formatDate(attempt.completed_at)}
                      </p>

                      <p className="mt-2 text-sm text-zinc-600">
                        {attempt.correct_answers} correct
                        answers out of{" "}
                        {attempt.total_questions}
                      </p>
                    </div>

                    <div
                      className={`rounded-lg px-4 py-2 text-lg font-bold ${getScoreColor(
                        attempt.score
                      )}`}
                    >
                      {attempt.score.toFixed(2)}%
                    </div>
                  </div>

                  {/* Score progress bar */}
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, attempt.score)
                        )}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Statistics are calculated from up to
          100 recent saved quiz attempts.
        </p>
      </div>
    </main>
  );
}
