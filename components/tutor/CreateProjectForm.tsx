
"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function CreateProjectForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutcomes, setExpectedOutcomes] = useState("");
  const [deadline, setDeadline] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleCreateProject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (creating) return;

    setError("");
    setSuccess("");

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedOutcomes = expectedOutcomes.trim();

    if (
      !trimmedTitle ||
      !trimmedDescription ||
      !trimmedOutcomes
    ) {
      setError("Please complete all required fields.");
      return;
    }

    setCreating(true);

    try {
      // Identify the authenticated Tutor.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please sign in to create a project.");
      }

      // Convert the optional deadline to a database timestamp.
      const deadlineValue = deadline
        ? new Date(`${deadline}T23:59:59`).toISOString()
        : null;

      // Supabase RLS ensures only permitted Tutors can insert.
      const { error: insertError } = await supabase
        .from("projects")
        .insert({
          tutor_id: user.id,
          title: trimmedTitle,
          description: trimmedDescription,
          expected_outcomes: trimmedOutcomes,
          deadline: deadlineValue,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setTitle("");
      setDescription("");
      setExpectedOutcomes("");
      setDeadline("");

      setSuccess("Project created successfully!");

      // Refresh the server-rendered project list.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the project."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">
        Create Project
      </h2>

      <p className="mt-2 text-sm text-zinc-600">
        Define the instructions and expected learning outcomes
        before assigning the project to students.
      </p>

      <form
        onSubmit={handleCreateProject}
        className="mt-6 space-y-5"
      >
        <div>
          <label
            htmlFor="project-title"
            className="mb-2 block text-sm font-medium text-zinc-800"
          >
            Project Title *
          </label>

          <input
            id="project-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={150}
            placeholder="Introduction to Data Analysis"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label
            htmlFor="project-description"
            className="mb-2 block text-sm font-medium text-zinc-800"
          >
            Description / Instructions *
          </label>

          <textarea
            id="project-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            required
            rows={5}
            maxLength={5000}
            placeholder="Explain what students need to complete..."
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label
            htmlFor="project-outcomes"
            className="mb-2 block text-sm font-medium text-zinc-800"
          >
            Expected Outcomes *
          </label>

          <textarea
            id="project-outcomes"
            value={expectedOutcomes}
            onChange={(event) =>
              setExpectedOutcomes(event.target.value)
            }
            required
            rows={4}
            maxLength={3000}
            placeholder="List the key concepts and objectives students should understand..."
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label
            htmlFor="project-deadline"
            className="mb-2 block text-sm font-medium text-zinc-800"
          >
            Deadline (optional)
          </label>

          <input
            id="project-deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Creating Project..." : "Create Project"}
        </button>
      </form>
    </section>
  );
}
