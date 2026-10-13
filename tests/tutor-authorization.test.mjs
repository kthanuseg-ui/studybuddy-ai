
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

test("Tutor can only read assigned student profiles", async () => {
  const requiredVariables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "TEST_TUTOR_EMAIL",
    "TEST_TUTOR_PASSWORD",
    "TEST_UNASSIGNED_STUDENT_EMAIL",
    "TEST_UNASSIGNED_STUDENT_PASSWORD",
  ];

  for (const name of requiredVariables) {
    assert.ok(
      process.env[name],
      `Missing environment variable: ${name}`
    );
  }

  const tutorClient = makeClient();
  const studentClient = makeClient();

  try {
    // 1. Authenticate the Tutor.
    const { data: tutorAuth, error: tutorError } =
      await tutorClient.auth.signInWithPassword({
        email: process.env.TEST_TUTOR_EMAIL,
        password: process.env.TEST_TUTOR_PASSWORD,
      });

    assert.ifError(tutorError);
    assert.ok(tutorAuth.user, "Tutor login failed");

    // 2. Verify the Tutor role.
    const { data: tutorProfile, error: roleError } =
      await tutorClient
        .from("profiles")
        .select("role")
        .eq("id", tutorAuth.user.id)
        .single();

    assert.ifError(roleError);
    assert.equal(tutorProfile.role, "tutor");

    // 3. Get the assigned student's ID from our fixture.
    const { assignedStudentId } =
      await loadProjectFixture(tutorClient);

    // 4. Authenticate the unassigned test Student.
    const { data: studentAuth, error: studentError } =
      await studentClient.auth.signInWithPassword({
        email: process.env.TEST_UNASSIGNED_STUDENT_EMAIL,
        password: process.env.TEST_UNASSIGNED_STUDENT_PASSWORD,
      });

    assert.ifError(studentError);
    assert.ok(studentAuth.user, "Student login failed");

    const unassignedStudentId = studentAuth.user.id;

    // Confirm the test accounts are different.
    assert.notEqual(
      assignedStudentId,
      unassignedStudentId,
      "Test students must be different"
    );

    // 5. Tutor can read the assigned student's profile.
    const { data: allowed, error: allowedError } =
      await tutorClient
        .from("profiles")
        .select("id")
        .eq("id", assignedStudentId);

    assert.ifError(allowedError);
    assert.equal(
      allowed.length,
      1,
      "Assigned student must be accessible"
    );

    console.log(
      "PASS: Assigned student is accessible."
    );

    // 6. Tutor cannot read the unassigned student's profile.
    const { data: denied, error: deniedError } =
      await tutorClient
        .from("profiles")
        .select("id")
        .eq("id", unassignedStudentId);

    assert.ifError(deniedError);
    assert.equal(
      denied.length,
      0,
      "Unassigned student must not be accessible"
    );

    console.log(
      "PASS: Unassigned student is not accessible."
    );
  } finally {
    await Promise.all([
      tutorClient.auth.signOut({ scope: "local" }),
      studentClient.auth.signOut({ scope: "local" }),
    ]);
  }
});
