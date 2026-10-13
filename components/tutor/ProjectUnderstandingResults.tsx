
import { createClient } from "@/utils/supabase/server";

type Props = {
  projectId: string;
};

type PointCategoryProps = {
  title: string;
  points: unknown;
  tone: "green" | "amber" | "red";
};

function PointCategory({
  title,
  points,
  tone,
}: PointCategoryProps) {
  const validPoints = Array.isArray(points)
    ? points.filter(
        (point): point is string =>
          typeof point === "string" && point.trim().length > 0
      )
    : [];

  const styles = {
    green: "border-green-200 bg-green-50 text-green-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`rounded-lg border p-4 ${styles[tone]}`}>
      <h6 className="font-semibold">{title}</h6>

      {validPoints.length > 0 ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {validPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm">
          No points identified.
        </p>
      )}
    </div>
  );
}

export default async function ProjectUnderstandingResults({
  projectId,
}: Props) {
  const supabase = await createClient();

  // The parent page verifies the Tutor role.
  // RLS additionally restricts which checks this Tutor can read.
  const { data: checks, error: checksError } =
    await supabase
      .from("understanding_checks")

.select("id, student_id, student_understanding, ai_summary, understood_points, missing_points, misunderstood_points, created_at")

      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

  if (checksError) {
    console.error(
      "Unable to load project understanding checks:",
      checksError.message
    );

    return (
      <section className="mt-6 border-t border-zinc-200 pt-5">
        <h4 className="font-semibold text-zinc-900">
          Understanding Checks
        </h4>

        <p role="alert" className="mt-3 text-sm text-red-600">
          Unable to load student analyses.
        </p>
      </section>
    );
  }

  // Retrieve names of students whose checks are visible.
  const studentIds = [
    ...new Set(
      (checks ?? []).map((check) => check.student_id)
    ),
  ];

  const studentNames = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: students, error: studentsError } =
      await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds);

    if (studentsError) {
      console.error(
        "Unable to load student names:",
        studentsError.message
      );
    }

    for (const student of students ?? []) {
      studentNames.set(
        student.id,
        student.full_name?.trim() || "Unnamed Student"
      );
    }
  }

  return (
    <section className="mt-6 border-t border-zinc-200 pt-5">
      <h4 className="text-lg font-semibold text-zinc-900">
        Understanding Checks
      </h4>

      <p className="mt-2 text-sm text-zinc-600">
        Review student explanations and AI-generated feedback.
      </p>

      {!checks || checks.length === 0 ? (
        <p className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          No understanding checks submitted yet.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {checks.map((check) => (
            <article
              key={check.id}
              className="space-y-4 rounded-xl border border-zinc-200 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h5 className="text-lg font-semibold text-zinc-900">
                  {studentNames.get(check.student_id) ||
                    "Student"}
                </h5>

                <p className="text-xs text-zinc-500">
                  Submitted:{" "}
                  {new Date(check.created_at).toLocaleString(
                    "en-US",
                    {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }
                  )}{" "}
                  UTC
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4">
                <h6 className="font-semibold text-zinc-900">
                  Student Explanation
                </h6>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
                  {check.student_understanding}
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h6 className="font-semibold text-blue-950">
                  AI Summary
                </h6>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-blue-900">
                  {check.ai_summary ||
                    "No AI summary available."}
                </p>
              </div>

              <PointCategory
                title="Understood Points"
                points={check.understood_points}
                tone="green"
              />

              <PointCategory
                title="Missing Points"
                points={check.missing_points}
                tone="amber"
              />

              <PointCategory
                title="Misunderstood Points"
                points={check.misunderstood_points}
                tone="red"
              />

              <p className="text-xs text-zinc-500">
                AI-generated feedback is advisory and should
                be reviewed by the Tutor.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
