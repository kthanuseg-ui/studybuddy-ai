
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Assessment =
  | "not_enough_data"
  | "needs_practice"
  | "improving"
  | "strong";

type TopicStatistics = {
  topic: string;
  totalAnswers: number;
  correctAnswers: number;
  mistakes: number;
  successRate: number;
  assessment: Assessment;
};

function MessagePage({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">
          Analysis unavailable
        </h1>

        <p role="alert" className="mt-4 text-zinc-600">
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

function getAssessmentLabel(assessment: Assessment) {
  switch (assessment) {
    case "not_enough_data":
      return "Not enough data";
    case "needs_practice":
      return "Needs practice";
    case "improving":
      return "Improving";
    case "strong":
      return "Strong";
  }
}

function getAssessmentColor(assessment: Assessment) {
  switch (assessment) {
    case "not_enough_data":
      return "bg-zinc-100 text-zinc-700";
    case "needs_practice":
      return "bg-red-100 text-red-700";
    case "improving":
      return "bg-amber-100 text-amber-700";
    case "strong":
      return "bg-green-100 text-green-700";
  }
}

function getProgressColor(assessment: Assessment) {
  switch (assessment) {
    case "needs_practice":
      return "bg-red-500";
    case "improving":
      return "bg-amber-500";
    case "strong":
      return "bg-green-600";
    default:
      return "bg-blue-600";
  }
}

export default async function TutorStudentWeaknessesPage({
  params,
}: PageProps) {
  // 1. Validate the requested student ID.
  const { id: studentId } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(studentId)) {
    notFound();
  }

  // 2. Authenticate the current user.
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <MessagePage message="Please sign in with your Tutor account." />
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
      <MessagePage message="Only Tutors can access this analysis." />
    );
  }

  // 4. Verify that the student is assigned to this Tutor.
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
      <MessagePage message="Unable to verify student assignment." />
    );
  }

  if (!assignment) {
    notFound();
  }

  // 5. Load the assigned student's profile.
  const { data: student, error: studentError } =
    await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", studentId)
      .eq("role", "student")
      .maybeSingle();

  if (studentError) {
    return (
      <MessagePage message="Unable to load student information." />
    );
  }

  if (!student) {
    notFound();
  }

  // 6. Retrieve up to 50 recent quiz attempts.
  const { data: attempts, error: attemptsError } =
    await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(50);

  if (attemptsError) {
    console.error(
      "Unable to load student attempts:",
      attemptsError.message
    );

    return (
      <MessagePage message="Unable to load student quiz attempts." />
    );
  }

  const attemptIds = (attempts ?? []).map(
    (attempt) => attempt.id
  );

  // 7. Retrieve the student's answers.
  let savedAnswers: {
    question_id: string;
    is_correct: boolean;
  }[] = [];

  if (attemptIds.length > 0) {
    const { data: answers, error: answersError } =
      await supabase
        .from("quiz_attempt_answers")
        .select("question_id, is_correct")
        .in("attempt_id", attemptIds);

    if (answersError) {
      console.error(
        "Unable to load student answers:",
        answersError.message
      );

      return (
        <MessagePage message="Unable to load student quiz answers." />
      );
    }

    savedAnswers = answers ?? [];
  }

  // 8. Collect unique question IDs.
  const questionIds = [
    ...new Set(
      savedAnswers.map((answer) => answer.question_id)
    ),
  ];

  const topicByQuestionId = new Map<string, string>();

  // 9. Retrieve question topics.
  // Never request confidential correct answers.
  if (questionIds.length > 0) {
    const { data: questions, error: questionsError } =
      await supabase
        .from("questions")
        .select("id, topic")
        .in("id", questionIds);

    if (questionsError) {
      console.error(
        "Unable to load question topics:",
        questionsError.message
      );

      return (
        <MessagePage message="Unable to load question topics." />
      );
    }

    for (const question of questions ?? []) {
      const topic =
        typeof question.topic === "string" &&
        question.topic.trim().length > 0
          ? question.topic.trim()
          : "Uncategorized";

      topicByQuestionId.set(question.id, topic);
    }

    if (topicByQuestionId.size !== questionIds.length) {
      return (
        <MessagePage message="Some question information is unavailable." />
      );
    }
  }

  // 10. Group correct and incorrect answers by topic.
  const statisticsByTopic = new Map<
    string,
    {
      totalAnswers: number;
      correctAnswers: number;
      mistakes: number;
    }
  >();

  for (const answer of savedAnswers) {
    const topic = topicByQuestionId.get(
      answer.question_id
    );

    if (!topic) {
      continue;
    }

    const statistics = statisticsByTopic.get(topic) ?? {
      totalAnswers: 0,
      correctAnswers: 0,
      mistakes: 0,
    };

    statistics.totalAnswers += 1;

    if (answer.is_correct) {
      statistics.correctAnswers += 1;
    } else {
      statistics.mistakes += 1;
    }

    statisticsByTopic.set(topic, statistics);
  }

  // 11. Calculate success rates and classifications.
  const topics: TopicStatistics[] = Array.from(
    statisticsByTopic.entries()
  ).map(([topic, statistics]) => {
    const successRate = Number(
      (
        (statistics.correctAnswers /
          statistics.totalAnswers) *
        100
      ).toFixed(2)
    );

    let assessment: Assessment;

    if (statistics.totalAnswers < 5) {
      assessment = "not_enough_data";
    } else if (successRate < 60) {
      assessment = "needs_practice";
    } else if (successRate < 80) {
      assessment = "improving";
    } else {
      assessment = "strong";
    }

    return {
      topic,
      ...statistics,
      successRate,
      assessment,
    };
  });

  // 12. Show the lowest success rates first.
  topics.sort(
    (a, b) =>
      a.successRate - b.successRate ||
      b.totalAnswers - a.totalAnswers
  );

  // 13. Calculate summary statistics.
  const needsPractice = topics.filter(
    (topic) => topic.assessment === "needs_practice"
  ).length;

  const strong = topics.filter(
    (topic) => topic.assessment === "strong"
  ).length;

  const insufficientData = topics.filter(
    (topic) => topic.assessment === "not_enough_data"
  ).length;

  const studentName =
    student.full_name?.trim() || "Student";

  // 14. Display the analysis.
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
              {studentName} - Weakness Analysis
            </h1>

            <p className="mt-2 text-zinc-600">
              Identify topics requiring additional
              practice and review student performance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/tutor/students/${studentId}/results`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Results
            </Link>

            <Link
              href="/tutor/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Tutor Dashboard
            </Link>
          </div>
        </div>

        {/* Summary statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Quiz Attempts Analyzed
            </p>

            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {attemptIds.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Answers Analyzed
            </p>

            <p className="mt-3 text-3xl font-bold text-blue-600">
              {savedAnswers.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Topics Needing Practice
            </p>

            <p className="mt-3 text-3xl font-bold text-red-600">
              {needsPractice}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Strong Topics
            </p>

            <p className="mt-3 text-3xl font-bold text-green-700">
              {strong}
            </p>
          </div>
        </section>

        {/* Topic analysis */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Topic Analysis
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Topics are ordered by success rate,
            from lowest to highest.
          </p>

          {topics.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
              <h3 className="font-semibold text-zinc-900">
                No analysis available yet
              </h3>

              <p className="mt-2 text-sm text-zinc-600">
                This student needs to complete some
                quizzes before an analysis is available.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {topics.map((topic) => (
                <article
                  key={topic.topic}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">
                        {topic.topic}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-600">
                        {topic.correctAnswers} correct
                        answers out of {topic.totalAnswers}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {topic.mistakes} mistake
                        {topic.mistakes !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getAssessmentColor(
                        topic.assessment
                      )}`}
                    >
                      {getAssessmentLabel(
                        topic.assessment
                      )}
                    </span>
                  </div>

                  {/* Success rate */}
                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-700">
                      Success Rate
                    </p>

                    <p className="text-lg font-bold text-zinc-900">
                      {topic.successRate.toFixed(2)}%
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-200"
                    role="progressbar"
                    aria-label={`${topic.topic} success rate`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={topic.successRate}
                  >
                    <div
                      className={`h-full rounded-full ${getProgressColor(
                        topic.assessment
                      )}`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, topic.successRate)
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Suggested Tutor guidance */}
                  {topic.assessment ===
                    "not_enough_data" && (
                    <p className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
                      More quiz answers are needed
                      before drawing conclusions about
                      this student&apos;s understanding.
                    </p>
                  )}

                  {topic.assessment ===
                    "needs_practice" && (
                    <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
                      Consider reviewing this topic
                      with the student and assigning
                      targeted practice exercises.
                    </p>
                  )}

                  {topic.assessment === "improving" && (
                    <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                      Encourage continued practice
                      to strengthen understanding
                      of this topic.
                    </p>
                  )}

                  {topic.assessment === "strong" && (
                    <p className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
                      The student is performing well
                      on this topic. Occasional review
                      can help maintain progress.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Additional information */}
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">
            Analysis Information
          </h2>

          <p className="mt-2 text-sm text-zinc-600">
            This analysis uses up to the student&apos;s
            50 most recent quiz attempts.
          </p>

          <p className="mt-2 text-sm text-zinc-600">
            {insufficientData} topic
            {insufficientData !== 1 ? "s have" : " has"}
            {" "}insufficient data for a reliable assessment.
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            Topic classifications are estimates based
            on quiz answers, not definitive conclusions
            about student ability.
          </p>
        </div>
      </div>
    </main>
  );
}
