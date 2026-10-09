
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminDashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              Admin Dashboard
            </h1>

            <p className="mt-3 text-zinc-600">
              You are signed in as an Admin.
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Administration
          </h2>

          <p className="mt-2 text-sm text-zinc-600">
            Manage users, roles, and Tutor-Student
            assignments.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="inline-block rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Manage Users →
            </Link>

            <Link
              href="/admin/assignments"
              className="inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Manage Assignments →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
