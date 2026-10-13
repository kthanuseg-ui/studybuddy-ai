
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ProjectUnderstandingForm from "@/components/student/ProjectUnderstandingForm";

export const dynamic = "force-dynamic";

type Project = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
};

export default async function StudentProjectsPage() {
  const supabase = await createClient();

  // 1. Identify the authenticated student.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          Authentication required
        </h1>
        <p className="mt-3 text-zinc-600">
          Please sign in to access your projects.
        </p>
      </main>
    );
  }

  // 2. Verify the Student role.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "student") {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          Access denied
        </h1>
        <p className="mt-3 text-zinc-600">
          Only Students can access this page.
        </p>
      </main>
    );
  }

  // 3. Load the student's project assignments.
  const { data: assignments, error: assignmentsError } =
    await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("student_id", user.id);

  let projects: Project[] = [];
  let loadingError = assignmentsError?.message ?? "";

  // 4. Retrieve only the assigned projects.
  if (!loadingError && assignments && assignments.length > 0) {
    const projectIds = assignments.map(
      (assignment) => assignment.project_id
    );

    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, deadline")
      .in("id", projectIds)
      .order("created_at", { ascending: false });

    if (error) {
      loadingError = error.message;
    } else {
      projects = data ?? [];
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Projects
            </h1>

            <p className="mt-3 text-zinc-600">
              Explore projects assigned by your Tutor.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Student Dashboard
          </Link>
        </header>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Assigned Projects
          </h2>

          {loadingError ? (
            <p role="alert" className="mt-5 text-red-600">
              Unable to load assigned projects.
            </p>
          ) : projects.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
              <p className="font-medium text-zinc-700">
                No projects assigned yet.
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Your Tutor&apos;s projects will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <h3 className="text-xl font-semibold text-zinc-900">
                    {project.title}
                  </h3>

                  <h4 className="mt-4 text-sm font-semibold text-zinc-800">
                    Project Instructions
                  </h4>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                    {project.description}
                  </p>

                  {project.deadline && (
                    <p className="mt-4 text-sm text-zinc-500">
                      Deadline:{" "}
                      {new Date(
                        project.deadline
                      ).toLocaleDateString("en-US")}
                    </p>
                  )}

                 <ProjectUnderstandingForm projectId={project.id} />

                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
