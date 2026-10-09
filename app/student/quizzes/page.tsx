"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Note = {
  id: string;
  subject_id: string;
  title: string;
};

type Quiz = {
  id: string;
  title: string;
  subject_id: string;
  source_note_id: string | null;
  created_by_ai: boolean;
  created_at: string;
};

export default function QuizzesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const [noteId, setNoteId] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [questionType, setQuestionType] =
    useState("multiple_choice");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    const [
      { data: notesData, error: notesError },
      { data: quizzesData, error: quizzesError },
    ] = await Promise.all([
      supabase
        .from("notes")
        .select("id, subject_id, title")
        .order("created_at", { ascending: false }),

      supabase
        .from("quizzes")
        .select(
          "id, title, subject_id, source_note_id, created_by_ai, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (notesError) {
      setError(notesError.message);
      return;
    }

    if (quizzesError) {
      setError(quizzesError.message);
      return;
    }

    setNotes(notesData ?? []);
    setQuizzes(quizzesData ?? []);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const [
        { data: notesData, error: notesError },
        { data: quizzesData, error: quizzesError },
      ] = await Promise.all([
        supabase
          .from("notes")
          .select("id, subject_id, title")
          .order("created_at", { ascending: false }),

        supabase
          .from("quizzes")
          .select(
            "id, title, subject_id, source_note_id, created_by_ai, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      if (notesError) {
        setError(notesError.message);
      } else if (quizzesError) {
        setError(quizzesError.message);
      } else {
        setNotes(notesData ?? []);
        setQuizzes(quizzesData ?? []);
      }

      setLoading(false);
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function getSourceNoteTitle(sourceNoteId: string | null) {
    if (!sourceNoteId) {
      return "No source note";
    }

    const note = notes.find(
      (currentNote) => currentNote.id === sourceNoteId
    );

    return note?.title ?? "Unknown note";
  }

  async function handleGenerateQuiz(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!noteId) {
      setError("Please select a note.");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId,
          numberOfQuestions,
          questionType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to generate quiz.");
        return;
      }

      setMessage("Quiz generated successfully.");
      setNoteId("");

      await loadData();
    } catch {
      setError("Unable to connect to the quiz generation service.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Quizzes
            </h1>

            <p className="mt-2 text-zinc-600">
              Generate quizzes from your study notes.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
          >
            Dashboard
          </Link>
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Generate a quiz
          </h2>

          {notes.length === 0 && !loading ? (
            <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You need to create a note before generating a quiz.
            </div>
          ) : (
            <form
              onSubmit={handleGenerateQuiz}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="note"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Source note
                </label>

                <select
                  id="note"
                  value={noteId}
                  onChange={(event) =>
                    setNoteId(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900"
                >
                  <option value="">Select a note</option>

                  {notes.map((note) => (
                    <option
                      key={note.id}
                      value={note.id}
                    >
                      {note.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="numberOfQuestions"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Number of questions
                </label>

                <select
                  id="numberOfQuestions"
                  value={numberOfQuestions}
                  onChange={(event) =>
                    setNumberOfQuestions(
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="questionType"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Question type
                </label>

                <select
                  id="questionType"
                  value={questionType}
                  onChange={(event) =>
                    setQuestionType(event.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900"
                >
                  <option value="multiple_choice">
                    Multiple choice
                  </option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {message && (
                <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={generating}
                className="rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating
                  ? "Generating..."
                  : "Generate quiz"}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Your quizzes
          </h2>

          {loading ? (
            <p className="mt-4 text-zinc-600">
              Loading...
            </p>
          ) : quizzes.length === 0 ? (
            <p className="mt-4 text-zinc-600">
              You have not generated any quizzes yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="rounded-xl border border-zinc-200 p-4"
                >
                  <h3 className="font-semibold text-zinc-900">
                    {quiz.title}
                  </h3>

                  <p className="mt-2 text-sm text-zinc-600">
                    Source:{" "}
                    {getSourceNoteTitle(quiz.source_note_id)}
                  </p>

                  {quiz.created_by_ai && (
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      AI generated
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}