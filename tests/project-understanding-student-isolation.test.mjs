
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadProjectFixture } from "./fixtures/project-understanding.mjs";

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function assertNoAccess(result, description) {
  if (result.error) {
    assert.equal(
      result.error.code,
      "42501",
      `${description}: ${result.error.message}`
    );
  } else {
    assert.equal(
      result.data?.length ?? 0,
      0,
      `${description}: unauthorized data was visible`
    );
  }

  console.log(`PASS: ${description}`);
}

test("Student One cannot access another student's project data", async () => {
  const requiredVariables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "TEST_TUTOR_EMAIL",
    "TEST_TUTOR_PASSWORD",
    "TEST_UNASSIGNED_STUDENT_EMAIL",
    "TEST_UNASSIGNED_STUDENT_PASSWORD",
  ];

  for (const name of requiredVariables) {
    assert.ok(process.env[name], `Missing variable: ${name}`);
  }

  const tutorClient = makeClient();
  const studentClient = makeClient();

  try {
    // Authenticate the test Tutor.
    const { data: tutorAuth, error: tutorError } =
      await tutorClient.auth.signInWithPassword({
        email: process.env.TEST_TUTOR_EMAIL,
        password: process.env.TEST_TUTOR_PASSWORD,
      });

    assert.ifError(tutorError);
    assert.ok(tutorAuth.user, "Tutor authentication failed");

    // Retrieve the project, assigned student and saved
    // analysis dynamically using our shared fixture.
    const {
      projectId,
      assignedStudentId,
      checkId,
    } = await loadProjectFixture(tutorClient);

    // Authenticate Student One.
    const { data: studentAuth, error: studentError } =
      await studentClient.auth.signInWithPassword({
        email: process.env.TEST_UNASSIGNED_STUDENT_EMAIL,
        password: process.env.TEST_UNASSIGNED_STUDENT_PASSWORD,
      });

    assert.ifError(studentError);
    assert.ok(studentAuth.user, "Student authentication failed");

    // Confirm the account has the Student role.
    const { data: studentProfile, error: profileError } =
      await studentClient
        .from("profiles")
        .select("role")
        .eq("id", studentAuth.user.id)
        .single();

    assert.ifError(profileError);
    assert.equal(studentProfile.role, "student");

    // Ensure this is not the student assigned to the project.
    assert.notEqual(
      studentAuth.user.id,
      assignedStudentId,
      "The unassigned test account must be different"
    );

    // Test 1: The unassigned Student cannot read the project.
    const projectResult = await studentClient
      .from("projects")
      .select("id")
      .eq("id", projectId);

    assertNoAccess(
      projectResult,
      "Student One cannot read the project"
    );

    // Test 2: The unassigned Student cannot read its assignment.
    const assignmentResult = await studentClient
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId);

    assertNoAccess(
      assignmentResult,
      "Student One cannot read the project assignment"
    );

    // Test 3: The unassigned Student cannot read the AI analysis.
    const analysisResult = await studentClient
      .from("understanding_checks")
      .select("id")
      .eq("id", checkId);

    assertNoAccess(
      analysisResult,
      "Student One cannot read Student Two AI analysis"
    );
  } finally {
    await Promise.all([
      tutorClient.auth.signOut({ scope: "local" }),
      studentClient.auth.signOut({ scope: "local" }),
    ]);
  }
});
