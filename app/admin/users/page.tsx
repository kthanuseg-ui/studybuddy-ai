
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ChangeRoleForm from "@/components/admin/ChangeRoleForm";

export const dynamic = "force-dynamic";

type UserRole = "student" | "tutor" | "admin";

type UserProfile = {
  id: string;
  full_name: string | null;
  role: string;
};

function getRoleStyle(role: string) {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-700";
    case "tutor":
      return "bg-blue-100 text-blue-700";
    case "student":
      return "bg-green-100 text-green-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "tutor":
      return "Tutor";
    case "student":
      return "Student";
    default:
      return "Unknown";
  }
}

export default async function AdminUsersPage() {
  // 1. Connect to Supabase.
  const supabase = await createClient();

  // 2. Verify the authenticated user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    notFound();
  }

  // 3. Verify the Admin role.
  const { data: adminProfile, error: adminError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (adminError || adminProfile?.role !== "admin") {
    notFound();
  }

  // 4. Retrieve all users.
  // Supabase RLS must also allow Admin read access.
  const { data, error: usersError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });

  if (usersError) {
    console.error(
      "Unable to load users:",
      usersError.message
    );

    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Manage Users
          </h1>

          <p role="alert" className="mt-4 text-red-600">
            Unable to load users. Please try again.
          </p>

          <Link
            href="/admin/dashboard"
            className="mt-6 inline-block text-blue-600 hover:underline"
          >
            ← Back to Admin Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const users: UserProfile[] = data ?? [];

  // 5. Calculate user statistics.
  const totalUsers = users.length;

  const countByRole = (role: UserRole) =>
    users.filter((profile) => profile.role === role).length;

  const totalStudents = countByRole("student");
  const totalTutors = countByRole("tutor");
  const totalAdmins = countByRole("admin");

  // 6. Display the Admin Users page.
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to Admin Dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-zinc-900">
              Manage Users
            </h1>

            <p className="mt-2 text-zinc-600">
              View and manage registered StudyBuddy AI users.
            </p>
          </div>

          <span className="rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
            Admin Access
          </span>
        </div>

        {/* Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Users
            </p>

            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {totalUsers}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Students
            </p>

            <p className="mt-3 text-3xl font-bold text-green-600">
              {totalStudents}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Tutors
            </p>

            <p className="mt-3 text-3xl font-bold text-blue-600">
              {totalTutors}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Admins
            </p>

            <p className="mt-3 text-3xl font-bold text-purple-600">
              {totalAdmins}
            </p>
          </div>
        </section>

        {/* Users table */}
        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-6">
            <h2 className="text-xl font-semibold text-zinc-900">
              Registered Users
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              All users registered in the application.
            </p>
          </div>

          {users.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-zinc-900">
                No users found
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                Registered users will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Name
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      User ID
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Role
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Status
                    </th>
                    <th
  scope="col"
  className="px-6 py-4 font-semibold"
>
  Change Role
</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {users.map((profile) => {
                    const userName =
                      profile.full_name?.trim() ||
                      "Unnamed User";

                    return (
                      <tr
                        key={profile.id}
                        className="hover:bg-zinc-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-zinc-900">
                            {userName}
                          </p>

                          {profile.id === user.id && (
                            <span className="mt-1 inline-block text-xs font-medium text-purple-600">
                              Your account
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <code className="whitespace-nowrap text-xs text-zinc-500">
                            {profile.id}
                          </code>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleStyle(
                              profile.role
                            )}`}
                          >
                            {getRoleLabel(profile.role)}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <span className="inline-flex items-center gap-2 text-zinc-600">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Registered
                          </span>
                        </td>

<td className="px-6 py-5">
  <ChangeRoleForm
    userId={profile.id}
    userName={userName}
    currentRole={profile.role}
    isCurrentUser={profile.id === user.id}
  />
</td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Information */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            User Management
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            This page currently provides read-only
            access to registered users. Role management
            and student assignments will be added next.
          </p>
        </div>
      </div>
    </main>
  );
}
