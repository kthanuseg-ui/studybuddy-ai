import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AssignStudentForm from "@/components/admin/AssignStudentForm";
import RemoveAssignmentButton from "@/components/admin/RemoveAssignmentButton";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  full_name: string | null;
  role: string;
};

type Assignment = {
  id: string;
  tutor_id: string;
  student_id: string;
  created_at: string;
};

function getDisplayName(profile?: UserProfile) {
  return profile?.full_name?.trim() || "Unknown User";
}

export default async function AdminAssignmentsPage() {
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

  // 4. Retrieve registered users.
  const { data: profilesData, error: profilesError } =
    await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

  // 5. Retrieve existing Tutor-Student assignments.
  const { data: assignmentsData, error: assignmentsError } =
    await supabase
      .from("tutor_student_links")
      .select("id, tutor_id, student_id, created_at")
      .order("created_at", { ascending: false });

  // 6. Handle database errors.
  if (profilesError || assignmentsError) {
    console.error("Unable to load assignments:", {
      profilesError: profilesError?.message,
      assignmentsError: assignmentsError?.message,
    });

    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Manage Assignments
          </h1>

          <p role="alert" className="mt-4 text-red-600">
            Unable to load assignment information.
            Please try again.
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

  const profiles: UserProfile[] = profilesData ?? [];
  const assignments: Assignment[] =
    assignmentsData ?? [];

  // 7. Separate Students and Tutors.
  const students = profiles.filter(
    (profile) => profile.role === "student"
  );

  const tutors = profiles.filter(
    (profile) => profile.role === "tutor"
  );

  // 8. Map user IDs to profiles.
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  // 9. Calculate assignment statistics.
  const totalAssignments = assignments.length;

  const assignedStudentIds = new Set(
    assignments.map((assignment) => assignment.student_id)
  );

  const assignedTutorIds = new Set(
    assignments.map((assignment) => assignment.tutor_id)
  );

  const activeTutors = tutors.filter((tutor) =>
    assignedTutorIds.has(tutor.id)
  ).length;

  const unassignedStudents = students.filter(
    (student) => !assignedStudentIds.has(student.id)
  ).length;

  // 10. Display the Admin Assignments page.
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
              Manage Assignments
            </h1>

            <p className="mt-2 text-zinc-600">
              Manage relationships between Tutors
              and Students in StudyBuddy AI.
            </p>
          </div>

          <Link
            href="/admin/users"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Manage Users
          </Link>
        </div>

        {/* Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Students
            </p>

            <p className="mt-3 text-3xl font-bold text-green-600">
              {students.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Tutors
            </p>

            <p className="mt-3 text-3xl font-bold text-blue-600">
              {tutors.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Active Tutors
            </p>

            <p className="mt-3 text-3xl font-bold text-purple-600">
              {activeTutors}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Assignments
            </p>

            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {totalAssignments}
            </p>
          </div>
        </section>

        {/* Assignment management introduction */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Assign Students to Tutors
          </h2>

          <p className="mt-2 text-sm text-zinc-600">
            Select a Tutor and a Student to create
            a new assignment.
          </p>


<div className="mt-5">
  <AssignStudentForm
    tutors={tutors}
    students={students}
  />
</div>

        </section>

        {/* Existing assignments */}
        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-6">
            <h2 className="text-xl font-semibold text-zinc-900">
              Existing Assignments
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              All Tutor-Student relationships currently
              registered in Supabase.
            </p>
          </div>

          {assignments.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-zinc-900">
                No assignments yet
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                Assignments will appear here when
                Students are linked to Tutors.
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
                      Tutor
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Student
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Assignment Date
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-4 font-semibold"
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {assignments.map((assignment) => {
                    const tutor = profilesById.get(
                      assignment.tutor_id
                    );

                    const student = profilesById.get(
                      assignment.student_id
                    );

                    const date = assignment.created_at
                      ? new Date(
                          assignment.created_at
                        ).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : "Unknown";

                    return (
                      <tr
                        key={assignment.id}
                        className="hover:bg-zinc-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-zinc-900">
                            {getDisplayName(tutor)}
                          </p>

                          <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            Tutor
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-semibold text-zinc-900">
                            {getDisplayName(student)}
                          </p>

                          <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            Student
                          </span>
                        </td>

                        <td className="px-6 py-5 text-zinc-600">
                          {date}
                        </td>


<td className="px-6 py-5">
  <RemoveAssignmentButton
    assignmentId={assignment.id}
    tutorName={getDisplayName(tutor)}
    studentName={getDisplayName(student)}
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

        {/* Summary */}
        <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            Assignment Overview
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            {unassignedStudents} student
            {unassignedStudents !== 1 ? "s" : ""}
            {" "}currently have no assigned Tutor.
          </p>

<p className="mt-2 text-sm text-blue-800">
  Administrators can create and remove Tutor-Student
  assignments directly from this page.
  Changes are saved in Supabase.
</p>

        </section>
      </div>
    </main>
  );
}
