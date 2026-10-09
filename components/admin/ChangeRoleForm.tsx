
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type UserRole = "student" | "tutor" | "admin";

type ChangeRoleFormProps = {
  userId: string;
  userName: string;
  currentRole: string;
  isCurrentUser: boolean;
};

function isValidRole(value: string): value is UserRole {
  return (
    value === "student" ||
    value === "tutor" ||
    value === "admin"
  );
}

export default function ChangeRoleForm({
  userId,
  userName,
  currentRole,
  isCurrentUser,
}: ChangeRoleFormProps) {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState(
    currentRole
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Prevent the administrator from changing their own role.
  if (isCurrentUser) {
    return (
      <span className="text-xs text-zinc-500">
        Your role cannot be changed
      </span>
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    // Validate the selected role.
    if (!isValidRole(selectedRole)) {
      setError("Invalid role selected.");
      return;
    }

    if (selectedRole === currentRole) {
      setError("Please select a different role.");
      return;
    }

    // Ask for confirmation.
    const confirmed = window.confirm(
      `Change ${userName}'s role from ${currentRole} to ${selectedRole}?`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      // Call the secure PostgreSQL function.
      const { error: updateError } = await supabase.rpc(
        "admin_set_user_role",
        {
          p_user_id: userId,
          p_role: selectedRole,
        }
      );

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        `Role successfully changed to ${selectedRole}.`
      );

      // Refresh the page to display updated roles.
      router.refresh();
    } catch (err) {
      console.error("Unable to change role:", err);

      setError(
        "Unable to update this user's role. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-w-48 flex-col gap-2"
    >
      <label
        htmlFor={`role-${userId}`}
        className="text-xs font-medium text-zinc-600"
      >
        Change role
      </label>

      <select
        id={`role-${userId}`}
        value={selectedRole}
        onChange={(event) => {
          setSelectedRole(event.target.value);
          setError("");
          setSuccess("");
        }}
        disabled={isSaving}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none"
      >
        <option value="student">Student</option>
        <option value="tutor">Tutor</option>
        <option value="admin">Admin</option>
      </select>

      <button
        type="submit"
        disabled={
          isSaving ||
          selectedRole === currentRole ||
          !isValidRole(selectedRole)
        }
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Role"}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-xs text-green-700">
          {success}
        </p>
      )}
    </form>
  );
}
