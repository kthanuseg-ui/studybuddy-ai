
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// Existing test students in the Supabase database.
const assignedStudentId = "2f741cc3-5166-41c8-95e9-4319aa47ff13";
const unassignedStudentId = "1a257f85-7fb2-4f2d-ac0e-4ecee13260b8";

test("Tutor can only read assigned student profiles", async () => {
  const requiredVariables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "TEST_TUTOR_EMAIL",
    "TEST_TUTOR_PASSWORD",
  ];

  for (const name of requiredVariables) {
    assert.ok(process.env[name], `Missing environment variable: ${name}`);
  }

  // Use the public key and a real Tutor session.
  // Never use the Supabase secret/service-role key for this test.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_TUTOR_EMAIL,
      password: process.env.TEST_TUTOR_PASSWORD,
    });

  assert.ifError(authError);
  assert.ok(authData.user, "Tutor login failed");

  try {
    // Confirm that the test account really has the Tutor role.
    const { data: tutorProfile, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    assert.ifError(roleError);
    assert.equal(tutorProfile.role, "tutor");

    // Thanu must be able to read Student Two.
    const { data: allowed, error: allowedError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedStudentId);

    assert.ifError(allowedError);
    assert.equal(allowed.length, 1);

    // Thanu must NOT be able to read student1.
    const { data: denied, error: deniedError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", unassignedStudentId);

    assert.ifError(deniedError);
    assert.equal(denied.length, 0);

       console.log("PASS: Assigned student is accessible.");
    console.log("PASS: Unassigned student is not accessible.");
  } finally {
    // Sign out only this test session.
    // Do not disconnect the Tutor's other active sessions.
    await supabase.auth.signOut({ scope: "local" });
  }
});