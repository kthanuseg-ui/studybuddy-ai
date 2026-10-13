
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Student = {
  id: string;
  full_name: string | null;
};

type Props = {
  projectId: string;
};

export default function AssignProjectStudent({ projectId }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from("tutor_student_links")
        .select("student_id")
        .eq("tutor_id", user.id);

      if (cancelled) return;

      if (linksError) {
        setError("Unable to load assigned students.");
        setLoading(false);
        return;
      }

      const studentIds = [
        ...new Set((links ?? []).map((link) => link.student_id)),
      ];

      if (studentIds.length === 0) {
        setLoading(false);
        return;
      }

      const [profilesResult, assignmentsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "student")
            .in("id", studentIds),

          supabase
            .from("project_assignments")
            .select("student_id")
            .eq("project_id", projectId),
        ]);

      if (cancelled) return;

      if (profilesResult.error || assignmentsResult.error) {
        setError("Unable to load project assignments.");
      } else {
        setStudents(profilesResult.data ?? []);
        setAssignedIds(
          (assignmentsResult.data ?? []).map(
            (assignment) => assignment.student_id
          )
        );
      }

      setLoading(false);
    }

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [supabase, projectId]);

  const availableStudents = students.filter(
    (student) => !assignedIds.includes(student.id)
  );

  const assignedStudents = students.filter(
    (student) => assignedIds.includes(student.id)
  );

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (assigning || !selectedId) return;

    if (!availableStudents.some((student) => student.id === selectedId)) {
      setError("Please select an available student.");
      return;
    }

    setAssigning(true);
    setError("");
    setSuccess("");

    const { error: insertError } = await supabase
      .from("project_assignments")
      .insert({
        project_id: projectId,
        student_id: selectedId,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setAssignedIds((current) => [...current, selectedId]);
      setSelectedId("");
      setSuccess("Student assigned successfully!");
    }

    setAssigning(false);
  }

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5">
      <h4 className="font-semibold text-zinc-900">
        Assign Students
      </h4>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-500">
          Loading students...
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {students.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No students available. Ask an Admin to assign
              students to your Tutor account.
            </p>
          ) : (
            <>
              <form
                onSubmit={handleAssign}
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <select
                  aria-label="Select a student"
                  value={selectedId}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setSuccess("");
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3"
                >
                  <option value="">Select a student</option>

                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name || "Unnamed Student"}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={assigning || !selectedId}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign Student"}
                </button>
              </form>

              {success && (
                <p role="status" className="mt-3 text-sm text-green-700">
                  {success}
                </p>
              )}

              {availableStudents.length === 0 && (
                <p className="mt-3 text-sm text-zinc-500">
                  All available students are already assigned.
                </p>
              )}

              {assignedStudents.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-zinc-800">
                    Assigned to this project:
                  </p>

                  <ul className="mt-2 space-y-1">
                    {assignedStudents.map((student) => (
                      <li
                        key={student.id}
                        className="text-sm text-zinc-600"
                      >
                        {student.full_name || "Unnamed Student"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
