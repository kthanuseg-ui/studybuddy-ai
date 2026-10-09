
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Quiz = {
  id: string;
  title: string;
  created_at: string;
};

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  topic: string | null;
};

type QuizResponse = {
  quiz: Quiz;
  questions: Question[];
  error?: string;
};

type QuizResult = {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  error?: string;
};

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuizResult | null>(null);

  // Load the quiz without exposing correct answers.
  useEffect(() => {
    const controller = new AbortController();

    async function loadQuiz() {
      try {
        const response = await fetch(
          `/api/quizzes/${encodeURIComponent(id)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = (await response.json()) as QuizResponse;

        if (!response.ok) {
          throw new Error(data.error || "Unable to load quiz.");
        }

        if (!data.quiz || !Array.isArray(data.questions)) {
          throw new Error("Invalid quiz data.");
        }

        setQuiz(data.quiz);
        setQuestions(data.questions);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load quiz."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadQuiz();

    return () => {
      controller.abort();
    };
  }, [id]);

  // Count the questions answered by the student.
  const answeredCount = questions.filter(
    (question) => answers[question.id] !== undefined
  ).length;

  const allAnswered =
    questions.length > 0 && answeredCount === questions.length;

  // Send the student's answers to the server.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!allAnswered || submitting || result) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const submittedAnswers = questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id],
      }));

      const response = await fetch(
        `/api/quizzes/${encodeURIComponent(id)}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: submittedAnswers,
          }),
        }
      );

      const data = (await response.json()) as QuizResult;

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit quiz.");
      }

      if (
        typeof data.score !== "number" ||
        typeof data.correctAnswers !== "number" ||
        typeof data.totalQuestions !== "number"
      ) {
        throw new Error("Invalid quiz result.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit quiz."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state.
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <p className="text-zinc-600">Loading quiz...</p>
      </main>
    );
  }

  // Error when loading the quiz.
  if (!quiz) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Quiz unavailable
          </h1>

          <p role="alert" className="mt-4 text-red-600">
            {error || "This quiz could not be loaded."}
          </p>

          <Link
            href="/student/quizzes"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Back to My Quizzes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/student/quizzes"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to My Quizzes
        </Link>

        <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-zinc-900">
            {quiz.title}
          </h1>

          <p className="mt-2 text-zinc-600">
            Answer each question and submit your quiz to see your
            score.
          </p>

          <div className="mt-5 rounded-lg bg-zinc-100 p-4">
            <p className="text-sm font-medium text-zinc-700">
              Questions answered: {answeredCount} / {questions.length}
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width:
                    questions.length > 0
                      ? `${(answeredCount / questions.length) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {result ? (
            <div
              aria-live="polite"
              className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-center"
            >
              <h2 className="text-2xl font-bold text-green-800">
                Quiz completed!
              </h2>

              <p className="mt-4 text-5xl font-bold text-green-700">
                {result.score.toFixed(2)}%
              </p>

              <p className="mt-3 text-green-800">
                {result.correctAnswers} correct answers out of{" "}
                {result.totalQuestions}
              </p>

              <p className="mt-3 text-sm text-green-700">
                Your result has been saved.
              </p>

              <Link
                href="/student/quizzes"
                className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800"
              >
                Back to My Quizzes
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              {questions.map((question, index) => (
                <fieldset
                  key={question.id}
                  disabled={submitting}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <legend className="px-2 text-sm font-semibold text-blue-600">
                    Question {index + 1}
                  </legend>

                  <p className="mt-2 text-lg font-semibold text-zinc-900">
                    {question.question_text}
                  </p>

                  {question.topic && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Topic: {question.topic}
                    </p>
                  )}

                  <div className="mt-5 space-y-3">
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={`${question.id}-${optionIndex}`}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                          answers[question.id] === option
                            ? "border-blue-500 bg-blue-50"
                            : "border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={() =>
                            setAnswers((previous) => ({
                              ...previous,
                              [question.id]: option,
                            }))
                          }
                          className="h-4 w-4 accent-blue-600"
                        />

                        <span className="text-sm text-zinc-800">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <button
                type="submit"
                disabled={!allAnswered || submitting}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Quiz"}
              </button>

              {!allAnswered && (
                <p className="text-center text-sm text-zinc-500">
                  Answer all questions before submitting.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
