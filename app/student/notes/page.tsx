"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Subject = {
  id: string;
  name: string;
};

type Note = {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function NotesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [
        { data: subjectsData, error: subjectsError },
        { data: notesData, error: notesError },
      ] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name")
          .order("name", { ascending: true }),

        supabase
          .from("notes")
          .select("id, subject_id, title, content, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      if (subjectsError) {
        setError(subjectsError.message);
      } else if (notesError) {
        setError(notesError.message);
      } else {
        setSubjects(subjectsData ?? []);
        setNotes(notesData ?? []);
      }

      setLoading(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function getSubjectName(noteSubjectId: string) {
    const subject = subjects.find(
      (currentSubject) => currentSubject.id === noteSubjectId
    );

    return subject?.name ?? "Unknown subject";
  }

  async function handleCreateNote(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }

    if (!trimmedTitle) {
      setError("Note title is required.");
      return;
    }

    if (!trimmedContent) {
      setError("Note content is required.");
      return;
    }

    setCreating(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Unable to identify the signed-in user.");
      setCreating(false);
      return;
    }

    const { data: newNote, error: insertError } = await supabase
      .from("notes")
      .insert({
        student_id: user.id,
        subject_id: subjectId,
        title: trimmedTitle,
        content: trimmedContent,
      })
      .select("id, subject_id, title, content, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    setNotes((currentNotes) => [
      newNote,
      ...currentNotes,
    ]);

    setSubjectId("");
    setTitle("");
    setContent("");
    setCreating(false);
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Notes
            </h1>

            <p className="mt-2 text-zinc-600">
              Create notes and organize them by subject.
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
            Add a note
          </h2>

          {subjects.length === 0 && !loading ? (
            <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You need to create a subject before adding notes.
            </div>
          ) : (
            <form
              onSubmit={handleCreateNote}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="subject"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Subject
                </label>

                <select
                  id="subject"
                  value={subjectId}
                  onChange={(event) =>
                    setSubjectId(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900"
                >
                  <option value="">Select a subject</option>

                  {subjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Title
                </label>

                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900"
                  placeholder="Quadratic equations"
                />
              </div>

              <div>
                <label
                  htmlFor="content"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  Content
                </label>

                <textarea
                  id="content"
                  value={content}
                  onChange={(event) =>
                    setContent(event.target.value)
                  }
                  required
                  rows={6}
                  className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900"
                  placeholder="Write your study notes here..."
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create note"}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Your notes
          </h2>

          {loading ? (
            <p className="mt-4 text-zinc-600">
              Loading...
            </p>
          ) : notes.length === 0 ? (
            <p className="mt-4 text-zinc-600">
              You have not created any notes yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-zinc-200 p-4"
                >
                  <p className="text-sm font-medium text-zinc-500">
                    {getSubjectName(note.subject_id)}
                  </p>

                  <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                    {note.title}
                  </h3>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                    {note.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}