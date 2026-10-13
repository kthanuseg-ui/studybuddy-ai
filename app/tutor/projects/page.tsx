import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import CreateProjectForm from "@/components/tutor/CreateProjectForm";
import AssignProjectStudent from "@/components/tutor/AssignProjectStudent";
import ProjectUnderstandingResults from "@/components/tutor/ProjectUnderstandingResults";

export const dynamic = "force-dynamic";

export default async function TutorProjectsPage() {
  const supabase = await createClient();

  // 1. Identify the authenticated user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <p className="text-red-600">
          Please sign in to access your projects.
        </p>
        <Link href="/login" className="text-blue-600">
          Sign in
        </Link>
      </main>
    );
  }

  // 2. Verify the Tutor role.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "tutor") {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <h1 className="text-2xl font-bold">
          Access denied
        </h1>
        <p className="mt-3">
          Only Tutors can access this page.
        </p>
      </main>
    );
  }

  // 3. Retrieve projects owned by this Tutor.
  const { data: projects, error: projectsError } =
    await supabase
      .from("projects")
      .select(
        "id, title, description, expected_outcomes, deadline, created_at"
      )
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              My Projects
            </h1>

            <p className="mt-3 text-zinc-600">
              Create and manage projects for your students.
            </p>
          </div>

          <Link
            href="/tutor/dashboard"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800"
          >
            Tutor Dashboard
          </Link>
        </div>
<CreateProjectForm />
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Your Projects
          </h2>

          {projectsError ? (
            <p role="alert" className="mt-5 text-red-600">
              Unable to load projects.
            </p>
          ) : !projects || projects.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
              <p className="font-medium text-zinc-700">
                No projects created yet.
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Your projects will appear here once created.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-xl border border-zinc-200 p-5"
                >
                  <h3 className="text-lg font-semibold text-zinc-900">
                    {project.title}
                  </h3>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">
                    {project.description}
                  </p>

                  <h4 className="mt-4 font-semibold text-zinc-800">
                    Expected Outcomes
                  </h4>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">
                    {project.expected_outcomes}
                  </p>

                  {project.deadline && (
                    <p className="mt-4 text-sm text-zinc-500">
                      Deadline:{" "}
                      {new Date(
                        project.deadline
                      ).toLocaleDateString("en-US")}
                    </p>
                  )}
                  <AssignProjectStudent projectId={project.id} />
                  <ProjectUnderstandingResults projectId={project.id} />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}