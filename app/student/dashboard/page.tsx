"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@/utils/supabase/client";

export default function StudentDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [tutorNames, setTutorNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAssignedTutors() {
      try {
        // Identify the authenticated student.
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Please sign in to view your tutor.");
        }

        // Retrieve only this student's tutor assignments.
        const { data: links, error: linksError } = await supabase
          .from("tutor_student_links")
          .select("tutor_id")
          .eq("student_id", user.id);

        if (linksError) {
          throw new Error(linksError.message);
        }

        const tutorIds = [
          ...new Set((links ?? []).map((link) => link.tutor_id)),
        ];

        if (tutorIds.length === 0) {
          if (!cancelled) {
            setTutorNames([]);
          }
          return;
        }

        // RLS allows access only to assigned tutor profiles.
        const { data: profiles, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", tutorIds);

        if (profilesError) {
          throw new Error(profilesError.message);
        }

        if (!profiles || profiles.length !== tutorIds.length) {
          throw new Error(
            "Some assigned tutor profiles are not accessible."
          );
        }

        if (!cancelled) {
          setTutorNames(
            profiles.map(
              (profile) =>
                profile.full_name?.trim() || "Unnamed tutor"
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load assigned tutors."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAssignedTutors();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              Student Dashboard
            </h1>

            <p className="mt-3 text-zinc-600">
              You are signed in as a Student.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/student/subjects"
                className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                My Subjects
              </Link>

              <Link
                href="/student/notes"
                className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                My Notes
              </Link>

              <Link
                href="/student/quizzes"
                className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                My Quizzes
              </Link>

              <Link
                href="/student/results"
                className="inline-block rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                My Results
              </Link>

              <Link
                href="/student/weaknesses"
                className="inline-block rounded-lg border border-purple-600 bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
              >
                My Weaknesses
              </Link>
            </div>
          </div>

          <LogoutButton />
        </div>

        {/* Assigned Tutor Information */}
        <section className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            My Assigned Tutor
          </h2>

          {loading ? (
            <p className="mt-3 text-sm text-zinc-600">
              Loading tutor information...
            </p>
          ) : error ? (
            <p className="mt-3 text-sm text-red-600">
              {error}
            </p>
          ) : tutorNames.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              No tutor assigned yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {tutorNames.map((name, index) => (
                <p
                  key={`${name}-${index}`}
                  className="font-semibold text-blue-700"
                >
                  {name}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}