"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Subject = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export default function SubjectsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSubjects() {
      const { data, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (subjectsError) {
        setError(subjectsError.message);
      } else {
        setSubjects(data ?? []);
      }

      setLoading(false);
    }

    void loadSubjects();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleCreateSubject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setError("Subject name is required.");
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

    const { data: newSubject, error: insertError } = await supabase
      .from("subjects")
      .insert({
        student_id: user.id,
        name: trimmedName,
        description: trimmedDescription || null,
      })
      .select("id, name, description, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    setSubjects((currentSubjects) => [
      newSubject,
      ...currentSubjects,
    ]);

    setName("");
    setDescription("");
    setCreating(false);
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Subjects
            </h1>

            <p className="mt-2 text-zinc-600">
              Organize your notes and quizzes by subject.
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
            Add a subject
          </h2>

          <form
            onSubmit={handleCreateSubject}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-zinc-800"
              >
                Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900"
                placeholder="Mathematics"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-zinc-800"
              >
                Description
              </label>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900"
                placeholder="Optional description"
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
              {creating ? "Creating..." : "Create subject"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Your subjects
          </h2>

          {loading ? (
            <p className="mt-4 text-zinc-600">Loading...</p>
          ) : subjects.length === 0 ? (
            <p className="mt-4 text-zinc-600">
              You have not created any subjects yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="rounded-xl border border-zinc-200 p-4"
                >
                  <h3 className="font-semibold text-zinc-900">
                    {subject.name}
                  </h3>

                  {subject.description && (
                    <p className="mt-2 text-sm text-zinc-600">
                      {subject.description}
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