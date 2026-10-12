
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type AssignedStudent = {
  id: string;
  full_name: string | null;
  assignedAt: string;
};

export default async function TutorStudentsPage() {
  // 1. Create the Supabase server client.
  const supabase = await createClient();

  // 2. Identify the authenticated user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Authentication required
          </h1>

          <p className="mt-3 text-zinc-600">
            Please sign in to access this page.
          </p>
        </div>
      </main>
    );
  }

  // 3. Verify the Tutor role.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "tutor") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Access denied
          </h1>

          <p className="mt-3 text-zinc-600">
            Only Tutors can access this page.
          </p>
        </div>
      </main>
    );
  }

  // 4. Retrieve students assigned to this Tutor.
  const { data: links, error: linksError } =
    await supabase
      .from("tutor_student_links")
      .select("student_id, created_at")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false });

  if (linksError) {
    console.error(
      "Unable to load tutor assignments:",
      linksError.message
    );

    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            My Students
          </h1>

          <p role="alert" className="mt-4 text-red-600">
            Unable to load assigned students.
          </p>

          <Link
            href="/tutor/dashboard"
            className="mt-5 inline-block text-blue-600 hover:underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 5. Collect unique student IDs.
  const studentIds = [
    ...new Set(
      (links ?? []).map((link) => link.student_id)
    ),
  ];

  let assignedStudents: AssignedStudent[] = [];

  // 6. Retrieve the permitted student profiles.
  if (studentIds.length > 0) {
    const { data: students, error: studentsError } =
      await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds)
        .eq("role", "student");

    if (studentsError) {
      console.error(
        "Unable to load student profiles:",
        studentsError.message
      );

      return (
        <main className="min-h-screen bg-zinc-100 px-4 py-10">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900">
              My Students
            </h1>

            <p role="alert" className="mt-4 text-red-600">
              Unable to load student profiles.
            </p>

            <Link
              href="/tutor/dashboard"
              className="mt-5 inline-block text-blue-600 hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      );
    }

    // 7. Connect profiles to their assignments.
    const studentsById = new Map(
      (students ?? []).map((student) => [
        student.id,
        student,
      ])
    );

    assignedStudents = (links ?? []).flatMap((link) => {
      const student = studentsById.get(link.student_id);

      if (!student) {
        return [];
      }

      return [
        {
          id: student.id,
          full_name: student.full_name,
          assignedAt: link.created_at,
        },
      ];
    });
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // 8. Display the assigned students.
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Students
            </h1>

            <p className="mt-2 text-zinc-600">
              View the students assigned to you.
            </p>
          </div>

          <Link
            href="/tutor/dashboard"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Dashboard
          </Link>
        </div>

        {/* Assigned students counter */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">
            Assigned Students
          </p>

          <p className="mt-3 text-4xl font-bold text-blue-600">
            {assignedStudents.length}
          </p>
        </section>

        {/* Student list */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Student List
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Only students assigned to your Tutor account
            are displayed.
          </p>

          {assignedStudents.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
              <h3 className="font-semibold text-zinc-900">
                No students assigned yet
              </h3>

              <p className="mt-2 text-sm text-zinc-600">
                Students assigned to your account will
                appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {assignedStudents.map((student) => (
                <article
                  key={student.id}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">
                        {student.full_name?.trim() ||
                          "Unnamed student"}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-500">
                        Assigned on:{" "}
                        {formatDate(student.assignedAt)}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Assigned Student
                    </span>
                  </div>

                  {/* View Results button */}
            {/* Student action buttons */}
<div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row">
  <Link
    href={`/tutor/students/${student.id}/results`}
    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
  >
    View Results →
  </Link>

  <Link
    href={`/tutor/students/${student.id}/weaknesses`}
    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-600 px-5 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 sm:w-auto"
  >
    View Weaknesses →
  </Link>
</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
