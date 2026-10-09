
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type UserProfile = {
  id: string;
  full_name: string | null;
};

type AssignStudentFormProps = {
  tutors: UserProfile[];
  students: UserProfile[];
};

function getDisplayName(profile: UserProfile) {
  return profile.full_name?.trim() || "Unnamed User";
}

export default function AssignStudentForm({
  tutors,
  students,
}: AssignStudentFormProps) {
  const router = useRouter();

  const [tutorId, setTutorId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canAssign =
    tutors.length > 0 && students.length > 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    // 1. Validate the selected users.
    if (!tutorId || !studentId) {
      setError("Please select a Tutor and a Student.");
      return;
    }

    // 2. Check the selected IDs against the options
    // provided by the server.
    const selectedTutor = tutors.find(
      (tutor) => tutor.id === tutorId
    );

    const selectedStudent = students.find(
      (student) => student.id === studentId
    );

    if (!selectedTutor || !selectedStudent) {
      setError("Invalid Tutor or Student selected.");
      return;
    }

    // 3. Ask for confirmation.
    const confirmed = window.confirm(
      `Assign ${getDisplayName(
        selectedStudent
      )} to ${getDisplayName(selectedTutor)}?`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      // 4. Confirm that the accounts still
      // have the correct roles in Supabase.
      const {
        data: currentProfiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select("id, role")
        .in("id", [tutorId, studentId]);

      if (profilesError) {
        throw profilesError;
      }

      const tutorIsValid = currentProfiles?.some(
        (profile) =>
          profile.id === tutorId &&
          profile.role === "tutor"
      );

      const studentIsValid = currentProfiles?.some(
        (profile) =>
          profile.id === studentId &&
          profile.role === "student"
      );

      if (!tutorIsValid || !studentIsValid) {
        setError(
          "The selected accounts no longer have the required roles."
        );
        return;
      }

      // 5. Check whether this assignment
      // already exists.
      const {
        data: existingAssignment,
        error: checkError,
      } = await supabase
        .from("tutor_student_links")
        .select("id")
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId)
        .limit(1)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingAssignment) {
        setError(
          "This Student is already assigned to this Tutor."
        );
        return;
      }

      // 6. Create the assignment.
      // Supabase RLS authorizes only Admin users.
      const { error: insertError } = await supabase
        .from("tutor_student_links")
        .insert({
          tutor_id: tutorId,
          student_id: studentId,
        });

      if (insertError) {
        // Unique constraint violation, if a
        // database uniqueness constraint exists.
        if (insertError.code === "23505") {
          setError(
            "This assignment already exists."
          );
          return;
        }

        throw insertError;
      }

      // 7. Display confirmation and refresh.
      setSuccess(
        `${getDisplayName(
          selectedStudent
        )} was successfully assigned to ${getDisplayName(
          selectedTutor
        )}.`
      );

      setTutorId("");
      setStudentId("");

      router.refresh();
    } catch (err) {
      console.error(
        "Unable to create assignment:",
        err
      );

      setError(
        "Unable to create this assignment. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* Tutor selection */}
        <div>
          <label
            htmlFor="assignment-tutor"
            className="mb-2 block text-sm font-semibold text-zinc-700"
          >
            Select Tutor
          </label>

          <select
            id="assignment-tutor"
            value={tutorId}
            onChange={(event) => {
              setTutorId(event.target.value);
              setError("");
              setSuccess("");
            }}
            disabled={isSaving || !canAssign}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none"
          >
            <option value="">
              Choose a Tutor
            </option>

            {tutors.map((tutor) => (
              <option
                key={tutor.id}
                value={tutor.id}
              >
                {getDisplayName(tutor)}
              </option>
            ))}
          </select>
        </div>

        {/* Student selection */}
        <div>
          <label
            htmlFor="assignment-student"
            className="mb-2 block text-sm font-semibold text-zinc-700"
          >
            Select Student
          </label>

          <select
            id="assignment-student"
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              setError("");
              setSuccess("");
            }}
            disabled={isSaving || !canAssign}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none"
          >
            <option value="">
              Choose a Student
            </option>

            {students.map((student) => (
              <option
                key={student.id}
                value={student.id}
              >
                {getDisplayName(student)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={
          isSaving ||
          !canAssign ||
          !tutorId ||
          !studentId
        }
        className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving
          ? "Assigning..."
          : "Assign Student →"}
      </button>

      {!canAssign && (
        <p className="text-sm text-amber-700">
          At least one Tutor and one Student
          are required to create an assignment.
        </p>
      )}

      {/* Error message */}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Success message */}
      {success && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </p>
      )}
    </form>
  );
}
