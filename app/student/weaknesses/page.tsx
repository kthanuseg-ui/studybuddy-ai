
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

type WeaknessAnalysis = {
  analyzedAttempts: number;
  analyzedAnswers: number;
  topics: TopicStatistics[];
  error?: string;
};

type RecommendationResponse = {
  recommendations?: string;
  error?: string;
};

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
    default:
      return "Unknown";
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
    default:
      return "bg-zinc-100 text-zinc-700";
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

export default function MyWeaknessesPage() {
  const [analysis, setAnalysis] =
    useState<WeaknessAnalysis | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI recommendations state.
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState("");
  const [recommendationError, setRecommendationError] =
    useState("");

  // Load the student's weakness analysis.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAnalysis() {
      try {
        const response = await fetch(
          "/api/analysis/weaknesses",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data =
          (await response.json()) as WeaknessAnalysis;

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load analysis."
          );
        }

        if (
          !Array.isArray(data.topics) ||
          typeof data.analyzedAttempts !== "number" ||
          typeof data.analyzedAnswers !== "number"
        ) {
          throw new Error("Invalid analysis data.");
        }

        if (!controller.signal.aborted) {
          setAnalysis(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load analysis."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAnalysis();

    return () => {
      controller.abort();
    };
  }, []);

  // Generate AI recommendations only when the student clicks.
  async function handleGenerateRecommendations() {
    if (
      generating ||
      recommendations ||
      !analysis ||
      analysis.analyzedAnswers === 0
    ) {
      return;
    }

    setGenerating(true);
    setRecommendationError("");

    try {
      const response = await fetch(
        "/api/ai/recommendations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as RecommendationResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to generate AI recommendations."
        );
      }

      if (
        typeof data.recommendations !== "string" ||
        data.recommendations.trim().length === 0
      ) {
        throw new Error(
          "OpenAI did not return any recommendations."
        );
      }

      setRecommendations(data.recommendations.trim());
    } catch (err) {
      setRecommendationError(
        err instanceof Error
          ? err.message
          : "Unable to generate recommendations."
      );
    } finally {
      setGenerating(false);
    }
  }

  // Calculate summary statistics.
  const topics = analysis?.topics ?? [];

  const needsPractice = topics.filter(
    (topic) => topic.assessment === "needs_practice"
  ).length;

  const improving = topics.filter(
    (topic) => topic.assessment === "improving"
  ).length;

  const strong = topics.filter(
    (topic) => topic.assessment === "strong"
  ).length;

  const insufficientData = topics.filter(
    (topic) => topic.assessment === "not_enough_data"
  ).length;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Weaknesses
            </h1>

            <p className="mt-2 text-zinc-600">
              Discover which topics need more practice
              and get personalized study recommendations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/student/results"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              My Results
            </Link>

            <Link
              href="/student/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-zinc-600">
              Analyzing your quiz performance...
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6"
          >
            <h2 className="font-semibold text-red-800">
              Analysis unavailable
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>
          </div>
        ) : analysis ? (
          <>
            {/* Summary statistics */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Quiz Attempts Analyzed
                </p>

                <p className="mt-3 text-3xl font-bold text-zinc-900">
                  {analysis.analyzedAttempts}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Answers Analyzed
                </p>

                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {analysis.analyzedAnswers}
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

            {/* Performance summary */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-900">
                Performance Overview
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Topic classifications based on your
                recent quiz answers.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-sm text-red-700">
                    Needs Practice
                  </p>

                  <p className="mt-2 text-2xl font-bold text-red-700">
                    {needsPractice}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-sm text-amber-700">
                    Improving
                  </p>

                  <p className="mt-2 text-2xl font-bold text-amber-700">
                    {improving}
                  </p>
                </div>

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm text-green-700">
                    Strong
                  </p>

                  <p className="mt-2 text-2xl font-bold text-green-700">
                    {strong}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-100 p-4">
                  <p className="text-sm text-zinc-600">
                    Not Enough Data
                  </p>

                  <p className="mt-2 text-2xl font-bold text-zinc-900">
                    {insufficientData}
                  </p>
                </div>
              </div>
            </section>

            {/* AI Study Recommendations */}
            <section className="mt-8 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">
                    AI Study Recommendations
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                    Get personalized revision strategies,
                    practice exercises, and a study plan
                    based on your quiz performance.
                  </p>
                </div>

                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Powered by AI
                </span>
              </div>

              {recommendationError && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
                >
                  {recommendationError}
                </p>
              )}

              {recommendations ? (
                <div className="mt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-green-700">
                      ✓
                    </span>

                    <h3 className="font-semibold text-zinc-900">
                      Your Personalized Study Plan
                    </h3>
                  </div>

                  <div className="whitespace-pre-wrap break-words rounded-xl bg-purple-50 p-5 text-sm leading-7 text-zinc-800">
                    {recommendations}
                  </div>

                  <p className="mt-4 text-xs text-zinc-500">
                    AI-generated advice can contain mistakes.
                    Use it as study guidance and verify
                    important information.
                  </p>
                </div>
              ) : analysis.analyzedAnswers === 0 ? (
                <div className="mt-6 rounded-xl bg-zinc-50 p-5">
                  <p className="text-sm text-zinc-600">
                    Complete a quiz before requesting AI
                    study recommendations.
                  </p>

                  <Link
                    href="/student/quizzes"
                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
                  >
                    Go to My Quizzes →
                  </Link>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleGenerateRecommendations}
                    disabled={generating}
                    className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generating
                      ? "Generating recommendations..."
                      : "Generate AI Recommendations"}
                  </button>

                  <p
                    aria-live="polite"
                    className="mt-3 text-xs text-zinc-500"
                  >
                    {generating
                      ? "OpenAI is preparing your personalized study plan. Please wait."
                      : "Recommendations are generated only when you click. This request may incur a small OpenAI API charge."}
                  </p>
                </div>
              )}
            </section>

            {/* Topic breakdown */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-900">
                Topic Analysis
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Topics are ordered by their success rate,
                from lowest to highest.
              </p>

              {topics.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
                  <h3 className="font-semibold text-zinc-900">
                    No analysis available yet
                  </h3>

                  <p className="mt-2 text-sm text-zinc-600">
                    Complete some quizzes to start
                    analyzing your performance.
                  </p>

                  <Link
                    href="/student/quizzes"
                    className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Go to My Quizzes
                  </Link>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {topics.map((topic) => (
                    <article
                      key={topic.topic}
                      className="rounded-xl border border-zinc-200 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900">
                            {topic.topic}
                          </h3>

                          <p className="mt-2 text-sm text-zinc-600">
                            {topic.correctAnswers} correct answers
                            out of {topic.totalAnswers}
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

                      <div className="mt-5 flex items-center justify-between">
                        <p className="text-sm font-medium text-zinc-700">
                          Success rate
                        </p>

                        <p className="text-lg font-bold text-zinc-900">
                          {topic.successRate.toFixed(2)}%
                        </p>
                      </div>

                      <div
                        className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-200"
                        role="progressbar"
                        aria-label={`${topic.topic} success rate`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={topic.successRate}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${getProgressColor(
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

                      {topic.assessment ===
                        "not_enough_data" && (
                        <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                          Complete more questions on this
                          topic to get a more reliable
                          assessment.
                        </p>
                      )}

                      {topic.assessment ===
                        "needs_practice" && (
                        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                          This topic could benefit from
                          additional practice and review.
                        </p>
                      )}

                      {topic.assessment === "improving" && (
                        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          Keep practicing this topic to
                          strengthen your understanding.
                        </p>
                      )}

                      {topic.assessment === "strong" && (
                        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                          Great results on this topic.
                          Keep reviewing it regularly.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-5 text-center text-xs text-zinc-500">
              This analysis uses up to your 50 most
              recent quiz attempts. Topic assessments
              are estimates, not definitive conclusions.
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
