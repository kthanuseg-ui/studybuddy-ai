
import assert from "node:assert/strict";

// Shared identifiers for the current integration-test dataset.
// Database UUIDs will be discovered at runtime.
export const TEST_PROJECT_TITLE =
  "Introduction to Data Analysis";

export async function loadProjectFixture(tutorClient) {
  const {
    data: { user },
    error: authError,
  } = await tutorClient.auth.getUser();

  assert.ifError(authError);
  assert.ok(user, "Authenticated test Tutor required");

  const { data: project, error: projectError } =
    await tutorClient
      .from("projects")
      .select("id, tutor_id")
      .eq("tutor_id", user.id)
      .eq("title", TEST_PROJECT_TITLE)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

  assert.ifError(projectError);
  assert.ok(project, "Test project fixture not found");

  const { data: assignments, error: assignmentsError } =
    await tutorClient
      .from("project_assignments")
      .select("student_id")
      .eq("project_id", project.id);

  assert.ifError(assignmentsError);
  assert.equal(
    assignments.length,
    1,
    "Expected exactly one assigned test student"
  );

  const assignedStudentId = assignments[0].student_id;

  const { data: check, error: checkError } =
    await tutorClient
      .from("understanding_checks")
      .select("id")
      .eq("project_id", project.id)
      .eq("student_id", assignedStudentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

  assert.ifError(checkError);
  assert.ok(check, "Test analysis fixture not found");

  return {
    projectId: project.id,
    assignedStudentId,
    checkId: check.id,
  };
}
