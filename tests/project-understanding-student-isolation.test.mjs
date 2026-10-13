
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const studentOneId = "1a257f85-7fb2-4f2d-ac0e-4ecee13260b8";
const studentTwoId = "2f741cc3-5166-41c8-95e9-4319aa47ff13";

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
      result.data?.length,
      0,
      `${description}: unauthorized data was visible`
    );
  }

  console.log(`PASS: ${description}`);
}

test("Student One cannot access Student Two project data", async () => {
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
    // Authenticate Tutor Thanu.
    const { data: tutorAuth, error: tutorError } =
      await tutorClient.auth.signInWithPassword({
        email: process.env.TEST_TUTOR_EMAIL,
        password: process.env.TEST_TUTOR_PASSWORD,
      });

    assert.ifError(tutorError);
    assert.ok(tutorAuth.user, "Tutor authentication failed");

    // Find the real test project.
    const { data: project, error: projectError } =
      await tutorClient
        .from("projects")
        .select("id")
        .eq("tutor_id", tutorAuth.user.id)
        .eq("title", "Introduction to Data Analysis")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    assert.ifError(projectError);
    assert.ok(project, "Test project not found");

    // Find Student Two's saved analysis.
    const { data: check, error: checkError } =
      await tutorClient
        .from("understanding_checks")
        .select("id")
        .eq("project_id", project.id)
        .eq("student_id", studentTwoId)
        .limit(1)
        .single();

    assert.ifError(checkError);
    assert.ok(check, "Student Two analysis not found");

    // Authenticate Student One using their own session.
    const { data: studentAuth, error: studentError } =
      await studentClient.auth.signInWithPassword({
        email: process.env.TEST_UNASSIGNED_STUDENT_EMAIL,
        password: process.env.TEST_UNASSIGNED_STUDENT_PASSWORD,
      });

    assert.ifError(studentError);
    assert.ok(studentAuth.user, "Student One login failed");

    // Ensure we are testing the intended account.
    assert.equal(
      studentAuth.user.id,
      studentOneId,
      "The test account is not Student One"
    );

    // Test 1: Student One cannot read the project.
    const projectResult = await studentClient
      .from("projects")
      .select("id")
      .eq("id", project.id);

    assertNoAccess(projectResult, "Student One cannot read the project");

    // Test 2: Student One cannot read its assignment.
    const assignmentResult = await studentClient
      .from("project_assignments")
      .select("id")
      .eq("project_id", project.id);

    assertNoAccess(
      assignmentResult,
      "Student One cannot read the project assignment"
    );

    // Test 3: Student One cannot read Student Two's AI analysis.
    const analysisResult = await studentClient
      .from("understanding_checks")
      .select("id")
      .eq("id", check.id);

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
