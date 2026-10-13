
"use client";

import { FormEvent, useState } from "react";

type UnderstandingAnalysis = {
  ai_summary: string;
  understood_points: string[];
  missing_points: string[];
  misunderstood_points: string[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  analysis?: UnderstandingAnalysis;
};

type Props = {
  projectId: string;
};

export default function ProjectUnderstandingForm({
  projectId,
}: Props) {
  const [explanation, setExplanation] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] =
    useState<UnderstandingAnalysis | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (analyzing) return;

    const trimmedExplanation = explanation.trim();

    setError("");
    setAnalysis(null);

    if (
      trimmedExplanation.length < 50 ||
      trimmedExplanation.length > 5000
    ) {
      setError(
        "Please write between 50 and 5000 characters."
      );
      return;
    }

    setAnalyzing(true);

    try {
      const response = await fetch(
        "/api/ai/project-understanding",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            studentUnderstanding: trimmedExplanation,
          }),
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to analyze your explanation."
        );
      }

      const result = data.analysis;

      if (
        !result ||
        typeof result.ai_summary !== "string" ||
        !Array.isArray(result.understood_points) ||
        !Array.isArray(result.missing_points) ||
        !Array.isArray(result.misunderstood_points)
      ) {
        throw new Error("Invalid AI analysis response.");
      }

      setAnalysis(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h4 className="text-lg font-semibold text-blue-950">
        Project Understanding Check
      </h4>

      <p className="mt-2 text-sm leading-6 text-blue-900">
        Explain this project in your own words.
        Describe what you need to do, the main concepts
        involved, and how you plan to achieve the objectives.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-4"
      >
        <div>
          <label
            htmlFor={`understanding-${projectId}`}
            className="mb-2 block text-sm font-semibold text-zinc-900"
          >
            Explain Your Understanding *
          </label>

          <textarea
            id={`understanding-${projectId}`}
            value={explanation}
            onChange={(event) => {
              setExplanation(event.target.value);
              setAnalysis(null);
              setError("");
            }}
            rows={7}
            required
            minLength={50}
            maxLength={5000}
            disabled={analyzing}
            placeholder="In this project, I need to analyze energy consumption data. First, I will..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-blue-600 disabled:opacity-60"
          />

          <p className="mt-2 text-right text-xs text-zinc-600">
            {explanation.length} / 5000 characters
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={analyzing || explanation.trim().length < 50}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing
            ? "Analyzing Your Understanding..."
            : "Analyze My Understanding"}
        </button>

        <p className="text-xs text-zinc-600">
          Maximum 3 AI analyses per student per UTC day.
          AI feedback is advisory and may contain mistakes.
        </p>
      </form>

      {analysis && (
        <div
          role="status"
          className="mt-6 space-y-4 border-t border-blue-200 pt-5"
        >
          <h5 className="text-lg font-bold text-zinc-900">
            Your AI Analysis
          </h5>

          <div className="rounded-lg bg-white p-4">
            <h6 className="font-semibold text-zinc-900">
              AI Summary
            </h6>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
              {analysis.ai_summary}
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h6 className="font-semibold text-green-900">
              Understood Points
            </h6>

            {analysis.understood_points.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-green-900">
                {analysis.understood_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-green-900">
                No clearly demonstrated points identified.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h6 className="font-semibold text-amber-900">
              Missing Points
            </h6>

            {analysis.missing_points.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-900">
                {analysis.missing_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-amber-900">
                No significant missing points identified.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h6 className="font-semibold text-red-900">
              Misunderstood Points
            </h6>

            {analysis.misunderstood_points.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-red-900">
                {analysis.misunderstood_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-red-900">
                No explicit misunderstandings identified.
              </p>
            )}
          </div>

          <p className="text-xs text-zinc-600">
            Your explanation and AI analysis have been saved.
            Your Tutor will be able to review them.
          </p>
        </div>
      )}
    </section>
  );
}
