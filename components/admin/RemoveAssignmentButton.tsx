
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type RemoveAssignmentButtonProps = {
  assignmentId: string;
  tutorName: string;
  studentName: string;
};

export default function RemoveAssignmentButton({
  assignmentId,
  tutorName,
  studentName,
}: RemoveAssignmentButtonProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    if (isDeleting || isDeleted) {
      return;
    }

    setError("");

    // 1. Ask the administrator for confirmation.
    const confirmed = window.confirm(
      `Remove the assignment between ${tutorName} and ${studentName}?\n\n` +
        "The Tutor will lose access to this Student's results " +
        "and weakness analysis unless another valid assignment exists."
    );

    if (!confirmed) {
      return;
    }

    // 2. Start the deletion process.
    setIsDeleting(true);

    try {
      const supabase = createClient();

      // 3. Delete ONLY the selected assignment.
      // Supabase RLS permits deletion only by Admins.
      const { data: deletedRows, error: deleteError } =
        await supabase
          .from("tutor_student_links")
          .delete()
          .eq("id", assignmentId)
          .select("id");

      if (deleteError) {
        throw deleteError;
      }

      // 4. Verify that exactly one assignment
      // was removed.
      if (!deletedRows || deletedRows.length !== 1) {
        throw new Error(
          "Assignment not found or deletion not permitted."
        );
      }

      // 5. Confirm success and refresh the page.
      setIsDeleted(true);

      router.refresh();
    } catch (err) {
      console.error(
        "Unable to remove assignment:",
        err
      );

      setError(
        "Unable to remove this assignment. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isDeleting || isDeleted}
        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting
          ? "Removing..."
          : isDeleted
            ? "Removed"
            : "Remove Assignment"}
      </button>

      {error && (
        <p
          role="alert"
          className="max-w-xs text-xs text-red-600"
        >
          {error}
        </p>
      )}

      {isDeleted && (
        <p
          role="status"
          className="text-xs text-green-700"
        >
          Assignment removed successfully.
        </p>
      )}
    </div>
  );
}
