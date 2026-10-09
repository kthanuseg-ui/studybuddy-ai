
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type QuizAttempt = {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
};

type QuizInfo = {
  id: string;
  title: string;
};

export default function MyResultsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizTitles, setQuizTitles] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the student's saved quiz results.
  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      try {
        // 1. Check that the student is authenticated.
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Please sign in to view your results.");
        }

        // 2. Retrieve the student's latest 100 attempts.
        const { data: attemptsData, error: attemptsError } =
          await supabase
            .from("quiz_attempts")
            .select(
              "id, quiz_id, score, total_questions, correct_answers, completed_at"
            )
            .eq("student_id", user.id)
            .order("completed_at", { ascending: false })
            .limit(100);

        if (attemptsError) {
          throw new Error(attemptsError.message);
        }

        const results: QuizAttempt[] = (attemptsData ?? []).map(
          (attempt) => ({
            id: attempt.id,
            quiz_id: attempt.quiz_id,
            score: Number(attempt.score),
            total_questions: attempt.total_questions,
            correct_answers: attempt.correct_answers,
            completed_at: attempt.completed_at,
          })
        );

        // 3. Retrieve the titles of the completed quizzes.
        const quizIds = [
          ...new Set(results.map((attempt) => attempt.quiz_id)),
        ];

        const titles: Record<string, string> = {};

        if (quizIds.length > 0) {
          const { data: quizzesData, error: quizzesError } =
            await supabase
              .from("quizzes")
              .select("id, title")
              .in("id", quizIds);

          if (quizzesError) {
            throw new Error(quizzesError.message);
          }

          for (const quiz of (quizzesData ?? []) as QuizInfo[]) {
            titles[quiz.id] = quiz.title;
          }
        }

        // 4. Update the interface.
        if (!cancelled) {
          setAttempts(results);
          setQuizTitles(titles);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load results."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Calculate the student's statistics.
  const statistics = useMemo(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        latestScore: 0,
      };
    }

    const scores = attempts.map((attempt) => attempt.score);

    const sum = scores.reduce(
      (total, current) => total + current,
      0
    );

    return {
      totalAttempts: attempts.length,
      averageScore: sum / scores.length,
      bestScore: Math.max(...scores),
      latestScore: scores[0],
    };
  }, [attempts]);

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getScoreColor(score: number) {
    if (score >= 80) {
      return "text-green-700 bg-green-50";
    }

    if (score >= 50) {
      return "text-amber-700 bg-amber-50";
    }

    return "text-red-700 bg-red-50";
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Results
            </h1>

            <p className="mt-2 text-zinc-600">
              Track your quiz scores and study progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/student/quizzes"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              My Quizzes
            </Link>

            <Link
              href="/student/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-zinc-600">
              Loading your results...
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6"
          >
            <h2 className="font-semibold text-red-800">
              Unable to load results
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Quiz Attempts
                </p>

                <p className="mt-3 text-3xl font-bold text-zinc-900">
                  {statistics.totalAttempts}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Average Score
                </p>

                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {statistics.averageScore.toFixed(2)}%
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Best Score
                </p>

                <p className="mt-3 text-3xl font-bold text-green-700">
                  {statistics.bestScore.toFixed(2)}%
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Latest Score
                </p>

                <p className="mt-3 text-3xl font-bold text-zinc-900">
                  {statistics.latestScore.toFixed(2)}%
                </p>
              </div>
            </section>

            {/* Results history */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900">
                  Quiz History
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Your 100 most recent quiz attempts.
                </p>
              </div>

              {attempts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
                  <h3 className="font-semibold text-zinc-900">
                    No results yet
                  </h3>

                  <p className="mt-2 text-sm text-zinc-600">
                    Complete your first quiz to see your results
                    here.
                  </p>

                  <Link
                    href="/student/quizzes"
                    className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Go to My Quizzes
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {attempts.map((attempt) => (
                    <div
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
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
